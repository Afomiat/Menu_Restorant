package middleware

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORSMiddleware configures cross-origin access with RFC 6454 credentials compliance
func CORSMiddleware(frontendURL string) gin.HandlerFunc {
	config := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Session-Token", "X-Tenant-Slug"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	origins := []string{"http://localhost:5173", "http://localhost:3000", "http://localhost:8080"}
	if frontendURL != "" && frontendURL != "*" {
		origins = append(origins, frontendURL)
	}
	config.AllowOrigins = origins

	// In dev/wildcard mode, dynamically reflect the requesting origin so AllowCredentials works per RFC 6454
	if frontendURL == "*" || frontendURL == "" {
		config.AllowOriginFunc = func(origin string) bool {
			return true
		}
		config.AllowOrigins = nil
	}

	return cors.New(config)
}
