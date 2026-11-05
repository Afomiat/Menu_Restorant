package test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/internal/security"
)

// stubBills records calls and returns what the test sets
type stubBills struct {
	mu       sync.Mutex
	calls    []string
	err      error
	attached []uuid.UUID
	rescans  []string
}

func (s *stubBills) call(name string) (*domain.Bill, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls = append(s.calls, name)
	if s.err != nil {
		return nil, s.err
	}
	return &domain.Bill{ID: uuid.New(), TableNumber: "5", Status: domain.BillRequested, TotalAmount: 670, AmountOwed: 670}, nil
}
func (s *stubBills) AttachOrder(ctx context.Context, tenant *domain.Tenant, order *domain.Order) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.attached = append(s.attached, order.ID)
	return nil
}
func (s *stubBills) List(ctx context.Context, actor domain.Actor, tenantID uuid.UUID) ([]domain.Bill, error) {
	_, err := s.call("list:" + string(actor.Role))
	return []domain.Bill{}, err
}
func (s *stubBills) RequestByCustomer(ctx context.Context, tenantID uuid.UUID, table string) (*domain.Bill, error) {
	return s.call("customer-request:" + table)
}
func (s *stubBills) Request(ctx context.Context, a domain.Actor, t, b uuid.UUID) (*domain.Bill, error) {
	return s.call("request")
}
func (s *stubBills) Collect(ctx context.Context, a domain.Actor, t, b uuid.UUID, in domain.CollectInput) (*domain.Bill, error) {
	return s.call("collect:" + string(in.Method))
}
func (s *stubBills) Confirm(ctx context.Context, a domain.Actor, t, b uuid.UUID) (*domain.Bill, error) {
	return s.call("confirm")
}
func (s *stubBills) Move(ctx context.Context, a domain.Actor, t, b uuid.UUID, to string) (*domain.Bill, error) {
	return s.call("move:" + to)
}
func (s *stubBills) Handover(ctx context.Context, a domain.Actor, t, b, to uuid.UUID) (*domain.Bill, error) {
	return s.call("handover")
}
func (s *stubBills) CheckRescan(ctx context.Context, tenantID uuid.UUID, table, session string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rescans = append(s.rescans, table+":"+session)
}
func (s *stubBills) CurrentShift(ctx context.Context, a domain.Actor) (*domain.Shift, error) {
	return nil, nil
}
func (s *stubBills) StartShift(ctx context.Context, a domain.Actor, t uuid.UUID) (*domain.Shift, error) {
	return &domain.Shift{ID: uuid.New(), UserID: a.ID, StartedAt: time.Now()}, nil
}
func (s *stubBills) EndShift(ctx context.Context, a domain.Actor, t uuid.UUID) (*domain.Shift, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &domain.Shift{ID: uuid.New(), UserID: a.ID}, nil
}

const billsJWT = "test-jwt-secret-key-32-chars-bills"
const billsQR = "test-qr-secret-key-32-chars-bills"

func billsRouter(plan domain.PlanTier) (*gin.Engine, *stubBills, *domain.Tenant) {
	tenant := &domain.Tenant{ID: uuid.New(), Slug: "bistro", Plan: plan, IsActive: true}
	bills := &stubBills{}
	r, _ := setupTestRouterWithBills(tenant, billsQR, billsJWT, bills)
	return r, bills, tenant
}

func send(r *gin.Engine, method, path, role string, tenantID uuid.UUID, body interface{}) (*httptest.ResponseRecorder, map[string]interface{}) {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if role != "" {
		token, _ := security.GenerateJWT(uuid.New(), tenantID, role, billsJWT, time.Hour)
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var res map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &res)
	return w, res
}

func TestBillDomain(t *testing.T) {
	for status, takes := range map[domain.BillStatus]bool{
		domain.BillOpen: true, domain.BillRequested: true, domain.BillCollected: false, domain.BillConfirmed: false, domain.BillWalkout: false,
	} {
		if status.TakesOrders() != takes {
			t.Errorf("%s.TakesOrders() should be %v", status, takes)
		}
	}
	for _, m := range []domain.PaymentMethod{domain.PayCash, domain.PayTelebirr, domain.PayCBE} {
		if !m.IsValid() {
			t.Errorf("%s should be valid", m)
		}
	}
	if domain.PaymentMethod("card").IsValid() {
		t.Error("cards are not taken")
	}
	if msg := (&domain.OpenBillsError{Count: 2}).Error(); !strings.Contains(msg, "2 unpaid bill") {
		t.Errorf("unexpected message %q", msg)
	}
}

func TestAPI_BillRoutesByRole(t *testing.T) {
	r, bills, tenant := billsRouter(domain.PlanPro)
	bill := "/api/v1/admin/bills/" + uuid.NewString()

	cases := []struct {
		role, method, path string
		body               interface{}
		want               int
	}{
		{"waiter", http.MethodGet, "/api/v1/admin/bills", nil, 200},
		{"cashier", http.MethodGet, "/api/v1/admin/bills", nil, 200},
		{"chef", http.MethodGet, "/api/v1/admin/bills", nil, 403},
		{"waiter", http.MethodPost, bill + "/collect", map[string]interface{}{"amount": 670, "method": "cash"}, 200},
		{"cashier", http.MethodPost, bill + "/collect", map[string]interface{}{"amount": 670, "method": "cash"}, 403},
		{"cashier", http.MethodPost, bill + "/confirm", nil, 200},
		{"waiter", http.MethodPost, bill + "/confirm", nil, 403},
		{"manager", http.MethodPost, bill + "/confirm", nil, 200},
		{"waiter", http.MethodPost, bill + "/request", nil, 200},
		{"waiter", http.MethodPost, bill + "/move", map[string]string{"table_number": "6"}, 200},
		{"waiter", http.MethodPost, bill + "/handover", map[string]string{"staff_id": uuid.NewString()}, 200},
		{"waiter", http.MethodPost, bill + "/handover", map[string]string{"staff_id": "nope"}, 400},
		{"waiter", http.MethodPost, "/api/v1/admin/bills/not-a-uuid/collect", map[string]interface{}{"amount": 1, "method": "cash"}, 400},
		{"chef", http.MethodPost, "/api/v1/admin/shifts/start", nil, 200},
		{"cashier", http.MethodPost, "/api/v1/admin/shifts/end", nil, 200},
	}
	for _, tc := range cases {
		if w, res := send(r, tc.method, tc.path, tc.role, tenant.ID, tc.body); w.Code != tc.want {
			t.Errorf("%s %s %s: expected %d, got %d %v", tc.role, tc.method, tc.path, tc.want, w.Code, res)
		}
	}
	if !strings.Contains(strings.Join(bills.calls, ","), "list:waiter") || !strings.Contains(strings.Join(bills.calls, ","), "move:6") {
		t.Fatalf("expected the calls to reach the usecase, got %v", bills.calls)
	}

	plus, _, plusTenant := billsRouter(domain.PlanPlus)
	if w, res := send(plus, http.MethodGet, "/api/v1/admin/bills", "manager", plusTenant.ID, nil); w.Code != 403 || res["error"] != "UPGRADE_REQUIRED" {
		t.Fatalf("bills need Pro, got %d %v", w.Code, res)
	}
}

func TestAPI_BillErrorsBecomeClearResponses(t *testing.T) {
	r, bills, tenant := billsRouter(domain.PlanPro)
	collect := "/api/v1/admin/bills/" + uuid.NewString() + "/collect"
	body := map[string]interface{}{"amount": 1, "method": "cash"}

	for err, want := range map[error]int{
		&domain.ValidationError{Message: "the amount is more than the bill still owes"}: 400,
		domain.ErrNotYourBill:  403,
		domain.ErrBillNotFound: 404,
		domain.ErrBillState:    409,
	} {
		bills.err = err
		if w, res := send(r, http.MethodPost, collect, "waiter", tenant.ID, body); w.Code != want || res["error"] != err.Error() {
			t.Errorf("%v: expected %d with the reason, got %d %v", err, want, w.Code, res)
		}
	}

	bills.err = &domain.OpenBillsError{Count: 2}
	w, res := send(r, http.MethodPost, "/api/v1/admin/shifts/end", "waiter", tenant.ID, nil)
	if w.Code != 409 || res["error"] != "OPEN_BILLS" || res["count"].(float64) != 2 {
		t.Fatalf("expected 409 OPEN_BILLS with the count, got %d %v", w.Code, res)
	}
}

func TestAPI_CustomerAsksForTheBill(t *testing.T) {
	r, bills, tenant := billsRouter(domain.PlanPro)
	path := "/api/v1/menus/bistro/bills/request"
	good := security.GenerateTableToken(tenant.ID.String(), "5", billsQR)

	if w, _ := send(r, http.MethodPost, path, "", uuid.Nil, map[string]string{"table_number": "5", "table_token": "forged"}); w.Code != 403 {
		t.Fatalf("a forged table token must be refused, got %d", w.Code)
	}
	w, res := send(r, http.MethodPost, path, "", uuid.Nil, map[string]string{"table_number": "5", "table_token": good})
	if w.Code != 200 || res["data"].(map[string]interface{})["status"] != "bill_requested" {
		t.Fatalf("expected the bill requested, got %d %v", w.Code, res)
	}
	if bills.calls[len(bills.calls)-1] != "customer-request:5" {
		t.Fatalf("expected the request for table 5, got %v", bills.calls)
	}

	bills.err = domain.ErrNoOpenBill
	if w, _ := send(r, http.MethodPost, path, "", uuid.Nil, map[string]string{"table_number": "5", "table_token": good}); w.Code != 409 {
		t.Fatalf("no bill to ask for is a 409, got %d", w.Code)
	}

	plus, _, plusTenant := billsRouter(domain.PlanPlus)
	plusToken := security.GenerateTableToken(plusTenant.ID.String(), "5", billsQR)
	if w, _ := send(plus, http.MethodPost, path, "", uuid.Nil, map[string]string{"table_number": "5", "table_token": plusToken}); w.Code != 403 {
		t.Fatalf("asking for the bill needs Pro, got %d", w.Code)
	}
}

func TestAPI_OrdersGoOnTheBillAndScansAreChecked(t *testing.T) {
	r, bills, tenant := billsRouter(domain.PlanPro)
	token := security.GenerateTableToken(tenant.ID.String(), "4", billsQR)

	order := map[string]interface{}{
		"table_number": "4",
		"table_token":  token,
		"items":        []map[string]interface{}{{"menu_item_id": uuid.NewString(), "item_name": "Tibs", "quantity": 1}},
	}
	if w, res := send(r, http.MethodPost, "/api/v1/menus/bistro/orders", "", uuid.Nil, order); w.Code != http.StatusCreated {
		t.Fatalf("expected the order placed, got %d %v", w.Code, res)
	}
	if len(bills.attached) != 1 {
		t.Fatalf("expected the order put on a bill, got %v", bills.attached)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/menus/bistro/tables/validate?table=4&token="+token, nil)
	req.Header.Set("X-Session-Token", "phone-1")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 200 || len(bills.rescans) != 1 || bills.rescans[0] != "4:phone-1" {
		t.Fatalf("expected the scan checked for an unpaid bill, got %d %v", w.Code, bills.rescans)
	}

	plus, plusBills, plusTenant := billsRouter(domain.PlanPlus)
	plusToken := security.GenerateTableToken(plusTenant.ID.String(), "4", billsQR)
	req = httptest.NewRequest(http.MethodGet, "/api/v1/menus/bistro/tables/validate?table=4&token="+plusToken, nil)
	w = httptest.NewRecorder()
	plus.ServeHTTP(w, req)
	if w.Code != 200 || len(plusBills.rescans) != 0 {
		t.Fatalf("Plus restaurants have no bills to check, got %d %v", w.Code, plusBills.rescans)
	}
}
