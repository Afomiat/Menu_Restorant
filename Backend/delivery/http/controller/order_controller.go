package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
	"menu-backend/internal/ws"
)

type OrderController struct {
	orderUsecase domain.OrderUsecase
	hub          *ws.Hub
}

func NewOrderController(orderUsecase domain.OrderUsecase, hub *ws.Hub) *OrderController {
	return &OrderController{
		orderUsecase: orderUsecase,
		hub:          hub,
	}
}

type OrderItemModifierRequest struct {
	ModifierID   uuid.UUID `json:"modifier_id" binding:"required"`
	ModifierName string    `json:"modifier_name" binding:"required"`
	PriceApplied float64   `json:"price_applied"`
}

type OrderItemRequest struct {
	MenuItemID uuid.UUID                  `json:"menu_item_id" binding:"required"`
	ItemName   string                     `json:"item_name" binding:"required"`
	UnitPrice  float64                    `json:"unit_price" binding:"gte=0"`
	Quantity   int32                      `json:"quantity" binding:"required,gt=0"`
	Notes      string                     `json:"notes"`
	Modifiers  []OrderItemModifierRequest `json:"modifiers"`
}

type PlaceOrderRequest struct {
	TableNumber string             `json:"table_number" binding:"required"`
	TableToken  string             `json:"table_token" binding:"required"`
	Items       []OrderItemRequest `json:"items" binding:"required,min=1"`
}

// PlaceOrder handles POST /api/v1/menus/:slug/orders
// Customers place an order. Initiates the 60-second Undo window.
func (ctrl *OrderController) PlaceOrder(c *gin.Context) {
	tenant, ok := middleware.GetTenantFromContext(c)
	if !ok || tenant == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "restaurant context missing"})
		return
	}

	var req PlaceOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Retrieve or generate customer session token
	sessionToken := c.GetHeader("X-Session-Token")
	if sessionToken == "" {
		sessionToken = uuid.New().String()
	}

	// Map input to domain items
	domainItems := make([]domain.CreateOrderItemInput, len(req.Items))
	for i, it := range req.Items {
		var domainMods []domain.OrderItemModifier
		for _, m := range it.Modifiers {
			domainMods = append(domainMods, domain.OrderItemModifier{
				ModifierID:   m.ModifierID,
				ModifierName: m.ModifierName,
				PriceApplied: m.PriceApplied,
			})
		}
		domainItems[i] = domain.CreateOrderItemInput{
			MenuItemID: it.MenuItemID,
			ItemName:   it.ItemName,
			UnitPrice:  it.UnitPrice,
			Quantity:   it.Quantity,
			Notes:      it.Notes,
			Modifiers:  domainMods,
		}
	}

	orderInput := domain.CreateOrderInput{
		TenantID:             tenant.ID,
		TableNumber:          req.TableNumber,
		TableToken:           req.TableToken,
		CustomerSessionToken: sessionToken,
		Items:                domainItems,
	}

	order, err := ctrl.orderUsecase.PlaceOrder(c.Request.Context(), orderInput)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Broadcast real-time order to the restaurant's private kitchen tablet room
	if ctrl.hub != nil {
		ctrl.hub.BroadcastToTenant(tenant.ID, "order:created", order)
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":              "Order placed successfully",
		"order":                order,
		"session_token":        sessionToken,
		"grace_period_seconds": 60,
		"grace_period_ends_at": order.GracePeriodEndsAt,
	})
}

// UndoOrder handles POST /api/v1/menus/:slug/orders/:id/undo
// Allows customer to cancel the order within the 60-second grace window
func (ctrl *OrderController) UndoOrder(c *gin.Context) {
	tenant, ok := middleware.GetTenantFromContext(c)
	if !ok || tenant == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "restaurant context missing"})
		return
	}

	orderIDStr := c.Param("id")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order ID"})
		return
	}

	sessionToken := c.GetHeader("X-Session-Token")
	if sessionToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-Session-Token header is required to undo an order"})
		return
	}

	if err := ctrl.orderUsecase.UndoOrder(c.Request.Context(), tenant.ID, orderID, sessionToken); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Broadcast cancellation event to kitchen screen
	if ctrl.hub != nil {
		ctrl.hub.BroadcastToTenant(tenant.ID, "order:cancelled", gin.H{"order_id": orderID})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Order successfully cancelled",
		"order_id": orderID,
	})
}

// GetOrder handles GET /api/v1/menus/:slug/orders/:id
// Customers poll or track their live order status using their session token
func (ctrl *OrderController) GetOrder(c *gin.Context) {
	tenant, ok := middleware.GetTenantFromContext(c)
	if !ok || tenant == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "restaurant context missing"})
		return
	}

	orderIDStr := c.Param("id")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order ID"})
		return
	}

	sessionToken := c.GetHeader("X-Session-Token")
	if sessionToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "X-Session-Token header is required to track an order"})
		return
	}

	order, err := ctrl.orderUsecase.GetOrderByID(c.Request.Context(), tenant.ID, orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}

	// Security: customer can only track their own session's order
	if order.CustomerSessionToken != sessionToken {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized to view this order"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": order,
	})
}

// ListActiveOrders handles GET /api/v1/admin/orders
// Returns live orders for the kitchen display system (KDS)
func (ctrl *OrderController) ListActiveOrders(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	orders, err := ctrl.orderUsecase.GetActiveKitchenOrders(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch kitchen orders"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": orders,
	})
}

// UpdateOrderStatus handles PATCH /api/v1/admin/orders/:id/status
// Chef or waiter moves order status (preparing, ready, delivered, cancelled)
func (ctrl *OrderController) UpdateOrderStatus(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	orderIDStr := c.Param("id")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order ID"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status is required"})
		return
	}

	// Validate allowed status transitions
	orderStatus := domain.OrderStatus(req.Status)
	switch orderStatus {
	case domain.StatusNotStarted, domain.StatusPreparing, domain.StatusReady, domain.StatusDelivered, domain.StatusCancelled:
		// Valid
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status; allowed: not_started, preparing, ready, delivered, cancelled"})
		return
	}

	if err := ctrl.orderUsecase.UpdateKitchenStatus(c.Request.Context(), tenantID, orderID, orderStatus); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update order status"})
		return
	}

	// Broadcast status update event to all staff tablets in this restaurant
	if ctrl.hub != nil {
		ctrl.hub.BroadcastToTenant(tenantID, "order:status_updated", gin.H{
			"order_id": orderID,
			"status":   orderStatus,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "order status updated successfully",
		"order_id": orderID,
		"status":   orderStatus,
	})
}
