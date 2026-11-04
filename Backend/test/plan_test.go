package test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
	"menu-backend/internal/security"
	"menu-backend/internal/ws"
	"menu-backend/usecase"
)

func TestPlanTier_AtLeast(t *testing.T) {
	cases := []struct {
		plan, min domain.PlanTier
		want      bool
	}{
		{domain.PlanBasic, domain.PlanBasic, true},
		{domain.PlanBasic, domain.PlanPlus, false},
		{domain.PlanPlus, domain.PlanPlus, true},
		{domain.PlanPlus, domain.PlanPro, false},
		{domain.PlanPro, domain.PlanPlus, true},
		{domain.PlanPro, domain.PlanPro, true},
		{domain.PlanTier("vip"), domain.PlanBasic, false},
		{domain.PlanTier(""), domain.PlanBasic, false},
	}
	for _, tc := range cases {
		if got := tc.plan.AtLeast(tc.min); got != tc.want {
			t.Errorf("%q.AtLeast(%q) = %v, want %v", tc.plan, tc.min, got, tc.want)
		}
	}
}

func TestPlanTier_Label(t *testing.T) {
	cases := map[domain.PlanTier]string{
		domain.PlanBasic:          "Basic",
		domain.PlanPlus:           "Plus",
		domain.PlanPro:            "Pro",
		domain.PlanTier("legacy"): "legacy",
	}
	for plan, want := range cases {
		if got := plan.Label(); got != want {
			t.Errorf("%q.Label() = %q, want %q", plan, got, want)
		}
	}
}

func TestTenantUsecase_VerifyPlanAccess(t *testing.T) {
	cases := []struct {
		plan, min domain.PlanTier
		want      bool
	}{
		{domain.PlanPro, domain.PlanPlus, true},
		{domain.PlanPlus, domain.PlanPlus, true},
		{domain.PlanBasic, domain.PlanPlus, false},
		{domain.PlanPlus, domain.PlanPro, false},
	}
	for _, tc := range cases {
		uc := usecase.NewTenantUsecase(&mockTenantRepo{tenant: &domain.Tenant{ID: uuid.New(), Plan: tc.plan}})
		got, err := uc.VerifyPlanAccess(context.Background(), uuid.New(), tc.min)
		if err != nil || got != tc.want {
			t.Errorf("plan %q, min %q: got %v (err %v), want %v", tc.plan, tc.min, got, err, tc.want)
		}
	}
}

func TestTenantUsecase_UpdatePlanValidatesPlan(t *testing.T) {
	uc := usecase.NewTenantUsecase(&mockTenantRepo{tenant: &domain.Tenant{ID: uuid.New()}})

	for _, plan := range []domain.PlanTier{domain.PlanBasic, domain.PlanPlus, domain.PlanPro} {
		if err := uc.UpdatePlan(context.Background(), uuid.New(), plan); err != nil {
			t.Errorf("expected %q to be accepted, got %v", plan, err)
		}
	}
	for _, plan := range []domain.PlanTier{"standard", "vip", "enterprise", ""} {
		if err := uc.UpdatePlan(context.Background(), uuid.New(), plan); !errors.Is(err, domain.ErrInvalidPlan) {
			t.Errorf("expected %q to be rejected with ErrInvalidPlan, got %v", plan, err)
		}
	}
}

func TestOrder_ProPlanCanOrder(t *testing.T) {
	tenantID := uuid.New()
	qrSecret := "test-secret-key-32-chars-abcdef"
	itemID := uuid.New()

	orderUc := usecase.NewOrderUsecase(
		&mockOrderRepo{},
		&mockTenantRepo{tenant: &domain.Tenant{ID: tenantID, Plan: domain.PlanPro}},
		&mockTableRepo{table: &domain.RestaurantTable{ID: uuid.New(), TenantID: tenantID, TableNumber: "5", IsActive: true}},
		&mockMenuRepo{item: &domain.MenuItem{ID: itemID, TenantID: tenantID, Name: "Tibs", Price: 300, IsAvailable: true}},
		qrSecret,
	)

	order, err := orderUc.PlaceOrder(context.Background(), domain.CreateOrderInput{
		TenantID:             tenantID,
		TableNumber:          "5",
		TableToken:           security.GenerateTableToken(tenantID.String(), "5", qrSecret),
		CustomerSessionToken: "session-xyz",
		Items:                []domain.CreateOrderItemInput{{MenuItemID: itemID, ItemName: "Tibs", Quantity: 1}},
	})
	if err != nil {
		t.Fatalf("expected a Pro restaurant to take orders, got %v", err)
	}
	if order.TotalAmount != 300 {
		t.Fatalf("expected total 300, got %.2f", order.TotalAmount)
	}
}

func TestMiddleware_RequirePlan_ProIncludesPlus(t *testing.T) {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(middleware.TenantContextKey, &domain.Tenant{ID: uuid.New(), Plan: domain.PlanPro})
		c.Next()
	})
	r.Use(middleware.RequirePlan(&mockTenantUsecase{}, domain.PlanPlus))
	r.GET("/orders", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/orders", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected Pro restaurant to pass a Plus check, got %d", w.Code)
	}
}

func TestMiddleware_RequirePlan_UpgradeResponseNamesPlan(t *testing.T) {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(middleware.TenantContextKey, &domain.Tenant{ID: uuid.New(), Plan: domain.PlanBasic})
		c.Next()
	})
	r.Use(middleware.RequirePlan(&mockTenantUsecase{}, domain.PlanPlus))
	r.GET("/orders", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/orders", nil))

	var body map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if w.Code != http.StatusForbidden || body["error"] != "UPGRADE_REQUIRED" || body["current_plan"] != "basic" || body["required_plan"] != "plus" {
		t.Fatalf("expected 403 naming current plan basic and required plan plus, got %d %v", w.Code, body)
	}
	if !strings.Contains(body["message"], "Plus plan") {
		t.Fatalf("expected the message to name the Plus plan, got %q", body["message"])
	}
}

func TestMiddleware_RequirePlan_AdminContextUsesRanking(t *testing.T) {
	for _, tc := range []struct {
		plan domain.PlanTier
		want int
	}{
		{domain.PlanPro, http.StatusOK},
		{domain.PlanPlus, http.StatusOK},
		{domain.PlanBasic, http.StatusForbidden},
	} {
		uc := usecase.NewTenantUsecase(&mockTenantRepo{tenant: &domain.Tenant{ID: uuid.New(), Plan: tc.plan}})
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set(middleware.TenantIDContextKey, uuid.New())
			c.Next()
		})
		r.Use(middleware.RequirePlan(uc, domain.PlanPlus))
		r.GET("/admin/orders", func(c *gin.Context) { c.Status(http.StatusOK) })

		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/admin/orders", nil))
		if w.Code != tc.want {
			t.Errorf("plan %q: expected %d, got %d", tc.plan, tc.want, w.Code)
		}
	}
}

func TestKitchenSocket_RequiresPlusOrHigher(t *testing.T) {
	jwtSecret := "test-jwt-secret-key-32-chars-xxyy"
	for _, tc := range []struct {
		plan   domain.PlanTier
		allows bool
	}{
		{domain.PlanPro, true},
		{domain.PlanPlus, true},
		{domain.PlanBasic, false},
	} {
		tenantID := uuid.New()
		uc := usecase.NewTenantUsecase(&mockTenantRepo{tenant: &domain.Tenant{ID: tenantID, Plan: tc.plan}})
		hub := ws.NewHub()
		go hub.Run()
		r := gin.New()
		r.GET("/ws/kitchen", ws.ServeWS(hub, uc, jwtSecret))
		server := httptest.NewServer(r)

		token, _ := security.GenerateJWT(uuid.New(), tenantID, "kitchen", jwtSecret, time.Hour)
		url := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/kitchen?token=" + token
		conn, resp, err := websocket.DefaultDialer.Dial(url, nil)
		if tc.allows && err != nil {
			t.Errorf("plan %q: expected kitchen socket to connect, got %v", tc.plan, err)
		}
		if !tc.allows && (err == nil || resp == nil || resp.StatusCode != http.StatusForbidden) {
			t.Errorf("plan %q: expected 403, got err=%v resp=%v", tc.plan, err, resp)
		}
		if conn != nil {
			conn.Close()
		}
		server.Close()
	}
}

func TestAPI_SuperAdminListPlans(t *testing.T) {
	jwtSecret := "test-jwt-secret-key-32-chars-xxyy"
	tenant := &domain.Tenant{ID: uuid.New(), Slug: "bistro", Plan: domain.PlanBasic, IsActive: true}
	r, _ := setupTestRouter(tenant, "test-qr-secret-key-32-chars-xxyy", jwtSecret)

	superAdminToken, _ := security.GenerateJWT(uuid.New(), tenant.ID, "super_admin", jwtSecret, time.Hour)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/superadmin/plans", nil)
	req.Header.Set("Authorization", "Bearer "+superAdminToken)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var res struct {
		Data []domain.Plan `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("invalid response: %v", err)
	}
	if len(res.Data) != 3 || res.Data[0].Value != domain.PlanBasic || res.Data[1].Value != domain.PlanPlus || res.Data[2].Value != domain.PlanPro {
		t.Fatalf("expected plans basic, plus, pro in order, got %+v", res.Data)
	}
	for i, label := range []string{"Basic", "Plus", "Pro"} {
		if res.Data[i].Label != label || res.Data[i].Description == "" {
			t.Fatalf("expected plan %d to be labelled %q with a description, got %+v", i, label, res.Data[i])
		}
	}

	ownerToken, _ := security.GenerateJWT(uuid.New(), tenant.ID, "owner", jwtSecret, time.Hour)
	req = httptest.NewRequest(http.MethodGet, "/api/v1/superadmin/plans", nil)
	req.Header.Set("Authorization", "Bearer "+ownerToken)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for owner, got %d", w.Code)
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/superadmin/plans", nil))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without a token, got %d", w.Code)
	}
}

func TestAPI_SuperAdminSetTenantPlan(t *testing.T) {
	jwtSecret := "test-jwt-secret-key-32-chars-xxyy"
	tenant := &domain.Tenant{ID: uuid.New(), Slug: "bistro", Plan: domain.PlanBasic, IsActive: true}
	r, _ := setupTestRouter(tenant, "test-qr-secret-key-32-chars-xxyy", jwtSecret)

	// The super admin's own tenant differs from the restaurant being changed
	superAdminToken, _ := security.GenerateJWT(uuid.New(), uuid.New(), "super_admin", jwtSecret, time.Hour)
	ownerToken, _ := security.GenerateJWT(uuid.New(), tenant.ID, "owner", jwtSecret, time.Hour)

	send := func(token, id, plan string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"plan": plan})
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/superadmin/tenants/"+id+"/plan", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	if w := send(superAdminToken, tenant.ID.String(), "pro"); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if tenant.Plan != domain.PlanPro {
		t.Fatalf("expected plan pro, got %s", tenant.Plan)
	}

	if w := send(superAdminToken, tenant.ID.String(), "vip"); w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for old plan name, got %d", w.Code)
	}
	if w := send(superAdminToken, "not-a-uuid", "plus"); w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid id, got %d", w.Code)
	}
	if w := send(superAdminToken, uuid.New().String(), "plus"); w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown restaurant, got %d", w.Code)
	}
	if w := send(ownerToken, tenant.ID.String(), "pro"); w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for owner, got %d", w.Code)
	}
	if tenant.Plan != domain.PlanPro {
		t.Fatalf("rejected requests must not change the plan, got %s", tenant.Plan)
	}
}

func TestAPI_AdminTenantPlanRejectsOldPlanNames(t *testing.T) {
	jwtSecret := "test-jwt-secret-key-32-chars-xxyy"
	tenant := &domain.Tenant{ID: uuid.New(), Slug: "bistro", Plan: domain.PlanBasic, IsActive: true}
	r, _ := setupTestRouter(tenant, "test-qr-secret-key-32-chars-xxyy", jwtSecret)
	token, _ := security.GenerateJWT(uuid.New(), tenant.ID, "super_admin", jwtSecret, time.Hour)

	for _, tc := range []struct {
		plan string
		want int
	}{
		{"vip", http.StatusBadRequest},
		{"standard", http.StatusBadRequest},
		{"pro", http.StatusOK},
	} {
		body, _ := json.Marshal(map[string]string{"plan": tc.plan})
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/tenant/plan", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Errorf("plan %q: expected %d, got %d", tc.plan, tc.want, w.Code)
		}
	}
	if tenant.Plan != domain.PlanPro {
		t.Fatalf("expected plan pro after the valid request, got %s", tenant.Plan)
	}
}
