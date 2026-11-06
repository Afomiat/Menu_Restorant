package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/google/uuid"

	"menu-backend/domain"
)

type TenantMessage struct {
	TenantID uuid.UUID   `json:"tenant_id"`
	Event    string      `json:"event"`
	Data     interface{} `json:"data"`
	// public messages also reach customers' menu pages; all others go to staff screens only
	public bool
	// audience, when set, limits a staff message to these roles and people
	audience *domain.Audience
}

// reaches reports whether a message goes to this client
func (m TenantMessage) reaches(c *Client) bool {
	if c.guest {
		return m.public
	}
	if m.audience == nil {
		return true
	}
	for _, role := range m.audience.Roles {
		if c.role == role {
			return true
		}
	}
	for _, id := range m.audience.UserIDs {
		if c.userID == id {
			return true
		}
	}
	return false
}

// maxGuestsPerRestaurant caps how many customer menu pages one restaurant room holds
const maxGuestsPerRestaurant = 1000

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
			if client.guest && countGuests(h.rooms[client.tenantID]) >= maxGuestsPerRestaurant {
				h.mu.Unlock()
				close(client.send) // the write pump closes the connection
				continue
			}
			h.rooms[client.tenantID][client] = true
			h.mu.Unlock()
			if !client.guest {
				log.Printf("🔌 Kitchen tablet connected for restaurant %s", client.tenantID)
			}

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
			if !client.guest {
				log.Printf("🔌 Kitchen tablet disconnected for restaurant %s", client.tenantID)
			}

		case msg := <-h.broadcast:
			h.mu.Lock()
			clients, ok := h.rooms[msg.TenantID]
			if ok {
				payload, err := json.Marshal(msg)
				if err == nil {
					for client := range clients {
						if !msg.reaches(client) {
							continue
						}
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

// NotifyStaff sends an event only to the staff screens in the audience, for example the
// waiter of one table or the restaurant's managers
func (h *Hub) NotifyStaff(tenantID uuid.UUID, to domain.Audience, event string, data interface{}) {
	h.broadcast <- TenantMessage{
		TenantID: tenantID,
		Event:    event,
		Data:     data,
		audience: &to,
	}
}

// BroadcastMenuUpdate tells every open screen of the restaurant, customers' menu pages included,
// that its menu changed (prices, dishes, categories, sold-out marks, branding) so they reload it
func (h *Hub) BroadcastMenuUpdate(tenantID uuid.UUID) {
	h.broadcast <- TenantMessage{
		TenantID: tenantID,
		Event:    "menu:updated",
		public:   true,
	}
}

func countGuests(clients map[*Client]bool) int {
	count := 0
	for client := range clients {
		if client.guest {
			count++
		}
	}
	return count
}
