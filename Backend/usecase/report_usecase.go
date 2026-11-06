package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"

	"menu-backend/domain"
)

type reportUsecase struct {
	reportRepo  domain.ReportRepository
	problemRepo domain.ProblemRepository
	billRepo    domain.BillRepository
	now         func() time.Time
}

func NewReportUsecase(reportRepo domain.ReportRepository, problemRepo domain.ProblemRepository, billRepo domain.BillRepository) domain.ReportUsecase {
	return &reportUsecase{reportRepo: reportRepo, problemRepo: problemRepo, billRepo: billRepo, now: time.Now}
}

func (u *reportUsecase) Daily(ctx context.Context, tenantID uuid.UUID, date string) (*domain.DailyReport, error) {
	from := startOfToday(u.now())
	if date != "" {
		day, err := time.ParseInLocation("2006-01-02", date, eat)
		if err != nil {
			return nil, &domain.ValidationError{Message: "the date must look like 2026-11-05"}
		}
		from = day
	}
	to := from.AddDate(0, 0, 1)

	report := &domain.DailyReport{Date: from.Format("2006-01-02")}
	var err error
	if report.Sales, err = u.reportRepo.SalesByMethod(ctx, tenantID, from, to); err != nil {
		return nil, err
	}
	for _, m := range report.Sales {
		report.SalesSum += m.Amount
	}
	if report.Waiters, err = u.reportRepo.Waiters(ctx, tenantID, from, to); err != nil {
		return nil, err
	}
	if report.Walkouts, err = u.problemRepo.ListWalkouts(ctx, tenantID, false, from, to); err != nil {
		return nil, err
	}
	problems, err := u.problemRepo.List(ctx, tenantID, domain.ProblemFilter{Since: from, Until: to})
	if err != nil {
		return nil, err
	}
	report.Removed = []domain.Problem{}
	for _, p := range problems {
		if p.Decision != nil && *p.Decision == domain.DecisionRemove {
			report.Removed = append(report.Removed, p)
		}
	}
	if report.Kitchen, err = u.reportRepo.Kitchen(ctx, tenantID, from, to); err != nil {
		return nil, err
	}
	if report.OpenBills, err = u.reportRepo.OpenBills(ctx, tenantID, from, to); err != nil {
		return nil, err
	}
	return report, nil
}

func (u *reportUsecase) MyShift(ctx context.Context, actor domain.Actor, tenantID uuid.UUID) (*domain.ShiftReport, error) {
	shift, err := u.billRepo.OpenShift(ctx, actor.ID)
	if err != nil {
		return nil, err
	}
	if shift == nil {
		if shift, err = u.reportRepo.LastShift(ctx, actor.ID); err != nil {
			return nil, err
		}
	}
	if shift == nil {
		return nil, domain.ErrNoShiftYet
	}
	until := u.now()
	if shift.EndedAt != nil {
		until = *shift.EndedAt
	}

	var report *domain.ShiftReport
	switch actor.Role {
	case domain.RoleWaiter:
		report, err = u.reportRepo.WaiterShift(ctx, tenantID, actor.ID, shift.StartedAt, until)
	case domain.RoleCashier:
		report, err = u.reportRepo.CashierShift(ctx, tenantID, actor.ID, shift.StartedAt, until)
	default:
		return nil, domain.ErrNoShiftYet
	}
	if err != nil {
		return nil, err
	}
	report.StartedAt = shift.StartedAt
	report.EndedAt = shift.EndedAt
	return report, nil
}
