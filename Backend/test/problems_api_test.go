package test

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/delivery/http/router"
	"menu-backend/domain"
	"menu-backend/internal/push"
)

// stubProblems records calls to the problem and report usecases
type stubProblems struct {
	mu    sync.Mutex
	calls []string
	err   error
}

func (s *stubProblems) note(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls = append(s.calls, name)
	return s.err
}
func (s *stubProblems) Report(ctx context.Context, a domain.Actor, t, o, i uuid.UUID, r domain.ProblemReason, note string) (*domain.Problem, error) {
	return &domain.Problem{ID: uuid.New(), Reason: r}, s.note("report:" + string(r))
}
func (s *stubProblems) Decide(ctx context.Context, a domain.Actor, t, p uuid.UUID, d domain.ProblemDecision, f domain.Fault) (*domain.Problem, error) {
	return &domain.Problem{ID: p}, s.note("decide:" + string(d) + ":" + string(f))
}
func (s *stubProblems) MarkWalkout(ctx context.Context, a domain.Actor, t, b uuid.UUID) (*domain.Walkout, error) {
	return &domain.Walkout{BillID: b}, s.note("walkout")
}
func (s *stubProblems) DecideWalkout(ctx context.Context, a domain.Actor, t, b uuid.UUID, d domain.WalkoutDecision, note string) (*domain.Walkout, error) {
	return &domain.Walkout{BillID: b}, s.note("walkout-decision:" + string(d))
}
func (s *stubProblems) Pending(ctx context.Context, t uuid.UUID) (*domain.Decisions, error) {
	return &domain.Decisions{Problems: []domain.Problem{}, Walkouts: []domain.Walkout{}}, s.note("pending")
}
func (s *stubProblems) Daily(ctx context.Context, t uuid.UUID, date string) (*domain.DailyReport, error) {
	return &domain.DailyReport{Date: date}, s.note("daily:" + date)
}
func (s *stubProblems) MyShift(ctx context.Context, a domain.Actor, t uuid.UUID) (*domain.ShiftReport, error) {
	return &domain.ShiftReport{Role: a.Role}, s.note("my-shift")
}

// memPush keeps push subscriptions in memory
type memPush struct {
	mu      sync.Mutex
	saved   map[string]uuid.UUID
	subs    []domain.PushSubscription
	deleted []string
	asked   []domain.Audience
}

func (m *memPush) Save(ctx context.Context, tenantID, userID uuid.UUID, sub domain.PushSubscription) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.saved == nil {
		m.saved = map[string]uuid.UUID{}
	}
	m.saved[sub.Endpoint] = userID
	return nil
}
func (m *memPush) For(ctx context.Context, tenantID uuid.UUID, to domain.Audience) ([]domain.PushSubscription, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.asked = append(m.asked, to)
	return m.subs, nil
}
func (m *memPush) Delete(ctx context.Context, endpoint string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deleted = append(m.deleted, endpoint)
	return nil
}

func problemsRouter(plan domain.PlanTier, vapidKey string) (*gin.Engine, *stubProblems, *memPush, *domain.Tenant) {
	tenant := &domain.Tenant{ID: uuid.New(), Slug: "bistro", Plan: plan, IsActive: true}
	stub := &stubProblems{}
	pushes := &memPush{}
	r, _ := setupTestRouterWithBills(tenant, billsQR, billsJWT, &stubBills{}, func(d *router.RouterDependencies) {
		d.ProblemUsecase = stub
		d.ReportUsecase = stub
		d.PushRepo = pushes
		d.Config.VAPIDPublicKey = vapidKey
	})
	return r, stub, pushes, tenant
}

func TestProblemDomain(t *testing.T) {
	for _, r := range []domain.ProblemReason{"cold", "wrong_dish", "undercooked", "too_slow", "foreign_object", "other"} {
		if !r.IsValid() {
			t.Errorf("%s should be valid", r)
		}
	}
	if domain.ProblemReason("burnt").IsValid() || domain.Fault("customer").IsValid() {
		t.Error("unknown reasons and faults must be refused")
	}
	for _, f := range []domain.Fault{"kitchen", "waiter", "none"} {
		if !f.IsValid() {
			t.Errorf("%s should be valid", f)
		}
	}
}

func TestAPI_ProblemAndReportRoutesByRole(t *testing.T) {
	r, stub, _, tenant := problemsRouter(domain.PlanPro, "")
	order := "/api/v1/admin/orders/" + uuid.NewString()
	bill := "/api/v1/admin/bills/" + uuid.NewString()
	problem := "/api/v1/admin/problems/" + uuid.NewString()
	report := map[string]string{"order_item_id": uuid.NewString(), "reason": "cold"}

	cases := []struct {
		role, method, path string
		body               interface{}
		want               int
	}{
		{"waiter", http.MethodPost, order + "/problems", report, 201},
		{"manager", http.MethodPost, order + "/problems", report, 201},
		{"chef", http.MethodPost, order + "/problems", report, 403},
		{"waiter", http.MethodPost, order + "/problems", map[string]string{"reason": "cold"}, 400},
		{"manager", http.MethodPost, problem + "/decision", map[string]string{"decision": "remake", "fault": "kitchen"}, 200},
		{"waiter", http.MethodPost, problem + "/decision", map[string]string{"decision": "remake", "fault": "kitchen"}, 403},
		{"waiter", http.MethodPost, bill + "/walkout", nil, 200},
		{"cashier", http.MethodPost, bill + "/walkout", nil, 403},
		{"manager", http.MethodPost, bill + "/walkout-decision", map[string]string{"decision": "waiter_pays"}, 200},
		{"waiter", http.MethodPost, bill + "/walkout-decision", map[string]string{"decision": "waiter_pays"}, 403},
		{"manager", http.MethodGet, "/api/v1/admin/decisions", nil, 200},
		{"cashier", http.MethodGet, "/api/v1/admin/decisions", nil, 403},
		{"manager", http.MethodGet, "/api/v1/admin/reports/daily?date=2026-11-05", nil, 200},
		{"waiter", http.MethodGet, "/api/v1/admin/reports/daily", nil, 403},
		{"waiter", http.MethodGet, "/api/v1/admin/reports/my-shift", nil, 200},
		{"cashier", http.MethodGet, "/api/v1/admin/reports/my-shift", nil, 200},
		{"chef", http.MethodGet, "/api/v1/admin/reports/my-shift", nil, 403},
	}
	for _, tc := range cases {
		if w, res := send(r, tc.method, tc.path, tc.role, tenant.ID, tc.body); w.Code != tc.want {
			t.Errorf("%s %s %s: expected %d, got %d %v", tc.role, tc.method, tc.path, tc.want, w.Code, res)
		}
	}
	joined := map[string]bool{}
	for _, c := range stub.calls {
		joined[c] = true
	}
	for _, want := range []string{"report:cold", "decide:remake:kitchen", "walkout", "walkout-decision:waiter_pays", "pending", "daily:2026-11-05", "my-shift"} {
		if !joined[want] {
			t.Errorf("expected %q to reach the usecase, got %v", want, stub.calls)
		}
	}

	plus, _, _, plusTenant := problemsRouter(domain.PlanPlus, "")
	if w, _ := send(plus, http.MethodGet, "/api/v1/admin/reports/daily", "manager", plusTenant.ID, nil); w.Code != 403 {
		t.Fatalf("reports need Pro, got %d", w.Code)
	}
}

func TestAPI_ProblemErrorsBecomeClearResponses(t *testing.T) {
	r, stub, _, tenant := problemsRouter(domain.PlanPro, "")
	path := "/api/v1/admin/problems/" + uuid.NewString() + "/decision"
	body := map[string]string{"decision": "remake", "fault": "none"}
	for err, want := range map[error]int{
		domain.ErrProblemNotFound: 404,
		domain.ErrAlreadyDecided:  409,
		domain.ErrBillState:       409,
		&domain.ValidationError{Message: "choose who was at fault: kitchen, waiter or no one"}: 400,
		errors.New("database down"): 500,
	} {
		stub.err = err
		w, res := send(r, http.MethodPost, path, "manager", tenant.ID, body)
		if w.Code != want {
			t.Errorf("%v: expected %d, got %d %v", err, want, w.Code, res)
		}
	}
}

func TestAPI_PushKeyAndSubscribe(t *testing.T) {
	r, _, pushes, tenant := problemsRouter(domain.PlanPro, "BPublicKey")

	w, res := send(r, http.MethodGet, "/api/v1/admin/push/key", "chef", tenant.ID, nil)
	data := res["data"].(map[string]interface{})
	if w.Code != 200 || data["enabled"] != true || data["public_key"] != "BPublicKey" {
		t.Fatalf("expected the public key, got %d %v", w.Code, res)
	}

	sub := map[string]interface{}{"endpoint": "https://push.example/abc", "keys": map[string]string{"p256dh": "k", "auth": "a"}}
	if w, res := send(r, http.MethodPost, "/api/v1/admin/push/subscribe", "waiter", tenant.ID, sub); w.Code != 200 {
		t.Fatalf("expected the subscription saved, got %d %v", w.Code, res)
	}
	if len(pushes.saved) != 1 {
		t.Fatalf("expected one subscription, got %v", pushes.saved)
	}
	if w, _ := send(r, http.MethodPost, "/api/v1/admin/push/subscribe", "waiter", tenant.ID, map[string]string{"endpoint": "not a url"}); w.Code != 400 {
		t.Fatalf("a broken subscription must be refused, got %d", w.Code)
	}

	off, _, _, offTenant := problemsRouter(domain.PlanPro, "")
	if _, res := send(off, http.MethodGet, "/api/v1/admin/push/key", "waiter", offTenant.ID, nil); res["data"].(map[string]interface{})["enabled"] != false {
		t.Fatalf("without keys push is off, got %v", res)
	}
}

func TestPush_MessagesForAlerts(t *testing.T) {
	msg, ok := push.MessageFor("order:ready", map[string]interface{}{"order_id": "x", "table_number": "5"})
	if !ok || msg.Title != "Food ready" || msg.Body != "Table 5: food is ready" || msg.Event != "order:ready" {
		t.Fatalf("unexpected message %+v", msg)
	}
	type ginLike map[string]any
	if msg, ok := push.MessageFor("bill:requested", ginLike{"table_number": "7"}); !ok || msg.Body != "Table 7 asks for the bill" {
		t.Fatalf("expected the table read from any map type, got %+v", msg)
	}
	for _, event := range []string{"order:created", "order:status_updated", "menu:updated"} {
		if _, ok := push.MessageFor(event, nil); ok {
			t.Errorf("%s must not wake a locked phone", event)
		}
	}
}

func TestPush_NotifierPushesAndForgetsDeadBrowsers(t *testing.T) {
	live := &recordingNotifier{}
	repo := &memPush{subs: []domain.PushSubscription{{Endpoint: "https://push.example/ok"}, {Endpoint: "https://push.example/gone"}}}
	var mu sync.Mutex
	var sent []string
	sender := func(sub domain.PushSubscription, payload []byte) (int, error) {
		mu.Lock()
		defer mu.Unlock()
		sent = append(sent, sub.Endpoint+" "+string(payload))
		if sub.Endpoint == "https://push.example/gone" {
			return http.StatusGone, nil
		}
		return http.StatusCreated, nil
	}
	n := push.NewSyncNotifier(live, repo, sender)
	tenant := uuid.New()
	waiter := uuid.New()

	n.NotifyStaff(tenant, domain.Audience{UserIDs: []uuid.UUID{waiter}}, "order:ready", map[string]interface{}{"table_number": "5"})

	if len(live.event) != 1 || live.event[0] != "order:ready" {
		t.Fatalf("live screens must still get the event, got %v", live.event)
	}
	if len(sent) != 2 || repo.asked[0].UserIDs[0] != waiter {
		t.Fatalf("expected a push to each of the waiter's browsers, got %v", sent)
	}
	if sent[0] != `https://push.example/ok {"title":"Food ready","body":"Table 5: food is ready","event":"order:ready"}` {
		t.Fatalf("unexpected payload %q", sent[0])
	}
	if len(repo.deleted) != 1 || repo.deleted[0] != "https://push.example/gone" {
		t.Fatalf("a browser that unsubscribed must be forgotten, got %v", repo.deleted)
	}

	n.NotifyStaff(tenant, domain.Audience{Roles: []domain.Role{domain.RoleChef}}, "order:created", nil)
	if len(sent) != 2 || len(live.event) != 2 {
		t.Fatalf("new orders go live but are not pushed, got %d pushes", len(sent))
	}

	// In the background (the server's way) the push still goes out
	bg := push.NewNotifier(live, repo, sender)
	bg.NotifyStaff(tenant, domain.Audience{Roles: []domain.Role{domain.RoleManager}}, "walkout:marked", map[string]interface{}{"table_number": "9"})
	deadline := time.Now().Add(2 * time.Second)
	for {
		mu.Lock()
		n := len(sent)
		mu.Unlock()
		if n == 4 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("expected the background push, got %d pushes", n)
		}
		time.Sleep(10 * time.Millisecond)
	}
}
