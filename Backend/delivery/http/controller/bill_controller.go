package controller

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
	"menu-backend/internal/security"
)

type BillController struct {
	billUsecase      domain.BillUsecase
	tableTokenSecret string
}

func NewBillController(billUsecase domain.BillUsecase, tableTokenSecret string) *BillController {
	return &BillController{billUsecase: billUsecase, tableTokenSecret: tableTokenSecret}
}

// RequestBillByCustomer handles POST /api/v1/menus/:slug/bills/request: the customer's
// "Ask for the bill" button, proven by the table's QR token
func (ctrl *BillController) RequestBillByCustomer(c *gin.Context) {
	tenant, ok := middleware.GetTenantFromContext(c)
	if !ok || tenant == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "restaurant context missing"})
		return
	}
	var req struct {
		TableNumber string `json:"table_number" binding:"required,max=20"`
		TableToken  string `json:"table_token" binding:"required,max=128"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table_number and table_token are required"})
		return
	}
	if !security.ValidateTableToken(tenant.ID.String(), req.TableNumber, ctrl.tableTokenSecret, req.TableToken) {
		c.JSON(http.StatusForbidden, gin.H{"error": "please scan the QR code on your table to ask for the bill"})
		return
	}

	bill, err := ctrl.billUsecase.RequestByCustomer(c.Request.Context(), tenant.ID, req.TableNumber)
	if err != nil {
		writeBillError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": bill.Status, "total_amount": bill.TotalAmount, "amount_owed": bill.AmountOwed}})
}

// ListBills handles GET /api/v1/admin/bills: a waiter's own bills, or all for cashiers and managers
func (ctrl *BillController) ListBills(c *gin.Context) {
	actor, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	bills, err := ctrl.billUsecase.List(c.Request.Context(), actor, tenantID)
	if err != nil {
		writeBillError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": bills})
}

// RequestBill handles POST /api/v1/admin/bills/:id/request (the waiter, for the customer)
func (ctrl *BillController) RequestBill(c *gin.Context) {
	ctrl.billAction(c, func(actor domain.Actor, tenantID, billID uuid.UUID) (*domain.Bill, error) {
		return ctrl.billUsecase.Request(c.Request.Context(), actor, tenantID, billID)
	})
}

// Collect handles POST /api/v1/admin/bills/:id/collect
func (ctrl *BillController) Collect(c *gin.Context) {
	var req struct {
		Amount    float64 `json:"amount"`
		Method    string  `json:"method"`
		Reference string  `json:"reference"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amount and method are required"})
		return
	}
	ctrl.billAction(c, func(actor domain.Actor, tenantID, billID uuid.UUID) (*domain.Bill, error) {
		return ctrl.billUsecase.Collect(c.Request.Context(), actor, tenantID, billID, domain.CollectInput{
			Amount: req.Amount, Method: domain.PaymentMethod(req.Method), Reference: req.Reference,
		})
	})
}

// Confirm handles POST /api/v1/admin/bills/:id/confirm (cashier or manager)
func (ctrl *BillController) Confirm(c *gin.Context) {
	ctrl.billAction(c, func(actor domain.Actor, tenantID, billID uuid.UUID) (*domain.Bill, error) {
		return ctrl.billUsecase.Confirm(c.Request.Context(), actor, tenantID, billID)
	})
}

// Move handles POST /api/v1/admin/bills/:id/move: to an empty table, or merged with its bill
func (ctrl *BillController) Move(c *gin.Context) {
	var req struct {
		TableNumber string `json:"table_number" binding:"required,max=20"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table_number is required"})
		return
	}
	ctrl.billAction(c, func(actor domain.Actor, tenantID, billID uuid.UUID) (*domain.Bill, error) {
		return ctrl.billUsecase.Move(c.Request.Context(), actor, tenantID, billID, req.TableNumber)
	})
}

// Handover handles POST /api/v1/admin/bills/:id/handover: to another waiter or a manager
func (ctrl *BillController) Handover(c *gin.Context) {
	var req struct {
		StaffID string `json:"staff_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "staff_id is required"})
		return
	}
	staffID, err := uuid.Parse(req.StaffID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid staff id"})
		return
	}
	ctrl.billAction(c, func(actor domain.Actor, tenantID, billID uuid.UUID) (*domain.Bill, error) {
		return ctrl.billUsecase.Handover(c.Request.Context(), actor, tenantID, billID, staffID)
	})
}

// MyShift handles GET /api/v1/admin/shifts/me
func (ctrl *BillController) MyShift(c *gin.Context) {
	actor, _, ok := billActor(c)
	if !ok {
		return
	}
	shift, err := ctrl.billUsecase.CurrentShift(c.Request.Context(), actor)
	if err != nil {
		writeBillError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": shift})
}

// StartShift handles POST /api/v1/admin/shifts/start
func (ctrl *BillController) StartShift(c *gin.Context) {
	actor, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	shift, err := ctrl.billUsecase.StartShift(c.Request.Context(), actor, tenantID)
	if err != nil {
		writeBillError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": shift})
}

// EndShift handles POST /api/v1/admin/shifts/end; refused while a waiter holds unpaid bills
func (ctrl *BillController) EndShift(c *gin.Context) {
	actor, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	shift, err := ctrl.billUsecase.EndShift(c.Request.Context(), actor, tenantID)
	if err != nil {
		writeBillError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": shift})
}

func (ctrl *BillController) billAction(c *gin.Context, do func(actor domain.Actor, tenantID, billID uuid.UUID) (*domain.Bill, error)) {
	actor, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	billID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bill id"})
		return
	}
	bill, err := do(actor, tenantID, billID)
	if err != nil {
		writeBillError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": bill})
}

func billActor(c *gin.Context) (domain.Actor, uuid.UUID, bool) {
	tenantID, hasTenant := middleware.GetTenantIDFromContext(c)
	claims, hasClaims := middleware.GetAuthClaims(c)
	if !hasTenant || !hasClaims {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return domain.Actor{}, uuid.Nil, false
	}
	return domain.Actor{ID: claims.UserID, Role: domain.NormalizeRole(claims.Role)}, tenantID, true
}

func writeBillError(c *gin.Context, err error) {
	var validation *domain.ValidationError
	var openBills *domain.OpenBillsError
	switch {
	case errors.As(err, &validation):
		c.JSON(http.StatusBadRequest, gin.H{"error": validation.Message})
	case errors.As(err, &openBills):
		c.JSON(http.StatusConflict, gin.H{"error": "OPEN_BILLS", "message": openBills.Error(), "count": openBills.Count})
	case errors.Is(err, domain.ErrBillNotFound), errors.Is(err, domain.ErrTableNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, domain.ErrNotYourBill):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, domain.ErrNoOpenBill), errors.Is(err, domain.ErrBillState), errors.Is(err, domain.ErrShiftOpen),
		errors.Is(err, domain.ErrNoShift), errors.Is(err, domain.ErrHandoverTarget):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update the bill"})
	}
}
