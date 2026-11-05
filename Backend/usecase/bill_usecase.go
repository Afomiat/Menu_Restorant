package usecase

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"

	"menu-backend/domain"
)

// Restaurants' "today" (for bills confirmed today) is Ethiopian time, UTC+3
var eat = time.FixedZone("EAT", 3*60*60)

// moneyEpsilon absorbs rounding when comparing Birr amounts
const moneyEpsilon = 0.005

type billUsecase struct {
	billRepo     domain.BillRepository
	tableRepo    domain.TableRepository
	staffRepo    domain.StaffRepository
	activityRepo domain.ActivityRepository
	notifier     domain.Notifier
	now          func() time.Time
}

func NewBillUsecase(billRepo domain.BillRepository, tableRepo domain.TableRepository, staffRepo domain.StaffRepository, activityRepo domain.ActivityRepository, notifier domain.Notifier) domain.BillUsecase {
	return &billUsecase{billRepo: billRepo, tableRepo: tableRepo, staffRepo: staffRepo, activityRepo: activityRepo, notifier: notifier, now: time.Now}
}

var cashiersAndManagers = domain.Audience{Roles: []domain.Role{domain.RoleCashier, domain.RoleManager}}

func (u *billUsecase) AttachOrder(ctx context.Context, tenant *domain.Tenant, order *domain.Order) error {
	if tenant == nil || !tenant.HasPlan(domain.PlanPro) {
		return nil
	}
	table, err := u.tableRepo.GetByNumber(ctx, tenant.ID, order.TableNumber)
	if err != nil || table == nil {
		return domain.ErrTableNotFound
	}
	billID, err := u.billRepo.ActiveBillForTable(ctx, tenant.ID, table)
	if err != nil {
		return err
	}
	if err := u.billRepo.AttachOrder(ctx, order.ID, billID); err != nil {
		return err
	}
	order.BillID = &billID
	return nil
}

func (u *billUsecase) List(ctx context.Context, actor domain.Actor, tenantID uuid.UUID) ([]domain.Bill, error) {
	filter := domain.BillFilter{Since: startOfToday(u.now())}
	if actor.Role == domain.RoleWaiter {
		filter.WaiterID = &actor.ID
	}
	return u.billRepo.List(ctx, tenantID, filter)
}

func (u *billUsecase) RequestByCustomer(ctx context.Context, tenantID uuid.UUID, tableNumber string) (*domain.Bill, error) {
	bill, err := u.activeBillForTable(ctx, tenantID, tableNumber)
	if err != nil {
		return nil, err
	}
	if bill == nil || bill.TotalAmount <= 0 {
		return nil, domain.ErrNoOpenBill
	}
	return u.request(ctx, uuid.Nil, bill)
}

func (u *billUsecase) Request(ctx context.Context, actor domain.Actor, tenantID, billID uuid.UUID) (*domain.Bill, error) {
	bill, err := u.ownBill(ctx, actor, tenantID, billID)
	if err != nil {
		return nil, err
	}
	if !bill.Status.TakesOrders() {
		return nil, domain.ErrBillState
	}
	return u.request(ctx, actor.ID, bill)
}

func (u *billUsecase) request(ctx context.Context, actorID uuid.UUID, bill *domain.Bill) (*domain.Bill, error) {
	if bill.Status == domain.BillRequested {
		return bill, nil
	}
	if err := u.billRepo.SetStatus(ctx, bill.TenantID, bill.ID, domain.BillRequested, actorID); err != nil {
		return nil, err
	}
	u.record(ctx, bill, actorID, domain.ActionBillRequested, nil)
	u.notifier.NotifyStaff(bill.TenantID, domain.WaiterOrManagers(bill.WaiterID), "bill:requested", billEvent(bill))
	return u.billRepo.Get(ctx, bill.TenantID, bill.ID)
}

func (u *billUsecase) Collect(ctx context.Context, actor domain.Actor, tenantID, billID uuid.UUID, input domain.CollectInput) (*domain.Bill, error) {
	bill, err := u.ownBill(ctx, actor, tenantID, billID)
	if err != nil {
		return nil, err
	}
	if !bill.Status.TakesOrders() || bill.AmountOwed <= moneyEpsilon {
		return nil, domain.ErrBillState
	}
	input.Reference = strings.TrimSpace(input.Reference)
	switch {
	case !input.Method.IsValid():
		return nil, &domain.ValidationError{Message: "choose how the bill was paid: cash, Telebirr or CBE Birr / bank"}
	case input.Amount <= 0:
		return nil, &domain.ValidationError{Message: "enter the amount collected"}
	case input.Amount > bill.AmountOwed+moneyEpsilon:
		return nil, &domain.ValidationError{Message: "the amount is more than the bill still owes"}
	case len(input.Reference) > 64:
		return nil, &domain.ValidationError{Message: "the transaction reference is too long"}
	}

	if err := u.billRepo.AddPayment(ctx, tenantID, billID, input, actor.ID); err != nil {
		return nil, err
	}
	details := map[string]interface{}{"amount": input.Amount, "method": input.Method, "reference": input.Reference}
	paidInFull := bill.AmountOwed-input.Amount <= moneyEpsilon
	if !paidInFull {
		u.record(ctx, bill, actor.ID, domain.ActionBillPaid, details)
		return u.billRepo.Get(ctx, tenantID, billID)
	}

	if err := u.billRepo.SetStatus(ctx, tenantID, billID, domain.BillCollected, actor.ID); err != nil {
		return nil, err
	}
	u.record(ctx, bill, actor.ID, domain.ActionBillCollected, details)
	updated, err := u.billRepo.Get(ctx, tenantID, billID)
	if err != nil {
		return nil, err
	}
	u.notifier.NotifyStaff(tenantID, cashiersAndManagers, "bill:collected", billEvent(updated))
	return updated, nil
}

func (u *billUsecase) Confirm(ctx context.Context, actor domain.Actor, tenantID, billID uuid.UUID) (*domain.Bill, error) {
	bill, err := u.billRepo.Get(ctx, tenantID, billID)
	if err != nil {
		return nil, err
	}
	if bill.Status != domain.BillCollected {
		return nil, domain.ErrBillState
	}
	if err := u.billRepo.SetStatus(ctx, tenantID, billID, domain.BillConfirmed, actor.ID); err != nil {
		return nil, err
	}
	u.record(ctx, bill, actor.ID, domain.ActionBillConfirmed, map[string]interface{}{"amount": bill.AmountPaid})
	return u.billRepo.Get(ctx, tenantID, billID)
}

func (u *billUsecase) Move(ctx context.Context, actor domain.Actor, tenantID, billID uuid.UUID, toTableNumber string) (*domain.Bill, error) {
	bill, err := u.ownBill(ctx, actor, tenantID, billID)
	if err != nil {
		return nil, err
	}
	toTableNumber = strings.TrimSpace(toTableNumber)
	if !bill.Status.TakesOrders() || toTableNumber == bill.TableNumber {
		return nil, domain.ErrBillState
	}
	table, err := u.tableRepo.GetByNumber(ctx, tenantID, toTableNumber)
	if err != nil || table == nil {
		return nil, domain.ErrTableNotFound
	}

	target, err := u.activeBillForTable(ctx, tenantID, toTableNumber)
	if err != nil {
		return nil, err
	}
	if target != nil {
		// The other table already has a bill: the two parties pay together
		if err := u.billRepo.Merge(ctx, tenantID, billID, target.ID, table); err != nil {
			return nil, err
		}
		u.record(ctx, target, actor.ID, domain.ActionBillMerged, map[string]interface{}{"from_table": bill.TableNumber, "to_table": toTableNumber, "from_bill_id": billID})
		return u.billRepo.Get(ctx, tenantID, target.ID)
	}

	if err := u.billRepo.MoveToTable(ctx, tenantID, billID, table); err != nil {
		return nil, err
	}
	u.record(ctx, bill, actor.ID, domain.ActionBillMoved, map[string]interface{}{"from_table": bill.TableNumber, "to_table": toTableNumber})
	return u.billRepo.Get(ctx, tenantID, billID)
}

func (u *billUsecase) Handover(ctx context.Context, actor domain.Actor, tenantID, billID, toStaffID uuid.UUID) (*domain.Bill, error) {
	bill, err := u.ownBill(ctx, actor, tenantID, billID)
	if err != nil {
		return nil, err
	}
	if bill.Status == domain.BillConfirmed || bill.Status == domain.BillWalkout {
		return nil, domain.ErrBillState
	}
	to, err := u.staffRepo.GetByID(ctx, tenantID, toStaffID)
	if err != nil || !to.IsActive || (to.Role != domain.RoleWaiter && to.Role != domain.RoleManager) {
		return nil, domain.ErrHandoverTarget
	}
	if err := u.billRepo.SetWaiter(ctx, tenantID, billID, &toStaffID); err != nil {
		return nil, err
	}
	u.record(ctx, bill, actor.ID, domain.ActionBillHandover, map[string]interface{}{"to_staff_id": toStaffID, "to_name": to.FullName})
	updated, err := u.billRepo.Get(ctx, tenantID, billID)
	if err != nil {
		return nil, err
	}
	u.notifier.NotifyStaff(tenantID, domain.Audience{UserIDs: []uuid.UUID{toStaffID}}, "bill:handed_over", billEvent(updated))
	return updated, nil
}

func (u *billUsecase) CheckRescan(ctx context.Context, tenantID uuid.UUID, tableNumber, sessionToken string) {
	bill, err := u.billRepo.RequestedBillForTable(ctx, tenantID, tableNumber)
	if err != nil || bill == nil {
		return
	}
	if sessionToken != "" {
		if same, err := u.billRepo.SessionOrderedOnBill(ctx, bill.ID, sessionToken); err != nil || same {
			return
		}
	}
	to := domain.WaiterOrManagers(bill.WaiterID)
	to.Roles = append(to.Roles, domain.RoleManager)
	u.notifier.NotifyStaff(tenantID, to, "table:open_bill_rescanned", billEvent(bill))
}

func (u *billUsecase) CurrentShift(ctx context.Context, actor domain.Actor) (*domain.Shift, error) {
	return u.billRepo.OpenShift(ctx, actor.ID)
}

func (u *billUsecase) StartShift(ctx context.Context, actor domain.Actor, tenantID uuid.UUID) (*domain.Shift, error) {
	if open, err := u.billRepo.OpenShift(ctx, actor.ID); err != nil {
		return nil, err
	} else if open != nil {
		return nil, domain.ErrShiftOpen
	}
	shift, err := u.billRepo.StartShift(ctx, tenantID, actor.ID)
	if err != nil {
		return nil, err
	}
	recordActivity(ctx, u.activityRepo, domain.Activity{TenantID: tenantID, ActorID: actor.ID, Action: domain.ActionShiftStarted})
	return shift, nil
}

func (u *billUsecase) EndShift(ctx context.Context, actor domain.Actor, tenantID uuid.UUID) (*domain.Shift, error) {
	if actor.Role == domain.RoleWaiter {
		unpaid, err := u.billRepo.CountWaiterUnpaid(ctx, tenantID, actor.ID)
		if err != nil {
			return nil, err
		}
		if unpaid > 0 {
			u.notifier.NotifyStaff(tenantID, domain.Audience{Roles: []domain.Role{domain.RoleManager}}, "shift:open_bills", map[string]interface{}{
				"waiter_id": actor.ID,
				"count":     unpaid,
			})
			return nil, &domain.OpenBillsError{Count: unpaid}
		}
	}
	shift, err := u.billRepo.EndShift(ctx, actor.ID)
	if err != nil {
		return nil, err
	}
	recordActivity(ctx, u.activityRepo, domain.Activity{TenantID: tenantID, ActorID: actor.ID, Action: domain.ActionShiftEnded})
	return shift, nil
}

// ownBill loads a bill a waiter may act on: their own; managers may act on any
func (u *billUsecase) ownBill(ctx context.Context, actor domain.Actor, tenantID, billID uuid.UUID) (*domain.Bill, error) {
	bill, err := u.billRepo.Get(ctx, tenantID, billID)
	if err != nil {
		return nil, err
	}
	if actor.Role == domain.RoleWaiter && (bill.WaiterID == nil || *bill.WaiterID != actor.ID) {
		return nil, domain.ErrNotYourBill
	}
	return bill, nil
}

func (u *billUsecase) activeBillForTable(ctx context.Context, tenantID uuid.UUID, tableNumber string) (*domain.Bill, error) {
	bills, err := u.billRepo.List(ctx, tenantID, domain.BillFilter{Since: u.now()})
	if err != nil {
		return nil, err
	}
	for i := range bills {
		if bills[i].TableNumber == tableNumber && bills[i].Status.TakesOrders() {
			return &bills[i], nil
		}
	}
	return nil, nil
}

func (u *billUsecase) record(ctx context.Context, bill *domain.Bill, actorID uuid.UUID, action string, details map[string]interface{}) {
	if details == nil {
		details = map[string]interface{}{}
	}
	details["table_number"] = bill.TableNumber
	billID := bill.ID
	recordActivity(ctx, u.activityRepo, domain.Activity{TenantID: bill.TenantID, ActorID: actorID, Action: action, BillID: &billID, Details: details})
}

func billEvent(b *domain.Bill) map[string]interface{} {
	return map[string]interface{}{
		"bill_id":      b.ID,
		"table_number": b.TableNumber,
		"total_amount": b.TotalAmount,
		"amount_owed":  b.AmountOwed,
	}
}

func startOfToday(now time.Time) time.Time {
	local := now.In(eat)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, eat)
}

// BillWatcher sends the unpaid-bill reminders and alerts for Pro restaurants
type BillWatcher struct {
	billRepo domain.BillRepository
	notifier domain.Notifier
}

func NewBillWatcher(billRepo domain.BillRepository, notifier domain.Notifier) *BillWatcher {
	return &BillWatcher{billRepo: billRepo, notifier: notifier}
}

func (w *BillWatcher) Run(ctx context.Context) {
	ticker := time.NewTicker(watchInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			if err := w.CheckOnce(ctx, now); err != nil {
				log.Printf("bill watcher: %v", err)
			}
		}
	}
}

// CheckOnce sends each due reminder once: the waiter after the bill reminder time, the managers
// after the escalation time, cashiers and managers when a collected bill is not confirmed, and
// the waiter when a table has been open a long time
func (w *BillWatcher) CheckOnce(ctx context.Context, now time.Time) error {
	due, err := w.billRepo.ListDue(ctx, now)
	if err != nil {
		return err
	}
	managers := domain.Audience{Roles: []domain.Role{domain.RoleManager}}
	for _, d := range due {
		if err := w.billRepo.MarkReminded(ctx, d); err != nil {
			return err
		}
		data := map[string]interface{}{"bill_id": d.ID, "table_number": d.TableNumber}
		if d.RemindWaiter {
			w.notifier.NotifyStaff(d.TenantID, domain.WaiterOrManagers(d.WaiterID), "bill:reminder", data)
		}
		if d.Escalate {
			w.notifier.NotifyStaff(d.TenantID, managers, "bill:escalated", data)
		}
		if d.Unconfirmed {
			w.notifier.NotifyStaff(d.TenantID, cashiersAndManagers, "bill:unconfirmed", data)
		}
		if d.LongOpen {
			w.notifier.NotifyStaff(d.TenantID, domain.WaiterOrManagers(d.WaiterID), "table:long_open", data)
		}
	}
	return nil
}
