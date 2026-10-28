package test

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"menu-backend/domain"
	"menu-backend/internal/ws"
)

func dialMenuSocket(t *testing.T, server *httptest.Server, slug string) *websocket.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/menu/" + slug
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("failed to connect to menu socket: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

func TestMenuSocket_GuestReceivesMenuUpdatesButNotOrders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tenant := &domain.Tenant{ID: uuid.New(), Slug: "azai-burger", IsActive: true}

	hub := ws.NewHub()
	go hub.Run()

	r := gin.New()
	r.GET("/ws/menu/:slug", ws.ServeMenuWS(hub, &mockTenantUsecase{tenant: tenant}))
	server := httptest.NewServer(r)
	defer server.Close()

	conn := dialMenuSocket(t, server, tenant.Slug)
	time.Sleep(100 * time.Millisecond) // let the hub register the connection

	// Orders carry customer details and must never reach customers' menu pages
	hub.BroadcastToTenant(tenant.ID, "order:created", map[string]string{"customer_session_token": "secret"})
	hub.BroadcastMenuUpdate(tenant.ID)

	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, payload, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("expected a menu update, got error: %v", err)
	}

	var msg ws.TenantMessage
	if err := json.Unmarshal(payload, &msg); err != nil {
		t.Fatalf("invalid message: %v", err)
	}
	if msg.Event != "menu:updated" {
		t.Fatalf("expected first message to be menu:updated, got %q", msg.Event)
	}
}

func TestMenuSocket_OtherRestaurantsUpdatesAreNotReceived(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tenant := &domain.Tenant{ID: uuid.New(), Slug: "azai-burger", IsActive: true}

	hub := ws.NewHub()
	go hub.Run()

	r := gin.New()
	r.GET("/ws/menu/:slug", ws.ServeMenuWS(hub, &mockTenantUsecase{tenant: tenant}))
	server := httptest.NewServer(r)
	defer server.Close()

	conn := dialMenuSocket(t, server, tenant.Slug)
	time.Sleep(100 * time.Millisecond)

	hub.BroadcastMenuUpdate(uuid.New())

	_ = conn.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
	if _, payload, err := conn.ReadMessage(); err == nil {
		t.Fatalf("expected no message, got %s", payload)
	}
}

func TestMenuSocket_UnknownRestaurantIsRejected(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.GET("/ws/menu/:slug", ws.ServeMenuWS(ws.NewHub(), &mockTenantUsecase{}))
	server := httptest.NewServer(r)
	defer server.Close()

	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/menu/nope"
	if _, resp, err := websocket.DefaultDialer.Dial(url, nil); err == nil || resp == nil || resp.StatusCode != 404 {
		t.Fatalf("expected 404 for an unknown restaurant, got err=%v resp=%v", err, resp)
	}
}
