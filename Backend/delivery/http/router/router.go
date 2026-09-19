package router

import (
	"net/http"

	"github.com/gin-gonic/gin"

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
	Hub           *ws.Hub
	Queries       *sqlc.Queries
}

// SetupRouter configures routes, middlewares, and CORS
func SetupRouter(deps RouterDependencies) *gin.Engine {
	if deps.Config.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORSMiddleware(deps.Config.FrontendURL))

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "azai-restaurant-menu-api",
		})
	})

	// Real-time Kitchen Display System WebSocket endpoint (STRICTLY VIP PLAN ONLY)
	if deps.Hub != nil {
		r.GET("/ws/kitchen", ws.ServeWS(deps.Hub, deps.TenantUsecase, deps.Config.JWTSecret))
	}

	// Initialize Controllers
	menuCtrl := controller.NewMenuController(deps.MenuUsecase, deps.Hub)
	tableCtrl := controller.NewTableController(deps.TableUsecase, deps.TenantUsecase)
	orderCtrl := controller.NewOrderController(deps.OrderUsecase, deps.Hub)
	tenantCtrl := controller.NewTenantController(deps.TenantUsecase)
	authCtrl := controller.NewAuthController(deps.Queries, deps.Config.JWTSecret)

	// API v1 Group
	apiV1 := r.Group("/api/v1")
	{
		// -------------------------------------------------------------
		// AUTH ROUTES
		// -------------------------------------------------------------
		apiV1.POST("/auth/login", authCtrl.Login)

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

			// 3. Smart Ordering (STRICTLY VIP PLAN ONLY)
			orderRoutes := menuRoutes.Group("/orders")
			orderRoutes.Use(middleware.RequireVIPPlan(deps.TenantUsecase))
			{
				orderRoutes.POST("", orderCtrl.PlaceOrder)
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
			adminRoutes.PATCH("/tenant/plan", middleware.RequireRole("owner", "super_admin"), tenantCtrl.UpdatePlan)

			// Kitchen Display System (KDS) live orders (STRICTLY VIP PLAN ONLY)
			kdsRoutes := adminRoutes.Group("")
			kdsRoutes.Use(middleware.RequireVIPPlan(deps.TenantUsecase))
			{
				kdsRoutes.GET("/orders", middleware.RequireRole("kitchen", "manager", "owner", "super_admin"), orderCtrl.ListActiveOrders)
				kdsRoutes.PATCH("/orders/:id/status", middleware.RequireRole("kitchen", "manager", "owner", "waiter", "super_admin"), orderCtrl.UpdateOrderStatus)
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
		}
	}

	return r
}
