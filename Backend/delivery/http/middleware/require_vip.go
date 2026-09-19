package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/domain"
)

// RequireVIPPlan enforces that digital ordering and KDS features are only active for VIP tier restaurants
func RequireVIPPlan(tenantUsecase domain.TenantUsecase) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Check if full tenant entity is already in context (from TenantMiddleware in customer routes)
		if tenant, ok := GetTenantFromContext(c); ok && tenant != nil {
			if !tenant.HasVIPFeatures() {
				c.JSON(http.StatusForbidden, gin.H{
					"error":        "UPGRADE_REQUIRED",
					"message":      "Digital ordering and Kitchen Display are VIP features. Upgrade to VIP tier to enable.",
					"current_plan": tenant.Plan,
				})
				c.Abort()
				return
			}
			c.Next()
			return
		}

		// 2. Check if tenant ID is in context (from AuthMiddleware in Admin routes)
		if tenantID, ok := GetTenantIDFromContext(c); ok && tenantID != uuid.Nil {
			hasVIP, err := tenantUsecase.VerifyVIPAccess(c.Request.Context(), tenantID)
			if err != nil || !hasVIP {
				c.JSON(http.StatusForbidden, gin.H{
					"error":   "UPGRADE_REQUIRED",
					"message": "Kitchen Display System live orders and feeds are restricted to VIP tier restaurants. Please upgrade your license.",
				})
				c.Abort()
				return
			}
			c.Next()
			return
		}

		c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context missing"})
		c.Abort()
	}
}
