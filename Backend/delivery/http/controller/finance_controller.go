package controller

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"menu-backend/domain"
)

type FinanceController struct {
	financeUsecase domain.FinanceUsecase
}

func NewFinanceController(financeUsecase domain.FinanceUsecase) *FinanceController {
	return &FinanceController{financeUsecase: financeUsecase}
}

func writeFinanceError(c *gin.Context, err error) {
	var valErr *domain.ValidationError
	if errors.As(err, &valErr) {
		c.JSON(http.StatusBadRequest, gin.H{"error": valErr.Message})
		return
	}
	log.Printf("finance error: %v", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load finance data"})
}

// Summary handles GET /api/v1/admin/finance/summary?from=&to=
func (ctrl *FinanceController) Summary(c *gin.Context) {
	_, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	summary, err := ctrl.financeUsecase.Summary(c.Request.Context(), tenantID, c.Query("from"), c.Query("to"))
	if err != nil {
		writeFinanceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": summary})
}

// Trend handles GET /api/v1/admin/finance/trend?from=&to=&group=
func (ctrl *FinanceController) Trend(c *gin.Context) {
	_, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	trend, err := ctrl.financeUsecase.Trend(c.Request.Context(), tenantID, c.Query("from"), c.Query("to"), c.Query("group"))
	if err != nil {
		writeFinanceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": trend})
}

// TopDishes handles GET /api/v1/admin/finance/top-dishes?from=&to=&limit=
func (ctrl *FinanceController) TopDishes(c *gin.Context) {
	_, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	limit := 10
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	dishes, err := ctrl.financeUsecase.TopDishes(c.Request.Context(), tenantID, c.Query("from"), c.Query("to"), limit)
	if err != nil {
		writeFinanceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": dishes})
}

// PaymentMethods handles GET /api/v1/admin/finance/payment-methods?from=&to=
func (ctrl *FinanceController) PaymentMethods(c *gin.Context) {
	_, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	methods, err := ctrl.financeUsecase.PaymentMethods(c.Request.Context(), tenantID, c.Query("from"), c.Query("to"))
	if err != nil {
		writeFinanceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": methods})
}

// StaffPerformance handles GET /api/v1/admin/finance/staff?from=&to=
func (ctrl *FinanceController) StaffPerformance(c *gin.Context) {
	_, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	staff, err := ctrl.financeUsecase.StaffPerformance(c.Request.Context(), tenantID, c.Query("from"), c.Query("to"))
	if err != nil {
		writeFinanceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": staff})
}

// ExportCSV handles GET /api/v1/admin/finance/summary.csv?from=&to=
func (ctrl *FinanceController) ExportCSV(c *gin.Context) {
	_, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	data, filename, err := ctrl.financeUsecase.ExportCSV(c.Request.Context(), tenantID, c.Query("from"), c.Query("to"))
	if err != nil {
		writeFinanceError(c, err)
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Data(http.StatusOK, "text/csv; charset=utf-8", data)
}
