package test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/usecase"
)

type mockProblemRepo struct {
	problems    []domain.Problem
	walkouts    []domain.Walkout
	decideCalls []domain.ProblemDecision
}

func (m *mockProblemRepo) ItemForProblem(ctx context.Context, tenantID, orderID, itemID uuid.UUID) (*domain.ProblemItem, error) {
	return &domain.ProblemItem{ItemName: "Burger", BillID: nil}, nil
}
func (m *mockProblemRepo) Create(ctx context.Context, tenantID uuid.UUID, item *domain.ProblemItem, reason domain.ProblemReason, note string, actorID uuid.UUID) (uuid.UUID, error) {
	return uuid.New(), nil
}
func (m *mockProblemRepo) List(ctx context.Context, tenantID uuid.UUID, filter domain.ProblemFilter) ([]domain.Problem, error) {
	if filter.ProblemID != nil {
		for _, p := range m.problems {
			if p.ID == *filter.ProblemID {
				return []domain.Problem{p}, nil
			}
		}
		return nil, domain.ErrProblemNotFound
	}
	return m.problems, nil
}
func (m *mockProblemRepo) Decide(ctx context.Context, tenantID, problemID uuid.UUID, decision domain.ProblemDecision, fault domain.Fault, actorID uuid.UUID, removed *float64, remakeOrderID *uuid.UUID) error {
	m.decideCalls = append(m.decideCalls, decision)
	for i := range m.problems {
		if m.problems[i].ID == problemID {
			m.problems[i].Decision = &decision
			m.problems[i].Fault = &fault
		}
	}
	return nil
}
func (m *mockProblemRepo) RemoveItem(ctx context.Context, orderID, itemID uuid.UUID) (float64, error) {
	return 100, nil
}
func (m *mockProblemRepo) CreateRemake(ctx context.Context, tenantID, orderID, itemID uuid.UUID) (uuid.UUID, error) {
	return uuid.New(), nil
}
func (m *mockProblemRepo) MarkWalkout(ctx context.Context, tenantID, billID uuid.UUID, amount float64, actorID uuid.UUID) error {
	return nil
}
func (m *mockProblemRepo) DecideWalkout(ctx context.Context, tenantID, billID uuid.UUID, decision domain.WalkoutDecision, note string, actorID uuid.UUID) error {
	return nil
}
func (m *mockProblemRepo) ListWalkouts(ctx context.Context, tenantID uuid.UUID, openOnly bool, since, until time.Time) ([]domain.Walkout, error) {
	return m.walkouts, nil
}

type mockReportRepo struct {
	openBills []domain.OpenBill
	sales     []domain.MethodTotal
}

func (m *mockReportRepo) SalesByMethod(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]domain.MethodTotal, error) {
	return m.sales, nil
}
func (m *mockReportRepo) Waiters(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]domain.WaiterTotals, error) {
	return nil, nil
}
func (m *mockReportRepo) Kitchen(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]domain.DishTiming, error) {
	return nil, nil
}
func (m *mockReportRepo) OpenBills(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]domain.OpenBill, error) {
	return m.openBills, nil
}
func (m *mockReportRepo) LastShift(ctx context.Context, userID uuid.UUID) (*domain.Shift, error) {
	return nil, nil
}
func (m *mockReportRepo) WaiterShift(ctx context.Context, tenantID, waiterID uuid.UUID, from, to time.Time) (*domain.ShiftReport, error) {
	return nil, nil
}
func (m *mockReportRepo) CashierShift(ctx context.Context, tenantID, cashierID uuid.UUID, from, to time.Time) (*domain.ShiftReport, error) {
	return nil, nil
}

// B10 test: no_change decision
func TestProblem_NoChangeDecision(t *testing.T) {
	tenantID := uuid.New()
	problemID := uuid.New()
	actor := domain.Actor{ID: uuid.New(), Role: domain.RoleManager}

	prob := domain.Problem{
		ID:          problemID,
		OrderID:     uuid.New(),
		OrderItemID: uuid.New(),
		Reason:      domain.ReasonCold,
	}

	pRepo := &mockProblemRepo{problems: []domain.Problem{prob}}
	bRepo := &mockBillRepo{}
	oRepo := &mockOrderRepo{}
	aRepo := &mockActivityRepo{}
	notifier := &recordingNotifier{}

	uc := usecase.NewProblemUsecase(pRepo, bRepo, oRepo, aRepo, notifier)

	decided, err := uc.Decide(context.Background(), actor, tenantID, problemID, domain.DecisionNoChange, domain.FaultNone)
	if err != nil {
		t.Fatalf("expected no_change to succeed, got: %v", err)
	}
	if decided.Decision == nil || *decided.Decision != domain.DecisionNoChange {
		t.Fatalf("expected decision to be no_change, got: %+v", decided.Decision)
	}
	if len(pRepo.decideCalls) != 1 || pRepo.decideCalls[0] != domain.DecisionNoChange {
		t.Fatalf("expected repo.Decide with no_change, got: %v", pRepo.decideCalls)
	}
	if len(aRepo.records) != 1 || aRepo.records[0].Action != domain.ActionProblemDecided {
		t.Fatalf("expected activity logged for problem decided, got: %+v", aRepo.records)
	}
}

// B11 test: Daily report includes remade dishes
func TestReport_DailyRemadeDishes(t *testing.T) {
	tenantID := uuid.New()

	remakeDec := domain.DecisionRemake
	removeDec := domain.DecisionRemove
	noChangeDec := domain.DecisionNoChange

	probRemade := domain.Problem{
		ID:       uuid.New(),
		Decision: &remakeDec,
	}
	probRemoved := domain.Problem{
		ID:       uuid.New(),
		Decision: &removeDec,
	}
	probNoChange := domain.Problem{
		ID:       uuid.New(),
		Decision: &noChangeDec,
	}

	pRepo := &mockProblemRepo{problems: []domain.Problem{probRemade, probRemoved, probNoChange}}
	rRepo := &mockReportRepo{}
	bRepo := &mockBillRepo{}

	uc := usecase.NewReportUsecase(rRepo, pRepo, bRepo)

	report, err := uc.Daily(context.Background(), tenantID, "2026-11-05")
	if err != nil {
		t.Fatalf("expected daily report, got: %v", err)
	}

	if len(report.Remade) != 1 || report.Remade[0].ID != probRemade.ID {
		t.Fatalf("expected 1 remade dish in report, got %d", len(report.Remade))
	}
	if len(report.Removed) != 1 || report.Removed[0].ID != probRemoved.ID {
		t.Fatalf("expected 1 removed dish in report, got %d", len(report.Removed))
	}
}

// B12 test: Open bills from previous days included in report
func TestReport_OpenBillsFromPreviousDays(t *testing.T) {
	tenantID := uuid.New()

	openBillOld := domain.OpenBill{
		BillID:      uuid.New(),
		TableNumber: "3",
		Status:      domain.BillOpen,
		TotalAmount: 250,
	}

	rRepo := &mockReportRepo{openBills: []domain.OpenBill{openBillOld}}
	pRepo := &mockProblemRepo{}
	bRepo := &mockBillRepo{}

	uc := usecase.NewReportUsecase(rRepo, pRepo, bRepo)

	report, err := uc.Daily(context.Background(), tenantID, "2026-11-05")
	if err != nil {
		t.Fatalf("expected daily report, got: %v", err)
	}

	if len(report.OpenBills) != 1 || report.OpenBills[0].BillID != openBillOld.BillID {
		t.Fatalf("expected 1 open bill from previous day in report, got %d", len(report.OpenBills))
	}
}
