package middleware

import (
	"regexp"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// lanIPRegex strictly matches RFC 1918 private IPv4 addresses with optional port
var lanIPRegex = regexp.MustCompile(`^https?://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$`)

// CORSMiddleware configures cross-origin access with RFC 6454 credentials compliance
func CORSMiddleware(frontendURL string) gin.HandlerFunc {
	config := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Session-Token", "X-Tenant-Slug"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	allowedOrigins := []string{
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://localhost:8080",
		"http://127.0.0.1:8080",
	}

	if frontendURL != "" && frontendURL != "*" {
		cleanFrontend := strings.TrimRight(frontendURL, "/")
		allowedOrigins = append(allowedOrigins, cleanFrontend)
	}

	config.AllowOriginFunc = func(origin string) bool {
		cleanOrigin := strings.TrimRight(origin, "/")
		for _, allowed := range allowedOrigins {
			if cleanOrigin == allowed {
				return true
			}
		}
		// Allow strictly formatted local private LAN IP development/testing (e.g. mobile testing on 192.168.1.15:5173)
		if lanIPRegex.MatchString(cleanOrigin) {
			return true
		}
		return false
	}
	config.AllowOrigins = nil

	return cors.New(config)
}
