package test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"menu-backend/domain"
	"menu-backend/internal/security"
	"menu-backend/usecase"
)

func intPtr(v int) *int { return &v }

// --- Restaurant settings ---

func TestTenantSettings_Defaults(t *testing.T) {
	got := domain.TenantSettings{DefaultPrepMinutes: 12}.WithDefaults()
	want := domain.DefaultTenantSettings
	want.DefaultPrepMinutes = 12
	if got != want {
		t.Fatalf("expected %+v, got %+v", want, got)
	}
	if (domain.TenantSettings{}).WithDefaults() != domain.DefaultTenantSettings {
		t.Fatal("empty settings must give the defaults")
	}
	d := domain.DefaultTenantSettings
	if d.DefaultPrepMinutes != 15 || d.BillReminderMinutes != 10 || d.BillEscalationMinutes != 20 || d.ConfirmReminderMinutes != 15 || d.LongTableMinutes != 120 {
		t.Fatalf("defaults must match the PRD, got %+v", d)
	}
}

func TestTenantUsecase_UpdateSettings(t *testing.T) {
	tenant := &domain.Tenant{ID: uuid.New(), Plan: domain.PlanPro, Settings: domain.DefaultTenantSettings}
	activity := &mockActivityRepo{}
	uc := usecase.NewTenantUsecase(&mockTenantRepo{tenant: tenant}, activity)
	actor := uuid.New()

	settings, err := uc.UpdateSettings(context.Background(), actor, tenant.ID, domain.TenantSettingsChanges{DefaultPrepMinutes: intPtr(20)})
	if err != nil || settings.DefaultPrepMinutes != 20 || settings.BillReminderMinutes != 10 {
		t.Fatalf("expected prep 20 with other settings kept, got %+v %v", settings, err)
	}
	if len(activity.records) != 1 || activity.records[0].Action != domain.ActionSettingsChanged || activity.records[0].ActorID != actor {
		t.Fatalf("expected settings.changed by the actor, got %+v", activity.records)
	}

	// Sending the same value changes nothing and records nothing
	if _, err := uc.UpdateSettings(context.Background(), actor, tenant.ID, domain.TenantSettingsChanges{DefaultPrepMinutes: intPtr(20)}); err != nil || len(activity.records) != 1 {
		t.Fatalf("an unchanged setting must not be recorded, got %d entries %v", len(activity.records), err)
	}

	for name, changes := range map[string]domain.TenantSettingsChanges{
		"zero prep":                  {DefaultPrepMinutes: intPtr(0)},
		"prep over 240":              {DefaultPrepMinutes: intPtr(241)},
		"reminder over 600":          {BillReminderMinutes: intPtr(601)},
		"escalation before reminder": {BillReminderMinutes: intPtr(30), BillEscalationMinutes: intPtr(25)},
	} {
		var validation *domain.ValidationError
		if _, err := uc.UpdateSettings(context.Background(), actor, tenant.ID, changes); !errors.As(err, &validation) {
			t.Errorf("%s: expected a validation error, got %v", name, err)
		}
	}
	if tenant.Settings.DefaultPrepMinutes != 20 {
		t.Fatal("rejected changes must not be saved")
	}
}

func TestAPI_SettingsNeedProAndManager(t *testing.T) {
	api := newStaffAPI(domain.PlanPro)
	chef := api.env.repo.add(api.env.tenant.ID, "Tsion", "+251911000003", "", "secret123", domain.RoleChef)

	w, res := api.do(http.MethodPatch, "/api/v1/admin/tenant/settings", api.token(api.env.manager), map[string]int{"default_prep_minutes": 18})
	if w.Code != http.StatusOK || res["data"].(map[string]interface{})["default_prep_minutes"].(float64) != 18 {
		t.Fatalf("expected the manager to change the prep time, got %d %v", w.Code, res)
	}
	if w, res := api.do(http.MethodPatch, "/api/v1/admin/tenant/settings", api.token(api.env.manager), map[string]int{"default_prep_minutes": 0}); w.Code != http.StatusBadRequest || !strings.Contains(res["error"].(string), "between 1 and 240") {
		t.Fatalf("expected 400 with the reason, got %d %v", w.Code, res)
	}
	if w, _ := api.do(http.MethodPatch, "/api/v1/admin/tenant/settings", api.token(chef), map[string]int{"default_prep_minutes": 18}); w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for a chef, got %d", w.Code)
	}

	// Every staff member reads the settings with the restaurant profile
	w, res = api.do(http.MethodGet, "/api/v1/admin/tenant", api.token(chef), nil)
	if w.Code != http.StatusOK || res["data"].(map[string]interface{})["settings"].(map[string]interface{})["default_prep_minutes"].(float64) != 18 {
		t.Fatalf("expected settings in the profile, got %d %v", w.Code, res)
	}

	plus := newStaffAPI(domain.PlanPlus)
	if w, _ := plus.do(http.MethodPatch, "/api/v1/admin/tenant/settings", plus.token(plus.env.manager), map[string]int{"default_prep_minutes": 18}); w.Code != http.StatusForbidden {
		t.Fatalf("expected Plus restaurants to need Pro, got %d", w.Code)
	}
}

// --- Dish prep time and order targets ---

func TestMenuUsecase_PrepMinutes(t *testing.T) {
	tenantID := uuid.New()
	category := &domain.Category{ID: uuid.New(), TenantID: tenantID}
	item := &domain.MenuItem{ID: uuid.New(), TenantID: tenantID, CategoryID: category.ID, Name: "Tibs", Price: 450}
	uc := usecase.NewMenuUsecase(&mockTenantRepo{}, &mockMenuRepo{item: item, category: category})
	ctx := context.Background()

	created, err := uc.CreateItem(ctx, domain.CreateItemInput{TenantID: tenantID, CategoryID: category.ID, Name: "Shiro", Price: 220, PrepMinutes: intPtr(10)})
	if err != nil || created.PrepMinutes == nil || *created.PrepMinutes != 10 {
		t.Fatalf("expected prep 10, got %+v %v", created, err)
	}
	if created, err := uc.CreateItem(ctx, domain.CreateItemInput{TenantID: tenantID, CategoryID: category.ID, Name: "Buna", Price: 60}); err != nil || created.PrepMinutes != nil {
		t.Fatalf("no prep time means the restaurant default (nil), got %+v %v", created, err)
	}
	updated, err := uc.UpdateItem(ctx, domain.UpdateItemInput{ID: item.ID, TenantID: tenantID, CategoryID: category.ID, Name: "Tibs", Price: 450, IsAvailable: true, PrepMinutes: intPtr(15)})
	if err != nil || *updated.PrepMinutes != 15 {
		t.Fatalf("expected prep 15, got %+v %v", updated, err)
	}
	for _, bad := range []int{0, -5, 241} {
		if _, err := uc.CreateItem(ctx, domain.CreateItemInput{TenantID: tenantID, CategoryID: category.ID, Name: "X", Price: 1, PrepMinutes: intPtr(bad)}); err == nil {
			t.Errorf("prep %d must be rejected", bad)
		}
		if _, err := uc.UpdateItem(ctx, domain.UpdateItemInput{ID: item.ID, TenantID: tenantID, CategoryID: category.ID, Name: "Tibs", Price: 1, PrepMinutes: intPtr(bad)}); err == nil {
			t.Errorf("prep %d must be rejected on update", bad)
		}
	}
}

// itemsMenuRepo returns dishes by id
type itemsMenuRepo struct {
	mockMenuRepo
	items map[uuid.UUID]*domain.MenuItem
}

func (m *itemsMenuRepo) GetItemByID(ctx context.Context, tenantID, itemID uuid.UUID) (*domain.MenuItem, error) {
	if it, ok := m.items[itemID]; ok {
		return it, nil
	}
	return nil, errors.New("not found")
}

func TestOrder_TargetIsTheSlowestDish(t *testing.T) {
	tenantID := uuid.New()
	qrSecret := "test-secret-key-32-chars-abcdef"
	tibs := &domain.MenuItem{ID: uuid.New(), TenantID: tenantID, Name: "Tibs", Price: 450, IsAvailable: true, PrepMinutes: intPtr(25)}
	shiro := &domain.MenuItem{ID: uuid.New(), TenantID: tenantID, Name: "Shiro", Price: 220, IsAvailable: true, PrepMinutes: intPtr(10)}
	buna := &domain.MenuItem{ID: uuid.New(), TenantID: tenantID, Name: "Buna", Price: 60, IsAvailable: true}

	place := func(settings domain.TenantSettings, dishes ...*domain.MenuItem) int {
		orderRepo := &mockOrderRepo{}
		uc := usecase.NewOrderUsecase(
			orderRepo,
			&mockTenantRepo{tenant: &domain.Tenant{ID: tenantID, Plan: domain.PlanPro, Settings: settings}},
			&mockTableRepo{table: &domain.RestaurantTable{ID: uuid.New(), TenantID: tenantID, TableNumber: "5", IsActive: true}},
			&itemsMenuRepo{items: map[uuid.UUID]*domain.MenuItem{tibs.ID: tibs, shiro.ID: shiro, buna.ID: buna}},
			qrSecret,
		)
		input := domain.CreateOrderInput{TenantID: tenantID, TableNumber: "5", TableToken: security.GenerateTableToken(tenantID.String(), "5", qrSecret)}
		for _, d := range dishes {
			input.Items = append(input.Items, domain.CreateOrderItemInput{MenuItemID: d.ID, ItemName: d.Name, Quantity: 1})
		}
		order, err := uc.PlaceOrder(context.Background(), input)
		if err != nil {
			t.Fatal(err)
		}
		if orderRepo.createdOrder.TargetMinutes != order.TargetMinutes {
			t.Fatal("the target must be saved with the order")
		}
		return order.TargetMinutes
	}

	if got := place(domain.DefaultTenantSettings, tibs, shiro); got != 25 {
		t.Errorf("Tibs 25 + Shiro 10: expected 25, got %d", got)
	}
	if got := place(domain.DefaultTenantSettings, shiro, buna); got != 15 {
		t.Errorf("Shiro 10 + Buna (default 15): expected 15, got %d", got)
	}
	if got := place(domain.TenantSettings{DefaultPrepMinutes: 5}, shiro, buna); got != 10 {
		t.Errorf("with a 5 minute default: expected 10, got %d", got)
	}
	if got := place(domain.TenantSettings{}, buna); got != 15 {
		t.Errorf("unset settings use the 15 minute default, got %d", got)
	}
}

// --- Who may move an order ---

func TestCanSetOrderStatus(t *testing.T) {
	all := []domain.OrderStatus{domain.StatusNotStarted, domain.StatusPreparing, domain.StatusReady, domain.StatusDelivered, domain.StatusCancelled}
	allowed := map[domain.Role][]domain.OrderStatus{
		domain.RoleManager:    all,
		domain.RoleSuperAdmin: all,
		domain.RoleChef:       {domain.StatusNotStarted, domain.StatusPreparing, domain.StatusReady, domain.StatusCancelled},
		domain.RoleWaiter:     {domain.StatusDelivered},
		domain.RoleCashier:    {},
	}
	for role, ok := range allowed {
		for _, status := range all {
			want := false
			for _, s := range ok {
				want = want || s == status
			}
			if got := domain.CanSetOrderStatus(role, status); got != want {
				t.Errorf("%s -> %s: got %v, want %v", role, status, got, want)
			}
		}
	}
}

func TestOrderUsecase_UpdateKitchenStatus(t *testing.T) {
	tenantID, waiterID := uuid.New(), uuid.New()
	orderRepo := &mockOrderRepo{createdOrder: &domain.Order{TableNumber: "5"}}
	uc := usecase.NewOrderUsecase(orderRepo, &mockTenantRepo{},
		&mockTableRepo{table: &domain.RestaurantTable{TenantID: tenantID, TableNumber: "5", AssignedWaiterID: &waiterID}},
		&mockMenuRepo{}, "secret")
	chef := domain.Actor{ID: uuid.New(), Role: domain.RoleChef}

	order, err := uc.UpdateKitchenStatus(context.Background(), chef, tenantID, uuid.New(), domain.StatusReady)
	if err != nil || order.WaiterID == nil || *order.WaiterID != waiterID {
		t.Fatalf("expected the table's waiter on the order, got %+v %v", order, err)
	}
	if len(orderRepo.statusCalls) != 1 || orderRepo.statusCalls[0].actor != chef.ID {
		t.Fatalf("expected the chef recorded on the step, got %+v", orderRepo.statusCalls)
	}

	waiter := domain.Actor{ID: waiterID, Role: domain.RoleWaiter}
	if _, err := uc.UpdateKitchenStatus(context.Background(), waiter, tenantID, uuid.New(), domain.StatusPreparing); !errors.Is(err, domain.ErrStatusNotAllowed) {
		t.Fatalf("a waiter must not start cooking, got %v", err)
	}
	if len(orderRepo.statusCalls) != 1 {
		t.Fatal("a refused step must not reach the database")
	}
}

// --- Waiters and tables ---

func TestTableUsecase_AssignWaiter(t *testing.T) {
	env := newStaffEnv()
	table := &domain.RestaurantTable{ID: uuid.New(), TenantID: env.tenant.ID, TableNumber: "5", IsActive: true}
	uc := usecase.NewTableUsecase(&mockTableRepo{table: table}, env.repo, env.activity, "secret")
	ctx := context.Background()
	abebe := env.repo.add(env.tenant.ID, "Abebe", "+251911000002", "", "secret123", domain.RoleWaiter)

	got, err := uc.AssignWaiter(ctx, env.manager.ID, env.tenant.ID, table.ID, &abebe.ID)
	if err != nil || *got.AssignedWaiterID != abebe.ID || got.AssignedWaiterName != "Abebe" {
		t.Fatalf("expected Abebe on table 5, got %+v %v", got, err)
	}
	if a := env.activity.records; len(a) != 1 || a[0].Action != domain.ActionWaiterAssigned || a[0].ActorID != env.manager.ID {
		t.Fatalf("expected the assignment recorded, got %+v", a)
	}

	chef := env.repo.add(env.tenant.ID, "Tsion", "+251911000003", "", "secret123", domain.RoleChef)
	offWaiter := env.repo.add(env.tenant.ID, "Gone", "+251911000004", "", "secret123", domain.RoleWaiter)
	off := false
	if _, err := env.uc.Update(ctx, env.manager.ID, env.tenant.ID, offWaiter.ID, domain.UpdateStaffInput{IsActive: &off}); err != nil {
		t.Fatal(err)
	}
	otherWaiter := env.repo.add(env.other.ID, "Other", "+251911000005", "", "secret123", domain.RoleWaiter)
	unknown := uuid.New()
	for name, id := range map[string]uuid.UUID{"chef": chef.ID, "turned off": offWaiter.ID, "other restaurant": otherWaiter.ID, "unknown": unknown} {
		id := id
		if _, err := uc.AssignWaiter(ctx, env.manager.ID, env.tenant.ID, table.ID, &id); !errors.Is(err, domain.ErrNotAWaiter) {
			t.Errorf("%s: expected ErrNotAWaiter, got %v", name, err)
		}
	}

	cleared, err := uc.AssignWaiter(ctx, env.manager.ID, env.tenant.ID, table.ID, nil)
	if err != nil || cleared.AssignedWaiterID != nil {
		t.Fatalf("expected no waiter, got %+v %v", cleared, err)
	}
	if _, err := uc.AssignWaiter(ctx, env.manager.ID, env.tenant.ID, uuid.New(), nil); !errors.Is(err, domain.ErrTableNotFound) {
		t.Fatalf("expected ErrTableNotFound, got %v", err)
	}
}

func TestOrderUsecase_TablesWithOrders(t *testing.T) {
	tenantID, abebe, bereket := uuid.New(), uuid.New(), uuid.New()
	tables := &multiTableRepo{tables: []domain.RestaurantTable{
		{ID: uuid.New(), TableNumber: "1", AssignedWaiterID: &abebe},
		{ID: uuid.New(), TableNumber: "2", AssignedWaiterID: &bereket},
		{ID: uuid.New(), TableNumber: "3"},
	}}
	orders := &listOrderRepo{orders: []domain.Order{{ID: uuid.New(), TableNumber: "1"}, {ID: uuid.New(), TableNumber: "2"}, {ID: uuid.New(), TableNumber: "1"}}}
	uc := usecase.NewOrderUsecase(orders, &mockTenantRepo{}, tables, &mockMenuRepo{}, "secret")

	mine, err := uc.TablesWithOrders(context.Background(), tenantID, abebe)
	if err != nil || len(mine) != 1 || mine[0].Table.TableNumber != "1" || len(mine[0].Orders) != 2 {
		t.Fatalf("expected Abebe's table 1 with 2 orders, got %+v %v", mine, err)
	}
	all, _ := uc.TablesWithOrders(context.Background(), tenantID, uuid.Nil)
	if len(all) != 3 || len(all[2].Orders) != 0 || all[2].Orders == nil {
		t.Fatalf("expected every table, with an empty list for table 3, got %+v", all)
	}
}

// multiTableRepo holds several tables
type multiTableRepo struct {
	mockTableRepo
	tables []domain.RestaurantTable
}

func (m *multiTableRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]domain.RestaurantTable, error) {
	return m.tables, nil
}

// listOrderRepo holds several open orders
type listOrderRepo struct {
	mockOrderRepo
	orders []domain.Order
}

func (m *listOrderRepo) ListActiveByTenant(ctx context.Context, tenantID uuid.UUID) ([]domain.Order, error) {
	return m.orders, nil
}

func TestAPI_AssignWaiterAndMyTables(t *testing.T) {
	api := newStaffAPI(domain.PlanPro)
	abebe := api.env.repo.add(api.env.tenant.ID, "Abebe", "+251911000002", "", "secret123", domain.RoleWaiter)
	bereket := api.env.repo.add(api.env.tenant.ID, "Bereket", "+251911000006", "", "secret123", domain.RoleWaiter)
	manager := api.token(api.env.manager)
	path := "/api/v1/admin/tables/" + api.table.ID.String() + "/waiter"

	w, res := api.do(http.MethodPatch, path, manager, map[string]string{"waiter_id": abebe.ID.String()})
	if w.Code != http.StatusOK || res["data"].(map[string]interface{})["assigned_waiter_name"] != "Abebe" {
		t.Fatalf("expected Abebe assigned, got %d %v", w.Code, res)
	}

	w, res = api.do(http.MethodGet, "/api/v1/admin/my-tables", api.token(abebe), nil)
	if w.Code != http.StatusOK || len(res["data"].([]interface{})) != 1 {
		t.Fatalf("expected Abebe to see table 5, got %d %v", w.Code, res)
	}
	if _, res := api.do(http.MethodGet, "/api/v1/admin/my-tables", api.token(bereket), nil); len(res["data"].([]interface{})) != 0 {
		t.Fatalf("Bereket has no tables, got %v", res)
	}
	if _, res := api.do(http.MethodGet, "/api/v1/admin/my-tables", manager, nil); len(res["data"].([]interface{})) != 1 {
		t.Fatalf("a manager sees every table, got %v", res)
	}

	if w, _ := api.do(http.MethodPatch, path, manager, map[string]interface{}{"waiter_id": nil}); w.Code != http.StatusOK || api.table.AssignedWaiterID != nil {
		t.Fatalf("expected the table cleared, got %d", w.Code)
	}
	if w, _ := api.do(http.MethodPatch, path, manager, map[string]string{"waiter_id": api.env.manager.ID.String()}); w.Code != http.StatusBadRequest {
		t.Fatalf("a manager is not a waiter, expected 400, got %d", w.Code)
	}
	if w, _ := api.do(http.MethodPatch, "/api/v1/admin/tables/"+uuid.NewString()+"/waiter", manager, map[string]string{"waiter_id": abebe.ID.String()}); w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for an unknown table, got %d", w.Code)
	}
	if w, _ := api.do(http.MethodPatch, path, api.token(abebe), map[string]string{"waiter_id": abebe.ID.String()}); w.Code != http.StatusForbidden {
		t.Fatalf("a waiter cannot assign tables, got %d", w.Code)
	}

	plus := newStaffAPI(domain.PlanPlus)
	if w, _ := plus.do(http.MethodGet, "/api/v1/admin/my-tables", plus.token(plus.env.manager), nil); w.Code != http.StatusForbidden {
		t.Fatalf("expected Plus restaurants to need Pro, got %d", w.Code)
	}
}

// --- Live events: the food-ready bell reaches only the table's waiter ---

type socketInbox struct {
	mu     sync.Mutex
	events []string
}

func (b *socketInbox) has(event string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, e := range b.events {
		if e == event {
			return true
		}
	}
	return false
}

func (a *staffAPI) listen(t *testing.T, server *httptest.Server, s domain.Staff) *socketInbox {
	t.Helper()
	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/kitchen?token=" + a.token(s)
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("connect %s: %v", s.FullName, err)
	}
	t.Cleanup(func() { conn.Close() })
	inbox := &socketInbox{}
	go func() {
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var m struct{ Event string }
			_ = json.Unmarshal(msg, &m)
			inbox.mu.Lock()
			inbox.events = append(inbox.events, m.Event)
			inbox.mu.Unlock()
		}
	}()
	return inbox
}

func waitFor(t *testing.T, what string, ok func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for !ok() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestAPI_FoodReadyBellReachesOnlyTheTablesWaiter(t *testing.T) {
	api := newStaffAPI(domain.PlanPro)
	server := httptest.NewServer(api.r)
	defer server.Close()

	abebe := api.env.repo.add(api.env.tenant.ID, "Abebe", "+251911000002", "", "secret123", domain.RoleWaiter)
	bereket := api.env.repo.add(api.env.tenant.ID, "Bereket", "+251911000006", "", "secret123", domain.RoleWaiter)
	chef := api.env.repo.add(api.env.tenant.ID, "Tsion", "+251911000003", "", "secret123", domain.RoleChef)
	api.table.AssignedWaiterID = &abebe.ID
	api.orderRepo.createdOrder = &domain.Order{TableNumber: "5"}

	abebeInbox := api.listen(t, server, abebe)
	bereketInbox := api.listen(t, server, bereket)
	chefInbox := api.listen(t, server, chef)
	managerInbox := api.listen(t, server, api.env.manager)
	time.Sleep(100 * time.Millisecond) // let the hub register the screens

	orderPath := "/api/v1/admin/orders/" + uuid.NewString() + "/status"
	if w, _ := api.do(http.MethodPatch, orderPath, api.token(chef), map[string]string{"status": "ready"}); w.Code != http.StatusOK {
		t.Fatalf("expected the chef to mark ready, got %d", w.Code)
	}

	waitFor(t, "Abebe's bell", func() bool { return abebeInbox.has("order:ready") })
	waitFor(t, "everyone's status update", func() bool {
		return bereketInbox.has("order:status_updated") && chefInbox.has("order:status_updated") && managerInbox.has("order:status_updated")
	})
	if bereketInbox.has("order:ready") || chefInbox.has("order:ready") || managerInbox.has("order:ready") {
		t.Fatal("only the table's waiter may hear the food-ready bell")
	}

	// Without a waiter on the table, the managers hear it
	api.table.AssignedWaiterID = nil
	if w, _ := api.do(http.MethodPatch, orderPath, api.token(chef), map[string]string{"status": "ready"}); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	waitFor(t, "the manager's bell", func() bool { return managerInbox.has("order:ready") })

	// Waiters serve but do not cook
	if w, _ := api.do(http.MethodPatch, orderPath, api.token(abebe), map[string]string{"status": "preparing"}); w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for a waiter starting an order, got %d", w.Code)
	}
	if w, _ := api.do(http.MethodPatch, orderPath, api.token(abebe), map[string]string{"status": "complete"}); w.Code != http.StatusOK {
		t.Fatalf("expected the waiter to mark served, got %d", w.Code)
	}
	if last := api.orderRepo.statusCalls[len(api.orderRepo.statusCalls)-1]; last.status != domain.StatusDelivered || last.actor != abebe.ID {
		t.Fatalf("expected served by Abebe, got %+v", last)
	}
}

// --- Late orders ---

type recordingNotifier struct {
	mu    sync.Mutex
	sent  []domain.Audience
	event []string
}

func (n *recordingNotifier) NotifyStaff(tenantID uuid.UUID, to domain.Audience, event string, data interface{}) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.sent = append(n.sent, to)
	n.event = append(n.event, event)
}

func TestKitchenWatcher_AlertsManagersOnceAtTwiceTheTarget(t *testing.T) {
	start := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	order := domain.LateOrder{ID: uuid.New(), TenantID: uuid.New(), TableNumber: "5", TargetMinutes: 15, StartedAt: start}
	repo := &mockOrderRepo{veryLate: []domain.LateOrder{order}}
	notifier := &recordingNotifier{}
	watcher := usecase.NewKitchenWatcher(repo, notifier)

	if err := watcher.CheckOnce(context.Background(), start.Add(29*time.Minute)); err != nil || len(notifier.sent) != 0 {
		t.Fatalf("no alert before twice the target, got %d %v", len(notifier.sent), err)
	}
	_ = watcher.CheckOnce(context.Background(), start.Add(30*time.Minute))
	_ = watcher.CheckOnce(context.Background(), start.Add(31*time.Minute))

	if len(notifier.sent) != 1 || notifier.event[0] != "order:very_late" {
		t.Fatalf("expected one very_late alert, got %v", notifier.event)
	}
	if roles := notifier.sent[0].Roles; len(roles) != 1 || roles[0] != domain.RoleManager || len(notifier.sent[0].UserIDs) != 0 {
		t.Fatalf("expected the alert for managers only, got %+v", notifier.sent[0])
	}
	if len(repo.alerted) != 1 || repo.alerted[0] != order.ID {
		t.Fatalf("expected the order marked as alerted, got %v", repo.alerted)
	}
}

func TestWaiterOrManagers(t *testing.T) {
	id := uuid.New()
	if a := domain.WaiterOrManagers(&id); len(a.UserIDs) != 1 || a.UserIDs[0] != id || len(a.Roles) != 0 {
		t.Fatalf("expected the waiter, got %+v", a)
	}
	for _, none := range []*uuid.UUID{nil, &uuid.Nil} {
		if a := domain.WaiterOrManagers(none); len(a.Roles) != 1 || a.Roles[0] != domain.RoleManager {
			t.Fatalf("expected the managers, got %+v", a)
		}
	}
}
