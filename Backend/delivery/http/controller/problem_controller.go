package controller

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/domain"
)

// ProblemController handles problems with dishes, walkouts, reports and push subscriptions (Pro)
type ProblemController struct {
	problemUsecase domain.ProblemUsecase
	reportUsecase  domain.ReportUsecase
	pushRepo       domain.PushRepository
	vapidPublicKey string
}

func NewProblemController(problemUsecase domain.ProblemUsecase, reportUsecase domain.ReportUsecase, pushRepo domain.PushRepository, vapidPublicKey string) *ProblemController {
	return &ProblemController{problemUsecase: problemUsecase, reportUsecase: reportUsecase, pushRepo: pushRepo, vapidPublicKey: vapidPublicKey}
}

// ReportProblem handles POST /api/v1/admin/orders/:id/problems
func (ctrl *ProblemController) ReportProblem(c *gin.Context) {
	actor, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	var req struct {
		OrderItemID string `json:"order_item_id" binding:"required"`
		Reason      string `json:"reason" binding:"required"`
		Note        string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_item_id and reason are required"})
		return
	}
	itemID, err := uuid.Parse(req.OrderItemID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order item id"})
		return
	}
	problem, err := ctrl.problemUsecase.Report(c.Request.Context(), actor, tenantID, orderID, itemID, domain.ProblemReason(req.Reason), req.Note)
	if err != nil {
		writeProblemError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": problem})
}

// DecideProblem handles POST /api/v1/admin/problems/:id/decision (managers)
func (ctrl *ProblemController) DecideProblem(c *gin.Context) {
	actor, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	problemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid problem id"})
		return
	}
	var req struct {
		Decision string `json:"decision"`
		Fault    string `json:"fault"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "decision and fault are required"})
		return
	}
	problem, err := ctrl.problemUsecase.Decide(c.Request.Context(), actor, tenantID, problemID, domain.ProblemDecision(req.Decision), domain.Fault(req.Fault))
	if err != nil {
		writeProblemError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": problem})
}

// Pending handles GET /api/v1/admin/decisions: problems and walkouts waiting for the manager
func (ctrl *ProblemController) Pending(c *gin.Context) {
	_, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	pending, err := ctrl.problemUsecase.Pending(c.Request.Context(), tenantID)
	if err != nil {
		writeProblemError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": pending})
}

// MarkWalkout handles POST /api/v1/admin/bills/:id/walkout
func (ctrl *ProblemController) MarkWalkout(c *gin.Context) {
	actor, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	billID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bill id"})
		return
	}
	walkout, err := ctrl.problemUsecase.MarkWalkout(c.Request.Context(), actor, tenantID, billID)
	if err != nil {
		writeProblemError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": walkout})
}

// DecideWalkout handles POST /api/v1/admin/bills/:id/walkout-decision (managers)
func (ctrl *ProblemController) DecideWalkout(c *gin.Context) {
	actor, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	billID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bill id"})
		return
	}
	var req struct {
		Decision string `json:"decision"`
		Note     string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "decision is required"})
		return
	}
	walkout, err := ctrl.problemUsecase.DecideWalkout(c.Request.Context(), actor, tenantID, billID, domain.WalkoutDecision(req.Decision), req.Note)
	if err != nil {
		writeProblemError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": walkout})
}

// DailyReport handles GET /api/v1/admin/reports/daily?date=2026-11-05 (managers)
func (ctrl *ProblemController) DailyReport(c *gin.Context) {
	_, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	report, err := ctrl.reportUsecase.Daily(c.Request.Context(), tenantID, c.Query("date"))
	if err != nil {
		writeProblemError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": report})
}

// MyShiftReport handles GET /api/v1/admin/reports/my-shift (waiters and cashiers)
func (ctrl *ProblemController) MyShiftReport(c *gin.Context) {
	actor, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	report, err := ctrl.reportUsecase.MyShift(c.Request.Context(), actor, tenantID)
	if err != nil {
		writeProblemError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": report})
}

// PushKey handles GET /api/v1/admin/push/key: the public key browsers subscribe with
func (ctrl *ProblemController) PushKey(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"enabled": ctrl.vapidPublicKey != "", "public_key": ctrl.vapidPublicKey}})
}

// SubscribePush handles POST /api/v1/admin/push/subscribe with the browser's push subscription
func (ctrl *ProblemController) SubscribePush(c *gin.Context) {
	actor, tenantID, ok := billActor(c)
	if !ok {
		return
	}
	var req struct {
		Endpoint string `json:"endpoint" binding:"required,url,max=1000"`
		Keys     struct {
			P256dh string `json:"p256dh" binding:"required,max=200"`
			Auth   string `json:"auth" binding:"required,max=100"`
		} `json:"keys" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a browser push subscription is required"})
		return
	}
	if err := ctrl.pushRepo.Save(c.Request.Context(), tenantID, actor.ID, domain.PushSubscription{
		Endpoint: req.Endpoint, P256dh: req.Keys.P256dh, Auth: req.Keys.Auth,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save push subscription"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "notifications turned on"})
}

func writeProblemError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domain.ErrProblemNotFound), errors.Is(err, domain.ErrItemNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, domain.ErrAlreadyDecided), errors.Is(err, domain.ErrNoShiftYet):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		writeBillError(c, err)
	}
}
