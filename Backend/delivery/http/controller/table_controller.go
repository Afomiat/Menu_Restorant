package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
)

type TableController struct {
	tableUsecase  domain.TableUsecase
	tenantUsecase domain.TenantUsecase
}

func NewTableController(tableUsecase domain.TableUsecase, tenantUsecase domain.TenantUsecase) *TableController {
	return &TableController{
		tableUsecase:  tableUsecase,
		tenantUsecase: tenantUsecase,
	}
}

// ListTables handles GET /api/v1/admin/tables
func (ctrl *TableController) ListTables(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	tables, err := ctrl.tableUsecase.ListTables(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch tables"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": tables,
	})
}

type CreateTableRequest struct {
	TableNumber string `json:"table_number" binding:"required,max=20"`
}

// CreateTable handles POST /api/v1/admin/tables
func (ctrl *TableController) CreateTable(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	var req CreateTableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table_number is required"})
		return
	}

	table, err := ctrl.tableUsecase.CreateTable(c.Request.Context(), domain.CreateTableInput{
		TenantID:    tenantID,
		TableNumber: req.TableNumber,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "table created successfully",
		"data":    table,
	})
}

// GenerateTableQR handles POST /api/v1/admin/tables/qr
// Generates a cryptographically signed dine-in table QR link
func (ctrl *TableController) GenerateTableQR(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant identification missing"})
		return
	}

	tenant, err := ctrl.tenantUsecase.GetTenantByID(c.Request.Context(), tenantID)
	if err != nil || tenant == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "restaurant tenant not found"})
		return
	}

	var req struct {
		TableNumber string `json:"table_number" binding:"required,max=20"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table_number is required"})
		return
	}

	qrURL, err := ctrl.tableUsecase.GenerateTableQR(c.Request.Context(), tenant.Slug, tenant.ID, req.TableNumber)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"table_number": req.TableNumber,
		"qr_url":       qrURL,
	})
}

// ValidateTable handles GET /api/v1/menus/:slug/tables/validate
// Customer scans QR code: validates HMAC signature and confirms table exists & is active
func (ctrl *TableController) ValidateTable(c *gin.Context) {
	tenant, ok := middleware.GetTenantFromContext(c)
	if !ok || tenant == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "restaurant context missing"})
		return
	}

	tableNumber := c.Query("table")
	token := c.Query("token")

	if tableNumber == "" || token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table and token parameters are required"})
		return
	}

	valid, err := ctrl.tableUsecase.ValidateTableToken(c.Request.Context(), tenant.ID, tableNumber, token)
	if err != nil || !valid {
		c.JSON(http.StatusForbidden, gin.H{
			"valid":   false,
			"error":   "INVALID_TABLE_TOKEN",
			"message": "This table QR code is invalid, expired, or has been tampered with.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":        true,
		"table_number": tableNumber,
		"tenant_id":    tenant.ID,
		"tenant_name":  tenant.Name,
	})
}
