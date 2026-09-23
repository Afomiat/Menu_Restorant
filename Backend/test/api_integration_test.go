package test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/config"
	"menu-backend/delivery/http/router"
	"menu-backend/domain"
	"menu-backend/internal/security"
	"menu-backend/usecase"
)

type mockFullTenantUsecase struct {
	tenant *domain.Tenant
}

func (m *mockFullTenantUsecase) GetTenantBySlug(ctx context.Context, slug string) (*domain.Tenant, error) {
	return m.tenant, nil
}
func (m *mockFullTenantUsecase) GetTenantByID(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	return m.tenant, nil
}
func (m *mockFullTenantUsecase) UpdatePlan(ctx context.Context, id uuid.UUID, plan domain.PlanTier) error {
	m.tenant.Plan = plan
	return nil
}
func (m *mockFullTenantUsecase) UpdateTheme(ctx context.Context, id uuid.UUID, themeConfig map[string]interface{}) (*domain.Tenant, error) {
	m.tenant.ThemeConfig = themeConfig
	return m.tenant, nil
}
func (m *mockFullTenantUsecase) VerifyVIPAccess(ctx context.Context, tenantID uuid.UUID) (bool, error) {
	return m.tenant.HasVIPFeatures(), nil
}
func (m *mockFullTenantUsecase) ListActive(ctx context.Context) ([]domain.Tenant, error) {
	if m.tenant != nil {
		return []domain.Tenant{*m.tenant}, nil
	}
	return nil, nil
}

func setupTestRouter(tenant *domain.Tenant, qrSecret, jwtSecret string) (*gin.Engine, *domain.Order) {
	cfg := &config.Config{
		Environment: "test",
		QRSecretKey: qrSecret,
		JWTSecret:   jwtSecret,
		FrontendURL: "http://localhost:5173",
	}

	testOrder := &domain.Order{
		ID:                   uuid.New(),
		TenantID:             tenant.ID,
		TableNumber:          "4",
		CustomerSessionToken: "secret-session-abc",
		Status:               domain.StatusPendingGrace,
		TotalAmount:          480.00,
		GracePeriodEndsAt:    time.Now().Add(60 * time.Second),
		CreatedAt:            time.Now(),
	}

	tenantUc := &mockFullTenantUsecase{tenant: tenant}
	orderRepo := &mockOrderRepo{createdOrder: testOrder}
	tableRepo := &mockTableRepo{
		table: &domain.RestaurantTable{
			ID:          uuid.New(),
			TenantID:    tenant.ID,
			TableNumber: "4",
			IsActive:    true,
		},
	}
	menuRepo := &mockMenuRepo{
		item: &domain.MenuItem{
			ID:          uuid.New(),
			TenantID:    tenant.ID,
			Name:        "The Truffle Prime",
			Price:       480.00,
			IsAvailable: true,
		},
	}

	orderUc := usecase.NewOrderUsecase(orderRepo, &mockTenantRepo{tenant: tenant}, tableRepo, menuRepo, qrSecret)
	menuUc := usecase.NewMenuUsecase(&mockTenantRepo{tenant: tenant}, menuRepo)
	tableUc := usecase.NewTableUsecase(tableRepo, qrSecret)

	r := router.SetupRouter(router.RouterDependencies{
		Config:        cfg,
		TenantUsecase: tenantUc,
		MenuUsecase:   menuUc,
		OrderUsecase:  orderUc,
		TableUsecase:  tableUc,
		Hub:           nil,
		Queries:       nil,
	})

	return r, testOrder
}

func TestAPI_CustomerLiveOrderTracking(t *testing.T) {
	tenantID := uuid.New()
	slug := "azai-burger"
	qrSecret := "test-secret-key-32-chars-long"
	jwtSecret := "test-jwt-secret-32-chars-long"

	tenant := &domain.Tenant{
		ID:       tenantID,
		Slug:     slug,
		Name:     "Azai Burger",
		Plan:     domain.PlanVIP,
		IsActive: true,
	}

	r, testOrder := setupTestRouter(tenant, qrSecret, jwtSecret)

	// 1. Customer with valid session token tracks order -> SUCCESS
	req := httptest.NewRequest(http.MethodGet, "/api/v1/menus/"+slug+"/orders/"+testOrder.ID.String(), nil)
	req.Header.Set("X-Session-Token", testOrder.CustomerSessionToken)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid session token, got %d: %s", w.Code, w.Body.String())
	}

	// 2. Customer with unauthorized session token tracks order -> 403 FORBIDDEN
	req = httptest.NewRequest(http.MethodGet, "/api/v1/menus/"+slug+"/orders/"+testOrder.ID.String(), nil)
	req.Header.Set("X-Session-Token", "wrong-session-token")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for unauthorized session token, got %d", w.Code)
	}

	// 3. Customer with missing session token -> 401 UNAUTHORIZED
	req = httptest.NewRequest(http.MethodGet, "/api/v1/menus/"+slug+"/orders/"+testOrder.ID.String(), nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for missing session token, got %d", w.Code)
	}
}

func TestAPI_AdminUpgradeToVIP(t *testing.T) {
	tenantID := uuid.New()
	userID := uuid.New()
	slug := "bistro-test"
	qrSecret := "test-secret-key-32-chars-long"
	jwtSecret := "test-jwt-secret-32-chars-long"

	tenant := &domain.Tenant{
		ID:       tenantID,
		Slug:     slug,
		Name:     "Bistro Test",
		Plan:     domain.PlanStandard, // Starts on Standard
		IsActive: true,
	}

	r, _ := setupTestRouter(tenant, qrSecret, jwtSecret)

	ownerToken, _ := security.GenerateJWT(userID, tenantID, "owner", jwtSecret, time.Hour)
	superAdminToken, _ := security.GenerateJWT(userID, tenantID, "super_admin", jwtSecret, time.Hour)

	// 1. Security Check: Owner cannot self-upgrade restaurant to VIP (Privilege Escalation Prevention)
	body, _ := json.Marshal(map[string]string{"plan": "vip"})
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/tenant/plan", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+ownerToken)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for owner trying to self-upgrade plan, got %d: %s", w.Code, w.Body.String())
	}

	// 2. Super Admin can upgrade restaurant to VIP
	req = httptest.NewRequest(http.MethodPatch, "/api/v1/admin/tenant/plan", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+superAdminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for super_admin VIP upgrade, got %d: %s", w.Code, w.Body.String())
	}

	if tenant.Plan != domain.PlanVIP {
		t.Fatalf("expected tenant plan to be updated to VIP, got %s", tenant.Plan)
	}

	// 3. Kitchen staff attempts to upgrade plan -> 403 INSUFFICIENT PERMISSIONS
	kitchenToken, _ := security.GenerateJWT(userID, tenantID, "kitchen", jwtSecret, time.Hour)
	req = httptest.NewRequest(http.MethodPatch, "/api/v1/admin/tenant/plan", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+kitchenToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for kitchen role, got %d", w.Code)
	}
}
