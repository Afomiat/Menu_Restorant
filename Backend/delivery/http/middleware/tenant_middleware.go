package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/domain"
)

const (
	TenantContextKey   = "current_tenant"
	TenantIDContextKey = "current_tenant_id"
)

// TenantMiddleware isolates every request strictly to the resolved restaurant
func TenantMiddleware(tenantUsecase domain.TenantUsecase) gin.HandlerFunc {
	return func(c *gin.Context) {
		slug := c.Param("slug")
		if slug == "" {
			slug = c.GetHeader("X-Tenant-Slug")
		}

		if slug == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "restaurant slug is required"})
			c.Abort()
			return
		}

		tenant, err := tenantUsecase.GetTenantBySlug(c.Request.Context(), slug)
		if err != nil || tenant == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "restaurant not found"})
			c.Abort()
			return
		}

		if !tenant.IsActive {
			c.JSON(http.StatusForbidden, gin.H{"error": "this restaurant account is suspended or inactive"})
			c.Abort()
			return
		}

		// Inject tenant entity and tenant UUID into Gin context
		c.Set(TenantContextKey, tenant)
		c.Set(TenantIDContextKey, tenant.ID)
		c.Next()
	}
}

// GetTenantFromContext helper to retrieve the tenant in any handler
func GetTenantFromContext(c *gin.Context) (*domain.Tenant, bool) {
	val, exists := c.Get(TenantContextKey)
	if !exists {
		return nil, false
	}
	tenant, ok := val.(*domain.Tenant)
	return tenant, ok
}

// GetTenantIDFromContext helper to retrieve the tenant UUID directly
func GetTenantIDFromContext(c *gin.Context) (uuid.UUID, bool) {
	val, exists := c.Get(TenantIDContextKey)
	if !exists {
		return uuid.Nil, false
	}
	id, ok := val.(uuid.UUID)
	return id, ok
}
