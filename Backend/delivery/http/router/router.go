package router

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"menu-backend/config"
	"menu-backend/db/sqlc"
	"menu-backend/delivery/http/controller"
	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
	"menu-backend/internal/ws"
)

type RouterDependencies struct {
	Config        *config.Config
	TenantUsecase domain.TenantUsecase
	MenuUsecase   domain.MenuUsecase
	OrderUsecase  domain.OrderUsecase
	TableUsecase  domain.TableUsecase
	UploadUsecase domain.UploadUsecase
	Hub           *ws.Hub
	Queries       *sqlc.Queries
	Pool          *pgxpool.Pool
}

// SetupRouter configures routes, middlewares, security headers, rate limiters, and CORS
func SetupRouter(deps RouterDependencies) *gin.Engine {
	if deps.Config.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// Security & DoS Ceiling Middlewares
	r.Use(middleware.SecurityHeadersMiddleware())
	r.Use(middleware.MaxBodySizeMiddleware(2 << 20)) // 2MB max request payload
	r.Use(middleware.CORSMiddleware(deps.Config.FrontendURL))

	// Deep Health Check Endpoint (Validates HTTP + PostgreSQL Pool Liveness)
	r.GET("/health", func(c *gin.Context) {
		dbStatus := "connected"
		if deps.Pool != nil {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
			defer cancel()
			if err := deps.Pool.Ping(ctx); err != nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{
					"status":   "degraded",
					"service":  "azai-restaurant-menu-api",
					"database": "disconnected",
					"error":    "database health check failed",
				})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":   "healthy",
			"service":  "azai-restaurant-menu-api",
			"database": dbStatus,
			"time":     time.Now().UTC().Format(time.RFC3339),
		})
	})

	// Real-time Kitchen Display System WebSocket endpoint (STRICTLY VIP PLAN ONLY)
	if deps.Hub != nil {
		r.GET("/ws/kitchen", ws.ServeWS(deps.Hub, deps.TenantUsecase, deps.Config.JWTSecret))
	}

	// Initialize In-Memory Rate Limiters (Automatic Stale Memory Eviction)
	authLimiter := middleware.NewRateLimiter(15, 1*time.Minute)   // 15 login attempts per min
	orderLimiter := middleware.NewRateLimiter(40, 1*time.Minute)  // 40 order submits per min
	uploadLimiter := middleware.NewRateLimiter(30, 1*time.Minute) // 30 signature requests per min

	// Initialize Controllers
	menuCtrl := controller.NewMenuController(deps.MenuUsecase, deps.Hub)
	tableCtrl := controller.NewTableController(deps.TableUsecase, deps.TenantUsecase)
	orderCtrl := controller.NewOrderController(deps.OrderUsecase, deps.Hub)
	tenantCtrl := controller.NewTenantController(deps.TenantUsecase)
	authCtrl := controller.NewAuthController(deps.Queries, deps.Config.JWTSecret)
	uploadCtrl := controller.NewUploadController(deps.UploadUsecase)

	// API v1 Group
	apiV1 := r.Group("/api/v1")
	{
		// -------------------------------------------------------------
		// PUBLIC RESTAURANTS DIRECTORY (Active tenants discovery)
		// -------------------------------------------------------------
		apiV1.GET("/restaurants", tenantCtrl.ListPublicTenants)

		// -------------------------------------------------------------
		// AUTH ROUTES (Protected by brute-force rate limiter)
		// -------------------------------------------------------------
		apiV1.POST("/auth/login", authLimiter.Limit(), authCtrl.Login)

		// -------------------------------------------------------------
		// GUEST / CUSTOMER ROUTES (Scoped to restaurant slug)
		// -------------------------------------------------------------
		menuRoutes := apiV1.Group("/menus/:slug")
		menuRoutes.Use(middleware.TenantMiddleware(deps.TenantUsecase))
		{
			// 1. Digital Menu viewing (Available for both Standard & VIP tiers)
			menuRoutes.GET("", menuCtrl.GetFullMenu)

			// 2. Dine-in Table QR validation
			menuRoutes.GET("/tables/validate", tableCtrl.ValidateTable)

			// 3. Smart Ordering (STRICTLY VIP PLAN ONLY + Protected by Order Rate Limiter)
			orderRoutes := menuRoutes.Group("/orders")
			orderRoutes.Use(middleware.RequireVIPPlan(deps.TenantUsecase))
			{
				orderRoutes.POST("", orderLimiter.Limit(), orderCtrl.PlaceOrder)
				orderRoutes.GET("/:id", orderCtrl.GetOrder)
				orderRoutes.POST("/:id/undo", orderCtrl.UndoOrder)
			}
		}

		// -------------------------------------------------------------
		// STAFF / KITCHEN / ADMIN ROUTES (Protected by JWT Auth & RBAC)
		// -------------------------------------------------------------
		adminRoutes := apiV1.Group("/admin")
		adminRoutes.Use(middleware.AuthMiddleware(deps.Config.JWTSecret))
		{
			// Restaurant Profile, Theme Customization & VIP License Upgrade
			adminRoutes.GET("/tenant", middleware.RequireRole("manager", "owner", "super_admin"), tenantCtrl.GetTenantProfile)
			adminRoutes.PATCH("/tenant/theme", middleware.RequireRole("manager", "owner", "super_admin"), tenantCtrl.UpdateTheme)
			adminRoutes.PATCH("/tenant/plan", middleware.RequireRole("super_admin"), tenantCtrl.UpdatePlan)

			// Kitchen Display System (KDS) live orders (STRICTLY VIP PLAN ONLY)
			kdsRoutes := adminRoutes.Group("")
			kdsRoutes.Use(middleware.RequireVIPPlan(deps.TenantUsecase))
			{
				kdsRoutes.GET("/orders", middleware.RequireRole("kitchen", "manager", "owner", "super_admin"), orderCtrl.ListActiveOrders)
				kdsRoutes.PATCH("/orders/:id/status", middleware.RequireRole("kitchen", "manager", "owner", "waiter", "super_admin"), orderCtrl.UpdateOrderStatus)
				kdsRoutes.DELETE("/orders/table/:number", middleware.RequireRole("kitchen", "manager", "owner", "super_admin"), orderCtrl.CancelTableOrders)
				kdsRoutes.DELETE("/orders", middleware.RequireRole("kitchen", "manager", "owner", "super_admin"), orderCtrl.CancelAllActiveOrders)

			}

			// Instant 86 / Sold-out toggle
			adminRoutes.PATCH("/items/:id/sold-out", middleware.RequireRole("kitchen", "manager", "owner", "waiter", "super_admin"), menuCtrl.ToggleSoldOut)

			// Menu Categories Management (CRUD)
			adminRoutes.GET("/categories", middleware.RequireRole("manager", "owner", "super_admin"), menuCtrl.ListCategories)
			adminRoutes.POST("/categories", middleware.RequireRole("manager", "owner", "super_admin"), menuCtrl.CreateCategory)
			adminRoutes.PUT("/categories/:id", middleware.RequireRole("manager", "owner", "super_admin"), menuCtrl.UpdateCategory)
			adminRoutes.DELETE("/categories/:id", middleware.RequireRole("manager", "owner", "super_admin"), menuCtrl.DeleteCategory)

			// Menu Items Management (CRUD)
			adminRoutes.POST("/items", middleware.RequireRole("manager", "owner", "super_admin"), menuCtrl.CreateItem)
			adminRoutes.PUT("/items/:id", middleware.RequireRole("manager", "owner", "super_admin"), menuCtrl.UpdateItem)
			adminRoutes.DELETE("/items/:id", middleware.RequireRole("manager", "owner", "super_admin"), menuCtrl.DeleteItem)

			// Dining Tables Management & QR Link generation
			adminRoutes.GET("/tables", middleware.RequireRole("manager", "owner", "super_admin"), tableCtrl.ListTables)
			adminRoutes.POST("/tables", middleware.RequireRole("manager", "owner", "super_admin"), tableCtrl.CreateTable)
			adminRoutes.POST("/tables/qr", middleware.RequireRole("manager", "owner", "super_admin"), tableCtrl.GenerateTableQR)

			// Cloudinary Secure Signed Direct Upload (Protected by Rate Limiter)
			adminRoutes.POST("/uploads/cloudinary-sign", uploadLimiter.Limit(), middleware.RequireRole("kitchen", "manager", "owner", "super_admin"), uploadCtrl.SignCloudinaryUpload)
		}
	}

	return r
}
