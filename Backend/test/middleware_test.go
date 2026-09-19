package test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
	"menu-backend/internal/security"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestMiddleware_AuthValidAndInvalidTokens(t *testing.T) {
	jwtSecret := "test-secret-key-32-chars-length"
	tenantID := uuid.New()
	userID := uuid.New()

	r := gin.New()
	r.Use(middleware.AuthMiddleware(jwtSecret))
	r.GET("/test", func(c *gin.Context) {
		claimsID, ok := middleware.GetTenantIDFromContext(c)
		if !ok || claimsID != tenantID {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "tenant id missing"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// 1. Missing Authorization Header
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for missing header, got %d", w.Code)
	}

	// 2. Malformed Header (No Bearer)
	req = httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Basic 12345")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for malformed header, got %d", w.Code)
	}

	// 3. Valid Token
	token, _ := security.GenerateJWT(userID, tenantID, "owner", jwtSecret, time.Hour)
	req = httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid token, got %d: %s", w.Code, w.Body.String())
	}
}

func TestMiddleware_CrossTenantDataIsolation(t *testing.T) {
	jwtSecret := "test-secret-key-32-chars-length"
	restaurantA := uuid.New()
	restaurantB := uuid.New()
	userID := uuid.New()

	r := gin.New()
	// Simulate route scoped to restaurant B
	r.Use(func(c *gin.Context) {
		c.Set(middleware.TenantIDContextKey, restaurantB)
		c.Next()
	})
	r.Use(middleware.AuthMiddleware(jwtSecret))
	r.GET("/admin/data", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": "secret"})
	})

	// User from Restaurant A tries to access Restaurant B's route
	tokenA, _ := security.GenerateJWT(userID, restaurantA, "owner", jwtSecret, time.Hour)
	req := httptest.NewRequest(http.MethodGet, "/admin/data", nil)
	req.Header.Set("Authorization", "Bearer "+tokenA)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("SECURITY VULNERABILITY: Cross-tenant access succeeded! Expected 403, got %d", w.Code)
	}

	// Super admin bypasses
	superToken, _ := security.GenerateJWT(userID, restaurantA, "super_admin", jwtSecret, time.Hour)
	req = httptest.NewRequest(http.MethodGet, "/admin/data", nil)
	req.Header.Set("Authorization", "Bearer "+superToken)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected super_admin to have multi-tenant bypass access, got %d", w.Code)
	}
}

func TestMiddleware_RequireVIPPlan(t *testing.T) {
	// 1. Customer Context with Standard Plan -> Rejected
	rStandard := gin.New()
	rStandard.Use(func(c *gin.Context) {
		c.Set(middleware.TenantContextKey, &domain.Tenant{
			ID:   uuid.New(),
			Plan: domain.PlanStandard,
		})
		c.Next()
	})
	rStandard.Use(middleware.RequireVIPPlan(&mockTenantUsecase{hasVIP: false}))
	rStandard.GET("/orders", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/orders", nil)
	w := httptest.NewRecorder()
	rStandard.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 UPGRADE_REQUIRED for Standard plan, got %d", w.Code)
	}

	// 2. Customer Context with VIP Plan -> Allowed
	rVIP := gin.New()
	rVIP.Use(func(c *gin.Context) {
		c.Set(middleware.TenantContextKey, &domain.Tenant{
			ID:   uuid.New(),
			Plan: domain.PlanVIP,
		})
		c.Next()
	})
	rVIP.Use(middleware.RequireVIPPlan(&mockTenantUsecase{hasVIP: true}))
	rVIP.GET("/orders", func(c *gin.Context) { c.Status(http.StatusOK) })

	req = httptest.NewRequest(http.MethodGet, "/orders", nil)
	w = httptest.NewRecorder()
	rVIP.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for VIP plan, got %d", w.Code)
	}

	// 3. Admin Context with VIP tenant ID -> Allowed
	rAdminVIP := gin.New()
	rAdminVIP.Use(func(c *gin.Context) {
		c.Set(middleware.TenantIDContextKey, uuid.New())
		c.Next()
	})
	rAdminVIP.Use(middleware.RequireVIPPlan(&mockTenantUsecase{hasVIP: true}))
	rAdminVIP.GET("/admin/orders", func(c *gin.Context) { c.Status(http.StatusOK) })

	req = httptest.NewRequest(http.MethodGet, "/admin/orders", nil)
	w = httptest.NewRecorder()
	rAdminVIP.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for Admin with VIP license, got %d", w.Code)
	}
}

func TestMiddleware_RequireRole_RBAC(t *testing.T) {
	jwtSecret := "test-secret-key-32-chars-length"
	tenantID := uuid.New()
	userID := uuid.New()

	r := gin.New()
	r.Use(middleware.AuthMiddleware(jwtSecret))
	r.DELETE("/admin/items/123", middleware.RequireRole("manager", "owner"), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// Waiter cannot delete items
	waiterToken, _ := security.GenerateJWT(userID, tenantID, "waiter", jwtSecret, time.Hour)
	req := httptest.NewRequest(http.MethodDelete, "/admin/items/123", nil)
	req.Header.Set("Authorization", "Bearer "+waiterToken)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for waiter role, got %d", w.Code)
	}

	// Owner can delete items
	ownerToken, _ := security.GenerateJWT(userID, tenantID, "owner", jwtSecret, time.Hour)
	req = httptest.NewRequest(http.MethodDelete, "/admin/items/123", nil)
	req.Header.Set("Authorization", "Bearer "+ownerToken)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for owner role, got %d", w.Code)
	}
}
