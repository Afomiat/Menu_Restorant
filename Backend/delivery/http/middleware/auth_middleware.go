package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"menu-backend/internal/security"
)

const AuthClaimsKey = "auth_claims"

// AuthMiddleware validates staff/admin JWT and prevents CROSS-TENANT DATA ACCESS
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header is required"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format; expected 'Bearer <token>'"})
			c.Abort()
			return
		}

		claims, err := security.ValidateJWT(parts[1], jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}

		// MULTI-TENANT ISOLATION CHECK:
		// If the route is scoped to a specific restaurant tenant, verify that
		// the user's token belongs to THAT restaurant (super_admin can bypass).
		routeTenantID, exists := GetTenantIDFromContext(c)
		if exists && claims.Role != "super_admin" {
			if claims.TenantID != routeTenantID {
				c.JSON(http.StatusForbidden, gin.H{
					"error":   "CROSS_TENANT_ACCESS_DENIED",
					"message": "Security Alert: You are not authorized to access another restaurant's data",
				})
				c.Abort()
				return
			}
		}

		// Store claims in context
		c.Set(AuthClaimsKey, claims)
		c.Set(TenantIDContextKey, claims.TenantID)
		c.Next()
	}
}

// RequireRole enforces role-based permissions (e.g. only "kitchen", "manager", "owner")
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		val, exists := c.Get(AuthClaimsKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			c.Abort()
			return
		}

		claims, ok := val.(*security.JWTClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth context"})
			c.Abort()
			return
		}

		// Super admin has access to everything
		if claims.Role == "super_admin" {
			c.Next()
			return
		}

		for _, role := range allowedRoles {
			if claims.Role == role {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error":   "INSUFFICIENT_PERMISSIONS",
			"message": "You do not have permission to perform this action",
		})
		c.Abort()
	}
}
