package domain

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type BillStatus string

const (
	BillOpen      BillStatus = "open"           // the table is eating; new orders join this bill
	BillRequested BillStatus = "bill_requested" // the customer asked to pay
	BillCollected BillStatus = "collected"      // the waiter took the money
	BillConfirmed BillStatus = "confirmed"      // the cashier has the money; the bill is closed
	BillWalkout   BillStatus = "walkout"        // the customer left without paying
)

// TakesOrders reports whether new orders and payments still go on the bill
func (s BillStatus) TakesOrders() bool {
	return s == BillOpen || s == BillRequested
}

type PaymentMethod string

const (
	PayCash     PaymentMethod = "cash"
	PayTelebirr PaymentMethod = "telebirr"
	PayCBE      PaymentMethod = "cbe_birr_bank"
)

func (m PaymentMethod) IsValid() bool {
	return m == PayCash || m == PayTelebirr || m == PayCBE
}

type BillPayment struct {
	ID              uuid.UUID     `json:"id"`
	Amount          float64       `json:"amount"`
	Method          PaymentMethod `json:"method"`
	Reference       string        `json:"reference"`
	CollectedBy     *uuid.UUID    `json:"collected_by"`
	CollectedByName string        `json:"collected_by_name"`
	CollectedAt     time.Time     `json:"collected_at"`
}

// Bill collects all orders of one table's visit
type Bill struct {
	ID          uuid.UUID     `json:"id"`
	TenantID    uuid.UUID     `json:"tenant_id"`
	TableID     *uuid.UUID    `json:"table_id"`
	TableNumber string        `json:"table_number"`
	WaiterID    *uuid.UUID    `json:"waiter_id"`
	WaiterName  string        `json:"waiter_name"`
	Status      BillStatus    `json:"status"`
	TotalAmount float64       `json:"total_amount"`
	AmountPaid  float64       `json:"amount_paid"`
	AmountOwed  float64       `json:"amount_owed"`
	RequestedAt *time.Time    `json:"requested_at"`
	CollectedBy *uuid.UUID    `json:"collected_by"`
	CollectedAt *time.Time    `json:"collected_at"`
	ConfirmedBy *uuid.UUID    `json:"confirmed_by"`
	ConfirmedAt *time.Time    `json:"confirmed_at"`
	CreatedAt   time.Time     `json:"created_at"`
	ClosedAt    *time.Time    `json:"closed_at"`
	Payments    []BillPayment `json:"payments"`
}

// BillFilter narrows a bill list: one waiter's bills, one bill, and closed bills since a time
type BillFilter struct {
	WaiterID *uuid.UUID
	BillID   *uuid.UUID
	Since    time.Time
}

// BillDue is a bill with the reminders and alerts that are due for it
type BillDue struct {
	ID           uuid.UUID
	TenantID     uuid.UUID
	TableNumber  string
	WaiterID     *uuid.UUID
	RemindWaiter bool
	Escalate     bool
	Unconfirmed  bool
	LongOpen     bool
}

type Shift struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	StartedAt time.Time  `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at"`
}

type CollectInput struct {
	Amount    float64
	Method    PaymentMethod
	Reference string
}

var (
	ErrBillNotFound   = errors.New("bill not found")
	ErrNoOpenBill     = errors.New("this table has no open bill")
	ErrBillState      = errors.New("the bill cannot do that in its current state")
	ErrNotYourBill    = errors.New("this bill belongs to another waiter")
	ErrNoShift        = errors.New("you have no open shift")
	ErrShiftOpen      = errors.New("your shift is already open")
	ErrHandoverTarget = errors.New("hand the bill to an active waiter or manager of this restaurant")
)

// OpenBillsError refuses to end a waiter's shift while they still hold unpaid bills
type OpenBillsError struct {
	Count int
}

func (e *OpenBillsError) Error() string {
	return fmt.Sprintf("you still have %d unpaid bill(s): collect them, hand them to another waiter, or hand them to a manager", e.Count)
}

type BillRepository interface {
	// ActiveBillForTable returns the table's bill taking orders, opening one if there is none
	ActiveBillForTable(ctx context.Context, tenantID uuid.UUID, table *RestaurantTable) (uuid.UUID, error)
	AttachOrder(ctx context.Context, orderID, billID uuid.UUID) error
	List(ctx context.Context, tenantID uuid.UUID, filter BillFilter) ([]Bill, error)
	Get(ctx context.Context, tenantID, billID uuid.UUID) (*Bill, error)
	AddPayment(ctx context.Context, tenantID, billID uuid.UUID, input CollectInput, actorID uuid.UUID) error
	SetStatus(ctx context.Context, tenantID, billID uuid.UUID, status BillStatus, actorID uuid.UUID) error
	SetWaiter(ctx context.Context, tenantID, billID uuid.UUID, waiterID *uuid.UUID) error
	// MoveToTable moves a bill and its orders to an empty table
	MoveToTable(ctx context.Context, tenantID, billID uuid.UUID, table *RestaurantTable) error
	// Merge moves a bill's orders and payments onto another bill and removes it
	Merge(ctx context.Context, tenantID, fromBillID, toBillID uuid.UUID, table *RestaurantTable) error
	CountWaiterUnpaid(ctx context.Context, tenantID, waiterID uuid.UUID) (int, error)
	// RequestedBillForTable returns the table's bill waiting for payment, if any
	RequestedBillForTable(ctx context.Context, tenantID uuid.UUID, tableNumber string) (*Bill, error)
	SessionOrderedOnBill(ctx context.Context, billID uuid.UUID, sessionToken string) (bool, error)
	ListDue(ctx context.Context, now time.Time) ([]BillDue, error)
	MarkReminded(ctx context.Context, due BillDue) error

	OpenShift(ctx context.Context, userID uuid.UUID) (*Shift, error)
	StartShift(ctx context.Context, tenantID, userID uuid.UUID) (*Shift, error)
	EndShift(ctx context.Context, userID uuid.UUID) (*Shift, error)
}

type BillUsecase interface {
	// AttachOrder puts a new Pro order on its table's bill
	AttachOrder(ctx context.Context, tenant *Tenant, order *Order) error
	List(ctx context.Context, actor Actor, tenantID uuid.UUID) ([]Bill, error)
	// RequestByCustomer is the customer's "Ask for the bill" button
	RequestByCustomer(ctx context.Context, tenantID uuid.UUID, tableNumber string) (*Bill, error)
	Request(ctx context.Context, actor Actor, tenantID, billID uuid.UUID) (*Bill, error)
	Collect(ctx context.Context, actor Actor, tenantID, billID uuid.UUID, input CollectInput) (*Bill, error)
	Confirm(ctx context.Context, actor Actor, tenantID, billID uuid.UUID) (*Bill, error)
	Move(ctx context.Context, actor Actor, tenantID, billID uuid.UUID, toTableNumber string) (*Bill, error)
	Handover(ctx context.Context, actor Actor, tenantID, billID, toStaffID uuid.UUID) (*Bill, error)
	// CheckRescan alerts the waiter and managers when new customers scan a table whose bill is unpaid
	CheckRescan(ctx context.Context, tenantID uuid.UUID, tableNumber, sessionToken string)

	CurrentShift(ctx context.Context, actor Actor) (*Shift, error)
	StartShift(ctx context.Context, actor Actor, tenantID uuid.UUID) (*Shift, error)
	EndShift(ctx context.Context, actor Actor, tenantID uuid.UUID) (*Shift, error)
}
