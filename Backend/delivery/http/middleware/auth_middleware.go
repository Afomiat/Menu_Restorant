package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"menu-backend/domain"
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
		if exists && domain.NormalizeRole(claims.Role) != domain.RoleSuperAdmin {
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

// GetAuthClaims returns the logged-in staff member's token claims set by AuthMiddleware
func GetAuthClaims(c *gin.Context) (*security.JWTClaims, bool) {
	val, exists := c.Get(AuthClaimsKey)
	if !exists {
		return nil, false
	}
	claims, ok := val.(*security.JWTClaims)
	return claims, ok
}

// RequireActiveStaff refuses accounts a manager has turned off, even if their login has not expired
func RequireActiveStaff(staffUsecase domain.StaffUsecase) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := GetAuthClaims(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			c.Abort()
			return
		}

		active, err := staffUsecase.IsActive(c.Request.Context(), claims.UserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check staff account"})
			c.Abort()
			return
		}
		if !active {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "STAFF_INACTIVE",
				"message": domain.ErrStaffInactive.Error(),
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequireRole enforces role-based permissions (e.g. only "chef", "manager").
// Roles from logins issued before the Pro roles (owner, kitchen) count as manager and chef.
func RequireRole(allowedRoles ...domain.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := GetAuthClaims(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			c.Abort()
			return
		}

		role := domain.NormalizeRole(claims.Role)

		// Super admin has access to everything
		if role == domain.RoleSuperAdmin {
			c.Next()
			return
		}

		for _, allowed := range allowedRoles {
			if role == allowed {
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
