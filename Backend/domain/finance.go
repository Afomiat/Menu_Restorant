package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type FinanceSummary struct {
	From                  string  `json:"from"`
	To                    string  `json:"to"`
	SalesTotal            float64 `json:"sales_total"`
	Collected             float64 `json:"collected"`
	Confirmed             float64 `json:"confirmed"`
	CollectedNotConfirmed float64 `json:"collected_not_confirmed"`
	WalkoutLoss           float64 `json:"walkout_loss"`
	RemovedLoss           float64 `json:"removed_loss"`
}

type TrendPoint struct {
	Period      string  `json:"period"`
	Revenue     float64 `json:"revenue"`
	Collected   float64 `json:"collected"`
	WalkoutLoss float64 `json:"walkout_loss"`
}

type DishRevenue struct {
	ItemName     string  `json:"item_name"`
	QuantitySold int     `json:"quantity_sold"`
	Revenue      float64 `json:"revenue"`
}

type FinanceRepository interface {
	Summary(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*FinanceSummary, error)
	Trend(ctx context.Context, tenantID uuid.UUID, from, to time.Time, groupBy string) ([]TrendPoint, error)
	TopDishes(ctx context.Context, tenantID uuid.UUID, from, to time.Time, limit int) ([]DishRevenue, error)
}

type FinanceUsecase interface {
	Summary(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) (*FinanceSummary, error)
	Trend(ctx context.Context, tenantID uuid.UUID, fromStr, toStr, groupBy string) ([]TrendPoint, error)
	TopDishes(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string, limit int) ([]DishRevenue, error)
	PaymentMethods(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]MethodTotal, error)
	StaffPerformance(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]WaiterTotals, error)
	ExportCSV(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]byte, string, error)
}
