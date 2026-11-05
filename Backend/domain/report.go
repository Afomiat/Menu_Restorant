package domain

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

type MethodTotal struct {
	Method   PaymentMethod `json:"method"`
	Payments int           `json:"payments"`
	Amount   float64       `json:"amount"`
}

type WaiterTotals struct {
	WaiterID              *uuid.UUID `json:"waiter_id"`
	WaiterName            string     `json:"waiter_name"`
	Bills                 int        `json:"bills"`
	Sales                 float64    `json:"sales"`
	Collected             float64    `json:"collected"`
	Confirmed             float64    `json:"confirmed"`
	CollectedNotConfirmed float64    `json:"collected_not_confirmed"`
	Walkouts              int        `json:"walkouts"`
}

type DishTiming struct {
	ItemName      string  `json:"item_name"`
	Orders        int     `json:"orders"`
	AvgMinutes    float64 `json:"avg_minutes"`
	TargetMinutes float64 `json:"target_minutes"`
	Late          int     `json:"late"`
}

type OpenBill struct {
	BillID      uuid.UUID  `json:"bill_id"`
	TableNumber string     `json:"table_number"`
	Status      BillStatus `json:"status"`
	WaiterName  string     `json:"waiter_name"`
	TotalAmount float64    `json:"total_amount"`
	AmountPaid  float64    `json:"amount_paid"`
}

// DailyReport is the manager's day: sales by method, waiters, losses, kitchen times and open bills
type DailyReport struct {
	Date      string         `json:"date"`
	Sales     []MethodTotal  `json:"sales_by_method"`
	SalesSum  float64        `json:"sales_total"`
	Waiters   []WaiterTotals `json:"waiters"`
	Walkouts  []Walkout      `json:"walkouts"`
	Removed   []Problem      `json:"removed_dishes"`
	Kitchen   []DishTiming   `json:"kitchen"`
	OpenBills []OpenBill     `json:"open_bills"`
}

// ShiftReport is a waiter's or cashier's own totals for their current (or last) shift
type ShiftReport struct {
	Role         Role       `json:"role"`
	StartedAt    time.Time  `json:"started_at"`
	EndedAt      *time.Time `json:"ended_at"`
	Bills        int        `json:"bills"`
	Collected    float64    `json:"collected"`
	NotConfirmed float64    `json:"not_confirmed"`
	Confirmed    float64    `json:"confirmed"`
}

var ErrNoShiftYet = errors.New("no shift yet: start a shift to see your totals")

type ReportRepository interface {
	SalesByMethod(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]MethodTotal, error)
	Waiters(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]WaiterTotals, error)
	Kitchen(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]DishTiming, error)
	OpenBills(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]OpenBill, error)
	LastShift(ctx context.Context, userID uuid.UUID) (*Shift, error)
	WaiterShift(ctx context.Context, tenantID, waiterID uuid.UUID, from, to time.Time) (*ShiftReport, error)
	CashierShift(ctx context.Context, tenantID, cashierID uuid.UUID, from, to time.Time) (*ShiftReport, error)
}

type ReportUsecase interface {
	// Daily is one day (YYYY-MM-DD, Ethiopian time); an empty date means today
	Daily(ctx context.Context, tenantID uuid.UUID, date string) (*DailyReport, error)
	MyShift(ctx context.Context, actor Actor, tenantID uuid.UUID) (*ShiftReport, error)
}
