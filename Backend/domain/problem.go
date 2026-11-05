package domain

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

type ProblemReason string

const (
	ReasonCold          ProblemReason = "cold"
	ReasonWrongDish     ProblemReason = "wrong_dish"
	ReasonUndercooked   ProblemReason = "undercooked"
	ReasonTooSlow       ProblemReason = "too_slow"
	ReasonForeignObject ProblemReason = "foreign_object"
	ReasonOther         ProblemReason = "other"
)

func (r ProblemReason) IsValid() bool {
	switch r {
	case ReasonCold, ReasonWrongDish, ReasonUndercooked, ReasonTooSlow, ReasonForeignObject, ReasonOther:
		return true
	}
	return false
}

type ProblemDecision string

const (
	DecisionRemake ProblemDecision = "remake"
	DecisionRemove ProblemDecision = "remove_from_bill"
)

type Fault string

const (
	FaultKitchen Fault = "kitchen"
	FaultWaiter  Fault = "waiter"
	FaultNone    Fault = "none"
)

func (f Fault) IsValid() bool {
	return f == FaultKitchen || f == FaultWaiter || f == FaultNone
}

type WalkoutDecision string

const (
	WaiterPays     WalkoutDecision = "waiter_pays"
	RestaurantLoss WalkoutDecision = "restaurant_loss"
)

// Problem is a complaint about one dish, with everyone involved, waiting for the manager's call
type Problem struct {
	ID            uuid.UUID        `json:"id"`
	OrderID       uuid.UUID        `json:"order_id"`
	OrderItemID   uuid.UUID        `json:"order_item_id"`
	ItemName      string           `json:"item_name"`
	Quantity      int              `json:"quantity"`
	TableNumber   string           `json:"table_number"`
	Reason        ProblemReason    `json:"reason"`
	Note          string           `json:"note"`
	ReportedAt    time.Time        `json:"reported_at"`
	ReportedBy    string           `json:"reported_by_name"`
	ReadyBy       string           `json:"ready_by_name"`
	ServedBy      string           `json:"served_by_name"`
	StartedAt     *time.Time       `json:"started_at"`
	ReadyAt       *time.Time       `json:"ready_at"`
	ServedAt      *time.Time       `json:"served_at"`
	Decision      *ProblemDecision `json:"decision"`
	Fault         *Fault           `json:"fault"`
	DecidedBy     string           `json:"decided_by_name"`
	DecidedAt     *time.Time       `json:"decided_at"`
	RemovedAmount *float64         `json:"removed_amount"`
	RemakeOrderID *uuid.UUID       `json:"remake_order_id"`
}

// ProblemItem is the dish a problem is reported on, with its order's table, bill and kitchen people
type ProblemItem struct {
	ItemID      uuid.UUID
	OrderID     uuid.UUID
	ItemName    string
	TableNumber string
	BillID      *uuid.UUID
	Removed     bool
}

// Walkout is a bill left unpaid, waiting for (or with) the manager's decision
type Walkout struct {
	BillID      uuid.UUID        `json:"bill_id"`
	TableNumber string           `json:"table_number"`
	Amount      float64          `json:"amount"`
	WaiterID    *uuid.UUID       `json:"waiter_id"`
	WaiterName  string           `json:"waiter_name"`
	MarkedBy    string           `json:"marked_by_name"`
	At          time.Time        `json:"walkout_at"`
	Decision    *WalkoutDecision `json:"decision"`
	Note        string           `json:"note"`
	DecidedBy   string           `json:"decided_by_name"`
	DecidedAt   *time.Time       `json:"decided_at"`
}

// Decisions are what the manager still has to decide
type Decisions struct {
	Problems []Problem `json:"problems"`
	Walkouts []Walkout `json:"walkouts"`
}

type ProblemFilter struct {
	ProblemID *uuid.UUID
	OpenOnly  bool
	Since     time.Time
	Until     time.Time
}

type PushSubscription struct {
	Endpoint string
	P256dh   string
	Auth     string
}

var (
	ErrProblemNotFound = errors.New("problem not found")
	ErrAlreadyDecided  = errors.New("this has already been decided")
	ErrItemNotFound    = errors.New("dish not found on this order")
)

type ProblemRepository interface {
	ItemForProblem(ctx context.Context, tenantID, orderID, itemID uuid.UUID) (*ProblemItem, error)
	Create(ctx context.Context, tenantID uuid.UUID, item *ProblemItem, reason ProblemReason, note string, actorID uuid.UUID) (uuid.UUID, error)
	List(ctx context.Context, tenantID uuid.UUID, filter ProblemFilter) ([]Problem, error)
	Decide(ctx context.Context, tenantID, problemID uuid.UUID, decision ProblemDecision, fault Fault, actorID uuid.UUID, removed *float64, remakeOrderID *uuid.UUID) error
	// RemoveItem takes a dish off its order's total and returns what it was worth
	RemoveItem(ctx context.Context, orderID, itemID uuid.UUID) (float64, error)
	// CreateRemake puts a free copy of the dish on a new kitchen order
	CreateRemake(ctx context.Context, tenantID, orderID, itemID uuid.UUID) (uuid.UUID, error)

	MarkWalkout(ctx context.Context, tenantID, billID uuid.UUID, amount float64, actorID uuid.UUID) error
	DecideWalkout(ctx context.Context, tenantID, billID uuid.UUID, decision WalkoutDecision, note string, actorID uuid.UUID) error
	ListWalkouts(ctx context.Context, tenantID uuid.UUID, openOnly bool, since, until time.Time) ([]Walkout, error)
}

type ProblemUsecase interface {
	Report(ctx context.Context, actor Actor, tenantID, orderID, itemID uuid.UUID, reason ProblemReason, note string) (*Problem, error)
	Decide(ctx context.Context, actor Actor, tenantID, problemID uuid.UUID, decision ProblemDecision, fault Fault) (*Problem, error)
	MarkWalkout(ctx context.Context, actor Actor, tenantID, billID uuid.UUID) (*Walkout, error)
	DecideWalkout(ctx context.Context, actor Actor, tenantID, billID uuid.UUID, decision WalkoutDecision, note string) (*Walkout, error)
	// Pending lists the problems and walkouts waiting for the manager
	Pending(ctx context.Context, tenantID uuid.UUID) (*Decisions, error)
}

type PushRepository interface {
	Save(ctx context.Context, tenantID, userID uuid.UUID, sub PushSubscription) error
	// For returns the browsers of an audience: its people, and everyone active with its roles
	For(ctx context.Context, tenantID uuid.UUID, to Audience) ([]PushSubscription, error)
	Delete(ctx context.Context, endpoint string) error
}
