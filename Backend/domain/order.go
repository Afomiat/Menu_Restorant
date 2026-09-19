package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type OrderStatus string

const (
	StatusPendingGrace OrderStatus = "pending_grace" // 60s grace window where customer can Undo
	StatusNotStarted   OrderStatus = "not_started"   // Confirmed, sent to kitchen tablet
	StatusPreparing    OrderStatus = "preparing"     // Chef started cooking
	StatusReady        OrderStatus = "ready"         // Plated, ready for table delivery
	StatusDelivered    OrderStatus = "delivered"     // Served at the table
	StatusCancelled    OrderStatus = "cancelled"     // Customer clicked Undo or staff cancelled
)

type OrderItemModifier struct {
	ID           uuid.UUID `json:"id"`
	OrderItemID  uuid.UUID `json:"order_item_id"`
	ModifierID   uuid.UUID `json:"modifier_id"`
	ModifierName string    `json:"modifier_name"`
	PriceApplied float64   `json:"price_applied"`
}

type OrderItem struct {
	ID         uuid.UUID           `json:"id"`
	OrderID    uuid.UUID           `json:"order_id"`
	MenuItemID uuid.UUID           `json:"menu_item_id"`
	ItemName   string              `json:"item_name"`
	UnitPrice  float64             `json:"unit_price"`
	Quantity   int32               `json:"quantity"`
	Notes      string              `json:"notes"`
	Modifiers  []OrderItemModifier `json:"modifiers"`
}

type Order struct {
	ID                   uuid.UUID   `json:"id"`
	TenantID             uuid.UUID   `json:"tenant_id"`
	TableID              *uuid.UUID  `json:"table_id,omitempty"`
	TableNumber          string      `json:"table_number"`
	CustomerSessionToken string      `json:"customer_session_token"`
	Status               OrderStatus `json:"status"`
	TotalAmount          float64     `json:"total_amount"`
	GracePeriodEndsAt    time.Time   `json:"grace_period_ends_at"`
	CreatedAt            time.Time   `json:"created_at"`
	UpdatedAt            time.Time   `json:"updated_at"`
	Items                []OrderItem `json:"items"`
}

// Helper: Checks if the 60-second grace cancellation window is still active
func (o *Order) CanUndo() bool {
	return o.Status == StatusPendingGrace && time.Now().Before(o.GracePeriodEndsAt)
}

type CreateOrderItemInput struct {
	MenuItemID uuid.UUID           `json:"menu_item_id"`
	ItemName   string              `json:"item_name"`
	UnitPrice  float64             `json:"unit_price"`
	Quantity   int32               `json:"quantity"`
	Notes      string              `json:"notes"`
	Modifiers  []OrderItemModifier `json:"modifiers"`
}

type CreateOrderInput struct {
	TenantID             uuid.UUID              `json:"tenant_id"`
	TableNumber          string                 `json:"table_number"`
	TableToken           string                 `json:"table_token"`
	CustomerSessionToken string                 `json:"customer_session_token"`
	Items                []CreateOrderItemInput `json:"items"`
}

// OrderRepository defines the persistence contract for orders
type OrderRepository interface {
	Create(ctx context.Context, order *Order) error
	GetByID(ctx context.Context, tenantID, orderID uuid.UUID) (*Order, error)
	ListActiveByTenant(ctx context.Context, tenantID uuid.UUID) ([]Order, error)
	UpdateStatus(ctx context.Context, tenantID, orderID uuid.UUID, status OrderStatus) error
	CancelInGrace(ctx context.Context, tenantID, orderID uuid.UUID, sessionToken string) error
}

// OrderUsecase defines the business rules for order placement, 60s Undo, and KDS
type OrderUsecase interface {
	PlaceOrder(ctx context.Context, input CreateOrderInput) (*Order, error)
	GetOrderByID(ctx context.Context, tenantID, orderID uuid.UUID) (*Order, error)
	UndoOrder(ctx context.Context, tenantID, orderID uuid.UUID, sessionToken string) error
	UpdateKitchenStatus(ctx context.Context, tenantID, orderID uuid.UUID, status OrderStatus) error
	GetActiveKitchenOrders(ctx context.Context, tenantID uuid.UUID) ([]Order, error)
}
