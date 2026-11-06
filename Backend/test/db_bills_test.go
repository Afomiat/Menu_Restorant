package test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
	"menu-backend/repository"
	"menu-backend/usecase"
)

// billWorld is one Pro restaurant on the local database: staff, tables 5 and 6, and the real
// bill usecase, inside a transaction that is rolled back after the test
type billWorld struct {
	t        *testing.T
	tx       pgx.Tx
	q        *sqlc.Queries
	uc       domain.BillUsecase
	repo     domain.BillRepository
	notifier *recordingNotifier
	tenant   *domain.Tenant
	abebe    domain.Actor // waiter of table 5
	bereket  domain.Actor // another waiter
	liya     domain.Actor // cashier
	hana     domain.Actor // manager
	chefID   uuid.UUID
}

func newBillWorld(t *testing.T) *billWorld {
	tx := dbTx(t)
	ctx := context.Background()
	q := sqlc.New(tx)
	tenantID := newDBTenant(t, q, "test-bills-"+uuid.NewString()[:8])
	staff := repository.NewStaffRepository(q)
	add := func(name, phone string, role domain.Role) domain.Actor {
		s, err := staff.Create(ctx, tenantID, domain.NewStaffInput{FullName: name, Phone: phone, Role: role}, "h")
		if err != nil {
			t.Fatal(err)
		}
		return domain.Actor{ID: s.ID, Role: role}
	}
	w := &billWorld{t: t, tx: tx, q: q, notifier: &recordingNotifier{}}
	w.tenant = &domain.Tenant{ID: tenantID, Plan: domain.PlanPro}
	w.abebe = add("Abebe", "+251911000002", domain.RoleWaiter)
	w.bereket = add("Bereket", "+251911000005", domain.RoleWaiter)
	w.liya = add("Liya", "+251911000003", domain.RoleCashier)
	w.hana = add("Hana", "+251911000001", domain.RoleManager)
	w.chefID = add("Tigist", "+251911000004", domain.RoleChef).ID

	tables := repository.NewTableRepository(q)
	for _, n := range []string{"5", "6"} {
		table := &domain.RestaurantTable{TenantID: tenantID, TableNumber: n, QrSecret: "s", IsActive: true}
		if err := tables.Create(ctx, table); err != nil {
			t.Fatal(err)
		}
		if n == "5" {
			if _, err := tables.UpdateWaiter(ctx, tenantID, table.ID, &w.abebe.ID); err != nil {
				t.Fatal(err)
			}
		}
	}
	w.repo = repository.NewBillRepository(tx, q)
	w.uc = usecase.NewBillUsecase(w.repo, tables, staff, repository.NewActivityRepository(q), w.notifier)
	return w
}

// order places an order of this amount on a table and puts it on the table's bill
func (w *billWorld) order(table string, amount float64, session string) uuid.UUID {
	w.t.Helper()
	o, err := w.q.CreateOrder(context.Background(), sqlc.CreateOrderParams{
		TenantID:             converter.UUIDToPg(w.tenant.ID),
		TableNumber:          table,
		CustomerSessionToken: session,
		Status:               sqlc.OrderStatusNotStarted,
		PaymentStatus:        sqlc.PaymentStatusUnpaid,
		TotalAmount:          converter.FloatToNumeric(amount),
		GracePeriodEndsAt:    converter.TimeToPg(time.Now()),
		TargetMinutes:        pgtype.Int4{Int32: 15, Valid: true},
	})
	if err != nil {
		w.t.Fatal(err)
	}
	order := &domain.Order{ID: converter.PgToUUID(o.ID), TableNumber: table}
	if err := w.uc.AttachOrder(context.Background(), w.tenant, order); err != nil {
		w.t.Fatal(err)
	}
	return *order.BillID
}

func (w *billWorld) bill(id uuid.UUID) *domain.Bill {
	w.t.Helper()
	b, err := w.repo.Get(context.Background(), w.tenant.ID, id)
	if err != nil {
		w.t.Fatal(err)
	}
	return b
}

func (w *billWorld) lastEvent() (string, domain.Audience) {
	w.notifier.mu.Lock()
	defer w.notifier.mu.Unlock()
	n := len(w.notifier.event)
	if n == 0 {
		return "", domain.Audience{}
	}
	return w.notifier.event[n-1], w.notifier.sent[n-1]
}

func TestDB_BillCollectsTheTablesOrders(t *testing.T) {
	w := newBillWorld(t)
	first := w.order("5", 450, "s1")
	second := w.order("5", 220, "s1")
	other := w.order("6", 100, "s2")

	if first != second || first == other {
		t.Fatal("orders of one table share a bill; another table has its own")
	}
	b := w.bill(first)
	if b.TotalAmount != 670 || b.AmountOwed != 670 || b.Status != domain.BillOpen || *b.WaiterID != w.abebe.ID || b.WaiterName != "Abebe" {
		t.Fatalf("unexpected bill %+v", b)
	}
	if w.bill(other).WaiterID != nil {
		t.Fatal("table 6 has no waiter, so its bill has none")
	}

	// A cancelled order leaves the bill
	if _, err := w.tx.Exec(context.Background(), `UPDATE orders SET status = 'cancelled' WHERE bill_id = $1 AND total_amount = 220`, first); err != nil {
		t.Fatal(err)
	}
	if b := w.bill(first); b.TotalAmount != 450 {
		t.Fatalf("expected 450 without the cancelled order, got %v", b.TotalAmount)
	}

	// Plus restaurants have no bills
	plusOrder := &domain.Order{ID: uuid.New(), TableNumber: "5"}
	if err := w.uc.AttachOrder(context.Background(), &domain.Tenant{ID: w.tenant.ID, Plan: domain.PlanPlus}, plusOrder); err != nil || plusOrder.BillID != nil {
		t.Fatalf("Plus orders must not get a bill, got %v %v", plusOrder.BillID, err)
	}
}

func TestDB_AskCollectConfirm(t *testing.T) {
	w := newBillWorld(t)
	ctx := context.Background()
	billID := w.order("5", 670, "s1")

	if _, err := w.uc.RequestByCustomer(ctx, w.tenant.ID, "6"); !errors.Is(err, domain.ErrNoOpenBill) {
		t.Fatalf("a table without orders has no bill to ask for, got %v", err)
	}
	b, err := w.uc.RequestByCustomer(ctx, w.tenant.ID, "5")
	if err != nil || b.Status != domain.BillRequested || b.RequestedAt == nil {
		t.Fatalf("expected the bill requested, got %+v %v", b, err)
	}
	if event, to := w.lastEvent(); event != "bill:requested" || len(to.UserIDs) != 1 || to.UserIDs[0] != w.abebe.ID {
		t.Fatalf("expected the bell for Abebe only, got %s %+v", event, to)
	}

	// Only the bill's waiter collects, with a valid method and no more than is owed
	if _, err := w.uc.Collect(ctx, w.bereket, w.tenant.ID, billID, domain.CollectInput{Amount: 100, Method: domain.PayCash}); !errors.Is(err, domain.ErrNotYourBill) {
		t.Fatalf("expected ErrNotYourBill for another waiter, got %v", err)
	}
	var validation *domain.ValidationError
	for name, in := range map[string]domain.CollectInput{
		"no method":     {Amount: 100},
		"bad method":    {Amount: 100, Method: "card"},
		"zero":          {Amount: 0, Method: domain.PayCash},
		"over the bill": {Amount: 700, Method: domain.PayCash},
	} {
		if _, err := w.uc.Collect(ctx, w.abebe, w.tenant.ID, billID, in); !errors.As(err, &validation) {
			t.Errorf("%s: expected a validation error, got %v", name, err)
		}
	}

	// Part now, rest later: the bill stays open with what is still owed
	b, err = w.uc.Collect(ctx, w.abebe, w.tenant.ID, billID, domain.CollectInput{Amount: 300, Method: domain.PayCash})
	if err != nil || b.Status != domain.BillRequested || b.AmountPaid != 300 || b.AmountOwed != 370 {
		t.Fatalf("expected 370 still owed, got %+v %v", b, err)
	}
	if _, err := w.uc.Confirm(ctx, w.liya, w.tenant.ID, billID); !errors.Is(err, domain.ErrBillState) {
		t.Fatalf("an unpaid bill cannot be confirmed, got %v", err)
	}

	b, err = w.uc.Collect(ctx, w.abebe, w.tenant.ID, billID, domain.CollectInput{Amount: 370, Method: domain.PayTelebirr, Reference: " TX123 "})
	if err != nil || b.Status != domain.BillCollected || b.AmountOwed != 0 || *b.CollectedBy != w.abebe.ID {
		t.Fatalf("expected collected in full, got %+v %v", b, err)
	}
	byMethod := map[domain.PaymentMethod]domain.BillPayment{}
	for _, p := range b.Payments {
		byMethod[p.Method] = p
	}
	telebirr := byMethod[domain.PayTelebirr]
	if len(b.Payments) != 2 || byMethod[domain.PayCash].Amount != 300 || telebirr.Amount != 370 || telebirr.Reference != "TX123" || telebirr.CollectedByName != "Abebe" {
		t.Fatalf("expected both payments recorded, got %+v", b.Payments)
	}
	if event, to := w.lastEvent(); event != "bill:collected" || len(to.Roles) != 2 {
		t.Fatalf("expected cashiers and managers alerted, got %s %+v", event, to)
	}

	// New customers at the table start a new bill
	if next := w.order("5", 60, "s9"); next == billID {
		t.Fatal("a collected bill takes no new orders")
	}

	b, err = w.uc.Confirm(ctx, w.liya, w.tenant.ID, billID)
	if err != nil || b.Status != domain.BillConfirmed || *b.ConfirmedBy != w.liya.ID || b.ClosedAt == nil {
		t.Fatalf("expected confirmed by Liya, got %+v %v", b, err)
	}
	if _, err := w.uc.Collect(ctx, w.abebe, w.tenant.ID, billID, domain.CollectInput{Amount: 1, Method: domain.PayCash}); !errors.Is(err, domain.ErrBillState) {
		t.Fatalf("a confirmed bill takes no payments, got %v", err)
	}

	// Cashiers see every bill including confirmed ones today; a waiter sees only theirs
	all, _ := w.uc.List(ctx, w.liya, w.tenant.ID)
	mine, _ := w.uc.List(ctx, w.bereket, w.tenant.ID)
	if len(all) != 2 || len(mine) != 0 {
		t.Fatalf("expected 2 bills for the cashier and none for Bereket, got %d and %d", len(all), len(mine))
	}
}

func TestDB_MoveAndMergeBills(t *testing.T) {
	w := newBillWorld(t)
	ctx := context.Background()
	billID := w.order("5", 450, "s1")

	moved, err := w.uc.Move(ctx, w.abebe, w.tenant.ID, billID, "6")
	if err != nil || moved.ID != billID || moved.TableNumber != "6" || moved.WaiterID != nil {
		t.Fatalf("expected the bill on table 6 (no waiter), got %+v %v", moved, err)
	}
	var tableOfOrder string
	if err := w.tx.QueryRow(ctx, `SELECT table_number FROM orders WHERE bill_id = $1`, billID).Scan(&tableOfOrder); err != nil || tableOfOrder != "6" {
		t.Fatalf("the orders must move with the bill, got %q %v", tableOfOrder, err)
	}

	// Table 5 orders again, then joins table 6: one bill for both
	second := w.order("5", 220, "s2")
	merged, err := w.uc.Move(ctx, w.hana, w.tenant.ID, second, "6")
	if err != nil || merged.ID != billID || merged.TotalAmount != 670 {
		t.Fatalf("expected the bills merged on table 6, got %+v %v", merged, err)
	}
	if _, err := w.repo.Get(ctx, w.tenant.ID, second); !errors.Is(err, domain.ErrBillNotFound) {
		t.Fatalf("the merged bill must be gone, got %v", err)
	}

	if _, err := w.uc.Move(ctx, w.hana, w.tenant.ID, billID, "99"); !errors.Is(err, domain.ErrTableNotFound) {
		t.Fatalf("expected ErrTableNotFound, got %v", err)
	}
	if _, err := w.uc.Move(ctx, w.hana, w.tenant.ID, billID, "6"); !errors.Is(err, domain.ErrBillState) {
		t.Fatalf("moving to the same table makes no sense, got %v", err)
	}
}

func TestDB_HandoverAndShifts(t *testing.T) {
	w := newBillWorld(t)
	ctx := context.Background()
	billID := w.order("5", 450, "s1")

	if _, err := w.uc.EndShift(ctx, w.abebe, w.tenant.ID); !errors.Is(err, domain.ErrNoShift) {
		// Abebe holds an unpaid bill, so this must be refused before checking the shift
		var open *domain.OpenBillsError
		if !errors.As(err, &open) {
			t.Fatalf("expected the shift refused, got %v", err)
		}
	}
	if _, err := w.uc.StartShift(ctx, w.abebe, w.tenant.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := w.uc.StartShift(ctx, w.abebe, w.tenant.ID); !errors.Is(err, domain.ErrShiftOpen) {
		t.Fatalf("expected ErrShiftOpen, got %v", err)
	}

	var open *domain.OpenBillsError
	if _, err := w.uc.EndShift(ctx, w.abebe, w.tenant.ID); !errors.As(err, &open) || open.Count != 1 {
		t.Fatalf("expected the shift refused with 1 unpaid bill, got %v", err)
	}
	if event, to := w.lastEvent(); event != "shift:open_bills" || to.Roles[0] != domain.RoleManager {
		t.Fatalf("expected the managers told, got %s %+v", event, to)
	}

	if _, err := w.uc.Handover(ctx, w.abebe, w.tenant.ID, billID, w.chefID); !errors.Is(err, domain.ErrHandoverTarget) {
		t.Fatalf("a chef cannot take a bill, got %v", err)
	}
	b, err := w.uc.Handover(ctx, w.abebe, w.tenant.ID, billID, w.bereket.ID)
	if err != nil || *b.WaiterID != w.bereket.ID || b.WaiterName != "Bereket" {
		t.Fatalf("expected the bill with Bereket, got %+v %v", b, err)
	}
	if event, to := w.lastEvent(); event != "bill:handed_over" || to.UserIDs[0] != w.bereket.ID {
		t.Fatalf("expected Bereket told, got %s %+v", event, to)
	}

	shift, err := w.uc.EndShift(ctx, w.abebe, w.tenant.ID)
	if err != nil || shift.EndedAt == nil {
		t.Fatalf("with no unpaid bills the shift ends, got %+v %v", shift, err)
	}
	if current, _ := w.uc.CurrentShift(ctx, w.abebe); current != nil {
		t.Fatal("no shift is open after ending it")
	}
}

func TestDB_BillReminders(t *testing.T) {
	w := newBillWorld(t)
	ctx := context.Background()
	billID := w.order("5", 450, "s1")
	if _, err := w.uc.RequestByCustomer(ctx, w.tenant.ID, "5"); err != nil {
		t.Fatal(err)
	}
	watcher := usecase.NewBillWatcher(w.repo, w.notifier)

	ours := func(now time.Time) []domain.BillDue {
		all, err := w.repo.ListDue(ctx, now)
		if err != nil {
			t.Fatal(err)
		}
		var mine []domain.BillDue
		for _, d := range all {
			if d.ID == billID {
				mine = append(mine, d)
			}
		}
		return mine
	}

	if due := ours(time.Now().Add(5 * time.Minute)); len(due) != 0 {
		t.Fatalf("nothing is due 5 minutes after asking, got %+v", due)
	}
	due := ours(time.Now().Add(11 * time.Minute))
	if len(due) != 1 || !due[0].RemindWaiter || due[0].Escalate {
		t.Fatalf("after 10 minutes the waiter is reminded, got %+v", due)
	}

	before := len(w.notifier.event)
	if err := watcher.CheckOnce(ctx, time.Now().Add(21*time.Minute)); err != nil {
		t.Fatal(err)
	}
	got := w.notifier.event[before:]
	if len(got) != 2 || got[0] != "bill:reminder" || got[1] != "bill:escalated" {
		t.Fatalf("expected the waiter reminder and manager alert, got %v", got)
	}
	if due := ours(time.Now().Add(30 * time.Minute)); len(due) != 0 {
		t.Fatalf("each reminder goes out once, got %+v", due)
	}

	// A table open for two hours reminds its waiter
	if _, err := w.tx.Exec(ctx, `UPDATE bills SET created_at = NOW() - interval '121 minutes' WHERE id = $1`, billID); err != nil {
		t.Fatal(err)
	}
	if due := ours(time.Now()); len(due) != 1 || !due[0].LongOpen {
		t.Fatalf("expected the long-open reminder, got %+v", due)
	}
}

func TestDB_RescanAlertsForNewCustomersOnly(t *testing.T) {
	w := newBillWorld(t)
	ctx := context.Background()
	w.order("5", 450, "same-party")

	before := len(w.notifier.event)
	w.uc.CheckRescan(ctx, w.tenant.ID, "5", "someone-new")
	if len(w.notifier.event) != before {
		t.Fatal("no alert while the bill has not been asked for")
	}

	if _, err := w.uc.RequestByCustomer(ctx, w.tenant.ID, "5"); err != nil {
		t.Fatal(err)
	}
	before = len(w.notifier.event)
	w.uc.CheckRescan(ctx, w.tenant.ID, "5", "same-party")
	if len(w.notifier.event) != before {
		t.Fatal("the same party scanning again is not an alert")
	}
	w.uc.CheckRescan(ctx, w.tenant.ID, "5", "someone-new")
	event, to := w.lastEvent()
	if event != "table:open_bill_rescanned" || len(to.UserIDs) != 1 || to.UserIDs[0] != w.abebe.ID || to.Roles[0] != domain.RoleManager {
		t.Fatalf("expected the waiter and managers alerted, got %s %+v", event, to)
	}
}
