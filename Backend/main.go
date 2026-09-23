package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"menu-backend/config"
	"menu-backend/db"
	"menu-backend/db/sqlc"
	"menu-backend/delivery/http/router"
	"menu-backend/internal/ws"
	"menu-backend/repository"
	"menu-backend/usecase"
)

func main() {
	log.Println("🚀 Initializing Azai Restaurant Menu Backend API...")

	// 1. Load Configuration
	cfg, err := config.LoadConfig(".")
	if err != nil {
		log.Fatalf("❌ Failed to load configuration: %v", err)
	}
	log.Printf("⚙️ Configuration loaded (Environment: %s, Port: %s)", cfg.Environment, cfg.ServerPort)

	// 2. Initialize PostgreSQL Pool (Supabase)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := db.NewPostgresPool(ctx, cfg.DBUrl)
	if err != nil {
		log.Fatalf("❌ Failed to initialize database connection: %v", err)
	}
	defer pool.Close()

	// 3. Initialize SQLC Querier
	queries := sqlc.New(pool)

	// 4. Initialize Multi-Tenant WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()
	log.Println("🔌 Real-time WebSocket KDS Hub running")

	// 5. Initialize Repositories (Data Layer)
	tenantRepo := repository.NewTenantRepository(queries)
	menuRepo := repository.NewMenuRepository(queries)
	tableRepo := repository.NewTableRepository(queries)
	orderRepo := repository.NewOrderRepository(pool, queries)
	uploadRepo := repository.NewCloudinaryUploadRepository(cfg)

	// 6. Initialize Usecases (Business Rules Layer)
	tenantUsecase := usecase.NewTenantUsecase(tenantRepo)
	menuUsecase := usecase.NewMenuUsecase(tenantRepo, menuRepo)
	tableUsecase := usecase.NewTableUsecase(tableRepo, cfg.QRSecretKey)
	orderUsecase := usecase.NewOrderUsecase(orderRepo, tenantRepo, tableRepo, menuRepo, cfg.QRSecretKey)
	uploadUsecase := usecase.NewUploadUsecase(tenantRepo, uploadRepo)

	// 7. Initialize Delivery Router (Gin HTTP Server)
	r := router.SetupRouter(router.RouterDependencies{
		Config:        cfg,
		TenantUsecase: tenantUsecase,
		MenuUsecase:   menuUsecase,
		OrderUsecase:  orderUsecase,
		TableUsecase:  tableUsecase,
		UploadUsecase: uploadUsecase,
		Hub:           hub,
		Queries:       queries,
		Pool:          pool,
	})

	// 8. Start HTTP Server with Graceful Shutdown
	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.ServerPort),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("🍽️ Azai Restaurant API listening on port %s", cfg.ServerPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Server failed to start: %v", err)
		}
	}()

	// Graceful Shutdown on SIGINT (Ctrl+C) or SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("⏳ Shutting down server gracefully...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("❌ Server forced to shutdown: %v", err)
	}

	log.Println("✅ Server exited cleanly. Goodbye!")
}
