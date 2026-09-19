package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/google/uuid"
)

type TenantMessage struct {
	TenantID uuid.UUID   `json:"tenant_id"`
	Event    string      `json:"event"`
	Data     interface{} `json:"data"`
}

type Hub struct {
	// Rooms separated by tenantID -> set of connected client tablets
	rooms      map[uuid.UUID]map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan TenantMessage
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[uuid.UUID]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan TenantMessage, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, exists := h.rooms[client.tenantID]; !exists {
				h.rooms[client.tenantID] = make(map[*Client]bool)
			}
			h.rooms[client.tenantID][client] = true
			h.mu.Unlock()
			log.Printf("🔌 Kitchen tablet connected for restaurant %s (active in room: %d)", client.tenantID, len(h.rooms[client.tenantID]))

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.rooms[client.tenantID]; ok {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					close(client.send)
					if len(clients) == 0 {
						delete(h.rooms, client.tenantID)
					}
				}
			}
			h.mu.Unlock()
			log.Printf("🔌 Kitchen tablet disconnected for restaurant %s", client.tenantID)

		case msg := <-h.broadcast:
			h.mu.Lock()
			clients, ok := h.rooms[msg.TenantID]
			if ok {
				payload, err := json.Marshal(msg)
				if err == nil {
					for client := range clients {
						select {
						case client.send <- payload:
						default:
							close(client.send)
							delete(clients, client)
						}
					}
					if len(clients) == 0 {
						delete(h.rooms, msg.TenantID)
					}
				}
			}
			h.mu.Unlock()
		}
	}
}

// BroadcastToTenant sends an event strictly to connected tablets belonging to the specified restaurant
func (h *Hub) BroadcastToTenant(tenantID uuid.UUID, event string, data interface{}) {
	h.broadcast <- TenantMessage{
		TenantID: tenantID,
		Event:    event,
		Data:     data,
	}
}
