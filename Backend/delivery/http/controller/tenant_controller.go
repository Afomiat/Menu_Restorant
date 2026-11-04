package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
	"menu-backend/internal/ws"
)

type TenantController struct {
	tenantUsecase domain.TenantUsecase
	hub           *ws.Hub
}

func NewTenantController(tenantUsecase domain.TenantUsecase, hub *ws.Hub) *TenantController {
	return &TenantController{tenantUsecase: tenantUsecase, hub: hub}
}

// GetTenantProfile handles GET /api/v1/admin/tenant
// Returns the restaurant profile and branding settings for the logged-in admin's tenant
func (ctrl *TenantController) GetTenantProfile(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	tenant, err := ctrl.tenantUsecase.GetTenantByID(c.Request.Context(), tenantID)
	if err != nil || tenant == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant profile not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": tenant,
	})
}

type UpdateThemeRequest struct {
	ThemeConfig map[string]interface{} `json:"theme_config" binding:"required"`
}

// UpdateTheme handles PATCH /api/v1/admin/tenant/theme
// Allows owners and managers to customize colors, fonts, banner layouts, and brand assets
func (ctrl *TenantController) UpdateTheme(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	var req UpdateThemeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "theme_config is required"})
		return
	}

	tenant, err := ctrl.tenantUsecase.UpdateTheme(c.Request.Context(), tenantID, req.ThemeConfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update restaurant theme"})
		return
	}

	// Open menu pages pick up the new branding without reloading
	if ctrl.hub != nil {
		ctrl.hub.BroadcastMenuUpdate(tenantID)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "restaurant theme updated successfully",
		"data":    tenant,
	})
}

type UpdatePlanRequest struct {
	Plan string `json:"plan" binding:"required"`
}

// UpdatePlan handles PATCH /api/v1/admin/tenant/plan
// Changes the plan of the logged-in admin's own restaurant (super admins only)
func (ctrl *TenantController) UpdatePlan(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}
	ctrl.applyPlan(c, tenantID)
}

// ListPlans handles GET /api/v1/superadmin/plans
// Returns every plan from lowest to highest so the admin dashboard can offer them as choices
func (ctrl *TenantController) ListPlans(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"data": domain.Plans,
	})
}

// SetTenantPlan handles PATCH /api/v1/superadmin/tenants/:id/plan
// Lets the Azai team assign any restaurant to Basic, Plus or Pro
func (ctrl *TenantController) SetTenantPlan(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid restaurant id"})
		return
	}

	if tenant, err := ctrl.tenantUsecase.GetTenantByID(c.Request.Context(), tenantID); err != nil || tenant == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "restaurant not found"})
		return
	}
	ctrl.applyPlan(c, tenantID)
}

func (ctrl *TenantController) applyPlan(c *gin.Context, tenantID uuid.UUID) {
	var req UpdatePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": domain.ErrInvalidPlan.Error()})
		return
	}

	planTier := domain.PlanTier(req.Plan)
	if !planTier.IsValid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": domain.ErrInvalidPlan.Error()})
		return
	}

	if err := ctrl.tenantUsecase.UpdatePlan(c.Request.Context(), tenantID, planTier); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update plan"})
		return
	}

	// Open menu pages switch ordering on or off without reloading
	if ctrl.hub != nil {
		ctrl.hub.BroadcastMenuUpdate(tenantID)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "restaurant plan successfully updated",
		"plan":    planTier,
	})
}

// ListPublicTenants handles GET /api/v1/restaurants
// Returns all active restaurants in the database for the landing discovery view
func (ctrl *TenantController) ListPublicTenants(c *gin.Context) {
	tenants, err := ctrl.tenantUsecase.ListActive(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load restaurants"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": tenants,
	})
}
