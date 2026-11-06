package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
)

type reportRepository struct {
	q *sqlc.Queries
}

func NewReportRepository(q *sqlc.Queries) domain.ReportRepository {
	return &reportRepository{q: q}
}

func (r *reportRepository) SalesByMethod(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]domain.MethodTotal, error) {
	rows, err := r.q.ReportSalesByMethod(ctx, sqlc.ReportSalesByMethodParams{
		TenantID: converter.UUIDToPg(tenantID), CollectedAt: converter.TimeToPg(from), CollectedAt_2: converter.TimeToPg(to),
	})
	if err != nil {
		return nil, err
	}
	out := make([]domain.MethodTotal, len(rows))
	for i, row := range rows {
		out[i] = domain.MethodTotal{Method: domain.PaymentMethod(row.Method), Payments: int(row.Payments), Amount: converter.NumericToFloat(row.Amount)}
	}
	return out, nil
}

func (r *reportRepository) Waiters(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]domain.WaiterTotals, error) {
	rows, err := r.q.ReportWaiters(ctx, sqlc.ReportWaitersParams{
		TenantID: converter.UUIDToPg(tenantID), CreatedAt: converter.TimeToPg(from), CreatedAt_2: converter.TimeToPg(to),
	})
	if err != nil {
		return nil, err
	}
	out := make([]domain.WaiterTotals, len(rows))
	for i, row := range rows {
		out[i] = domain.WaiterTotals{
			WaiterID:              converter.PgToUUIDPtr(row.WaiterID),
			WaiterName:            row.WaiterName,
			Bills:                 int(row.Bills),
			Sales:                 converter.NumericToFloat(row.Sales),
			Collected:             converter.NumericToFloat(row.Collected),
			Confirmed:             converter.NumericToFloat(row.Confirmed),
			CollectedNotConfirmed: converter.NumericToFloat(row.CollectedNotConfirmed),
			Walkouts:              int(row.Walkouts),
		}
	}
	return out, nil
}

func (r *reportRepository) Kitchen(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]domain.DishTiming, error) {
	rows, err := r.q.ReportKitchen(ctx, sqlc.ReportKitchenParams{
		TenantID: converter.UUIDToPg(tenantID), StartedAt: converter.TimeToPg(from), StartedAt_2: converter.TimeToPg(to),
	})
	if err != nil {
		return nil, err
	}
	out := make([]domain.DishTiming, len(rows))
	for i, row := range rows {
		out[i] = domain.DishTiming{ItemName: row.ItemName, Orders: int(row.Orders), AvgMinutes: row.AvgMinutes, TargetMinutes: row.TargetMinutes, Late: int(row.Late)}
	}
	return out, nil
}

func (r *reportRepository) OpenBills(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]domain.OpenBill, error) {
	rows, err := r.q.ReportOpenBills(ctx, sqlc.ReportOpenBillsParams{
		TenantID: converter.UUIDToPg(tenantID), CreatedAt: converter.TimeToPg(from), CreatedAt_2: converter.TimeToPg(to),
	})
	if err != nil {
		return nil, err
	}
	out := make([]domain.OpenBill, len(rows))
	for i, row := range rows {
		out[i] = domain.OpenBill{
			BillID:      converter.PgToUUID(row.ID),
			TableNumber: row.TableNumber,
			Status:      domain.BillStatus(row.Status),
			WaiterName:  row.WaiterName,
			TotalAmount: converter.NumericToFloat(row.TotalAmount),
			AmountPaid:  converter.NumericToFloat(row.AmountPaid),
		}
	}
	return out, nil
}

func (r *reportRepository) LastShift(ctx context.Context, userID uuid.UUID) (*domain.Shift, error) {
	s, err := r.q.LastShift(ctx, converter.UUIDToPg(userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return toShift(s), nil
}

func (r *reportRepository) WaiterShift(ctx context.Context, tenantID, waiterID uuid.UUID, from, to time.Time) (*domain.ShiftReport, error) {
	row, err := r.q.ReportWaiterShift(ctx, sqlc.ReportWaiterShiftParams{
		TenantID: converter.UUIDToPg(tenantID), CollectedBy: converter.UUIDToPg(waiterID),
		CollectedAt: converter.TimeToPg(from), CollectedAt_2: converter.TimeToPg(to),
	})
	if err != nil {
		return nil, err
	}
	return &domain.ShiftReport{
		Role: domain.RoleWaiter, Bills: int(row.Bills),
		Collected: converter.NumericToFloat(row.Collected), NotConfirmed: converter.NumericToFloat(row.NotConfirmed),
	}, nil
}

func (r *reportRepository) CashierShift(ctx context.Context, tenantID, cashierID uuid.UUID, from, to time.Time) (*domain.ShiftReport, error) {
	row, err := r.q.ReportCashierShift(ctx, sqlc.ReportCashierShiftParams{
		TenantID: converter.UUIDToPg(tenantID), ConfirmedBy: converter.UUIDToPg(cashierID),
		ConfirmedAt: converter.TimeToPg(from), ConfirmedAt_2: converter.TimeToPg(to),
	})
	if err != nil {
		return nil, err
	}
	return &domain.ShiftReport{Role: domain.RoleCashier, Bills: int(row.Bills), Confirmed: converter.NumericToFloat(row.Confirmed)}, nil
}
