package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/domain"
)

// RequirePlan enforces that a route is only active for restaurants on min or a higher plan
func RequirePlan(tenantUsecase domain.TenantUsecase, min domain.PlanTier) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Check if full tenant entity is already in context (from TenantMiddleware in customer routes)
		if tenant, ok := GetTenantFromContext(c); ok && tenant != nil {
			if !tenant.HasPlan(min) {
				c.JSON(http.StatusForbidden, gin.H{
					"error":         "UPGRADE_REQUIRED",
					"message":       "This feature needs the " + min.Label() + " plan. Upgrade to enable it.",
					"current_plan":  tenant.Plan,
					"required_plan": min,
				})
				c.Abort()
				return
			}
			c.Next()
			return
		}

		// 2. Check if tenant ID is in context (from AuthMiddleware in Admin routes)
		if tenantID, ok := GetTenantIDFromContext(c); ok && tenantID != uuid.Nil {
			hasPlan, err := tenantUsecase.VerifyPlanAccess(c.Request.Context(), tenantID, min)
			if err != nil || !hasPlan {
				c.JSON(http.StatusForbidden, gin.H{
					"error":         "UPGRADE_REQUIRED",
					"message":       "This feature needs the " + min.Label() + " plan. Upgrade to enable it.",
					"required_plan": min,
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
