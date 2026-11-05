package domain

import (
	"context"
	"errors"
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

	// TargetMinutes is the order's cooking target: its slowest dish, fixed when it was placed
	TargetMinutes int        `json:"target_minutes"`
	StartedAt     *time.Time `json:"started_at"`
	StartedBy     *uuid.UUID `json:"started_by"`
	ReadyAt       *time.Time `json:"ready_at"`
	ReadyBy       *uuid.UUID `json:"ready_by"`
	ServedAt      *time.Time `json:"served_at"`
	ServedBy      *uuid.UUID `json:"served_by"`
	// WaiterID is the waiter of the order's table when the order was changed (nil: none assigned)
	WaiterID *uuid.UUID `json:"waiter_id,omitempty"`
	// BillID is the Pro bill the order is on
	BillID *uuid.UUID `json:"bill_id,omitempty"`
}

// Actor is the signed-in staff member doing something
type Actor struct {
	ID   uuid.UUID
	Role Role
}

var ErrStatusNotAllowed = errors.New("your role cannot move an order to this status")

// CanSetOrderStatus says which role moves an order to which status: chefs cook, waiters serve,
// managers (and the Azai team) can do everything
func CanSetOrderStatus(role Role, status OrderStatus) bool {
	switch role {
	case RoleManager, RoleSuperAdmin:
		return true
	case RoleChef:
		return status == StatusNotStarted || status == StatusPreparing || status == StatusReady || status == StatusCancelled
	case RoleWaiter:
		return status == StatusDelivered
	}
	return false
}

// LateOrder is a cooking order that has run past its target
type LateOrder struct {
	ID            uuid.UUID
	TenantID      uuid.UUID
	TableNumber   string
	TargetMinutes int
	StartedAt     time.Time
}

// TableOrders is one table with its waiter and its open orders, for the waiter's screen
type TableOrders struct {
	Table  RestaurantTable `json:"table"`
	Orders []Order         `json:"orders"`
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
	// UpdateStatus moves an order and records who did the step and when
	UpdateStatus(ctx context.Context, tenantID, orderID uuid.UUID, status OrderStatus, actorID uuid.UUID) (*Order, error)
	ListVeryLate(ctx context.Context, now time.Time) ([]LateOrder, error)
	MarkVeryLateAlerted(ctx context.Context, orderID uuid.UUID) error
	CancelInGrace(ctx context.Context, tenantID, orderID uuid.UUID, sessionToken string) error
	// OrderRepository — add after CancelInGrace:
	BulkCancelTableOrders(ctx context.Context, tenantID uuid.UUID, tableNumber string) error
	BulkCancelAllActive(ctx context.Context, tenantID uuid.UUID) error
}

// OrderUsecase defines the business rules for order placement, 60s Undo, and KDS
type OrderUsecase interface {
	PlaceOrder(ctx context.Context, input CreateOrderInput) (*Order, error)
	GetOrderByID(ctx context.Context, tenantID, orderID uuid.UUID) (*Order, error)
	UndoOrder(ctx context.Context, tenantID, orderID uuid.UUID, sessionToken string) error
	UpdateKitchenStatus(ctx context.Context, actor Actor, tenantID, orderID uuid.UUID, status OrderStatus) (*Order, error)
	// TablesWithOrders lists tables and their open orders: one waiter's tables, or all (uuid.Nil)
	TablesWithOrders(ctx context.Context, tenantID, waiterID uuid.UUID) ([]TableOrders, error)
	GetActiveKitchenOrders(ctx context.Context, tenantID uuid.UUID) ([]Order, error)
	BulkCancelTableOrders(ctx context.Context, tenantID uuid.UUID, tableNumber string) error
	BulkCancelAllActive(ctx context.Context, tenantID uuid.UUID) error
	// ForgetMenuItem drops the remembered price and stock of an item after staff change it
	ForgetMenuItem(itemID uuid.UUID)
}
