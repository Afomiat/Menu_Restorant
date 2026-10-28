package test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"net/http/httptest"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"menu-backend/config"
	"menu-backend/delivery/http/router"
	"menu-backend/domain"
	"menu-backend/internal/security"
	"menu-backend/internal/ws"
	"menu-backend/usecase"
)

const (
	liveMenuQRSecret  = "test-secret-key-32-chars-long"
	liveMenuJWTSecret = "test-jwt-secret-32-chars-long"
)

// storedMenuRepo behaves like the database: every read returns a fresh copy and writes are kept.
// A copy remembered by the order usecase therefore stays stale until it is forgotten.
type storedMenuRepo struct {
	mockMenuRepo
	mu sync.Mutex
}

func (m *storedMenuRepo) GetItemByID(ctx context.Context, tenantID, itemID uuid.UUID) (*domain.MenuItem, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.item == nil || m.item.ID != itemID {
		return nil, errors.New("item not found")
	}
	item := *m.item
	return &item, nil
}

func (m *storedMenuRepo) UpdateItem(ctx context.Context, item *domain.MenuItem) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	stored := *item
	m.item = &stored
	return nil
}

func (m *storedMenuRepo) ToggleSoldOut(ctx context.Context, tenantID, itemID uuid.UUID, isSoldOut bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.item.IsSoldOut = isSoldOut
	return nil
}

func (m *storedMenuRepo) DeleteItem(ctx context.Context, tenantID, itemID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.item = nil
	return nil
}

type liveMenuEnv struct {
	server   *httptest.Server
	tenant   *domain.Tenant
	item     domain.MenuItem
	category domain.Category
	hub      *ws.Hub
}

// newLiveMenuEnv runs the real router and WebSocket hub behind a test server
func newLiveMenuEnv(t *testing.T) *liveMenuEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)

	tenant := &domain.Tenant{
		ID:       uuid.New(),
		Slug:     "live-bistro",
		Name:     "Live Bistro",
		Plan:     domain.PlanVIP,
		IsActive: true,
	}
	category := domain.Category{ID: uuid.New(), TenantID: tenant.ID, Name: "Burgers", IsActive: true}
	item := domain.MenuItem{
		ID:          uuid.New(),
		TenantID:    tenant.ID,
		CategoryID:  category.ID,
		Name:        "The Truffle Prime",
		Price:       480.00,
		IsAvailable: true,
	}

	itemCopy := item
	categoryCopy := category
	menuRepo := &storedMenuRepo{mockMenuRepo: mockMenuRepo{item: &itemCopy, category: &categoryCopy}}
	tableRepo := &mockTableRepo{
		table: &domain.RestaurantTable{ID: uuid.New(), TenantID: tenant.ID, TableNumber: "4", IsActive: true},
	}
	tenantRepo := &mockTenantRepo{tenant: tenant}

	hub := ws.NewHub()
	go hub.Run()

	r := router.SetupRouter(router.RouterDependencies{
		Config: &config.Config{
			Environment: "test",
			QRSecretKey: liveMenuQRSecret,
			JWTSecret:   liveMenuJWTSecret,
			FrontendURL: "http://localhost:5173",
		},
		TenantUsecase: &mockFullTenantUsecase{tenant: tenant},
		MenuUsecase:   usecase.NewMenuUsecase(tenantRepo, menuRepo),
		OrderUsecase:  usecase.NewOrderUsecase(&mockOrderRepo{}, tenantRepo, tableRepo, menuRepo, liveMenuQRSecret),
		TableUsecase:  usecase.NewTableUsecase(tableRepo, liveMenuQRSecret),
		Hub:           hub,
	})

	server := httptest.NewServer(r)
	t.Cleanup(server.Close)

	return &liveMenuEnv{server: server, tenant: tenant, item: item, category: category, hub: hub}
}

func (e *liveMenuEnv) wsURL(path string) string {
	return "ws" + strings.TrimPrefix(e.server.URL, "http") + path
}

// openMenu connects the way a customer's menu page does and waits until the hub has registered it
func (e *liveMenuEnv) openMenu(t *testing.T) *websocket.Conn {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial(e.wsURL("/ws/menu/"+e.tenant.Slug), nil)
	if err != nil {
		t.Fatalf("failed to open the menu socket: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	time.Sleep(100 * time.Millisecond)
	return conn
}

func (e *liveMenuEnv) staffToken(t *testing.T, role string) string {
	t.Helper()
	token, err := security.GenerateJWT(uuid.New(), e.tenant.ID, role, liveMenuJWTSecret, time.Hour)
	if err != nil {
		t.Fatalf("failed to sign staff token: %v", err)
	}
	return token
}

func (e *liveMenuEnv) send(t *testing.T, method, path, token string, body interface{}) *http.Response {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		payload, _ := json.Marshal(body)
		reader = bytes.NewReader(payload)
	} else {
		reader = bytes.NewReader(nil)
	}
	req, _ := http.NewRequest(method, e.server.URL+path, reader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s failed: %v", method, path, err)
	}
	t.Cleanup(func() { res.Body.Close() })
	return res
}

func (e *liveMenuEnv) placeOrder(t *testing.T) *http.Response {
	t.Helper()
	return e.send(t, http.MethodPost, "/api/v1/menus/"+e.tenant.Slug+"/orders", "", map[string]interface{}{
		"table_number": "4",
		"table_token":  security.GenerateTableToken(e.tenant.ID.String(), "4", liveMenuQRSecret),
		"items":        []map[string]interface{}{{"menu_item_id": e.item.ID, "quantity": 1}},
	})
}

// nextEvent returns the next event name received on the socket, or "" if none arrives in time.
// A timed-out read leaves the connection unusable, so only wait for "nothing" as the last check.
func nextEvent(conn *websocket.Conn, wait time.Duration) string {
	_ = conn.SetReadDeadline(time.Now().Add(wait))
	_, payload, err := conn.ReadMessage()
	if err != nil {
		return ""
	}
	var msg ws.TenantMessage
	if json.Unmarshal(payload, &msg) != nil {
		return ""
	}
	return msg.Event
}

func TestLiveMenu_EveryStaffChangeReachesOpenMenus(t *testing.T) {
	cases := []struct {
		name   string
		role   string
		method string
		path   func(e *liveMenuEnv) string
		body   func(e *liveMenuEnv) interface{}
	}{
		{
			name: "price change", role: "manager", method: http.MethodPut,
			path: func(e *liveMenuEnv) string { return "/api/v1/admin/items/" + e.item.ID.String() },
			body: func(e *liveMenuEnv) interface{} {
				return map[string]interface{}{"category_id": e.category.ID, "name": e.item.Name, "price": 520.0, "is_available": true}
			},
		},
		{
			name: "new dish", role: "manager", method: http.MethodPost,
			path: func(e *liveMenuEnv) string { return "/api/v1/admin/items" },
			body: func(e *liveMenuEnv) interface{} {
				return map[string]interface{}{"category_id": e.category.ID, "name": "Smash Burger", "price": 300.0}
			},
		},
		{
			name: "dish removed", role: "owner", method: http.MethodDelete,
			path: func(e *liveMenuEnv) string { return "/api/v1/admin/items/" + e.item.ID.String() },
		},
		{
			name: "sold out", role: "kitchen", method: http.MethodPatch,
			path: func(e *liveMenuEnv) string { return "/api/v1/admin/items/" + e.item.ID.String() + "/sold-out" },
			body: func(e *liveMenuEnv) interface{} { return map[string]interface{}{"is_sold_out": true} },
		},
		{
			name: "new category", role: "manager", method: http.MethodPost,
			path: func(e *liveMenuEnv) string { return "/api/v1/admin/categories" },
			body: func(e *liveMenuEnv) interface{} { return map[string]interface{}{"name": "Drinks"} },
		},
		{
			name: "category renamed", role: "manager", method: http.MethodPut,
			path: func(e *liveMenuEnv) string { return "/api/v1/admin/categories/" + e.category.ID.String() },
			body: func(e *liveMenuEnv) interface{} { return map[string]interface{}{"name": "Signature Burgers"} },
		},
		{
			name: "category removed", role: "owner", method: http.MethodDelete,
			path: func(e *liveMenuEnv) string { return "/api/v1/admin/categories/" + e.category.ID.String() },
		},
		{
			name: "branding changed", role: "owner", method: http.MethodPatch,
			path: func(e *liveMenuEnv) string { return "/api/v1/admin/tenant/theme" },
			body: func(e *liveMenuEnv) interface{} {
				return map[string]interface{}{"theme_config": map[string]interface{}{"primary": "#ff5500"}}
			},
		},
		{
			name: "plan changed", role: "super_admin", method: http.MethodPatch,
			path: func(e *liveMenuEnv) string { return "/api/v1/admin/tenant/plan" },
			body: func(e *liveMenuEnv) interface{} { return map[string]interface{}{"plan": "standard"} },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			env := newLiveMenuEnv(t)
			menu := env.openMenu(t)

			var body interface{}
			if tc.body != nil {
				body = tc.body(env)
			}
			res := env.send(t, tc.method, tc.path(env), env.staffToken(t, tc.role), body)
			if res.StatusCode >= 300 {
				t.Fatalf("expected the change to succeed, got %d", res.StatusCode)
			}

			if event := nextEvent(menu, 2*time.Second); event != "menu:updated" {
				t.Fatalf("expected the open menu to receive menu:updated, got %q", event)
			}
		})
	}
}

func TestLiveMenu_RejectedChangeIsNotBroadcast(t *testing.T) {
	env := newLiveMenuEnv(t)
	menu := env.openMenu(t)

	// A negative price fails validation, so nothing on the menu changed
	res := env.send(t, http.MethodPut, "/api/v1/admin/items/"+env.item.ID.String(), env.staffToken(t, "manager"),
		map[string]interface{}{"category_id": env.category.ID, "name": env.item.Name, "price": -5.0})
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for a negative price, got %d", res.StatusCode)
	}

	// Customers' menus must not reload for a change that never happened
	if event := nextEvent(menu, 300*time.Millisecond); event != "" {
		t.Fatalf("expected no event after a rejected change, got %q", event)
	}
}

func TestLiveMenu_UnauthorizedChangeIsNotBroadcast(t *testing.T) {
	env := newLiveMenuEnv(t)
	menu := env.openMenu(t)

	// Waiters may mark dishes sold out but not change prices
	res := env.send(t, http.MethodPut, "/api/v1/admin/items/"+env.item.ID.String(), env.staffToken(t, "waiter"),
		map[string]interface{}{"category_id": env.category.ID, "name": env.item.Name, "price": 1.0, "is_available": true})
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for a waiter changing a price, got %d", res.StatusCode)
	}

	if event := nextEvent(menu, 300*time.Millisecond); event != "" {
		t.Fatalf("expected no event after a forbidden change, got %q", event)
	}
}

func TestLiveMenu_NewPriceIsChargedImmediately(t *testing.T) {
	env := newLiveMenuEnv(t)

	// First order remembers the dish at its current price
	res := env.placeOrder(t)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("expected first order to succeed, got %d", res.StatusCode)
	}

	res = env.send(t, http.MethodPut, "/api/v1/admin/items/"+env.item.ID.String(), env.staffToken(t, "manager"),
		map[string]interface{}{"category_id": env.category.ID, "name": env.item.Name, "price": 520.0, "is_available": true})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected price change to succeed, got %d", res.StatusCode)
	}

	// The very next order must use the new price, not the remembered one
	res = env.placeOrder(t)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("expected second order to succeed, got %d", res.StatusCode)
	}
	var placed struct {
		Order domain.Order `json:"order"`
	}
	if err := json.NewDecoder(res.Body).Decode(&placed); err != nil {
		t.Fatalf("invalid order response: %v", err)
	}
	if placed.Order.TotalAmount != 520.0 {
		t.Fatalf("expected the order to be charged the new price 520, got %.2f", placed.Order.TotalAmount)
	}
}

func TestLiveMenu_SoldOutDishCannotBeOrderedImmediately(t *testing.T) {
	env := newLiveMenuEnv(t)

	if res := env.placeOrder(t); res.StatusCode != http.StatusCreated {
		t.Fatalf("expected first order to succeed, got %d", res.StatusCode)
	}

	res := env.send(t, http.MethodPatch, "/api/v1/admin/items/"+env.item.ID.String()+"/sold-out", env.staffToken(t, "kitchen"),
		map[string]interface{}{"is_sold_out": true})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected sold-out toggle to succeed, got %d", res.StatusCode)
	}

	if res := env.placeOrder(t); res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected an order for a sold-out dish to be rejected, got %d", res.StatusCode)
	}
}

func TestLiveMenu_KitchenScreenGetsOrdersAndMenuUpdates(t *testing.T) {
	env := newLiveMenuEnv(t)

	kitchen, _, err := websocket.DefaultDialer.Dial(env.wsURL("/ws/kitchen?token="+env.staffToken(t, "kitchen")), nil)
	if err != nil {
		t.Fatalf("failed to open the kitchen socket: %v", err)
	}
	defer kitchen.Close()
	menu := env.openMenu(t)

	if res := env.placeOrder(t); res.StatusCode != http.StatusCreated {
		t.Fatalf("expected order to succeed, got %d", res.StatusCode)
	}
	if event := nextEvent(kitchen, 2*time.Second); event != "order:created" {
		t.Fatalf("expected the kitchen to receive order:created, got %q", event)
	}

	res := env.send(t, http.MethodPatch, "/api/v1/admin/items/"+env.item.ID.String()+"/sold-out", env.staffToken(t, "kitchen"),
		map[string]interface{}{"is_sold_out": true})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected sold-out toggle to succeed, got %d", res.StatusCode)
	}

	// Kitchen keeps its sold-out event and also gets the menu update; the customer only the menu update
	kitchenEvents := map[string]bool{nextEvent(kitchen, 2*time.Second): true, nextEvent(kitchen, 2*time.Second): true}
	if !kitchenEvents["item:sold_out_toggled"] || !kitchenEvents["menu:updated"] {
		t.Fatalf("expected the kitchen to receive item:sold_out_toggled and menu:updated, got %v", kitchenEvents)
	}
	// Orders hold customer session tokens: the order was sent first, so if customers' menus could
	// see orders it would arrive here before the menu update
	if event := nextEvent(menu, 2*time.Second); event != "menu:updated" {
		t.Fatalf("expected the customer menu's first event to be menu:updated, got %q", event)
	}
	if event := nextEvent(menu, 300*time.Millisecond); event != "" {
		t.Fatalf("expected the customer menu to receive only menu:updated, got extra %q", event)
	}
}

func TestLiveMenu_SuspendedRestaurantMenuSocketIsRejected(t *testing.T) {
	env := newLiveMenuEnv(t)
	env.tenant.IsActive = false

	_, res, err := websocket.DefaultDialer.Dial(env.wsURL("/ws/menu/"+env.tenant.Slug), nil)
	if err == nil || res == nil || res.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for a suspended restaurant, got err=%v res=%v", err, res)
	}
}
