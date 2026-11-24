package test

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/delivery/http/router"
	"menu-backend/domain"
)

type stubFinance struct {
	summaryFn   func(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) (*domain.FinanceSummary, error)
	trendFn     func(ctx context.Context, tenantID uuid.UUID, fromStr, toStr, groupBy string) ([]domain.TrendPoint, error)
	topDishesFn func(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string, limit int) ([]domain.DishRevenue, error)
	methodsFn   func(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]domain.MethodTotal, error)
	staffFn     func(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]domain.WaiterTotals, error)
	exportCSVFn func(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]byte, string, error)
}

func (s *stubFinance) Summary(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) (*domain.FinanceSummary, error) {
	if s.summaryFn != nil {
		return s.summaryFn(ctx, tenantID, fromStr, toStr)
	}
	return &domain.FinanceSummary{
		From:                  "2026-11-01",
		To:                    "2026-11-20",
		SalesTotal:            10000.0,
		Collected:             9500.0,
		Confirmed:             9000.0,
		CollectedNotConfirmed: 500.0,
		WalkoutLoss:           200.0,
		RemovedLoss:           100.0,
	}, nil
}

func (s *stubFinance) Trend(ctx context.Context, tenantID uuid.UUID, fromStr, toStr, groupBy string) ([]domain.TrendPoint, error) {
	if s.trendFn != nil {
		return s.trendFn(ctx, tenantID, fromStr, toStr, groupBy)
	}
	return []domain.TrendPoint{
		{Period: "2026-11-01", Revenue: 5000.0, Collected: 4800.0, WalkoutLoss: 100.0},
	}, nil
}

func (s *stubFinance) TopDishes(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string, limit int) ([]domain.DishRevenue, error) {
	if s.topDishesFn != nil {
		return s.topDishesFn(ctx, tenantID, fromStr, toStr, limit)
	}
	return []domain.DishRevenue{
		{ItemName: "Special Tibs", QuantitySold: 20, Revenue: 6000.0},
	}, nil
}

func (s *stubFinance) PaymentMethods(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]domain.MethodTotal, error) {
	if s.methodsFn != nil {
		return s.methodsFn(ctx, tenantID, fromStr, toStr)
	}
	return []domain.MethodTotal{
		{Method: domain.PayTelebirr, Payments: 12, Amount: 6000.0},
		{Method: domain.PayCash, Payments: 8, Amount: 4000.0},
	}, nil
}

func (s *stubFinance) StaffPerformance(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]domain.WaiterTotals, error) {
	if s.staffFn != nil {
		return s.staffFn(ctx, tenantID, fromStr, toStr)
	}
	return []domain.WaiterTotals{
		{WaiterName: "Abebe", Bills: 10, Sales: 5000.0, Collected: 5000.0, Confirmed: 4800.0},
	}, nil
}

func (s *stubFinance) ExportCSV(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) ([]byte, string, error) {
	if s.exportCSVFn != nil {
		return s.exportCSVFn(ctx, tenantID, fromStr, toStr)
	}
	return []byte("Finance Report,2026-11-01 to 2026-11-20\nTotal Sales,10000.00\n"), "finance-report-2026-11-01-to-2026-11-20.csv", nil
}

func financeRouter(plan domain.PlanTier, stub *stubFinance) (*gin.Engine, *domain.Tenant) {
	tenant := &domain.Tenant{ID: uuid.New(), Slug: "pro-bistro", Plan: plan, IsActive: true}
	r, _ := setupTestRouterWithBills(tenant, billsQR, billsJWT, &stubBills{}, func(d *router.RouterDependencies) {
		d.FinanceUsecase = stub
	})
	return r, tenant
}

func TestAPI_FinanceRoutes_AuthenticationAndRolePermissions(t *testing.T) {
	stub := &stubFinance{}
	r, tenant := financeRouter(domain.PlanPro, stub)

	cases := []struct {
		role string
		want int
	}{
		{"", http.StatusUnauthorized},
		{"waiter", http.StatusForbidden},
		{"chef", http.StatusForbidden},
		{"cashier", http.StatusForbidden},
		{"manager", http.StatusOK},
		{"finance", http.StatusOK},
	}

	for _, tc := range cases {
		t.Run("role_"+tc.role, func(t *testing.T) {
			w, res := send(r, http.MethodGet, "/api/v1/admin/finance/summary", tc.role, tenant.ID, nil)
			if w.Code != tc.want {
				t.Fatalf("expected status %d for role %q, got %d (body: %v)", tc.want, tc.role, w.Code, res)
			}
		})
	}
}

func TestAPI_FinanceRoutes_PlanTiers(t *testing.T) {
	stub := &stubFinance{}

	tiers := []struct {
		plan domain.PlanTier
		role string
		want int
	}{
		{domain.PlanBasic, "finance", http.StatusForbidden},
		{domain.PlanBasic, "manager", http.StatusForbidden},
		{domain.PlanPlus, "finance", http.StatusForbidden},
		{domain.PlanPlus, "manager", http.StatusForbidden},
		{domain.PlanPro, "finance", http.StatusOK},
		{domain.PlanPro, "manager", http.StatusOK},
	}

	for _, tc := range tiers {
		t.Run(string(tc.plan)+"_"+tc.role, func(t *testing.T) {
			r, tenant := financeRouter(tc.plan, stub)
			w, res := send(r, http.MethodGet, "/api/v1/admin/finance/summary", tc.role, tenant.ID, nil)
			if w.Code != tc.want {
				t.Fatalf("expected status %d on plan %s for role %s, got %d (body: %v)", tc.want, tc.plan, tc.role, w.Code, res)
			}
		})
	}
}

func TestAPI_FinanceEndpoints_DataResponses(t *testing.T) {
	stub := &stubFinance{}
	r, tenant := financeRouter(domain.PlanPro, stub)

	endpoints := []struct {
		name string
		path string
	}{
		{"Summary", "/api/v1/admin/finance/summary?from=2026-11-01&to=2026-11-20"},
		{"Trend", "/api/v1/admin/finance/trend?from=2026-11-01&to=2026-11-20&group=day"},
		{"TopDishes", "/api/v1/admin/finance/top-dishes?limit=5"},
		{"PaymentMethods", "/api/v1/admin/finance/payment-methods"},
		{"StaffPerformance", "/api/v1/admin/finance/staff"},
	}

	for _, ep := range endpoints {
		t.Run(ep.name, func(t *testing.T) {
			w, res := send(r, http.MethodGet, ep.path, "finance", tenant.ID, nil)
			if w.Code != http.StatusOK {
				t.Fatalf("expected 200 for %s, got %d (%v)", ep.name, w.Code, res)
			}
			if res["data"] == nil {
				t.Fatalf("expected data field in response for %s, got %v", ep.name, res)
			}
		})
	}

	// CSV Export test
	t.Run("ExportCSV", func(t *testing.T) {
		w, _ := send(r, http.MethodGet, "/api/v1/admin/finance/summary.csv?from=2026-11-01&to=2026-11-20", "finance", tenant.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 for CSV export, got %d", w.Code)
		}
		disposition := w.Header().Get("Content-Disposition")
		if !strings.Contains(disposition, "attachment;") || !strings.Contains(disposition, "finance-report-") {
			t.Errorf("unexpected Content-Disposition header: %q", disposition)
		}
		if !strings.Contains(w.Body.String(), "Total Sales,10000.00") {
			t.Errorf("unexpected CSV content: %q", w.Body.String())
		}
	})
}

func TestAPI_FinanceEndpoints_ValidationErrors(t *testing.T) {
	stub := &stubFinance{
		summaryFn: func(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) (*domain.FinanceSummary, error) {
			return nil, &domain.ValidationError{Message: "The from date must look like 2026-11-05"}
		},
	}
	r, tenant := financeRouter(domain.PlanPro, stub)

	w, res := send(r, http.MethodGet, "/api/v1/admin/finance/summary?from=invalid", "finance", tenant.ID, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for validation error, got %d (%v)", w.Code, res)
	}
	if res["error"] != "The from date must look like 2026-11-05" {
		t.Fatalf("unexpected validation error message: %v", res["error"])
	}
}

func TestAPI_FinanceEndpoints_InternalErrorSafeLogging(t *testing.T) {
	stub := &stubFinance{
		summaryFn: func(ctx context.Context, tenantID uuid.UUID, fromStr, toStr string) (*domain.FinanceSummary, error) {
			return nil, errors.New("pq: connection failure to database cluster pg_catalog broken")
		},
	}
	r, tenant := financeRouter(domain.PlanPro, stub)

	w, res := send(r, http.MethodGet, "/api/v1/admin/finance/summary", "finance", tenant.ID, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for internal error, got %d (%v)", w.Code, res)
	}
	if res["error"] != "Failed to load finance data" {
		t.Fatalf("expected generic safe error message, got: %v", res["error"])
	}
	if strings.Contains(w.Body.String(), "pg_catalog") || strings.Contains(w.Body.String(), "connection failure") {
		t.Fatalf("internal error leaked in response body: %s", w.Body.String())
	}
}
