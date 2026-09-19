package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
)

type TenantController struct {
	tenantUsecase domain.TenantUsecase
}

func NewTenantController(tenantUsecase domain.TenantUsecase) *TenantController {
	return &TenantController{tenantUsecase: tenantUsecase}
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

	c.JSON(http.StatusOK, gin.H{
		"message": "restaurant theme updated successfully",
		"data":    tenant,
	})
}

type UpdatePlanRequest struct {
	Plan string `json:"plan" binding:"required"`
}

// UpdatePlan handles PATCH /api/v1/admin/tenant/plan
// Allows restaurant owners or super admins to upgrade or change license tier (e.g., standard -> vip)
func (ctrl *TenantController) UpdatePlan(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	var req UpdatePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "plan is required (allowed: 'standard' or 'vip')"})
		return
	}

	planTier := domain.PlanTier(req.Plan)
	if planTier != domain.PlanStandard && planTier != domain.PlanVIP {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid plan; allowed values are 'standard' or 'vip'"})
		return
	}

	if err := ctrl.tenantUsecase.UpdatePlan(c.Request.Context(), tenantID, planTier); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update plan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "restaurant license tier successfully updated",
		"plan":    planTier,
	})
}
