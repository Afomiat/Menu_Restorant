package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
)

type financeRepository struct {
	q *sqlc.Queries
}

func NewFinanceRepository(q *sqlc.Queries) domain.FinanceRepository {
	return &financeRepository{q: q}
}

func (r *financeRepository) Summary(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*domain.FinanceSummary, error) {
	row, err := r.q.FinanceSummary(ctx, sqlc.FinanceSummaryParams{
		TenantID: converter.UUIDToPg(tenantID),
		From:     converter.TimeToPg(from),
		To:       converter.TimeToPg(to),
	})
	if err != nil {
		return nil, err
	}
	return &domain.FinanceSummary{
		From:                  from.Format("2006-01-02"),
		To:                    to.AddDate(0, 0, -1).Format("2006-01-02"),
		SalesTotal:            converter.NumericToFloat(row.SalesTotal),
		Collected:             converter.NumericToFloat(row.Collected),
		Confirmed:             converter.NumericToFloat(row.Confirmed),
		CollectedNotConfirmed: converter.NumericToFloat(row.CollectedNotConfirmed),
		WalkoutLoss:           converter.NumericToFloat(row.WalkoutLoss),
		RemovedLoss:           converter.NumericToFloat(row.RemovedLoss),
	}, nil
}

func (r *financeRepository) Trend(ctx context.Context, tenantID uuid.UUID, from, to time.Time, groupBy string) ([]domain.TrendPoint, error) {
	if groupBy == "week" {
		rows, err := r.q.FinanceTrendWeekly(ctx, sqlc.FinanceTrendWeeklyParams{
			TenantID: converter.UUIDToPg(tenantID),
			From:     converter.TimeToPg(from),
			To:       converter.TimeToPg(to),
		})
		if err != nil {
			return nil, err
		}
		points := make([]domain.TrendPoint, len(rows))
		for i, row := range rows {
			points[i] = domain.TrendPoint{
				Period:      row.Period,
				Revenue:     converter.NumericToFloat(row.Revenue),
				Collected:   converter.NumericToFloat(row.Collected),
				WalkoutLoss: converter.NumericToFloat(row.WalkoutLoss),
			}
		}
		return points, nil
	}

	rows, err := r.q.FinanceTrendDaily(ctx, sqlc.FinanceTrendDailyParams{
		TenantID: converter.UUIDToPg(tenantID),
		From:     converter.TimeToPg(from),
		To:       converter.TimeToPg(to),
	})
	if err != nil {
		return nil, err
	}
	points := make([]domain.TrendPoint, len(rows))
	for i, row := range rows {
		points[i] = domain.TrendPoint{
			Period:      row.Period,
			Revenue:     converter.NumericToFloat(row.Revenue),
			Collected:   converter.NumericToFloat(row.Collected),
			WalkoutLoss: converter.NumericToFloat(row.WalkoutLoss),
		}
	}
	return points, nil
}

func (r *financeRepository) TopDishes(ctx context.Context, tenantID uuid.UUID, from, to time.Time, limit int) ([]domain.DishRevenue, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := r.q.FinanceTopDishes(ctx, sqlc.FinanceTopDishesParams{
		TenantID:   converter.UUIDToPg(tenantID),
		From:       converter.TimeToPg(from),
		To:         converter.TimeToPg(to),
		LimitCount: int32(limit),
	})
	if err != nil {
		return nil, err
	}
	dishes := make([]domain.DishRevenue, len(rows))
	for i, row := range rows {
		dishes[i] = domain.DishRevenue{
			ItemName:     row.ItemName,
			QuantitySold: int(row.QuantitySold),
			Revenue:      converter.NumericToFloat(row.Revenue),
		}
	}
	return dishes, nil
}
