package test

import (
	"bytes"
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
	"menu-backend/internal/ws"
	"menu-backend/usecase"
)

const staffJWTSecret = "test-jwt-secret-key-32-chars-staff"

type staffAPI struct {
	r         *gin.Engine
	env       *staffEnv
	tenantUc  *mockFullTenantUsecase
	table     *domain.RestaurantTable
	orderRepo *mockOrderRepo
	hub       *ws.Hub
}

// newStaffAPI builds the real router with the real staff, table and order usecases over
// in-memory data: one restaurant with table 5
func newStaffAPI(plan domain.PlanTier) *staffAPI {
	env := newStaffEnv()
	env.tenant.Plan = plan
	tenantUc := &mockFullTenantUsecase{tenant: env.tenant}
	tenantRepo := &mockTenantRepo{tenant: env.tenant}
	table := &domain.RestaurantTable{ID: uuid.New(), TenantID: env.tenant.ID, TableNumber: "5", IsActive: true}
	tableRepo := &mockTableRepo{table: table}
	orderRepo := &mockOrderRepo{}
	hub := ws.NewHub()
	go hub.Run()
	r := router.SetupRouter(router.RouterDependencies{
		Config:        &config.Config{Environment: "test", JWTSecret: staffJWTSecret, QRSecretKey: "test-qr-secret-key-32-chars-staff"},
		TenantUsecase: tenantUc,
		MenuUsecase:   usecase.NewMenuUsecase(tenantRepo, &mockMenuRepo{}),
		OrderUsecase:  usecase.NewOrderUsecase(orderRepo, tenantRepo, tableRepo, &mockMenuRepo{}, "test-qr-secret-key-32-chars-staff"),
		TableUsecase:  usecase.NewTableUsecase(tableRepo, env.repo, env.activity, "test-qr-secret-key-32-chars-staff"),
		StaffUsecase:  env.uc,
		Hub:           hub,
	})
	return &staffAPI{r: r, env: env, tenantUc: tenantUc, table: table, orderRepo: orderRepo, hub: hub}
}

func (a *staffAPI) token(s domain.Staff) string {
	t, _ := security.GenerateJWT(s.ID, s.TenantID, string(s.Role), staffJWTSecret, time.Hour)
	return t
}

func (a *staffAPI) do(method, path, token string, body interface{}) (*httptest.ResponseRecorder, map[string]interface{}) {
	var reader *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	a.r.ServeHTTP(w, req)
	var res map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &res)
	return w, res
}

func TestAPI_LoginByPhoneAndEmail(t *testing.T) {
	api := newStaffAPI(domain.PlanPro)

	w, res := api.do(http.MethodPost, "/api/v1/auth/login", "", map[string]string{"phone": "0911 000 001", "restaurant": "demo-pro", "password": "secret123"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d %v", w.Code, res)
	}
	user := res["user"].(map[string]interface{})
	if user["full_name"] != "Hana Manager" || user["role"] != "manager" || user["phone"] != "+251911000001" {
		t.Fatalf("unexpected user %v", user)
	}
	claims, err := security.ValidateJWT(res["token"].(string), staffJWTSecret)
	if err != nil || claims.UserID != api.env.manager.ID || claims.TenantID != api.env.tenant.ID || claims.Role != "manager" {
		t.Fatalf("unexpected token claims %+v %v", claims, err)
	}

	if w, _ := api.do(http.MethodPost, "/api/v1/auth/login", "", map[string]string{"email": "hana@demo.et", "password": "secret123"}); w.Code != http.StatusOK {
		t.Fatalf("expected email login to work, got %d", w.Code)
	}
	if w, res := api.do(http.MethodPost, "/api/v1/auth/login", "", map[string]string{"phone": "0911000001", "restaurant": "demo-pro", "password": "bad"}); w.Code != http.StatusUnauthorized || res["error"] != domain.ErrInvalidLogin.Error() {
		t.Fatalf("expected 401 for a wrong password, got %d %v", w.Code, res)
	}
	if w, _ := api.do(http.MethodPost, "/api/v1/auth/login", "", map[string]string{"password": "secret123"}); w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 without phone or email, got %d", w.Code)
	}
}

func TestAPI_StaffManagement(t *testing.T) {
	api := newStaffAPI(domain.PlanPro)
	managerToken := api.token(api.env.manager)

	w, res := api.do(http.MethodPost, "/api/v1/admin/staff", managerToken, map[string]string{
		"full_name": "Abebe Kebede", "phone": "0922 111 222", "password": "pass123", "role": "waiter",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d %v", w.Code, res)
	}
	created := res["data"].(map[string]interface{})
	if created["phone"] != "+251922111222" || created["role"] != "waiter" || created["password_hash"] != nil {
		t.Fatalf("unexpected staff response %v", created)
	}

	w, res = api.do(http.MethodGet, "/api/v1/admin/staff", managerToken, nil)
	if w.Code != http.StatusOK || len(res["data"].([]interface{})) != 2 || len(res["roles"].([]interface{})) != 4 {
		t.Fatalf("expected 2 staff and 4 roles, got %d %v", w.Code, res)
	}

	if w, res := api.do(http.MethodPost, "/api/v1/admin/staff", managerToken, map[string]string{
		"full_name": "Copy", "phone": "0922111222", "password": "pass123", "role": "chef",
	}); w.Code != http.StatusConflict || res["error"] != domain.ErrPhoneTaken.Error() {
		t.Fatalf("expected 409 for a duplicate phone, got %d %v", w.Code, res)
	}
	if w, res := api.do(http.MethodPost, "/api/v1/admin/staff", managerToken, map[string]string{
		"full_name": "Short", "phone": "0922111333", "password": "123", "role": "chef",
	}); w.Code != http.StatusBadRequest || res["error"] != "password must be at least 6 characters" {
		t.Fatalf("expected 400 with the reason, got %d %v", w.Code, res)
	}

	id := created["id"].(string)
	w, res = api.do(http.MethodPatch, "/api/v1/admin/staff/"+id, managerToken, map[string]interface{}{"role": "cashier"})
	if w.Code != http.StatusOK || res["data"].(map[string]interface{})["role"] != "cashier" {
		t.Fatalf("expected the role change, got %d %v", w.Code, res)
	}
	if w, res := api.do(http.MethodPatch, "/api/v1/admin/staff/"+api.env.manager.ID.String(), managerToken, map[string]interface{}{"is_active": false}); w.Code != http.StatusConflict || res["error"] != domain.ErrChangeOwnStaff.Error() {
		t.Fatalf("expected 409 when turning off yourself, got %d %v", w.Code, res)
	}
	if w, _ := api.do(http.MethodPatch, "/api/v1/admin/staff/"+uuid.New().String(), managerToken, map[string]interface{}{"role": "chef"}); w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown staff, got %d", w.Code)
	}
	if w, _ := api.do(http.MethodPatch, "/api/v1/admin/staff/not-a-uuid", managerToken, map[string]interface{}{"role": "chef"}); w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a bad id, got %d", w.Code)
	}
}

func TestAPI_StaffNeedsProPlanAndManager(t *testing.T) {
	plus := newStaffAPI(domain.PlanPlus)
	if w, res := plus.do(http.MethodGet, "/api/v1/admin/staff", plus.token(plus.env.manager), nil); w.Code != http.StatusForbidden || res["error"] != "UPGRADE_REQUIRED" {
		t.Fatalf("expected Plus restaurants to need an upgrade, got %d %v", w.Code, res)
	}

	pro := newStaffAPI(domain.PlanPro)
	for i, role := range []domain.Role{domain.RoleWaiter, domain.RoleChef, domain.RoleCashier} {
		s := pro.env.repo.add(pro.env.tenant.ID, string(role), "+25191100009"+string(rune('1'+i)), "", "secret123", role)
		if w, _ := pro.do(http.MethodGet, "/api/v1/admin/staff", pro.token(s), nil); w.Code != http.StatusForbidden {
			t.Errorf("%s: expected 403, got %d", role, w.Code)
		}
	}
}

func TestAPI_TurnedOffStaffIsSignedOutAtOnce(t *testing.T) {
	api := newStaffAPI(domain.PlanPro)
	chef := api.env.repo.add(api.env.tenant.ID, "Tsion", "+251911000003", "", "secret123", domain.RoleChef)
	chefToken := api.token(chef)

	if w, _ := api.do(http.MethodGet, "/api/v1/admin/tenant", chefToken, nil); w.Code != http.StatusOK {
		t.Fatalf("expected every staff role to read the restaurant profile, got %d", w.Code)
	}

	if w, _ := api.do(http.MethodPatch, "/api/v1/admin/staff/"+chef.ID.String(), api.token(api.env.manager), map[string]interface{}{"is_active": false}); w.Code != http.StatusOK {
		t.Fatalf("expected the manager to turn off the chef, got %d", w.Code)
	}

	w, res := api.do(http.MethodGet, "/api/v1/admin/tenant", chefToken, nil)
	if w.Code != http.StatusUnauthorized || res["error"] != "STAFF_INACTIVE" {
		t.Fatalf("expected the chef's existing login to stop working, got %d %v", w.Code, res)
	}
	if w, _ := api.do(http.MethodPost, "/api/v1/auth/login", "", map[string]string{"phone": "0911000003", "restaurant": "demo-pro", "password": "secret123"}); w.Code != http.StatusForbidden {
		t.Fatalf("expected a turned-off account to be refused at login, got %d", w.Code)
	}
}

func TestAPI_LoginsWithOldRoleNamesKeepWorking(t *testing.T) {
	api := newStaffAPI(domain.PlanPro)
	chef := api.env.repo.add(api.env.tenant.ID, "Tsion", "+251911000003", "", "secret123", domain.RoleChef)

	// Tokens issued before the Pro roles say "owner" and "kitchen"
	owner, _ := security.GenerateJWT(api.env.manager.ID, api.env.tenant.ID, "owner", staffJWTSecret, time.Hour)
	kitchen, _ := security.GenerateJWT(chef.ID, api.env.tenant.ID, "kitchen", staffJWTSecret, time.Hour)

	if w, _ := api.do(http.MethodGet, "/api/v1/admin/staff", owner, nil); w.Code != http.StatusOK {
		t.Fatalf("an owner login should act as manager, got %d", w.Code)
	}
	if w, _ := api.do(http.MethodGet, "/api/v1/admin/orders", kitchen, nil); w.Code != http.StatusOK {
		t.Fatalf("a kitchen login should act as chef, got %d", w.Code)
	}
	if w, _ := api.do(http.MethodGet, "/api/v1/admin/staff", kitchen, nil); w.Code != http.StatusForbidden {
		t.Fatalf("a kitchen login must not manage staff, got %d", w.Code)
	}
}

func TestAPI_PlanChangeIsRecordedWithTheSuperAdmin(t *testing.T) {
	activity := &mockActivityRepo{}
	tenant := &domain.Tenant{ID: uuid.New(), Slug: "bistro", Plan: domain.PlanBasic}
	tenantUc := usecase.NewTenantUsecase(&mockTenantRepo{tenant: tenant}, activity)
	r := router.SetupRouter(router.RouterDependencies{
		Config:        &config.Config{Environment: "test", JWTSecret: staffJWTSecret},
		TenantUsecase: tenantUc,
		StaffUsecase:  allActiveStaff{},
	})

	superAdmin := uuid.New()
	token, _ := security.GenerateJWT(superAdmin, uuid.Nil, "super_admin", staffJWTSecret, time.Hour)
	body, _ := json.Marshal(map[string]string{"plan": "pro"})
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/superadmin/tenants/"+tenant.ID.String()+"/plan", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d %s", w.Code, w.Body.String())
	}
	if len(activity.records) != 1 || activity.records[0].ActorID != superAdmin || activity.records[0].TenantID != tenant.ID {
		t.Fatalf("expected the change recorded under the super admin, got %+v", activity.records)
	}
}
