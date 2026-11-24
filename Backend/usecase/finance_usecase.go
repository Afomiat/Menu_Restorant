package usecase

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"time"

	"github.com/google/uuid"

	"menu-backend/domain"
)

type financeUsecase struct {
	financeRepo domain.FinanceRepository
	reportRepo  domain.ReportRepository
	now         func() time.Time
}

func NewFinanceUsecase(financeRepo domain.FinanceRepository, reportRepo domain.ReportRepository) domain.FinanceUsecase {
	return &financeUsecase{
		financeRepo: financeRepo,
		reportRepo:  reportRepo,
		now:         time.Now,
	}
}

func (u *financeUsecase) parseDates(fromStr, toStr string) (time.Time, time.Time, error) {
	from := startOfToday(u.now()).AddDate(0, 0, -30)
	if fromStr != "" {
		d, err := time.ParseInLocation("2006-01-02", fromStr, eat)
		if err != nil {
			return time.Time{}, time.Time{}, &domain.ValidationError{Message: "The from date must look like 2026-11-05"}
		}
		from = d
	}

	to := startOfToday(u.now()).AddDate(0, 0, 1)
	if toStr != "" {
		d, err := time.ParseInLocation("2006-01-02", toStr, eat)
		if err != nil {
			return time.Time{}, time.Time{}, &domain.ValidationError{Message: "The to date must look like 2026-11-05"}
		}
		to = d.AddDate(0, 0, 1)
	}

	if to.Before(from) {
		return time.Time{}, time.Time{}, &domain.ValidationError{Message: "The to date cannot be before the from date"}
	}
	return from, to, nil
}

func (u *financeUsecase) Summary(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) (*domain.FinanceSummary, error) {
	from, to, err := u.parseDates(fromStr, toStr)
	if err != nil {
		return nil, err
	}
	res, err := u.financeRepo.Summary(ctx, tenantID, from, to)
	if err != nil {
		return nil, err
	}
	res.From = from.Format("2006-01-02")
	res.To = to.AddDate(0, 0, -1).Format("2006-01-02")
	return res, nil
}

func (u *financeUsecase) Trend(ctx context.Context, tenantID uuid.UUID, fromStr, toStr, groupBy string) ([]domain.TrendPoint, error) {
	from, to, err := u.parseDates(fromStr, toStr)
	if err != nil {
		return nil, err
	}
	if groupBy != "week" {
		groupBy = "day"
	}
	return u.financeRepo.Trend(ctx, tenantID, from, to, groupBy)
}

func (u *financeUsecase) TopDishes(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string, limit int) ([]domain.DishRevenue, error) {
	from, to, err := u.parseDates(fromStr, toStr)
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 10
	}
	return u.financeRepo.TopDishes(ctx, tenantID, from, to, limit)
}

func (u *financeUsecase) PaymentMethods(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]domain.MethodTotal, error) {
	from, to, err := u.parseDates(fromStr, toStr)
	if err != nil {
		return nil, err
	}
	return u.reportRepo.SalesByMethod(ctx, tenantID, from, to)
}

func (u *financeUsecase) StaffPerformance(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]domain.WaiterTotals, error) {
	from, to, err := u.parseDates(fromStr, toStr)
	if err != nil {
		return nil, err
	}
	return u.reportRepo.Waiters(ctx, tenantID, from, to)
}

func (u *financeUsecase) ExportCSV(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]byte, string, error) {
	from, to, err := u.parseDates(fromStr, toStr)
	if err != nil {
		return nil, "", err
	}

	summary, err := u.financeRepo.Summary(ctx, tenantID, from, to)
	if err != nil {
		return nil, "", err
	}

	methods, err := u.reportRepo.SalesByMethod(ctx, tenantID, from, to)
	if err != nil {
		return nil, "", err
	}

	waiters, err := u.reportRepo.Waiters(ctx, tenantID, from, to)
	if err != nil {
		return nil, "", err
	}

	topDishes, err := u.financeRepo.TopDishes(ctx, tenantID, from, to, 20)
	if err != nil {
		return nil, "", err
	}

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)

	fromFmt := from.Format("2006-01-02")
	toFmt := to.AddDate(0, 0, -1).Format("2006-01-02")

	_ = w.Write([]string{"Finance Report", fmt.Sprintf("%s to %s", fromFmt, toFmt)})
	_ = w.Write([]string{})

	_ = w.Write([]string{"Summary Metric", "Amount (ETB)"})
	_ = w.Write([]string{"Total Sales", fmt.Sprintf("%.2f", summary.SalesTotal)})
	_ = w.Write([]string{"Total Collected", fmt.Sprintf("%.2f", summary.Collected)})
	_ = w.Write([]string{"Total Confirmed", fmt.Sprintf("%.2f", summary.Confirmed)})
	_ = w.Write([]string{"Collected Not Confirmed", fmt.Sprintf("%.2f", summary.CollectedNotConfirmed)})
	_ = w.Write([]string{"Walkout Loss", fmt.Sprintf("%.2f", summary.WalkoutLoss)})
	_ = w.Write([]string{"Removed Dishes Loss", fmt.Sprintf("%.2f", summary.RemovedLoss)})
	_ = w.Write([]string{})

	_ = w.Write([]string{"Payment Method", "Payments Count", "Amount (ETB)"})
	for _, m := range methods {
		_ = w.Write([]string{string(m.Method), fmt.Sprintf("%d", m.Payments), fmt.Sprintf("%.2f", m.Amount)})
	}
	_ = w.Write([]string{})

	_ = w.Write([]string{"Staff Member", "Bills", "Sales", "Collected", "Confirmed", "Not Confirmed", "Walkouts"})
	for _, wt := range waiters {
		name := wt.WaiterName
		if name == "" {
			name = "Unassigned"
		}
		_ = w.Write([]string{
			name,
			fmt.Sprintf("%d", wt.Bills),
			fmt.Sprintf("%.2f", wt.Sales),
			fmt.Sprintf("%.2f", wt.Collected),
			fmt.Sprintf("%.2f", wt.Confirmed),
			fmt.Sprintf("%.2f", wt.CollectedNotConfirmed),
			fmt.Sprintf("%d", wt.Walkouts),
		})
	}
	_ = w.Write([]string{})

	_ = w.Write([]string{"Top Dish", "Quantity Sold", "Revenue (ETB)"})
	for _, td := range topDishes {
		_ = w.Write([]string{td.ItemName, fmt.Sprintf("%d", td.QuantitySold), fmt.Sprintf("%.2f", td.Revenue)})
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return nil, "", err
	}

	filename := fmt.Sprintf("finance-report-%s-to-%s.csv", fromFmt, toFmt)
	return buf.Bytes(), filename, nil
}
