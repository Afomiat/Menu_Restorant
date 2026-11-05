package usecase

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"menu-backend/domain"
)

const maxNoteLength = 500

type problemUsecase struct {
	problemRepo  domain.ProblemRepository
	billRepo     domain.BillRepository
	orderRepo    domain.OrderRepository
	activityRepo domain.ActivityRepository
	notifier     domain.Notifier
}

func NewProblemUsecase(problemRepo domain.ProblemRepository, billRepo domain.BillRepository, orderRepo domain.OrderRepository, activityRepo domain.ActivityRepository, notifier domain.Notifier) domain.ProblemUsecase {
	return &problemUsecase{problemRepo: problemRepo, billRepo: billRepo, orderRepo: orderRepo, activityRepo: activityRepo, notifier: notifier}
}

var managersOnly = domain.Audience{Roles: []domain.Role{domain.RoleManager}}

// everything is the widest time range, for looking one record up
var everything = struct{ since, until time.Time }{time.Unix(0, 0), time.Now().AddDate(100, 0, 0)}

func (u *problemUsecase) Report(ctx context.Context, actor domain.Actor, tenantID, orderID, itemID uuid.UUID, reason domain.ProblemReason, note string) (*domain.Problem, error) {
	note = strings.TrimSpace(note)
	if !reason.IsValid() {
		return nil, &domain.ValidationError{Message: "choose what is wrong: cold, wrong dish, undercooked, too slow, foreign object or other"}
	}
	if reason == domain.ReasonOther && note == "" {
		return nil, &domain.ValidationError{Message: "say what is wrong in the note"}
	}
	if len([]rune(note)) > maxNoteLength {
		return nil, &domain.ValidationError{Message: "the note is too long"}
	}

	item, err := u.problemRepo.ItemForProblem(ctx, tenantID, orderID, itemID)
	if err != nil {
		return nil, err
	}
	if item.Removed {
		return nil, domain.ErrAlreadyDecided
	}
	if actor.Role == domain.RoleWaiter {
		if err := u.waiterOwns(ctx, actor, tenantID, item.BillID); err != nil {
			return nil, err
		}
	}

	problemID, err := u.problemRepo.Create(ctx, tenantID, item, reason, note, actor.ID)
	if err != nil {
		return nil, err
	}
	problem, err := u.problem(ctx, tenantID, problemID)
	if err != nil {
		return nil, err
	}
	recordActivity(ctx, u.activityRepo, domain.Activity{
		TenantID: tenantID, ActorID: actor.ID, Action: domain.ActionProblemReported, OrderID: &orderID, BillID: item.BillID,
		Details: map[string]interface{}{"problem_id": problemID, "item_name": item.ItemName, "reason": reason, "note": note, "table_number": item.TableNumber},
	})
	u.notifier.NotifyStaff(tenantID, managersOnly, "problem:reported", map[string]interface{}{
		"problem_id": problemID, "table_number": item.TableNumber, "item_name": item.ItemName, "reason": reason,
	})
	return problem, nil
}

func (u *problemUsecase) Decide(ctx context.Context, actor domain.Actor, tenantID, problemID uuid.UUID, decision domain.ProblemDecision, fault domain.Fault) (*domain.Problem, error) {
	if decision != domain.DecisionRemake && decision != domain.DecisionRemove {
		return nil, &domain.ValidationError{Message: "choose remake or remove from bill"}
	}
	if !fault.IsValid() {
		return nil, &domain.ValidationError{Message: "choose who was at fault: kitchen, waiter or no one"}
	}
	problem, err := u.problem(ctx, tenantID, problemID)
	if err != nil {
		return nil, err
	}
	if problem.Decision != nil {
		return nil, domain.ErrAlreadyDecided
	}

	var removed *float64
	var remakeID *uuid.UUID
	if decision == domain.DecisionRemove {
		item, err := u.problemRepo.ItemForProblem(ctx, tenantID, problem.OrderID, problem.OrderItemID)
		if err != nil {
			return nil, err
		}
		// Only a bill still being paid can change; a collected or closed bill is settled
		if item.BillID != nil {
			bill, err := u.billRepo.Get(ctx, tenantID, *item.BillID)
			if err != nil {
				return nil, err
			}
			if !bill.Status.TakesOrders() {
				return nil, domain.ErrBillState
			}
		}
		value, err := u.problemRepo.RemoveItem(ctx, problem.OrderID, problem.OrderItemID)
		if err != nil {
			return nil, err
		}
		removed = &value
	} else {
		id, err := u.problemRepo.CreateRemake(ctx, tenantID, problem.OrderID, problem.OrderItemID)
		if err != nil {
			return nil, err
		}
		remakeID = &id
	}

	if err := u.problemRepo.Decide(ctx, tenantID, problemID, decision, fault, actor.ID, removed, remakeID); err != nil {
		return nil, err
	}
	details := map[string]interface{}{"problem_id": problemID, "decision": decision, "fault": fault, "item_name": problem.ItemName, "table_number": problem.TableNumber}
	if removed != nil {
		details["removed_amount"] = *removed
	}
	recordActivity(ctx, u.activityRepo, domain.Activity{TenantID: tenantID, ActorID: actor.ID, Action: domain.ActionProblemDecided, OrderID: &problem.OrderID, Details: details})

	// A remake goes straight to the kitchen screens, which show it first
	if remakeID != nil {
		if order, err := u.orderRepo.GetByID(ctx, tenantID, *remakeID); err == nil {
			u.notifier.NotifyStaff(tenantID, domain.Audience{Roles: []domain.Role{domain.RoleChef, domain.RoleManager}}, "order:created", order)
		}
	}
	return u.problem(ctx, tenantID, problemID)
}

func (u *problemUsecase) MarkWalkout(ctx context.Context, actor domain.Actor, tenantID, billID uuid.UUID) (*domain.Walkout, error) {
	bill, err := u.billRepo.Get(ctx, tenantID, billID)
	if err != nil {
		return nil, err
	}
	if actor.Role == domain.RoleWaiter && (bill.WaiterID == nil || *bill.WaiterID != actor.ID) {
		return nil, domain.ErrNotYourBill
	}
	// A walkout is a customer leaving without paying: only an unpaid bill can be one
	if !bill.Status.TakesOrders() || bill.AmountOwed <= moneyEpsilon {
		return nil, domain.ErrBillState
	}
	if err := u.problemRepo.MarkWalkout(ctx, tenantID, billID, bill.AmountOwed, actor.ID); err != nil {
		return nil, err
	}
	recordActivity(ctx, u.activityRepo, domain.Activity{
		TenantID: tenantID, ActorID: actor.ID, Action: domain.ActionWalkoutMarked, BillID: &billID,
		Details: map[string]interface{}{"table_number": bill.TableNumber, "amount": bill.AmountOwed, "waiter_name": bill.WaiterName},
	})
	u.notifier.NotifyStaff(tenantID, managersOnly, "walkout:marked", map[string]interface{}{
		"bill_id": billID, "table_number": bill.TableNumber, "amount": bill.AmountOwed, "waiter_name": bill.WaiterName,
	})
	return u.walkout(ctx, tenantID, billID)
}

func (u *problemUsecase) DecideWalkout(ctx context.Context, actor domain.Actor, tenantID, billID uuid.UUID, decision domain.WalkoutDecision, note string) (*domain.Walkout, error) {
	note = strings.TrimSpace(note)
	if decision != domain.WaiterPays && decision != domain.RestaurantLoss {
		return nil, &domain.ValidationError{Message: "choose waiter pays or restaurant takes the loss"}
	}
	if len([]rune(note)) > maxNoteLength {
		return nil, &domain.ValidationError{Message: "the note is too long"}
	}
	walkout, err := u.walkout(ctx, tenantID, billID)
	if err != nil {
		return nil, err
	}
	if walkout.Decision != nil {
		return nil, domain.ErrAlreadyDecided
	}
	if err := u.problemRepo.DecideWalkout(ctx, tenantID, billID, decision, note, actor.ID); err != nil {
		return nil, err
	}
	recordActivity(ctx, u.activityRepo, domain.Activity{
		TenantID: tenantID, ActorID: actor.ID, Action: domain.ActionWalkoutDecided, BillID: &billID,
		Details: map[string]interface{}{"decision": decision, "note": note, "amount": walkout.Amount, "waiter_name": walkout.WaiterName},
	})
	return u.walkout(ctx, tenantID, billID)
}

func (u *problemUsecase) Pending(ctx context.Context, tenantID uuid.UUID) (*domain.Decisions, error) {
	problems, err := u.problemRepo.List(ctx, tenantID, domain.ProblemFilter{OpenOnly: true, Since: everything.since, Until: everything.until})
	if err != nil {
		return nil, err
	}
	walkouts, err := u.problemRepo.ListWalkouts(ctx, tenantID, true, everything.since, everything.until)
	if err != nil {
		return nil, err
	}
	return &domain.Decisions{Problems: problems, Walkouts: walkouts}, nil
}

func (u *problemUsecase) waiterOwns(ctx context.Context, actor domain.Actor, tenantID uuid.UUID, billID *uuid.UUID) error {
	if billID == nil {
		return domain.ErrNotYourBill
	}
	bill, err := u.billRepo.Get(ctx, tenantID, *billID)
	if err != nil {
		return err
	}
	if bill.WaiterID == nil || *bill.WaiterID != actor.ID {
		return domain.ErrNotYourBill
	}
	return nil
}

func (u *problemUsecase) problem(ctx context.Context, tenantID, problemID uuid.UUID) (*domain.Problem, error) {
	list, err := u.problemRepo.List(ctx, tenantID, domain.ProblemFilter{ProblemID: &problemID, Since: everything.since, Until: everything.until})
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, domain.ErrProblemNotFound
	}
	return &list[0], nil
}

func (u *problemUsecase) walkout(ctx context.Context, tenantID, billID uuid.UUID) (*domain.Walkout, error) {
	list, err := u.problemRepo.ListWalkouts(ctx, tenantID, false, everything.since, everything.until)
	if err != nil {
		return nil, err
	}
	for i := range list {
		if list[i].BillID == billID {
			return &list[i], nil
		}
	}
	return nil, domain.ErrBillNotFound
}
