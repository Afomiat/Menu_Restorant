package test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/usecase"
)

type mockFinanceRepo struct {
	summary   *domain.FinanceSummary
	trend     []domain.TrendPoint
	topDishes []domain.DishRevenue
}

func (m *mockFinanceRepo) Summary(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*domain.FinanceSummary, error) {
	if m.summary != nil {
		return m.summary, nil
	}
	return &domain.FinanceSummary{
		SalesTotal:            1000.0,
		Collected:             800.0,
		Confirmed:             750.0,
		CollectedNotConfirmed: 50.0,
		WalkoutLoss:           100.0,
		RemovedLoss:           50.0,
	}, nil
}

func (m *mockFinanceRepo) Trend(ctx context.Context, tenantID uuid.UUID, from, to time.Time, groupBy string) ([]domain.TrendPoint, error) {
	if m.trend != nil {
		return m.trend, nil
	}
	return []domain.TrendPoint{
		{Period: "2026-11-20", Revenue: 500, Collected: 400, WalkoutLoss: 50},
		{Period: "2026-11-21", Revenue: 500, Collected: 400, WalkoutLoss: 50},
	}, nil
}

func (m *mockFinanceRepo) TopDishes(ctx context.Context, tenantID uuid.UUID, from, to time.Time, limit int) ([]domain.DishRevenue, error) {
	if m.topDishes != nil {
		return m.topDishes, nil
	}
	return []domain.DishRevenue{
		{ItemName: "Tibs", QuantitySold: 10, Revenue: 4500},
		{ItemName: "Shiro", QuantitySold: 5, Revenue: 1100},
	}, nil
}

func TestFinanceUsecase_Summary(t *testing.T) {
	fRepo := &mockFinanceRepo{}
	rRepo := &mockReportRepo{}
	uc := usecase.NewFinanceUsecase(fRepo, rRepo)
	tenantID := uuid.New()

	ctx := context.Background()

	// 1. Valid range
	summary, err := uc.Summary(ctx, tenantID, "2026-11-01", "2026-11-20")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if summary.SalesTotal != 1000.0 || summary.Collected != 800.0 {
		t.Errorf("unexpected summary values: %+v", summary)
	}
	if summary.From != "2026-11-01" || summary.To != "2026-11-20" {
		t.Errorf("unexpected date range: from %q to %q", summary.From, summary.To)
	}

	// 2. Default dates (empty)
	summaryDefault, err := uc.Summary(ctx, tenantID, "", "")
	if err != nil {
		t.Fatalf("unexpected error on default dates: %v", err)
	}
	if summaryDefault.From == "" || summaryDefault.To == "" {
		t.Error("expected non-empty default dates")
	}

	// 3. Invalid date format
	_, err = uc.Summary(ctx, tenantID, "invalid-date", "2026-11-20")
	if err == nil {
		t.Error("expected validation error on invalid from date")
	}

	// 4. To before From
	_, err = uc.Summary(ctx, tenantID, "2026-11-20", "2026-11-01")
	if err == nil {
		t.Error("expected validation error when to is before from")
	}
}

func TestFinanceUsecase_Trend(t *testing.T) {
	fRepo := &mockFinanceRepo{}
	rRepo := &mockReportRepo{}
	uc := usecase.NewFinanceUsecase(fRepo, rRepo)
	tenantID := uuid.New()
	ctx := context.Background()

	// Daily trend
	trend, err := uc.Trend(ctx, tenantID, "2026-11-01", "2026-11-20", "day")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(trend) != 2 {
		t.Fatalf("expected 2 trend points, got %d", len(trend))
	}

	// Weekly trend
	trendWeek, err := uc.Trend(ctx, tenantID, "2026-11-01", "2026-11-20", "week")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(trendWeek) != 2 {
		t.Fatalf("expected 2 trend points, got %d", len(trendWeek))
	}
}

func TestFinanceUsecase_TopDishes(t *testing.T) {
	fRepo := &mockFinanceRepo{}
	rRepo := &mockReportRepo{}
	uc := usecase.NewFinanceUsecase(fRepo, rRepo)
	tenantID := uuid.New()
	ctx := context.Background()

	dishes, err := uc.TopDishes(ctx, tenantID, "2026-11-01", "2026-11-20", 5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dishes) != 2 {
		t.Fatalf("expected 2 dishes, got %d", len(dishes))
	}
	if dishes[0].ItemName != "Tibs" || dishes[0].Revenue != 4500 {
		t.Errorf("unexpected top dish: %+v", dishes[0])
	}
}

func TestFinanceUsecase_ExportCSV(t *testing.T) {
	fRepo := &mockFinanceRepo{}
	rRepo := &mockReportRepo{
		sales: []domain.MethodTotal{
			{Method: domain.PayCash, Payments: 10, Amount: 500},
			{Method: domain.PayTelebirr, Payments: 5, Amount: 300},
		},
	}
	uc := usecase.NewFinanceUsecase(fRepo, rRepo)
	tenantID := uuid.New()
	ctx := context.Background()

	csvBytes, filename, err := uc.ExportCSV(ctx, tenantID, "2026-11-01", "2026-11-20")
	if err != nil {
		t.Fatalf("unexpected error on ExportCSV: %v", err)
	}
	if !strings.HasSuffix(filename, ".csv") {
		t.Errorf("expected .csv filename, got: %s", filename)
	}
	csvStr := string(csvBytes)
	if !strings.Contains(csvStr, "Finance Report") {
		t.Error("expected CSV to contain 'Finance Report'")
	}
	if !strings.Contains(csvStr, "Total Sales") || !strings.Contains(csvStr, "1000.00") {
		t.Error("expected CSV to contain total sales and 1000.00")
	}
	if !strings.Contains(csvStr, "cash") || !strings.Contains(csvStr, "telebirr") {
		t.Error("expected CSV to contain payment methods")
	}
	if !strings.Contains(csvStr, "Tibs") {
		t.Error("expected CSV to contain top dish Tibs")
	}
}

func TestFinanceRole_PermissionsAndLabels(t *testing.T) {
	if !domain.RoleFinance.IsStaffRole() {
		t.Error("RoleFinance must be recognized as a staff role")
	}
	if domain.RoleFinance.Label() != "Finance" {
		t.Errorf("expected label 'Finance', got %q", domain.RoleFinance.Label())
	}
	if domain.NormalizeRole("finance") != domain.RoleFinance {
		t.Errorf("NormalizeRole('finance') must return RoleFinance")
	}
}
