package ws

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"menu-backend/domain"
	"menu-backend/internal/security"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allows frontend connections
	},
}

// ServeWS authenticates the kitchen tablet via ?token=<jwt>, verifies VIP license, and connects to its private room
func ServeWS(hub *Hub, tenantUsecase domain.TenantUsecase, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Query("token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "websocket token parameter is required"})
			return
		}

		claims, err := security.ValidateJWT(token, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		// VIP PLAN CHECK: Only restaurants with VIP tier have access to real-time Kitchen Display WebSocket
		hasVIP, err := tenantUsecase.VerifyVIPAccess(c.Request.Context(), claims.TenantID)
		if err != nil || !hasVIP {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "UPGRADE_REQUIRED",
				"message": "Real-time kitchen display WebSocket feed is restricted to VIP tier restaurants.",
			})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}

		client := &Client{
			hub:      hub,
			conn:     conn,
			tenantID: claims.TenantID,
			send:     make(chan []byte, 256),
		}

		client.hub.register <- client

		go client.WritePump()
		go client.ReadPump()
	}
}
