package router

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"menu-backend/config"
	"menu-backend/delivery/http/controller"
	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
	"menu-backend/internal/ws"
)

type RouterDependencies struct {
	Config         *config.Config
	TenantUsecase  domain.TenantUsecase
	MenuUsecase    domain.MenuUsecase
	OrderUsecase   domain.OrderUsecase
	TableUsecase   domain.TableUsecase
	UploadUsecase  domain.UploadUsecase
	StaffUsecase   domain.StaffUsecase
	BillUsecase    domain.BillUsecase
	ProblemUsecase domain.ProblemUsecase
	ReportUsecase  domain.ReportUsecase
	PushRepo       domain.PushRepository
	// Notifier sends targeted alerts (live screens, plus web push when it is on); defaults to the hub
	Notifier domain.Notifier
	Hub      *ws.Hub
	Pool     *pgxpool.Pool
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

		// Live menu updates for customers' menu pages (all plans, no login, receives public events only)
		menuSocketLimiter := middleware.NewRateLimiter(30, 1*time.Minute) // 30 connections per min per IP
		r.GET("/ws/menu/:slug", menuSocketLimiter.Limit(), ws.ServeMenuWS(deps.Hub, deps.TenantUsecase))
	}

	// Initialize In-Memory Rate Limiters (Automatic Stale Memory Eviction)
	authLimiter := middleware.NewRateLimiter(15, 1*time.Minute)   // 15 login attempts per min
	orderLimiter := middleware.NewRateLimiter(40, 1*time.Minute)  // 40 order submits per min
	uploadLimiter := middleware.NewRateLimiter(30, 1*time.Minute) // 30 signature requests per min

	// Initialize Controllers
	menuCtrl := controller.NewMenuController(deps.MenuUsecase, deps.OrderUsecase, deps.Hub)
	tableCtrl := controller.NewTableController(deps.TableUsecase, deps.TenantUsecase, deps.BillUsecase)
	var notifier domain.Notifier = deps.Notifier
	if notifier == nil && deps.Hub != nil {
		notifier = deps.Hub
	}
	orderCtrl := controller.NewOrderController(deps.OrderUsecase, deps.BillUsecase, deps.Hub, notifier)
	problemCtrl := controller.NewProblemController(deps.ProblemUsecase, deps.ReportUsecase, deps.PushRepo, deps.Config.VAPIDPublicKey)
	billCtrl := controller.NewBillController(deps.BillUsecase, deps.Config.QRSecretKey)
	tenantCtrl := controller.NewTenantController(deps.TenantUsecase, deps.Hub)
	authCtrl := controller.NewAuthController(deps.StaffUsecase, deps.Config.JWTSecret)
	staffCtrl := controller.NewStaffController(deps.StaffUsecase)
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
			orderRoutes.Use(middleware.RequirePlan(deps.TenantUsecase, domain.PlanPlus))
			{
				orderRoutes.POST("", orderLimiter.Limit(), orderCtrl.PlaceOrder)
				orderRoutes.GET("/:id", orderCtrl.GetOrder)
				orderRoutes.POST("/:id/undo", orderCtrl.UndoOrder)
			}

			// 4. "Ask for the bill" (Pro plan, proven by the table QR token)
			menuRoutes.POST("/bills/request", middleware.RequirePlan(deps.TenantUsecase, domain.PlanPro), orderLimiter.Limit(), billCtrl.RequestBillByCustomer)
		}

		// -------------------------------------------------------------
		// AZAI TEAM ROUTES (super_admin only, across all restaurants)
		// -------------------------------------------------------------
		superAdminRoutes := apiV1.Group("/superadmin")
		superAdminRoutes.Use(
			middleware.AuthMiddleware(deps.Config.JWTSecret),
			middleware.RequireActiveStaff(deps.StaffUsecase),
			middleware.RequireRole(domain.RoleSuperAdmin),
		)
		{
			superAdminRoutes.GET("/plans", tenantCtrl.ListPlans)
			superAdminRoutes.PATCH("/tenants/:id/plan", tenantCtrl.SetTenantPlan)
		}

		// -------------------------------------------------------------
		// STAFF / KITCHEN / ADMIN ROUTES (Protected by JWT Auth & RBAC)
		// -------------------------------------------------------------
		manager := middleware.RequireRole(domain.RoleManager)
		allStaff := middleware.RequireRole(domain.RoleManager, domain.RoleCashier, domain.RoleWaiter, domain.RoleChef)

		adminRoutes := apiV1.Group("/admin")
		adminRoutes.Use(middleware.AuthMiddleware(deps.Config.JWTSecret), middleware.RequireActiveStaff(deps.StaffUsecase))
		{
			// Restaurant Profile, Theme Customization & Plan Change
			adminRoutes.GET("/tenant", allStaff, tenantCtrl.GetTenantProfile)
			adminRoutes.PATCH("/tenant/theme", manager, tenantCtrl.UpdateTheme)
			adminRoutes.PATCH("/tenant/plan", middleware.RequireRole(domain.RoleSuperAdmin), tenantCtrl.UpdatePlan)
			adminRoutes.PATCH("/tenant/settings", middleware.RequirePlan(deps.TenantUsecase, domain.PlanPro), manager, tenantCtrl.UpdateSettings)

			// Kitchen Display System (KDS) live orders (Plus plan or higher)
			kdsRoutes := adminRoutes.Group("")
			kdsRoutes.Use(middleware.RequirePlan(deps.TenantUsecase, domain.PlanPlus))
			{
				kdsRoutes.GET("/orders", middleware.RequireRole(domain.RoleChef, domain.RoleManager), orderCtrl.ListActiveOrders)
				kdsRoutes.PATCH("/orders/:id/status", middleware.RequireRole(domain.RoleChef, domain.RoleManager, domain.RoleWaiter), orderCtrl.UpdateOrderStatus)
				kdsRoutes.DELETE("/orders/table/:number", middleware.RequireRole(domain.RoleChef, domain.RoleManager), orderCtrl.CancelTableOrders)
				kdsRoutes.DELETE("/orders", middleware.RequireRole(domain.RoleChef, domain.RoleManager), orderCtrl.CancelAllActiveOrders)
			}

			// Waiters' tables (Pro plan)
			proRoutes := adminRoutes.Group("")
			proRoutes.Use(middleware.RequirePlan(deps.TenantUsecase, domain.PlanPro))
			{
				proRoutes.GET("/my-tables", middleware.RequireRole(domain.RoleWaiter, domain.RoleManager), orderCtrl.MyTables)
				proRoutes.PATCH("/tables/:id/waiter", manager, tableCtrl.AssignWaiter)

				// Bills: waiters collect, cashiers confirm, managers do everything
				waiter := middleware.RequireRole(domain.RoleWaiter, domain.RoleManager)
				proRoutes.GET("/bills", middleware.RequireRole(domain.RoleWaiter, domain.RoleCashier, domain.RoleManager), billCtrl.ListBills)
				proRoutes.POST("/bills/:id/request", waiter, billCtrl.RequestBill)
				proRoutes.POST("/bills/:id/collect", waiter, billCtrl.Collect)
				proRoutes.POST("/bills/:id/confirm", middleware.RequireRole(domain.RoleCashier, domain.RoleManager), billCtrl.Confirm)
				proRoutes.POST("/bills/:id/move", waiter, billCtrl.Move)
				proRoutes.POST("/bills/:id/handover", waiter, billCtrl.Handover)
				proRoutes.GET("/colleagues", waiter, staffCtrl.ListColleagues)

				// Problems with dishes and walkouts: waiters report, managers decide
				proRoutes.POST("/orders/:id/problems", waiter, problemCtrl.ReportProblem)
				proRoutes.POST("/problems/:id/decision", manager, problemCtrl.DecideProblem)
				proRoutes.POST("/bills/:id/walkout", waiter, problemCtrl.MarkWalkout)
				proRoutes.POST("/bills/:id/walkout-decision", manager, problemCtrl.DecideWalkout)
				proRoutes.GET("/decisions", manager, problemCtrl.Pending)

				// Reports
				proRoutes.GET("/reports/daily", manager, problemCtrl.DailyReport)
				proRoutes.GET("/reports/my-shift", middleware.RequireRole(domain.RoleWaiter, domain.RoleCashier), problemCtrl.MyShiftReport)

				// Web push for locked phones
				proRoutes.GET("/push/key", allStaff, problemCtrl.PushKey)
				proRoutes.POST("/push/subscribe", allStaff, problemCtrl.SubscribePush)

				// Shifts
				proRoutes.GET("/shifts/me", allStaff, billCtrl.MyShift)
				proRoutes.POST("/shifts/start", allStaff, billCtrl.StartShift)
				proRoutes.POST("/shifts/end", allStaff, billCtrl.EndShift)
			}

			// Staff accounts (Pro plan, managers only)
			staffRoutes := adminRoutes.Group("/staff")
			staffRoutes.Use(middleware.RequirePlan(deps.TenantUsecase, domain.PlanPro), manager)
			{
				staffRoutes.GET("", staffCtrl.ListStaff)
				staffRoutes.POST("", staffCtrl.CreateStaff)
				staffRoutes.PATCH("/:id", staffCtrl.UpdateStaff)
			}

			// Instant 86 / Sold-out toggle
			adminRoutes.PATCH("/items/:id/sold-out", middleware.RequireRole(domain.RoleChef, domain.RoleManager, domain.RoleWaiter), menuCtrl.ToggleSoldOut)

			// Menu Categories Management (CRUD)
			adminRoutes.GET("/categories", manager, menuCtrl.ListCategories)
			adminRoutes.POST("/categories", manager, menuCtrl.CreateCategory)
			adminRoutes.PUT("/categories/:id", manager, menuCtrl.UpdateCategory)
			adminRoutes.DELETE("/categories/:id", manager, menuCtrl.DeleteCategory)

			// Menu Items Management (CRUD)
			adminRoutes.POST("/items", manager, menuCtrl.CreateItem)
			adminRoutes.PUT("/items/:id", manager, menuCtrl.UpdateItem)
			adminRoutes.DELETE("/items/:id", manager, menuCtrl.DeleteItem)

			// Dining Tables Management & QR Link generation
			adminRoutes.GET("/tables", manager, tableCtrl.ListTables)
			adminRoutes.POST("/tables", manager, tableCtrl.CreateTable)
			adminRoutes.POST("/tables/qr", manager, tableCtrl.GenerateTableQR)

			// Cloudinary Secure Signed Direct Upload (Protected by Rate Limiter)
			adminRoutes.POST("/uploads/cloudinary-sign", uploadLimiter.Limit(), middleware.RequireRole(domain.RoleChef, domain.RoleManager), uploadCtrl.SignCloudinaryUpload)
		}
	}

	return r
}
