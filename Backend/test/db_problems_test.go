package test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
	"menu-backend/repository"
	"menu-backend/usecase"
)

type dish struct {
	name  string
	price float64
	qty   int32
}

// orderWithDishes places an order of these dishes on a table's bill and returns the order,
// its bill and the dishes' ids
func (w *billWorld) orderWithDishes(table, session string, dishes ...dish) (uuid.UUID, uuid.UUID, []uuid.UUID) {
	w.t.Helper()
	ctx := context.Background()
	total := 0.0
	for _, d := range dishes {
		total += d.price * float64(d.qty)
	}
	o, err := w.q.CreateOrder(ctx, sqlc.CreateOrderParams{
		TenantID: converter.UUIDToPg(w.tenant.ID), TableNumber: table, CustomerSessionToken: session,
		Status: sqlc.OrderStatusNotStarted, PaymentStatus: sqlc.PaymentStatusUnpaid,
		TotalAmount: converter.FloatToNumeric(total), GracePeriodEndsAt: converter.TimeToPg(time.Now()),
		TargetMinutes: pgtype.Int4{Int32: 15, Valid: true},
	})
	if err != nil {
		w.t.Fatal(err)
	}
	order := &domain.Order{ID: converter.PgToUUID(o.ID), TableNumber: table}
	if err := w.uc.AttachOrder(ctx, w.tenant, order); err != nil {
		w.t.Fatal(err)
	}
	var items []uuid.UUID
	for _, d := range dishes {
		it, err := w.q.CreateOrderItem(ctx, sqlc.CreateOrderItemParams{
			OrderID: o.ID, ItemName: d.name, UnitPrice: converter.FloatToNumeric(d.price), Quantity: d.qty,
		})
		if err != nil {
			w.t.Fatal(err)
		}
		items = append(items, converter.PgToUUID(it.ID))
	}
	return order.ID, *order.BillID, items
}

func (w *billWorld) problems() (domain.ProblemUsecase, domain.ProblemRepository) {
	repo := repository.NewProblemRepository(w.tx, w.q)
	return usecase.NewProblemUsecase(repo, w.repo, repository.NewOrderRepository(nil, w.q), repository.NewActivityRepository(w.q), w.notifier), repo
}

func TestDB_ProblemRemoveFromBill(t *testing.T) {
	w := newBillWorld(t)
	ctx := context.Background()
	problems, _ := w.problems()
	orderID, billID, items := w.orderWithDishes("5", "s1", dish{"Tibs", 450, 1}, dish{"Buna", 60, 2})

	var validation *domain.ValidationError
	if _, err := problems.Report(ctx, w.abebe, w.tenant.ID, orderID, items[0], "burnt", ""); !errors.As(err, &validation) {
		t.Fatalf("an unknown reason must be refused, got %v", err)
	}
	if _, err := problems.Report(ctx, w.abebe, w.tenant.ID, orderID, items[0], domain.ReasonOther, " "); !errors.As(err, &validation) {
		t.Fatalf("'other' needs a note, got %v", err)
	}
	if _, err := problems.Report(ctx, w.bereket, w.tenant.ID, orderID, items[0], domain.ReasonCold, ""); !errors.Is(err, domain.ErrNotYourBill) {
		t.Fatalf("only the table's waiter reports, got %v", err)
	}
	if _, err := problems.Report(ctx, w.abebe, w.tenant.ID, orderID, uuid.New(), domain.ReasonCold, ""); !errors.Is(err, domain.ErrItemNotFound) {
		t.Fatalf("expected ErrItemNotFound, got %v", err)
	}

	p, err := problems.Report(ctx, w.abebe, w.tenant.ID, orderID, items[1], domain.ReasonCold, "coffee was cold")
	if err != nil || p.ItemName != "Buna" || p.ReportedBy != "Abebe" || p.TableNumber != "5" || p.Decision != nil {
		t.Fatalf("unexpected problem %+v %v", p, err)
	}
	if event, to := w.lastEvent(); event != "problem:reported" || to.Roles[0] != domain.RoleManager {
		t.Fatalf("expected the managers alerted, got %s %+v", event, to)
	}

	pending, _ := problems.Pending(ctx, w.tenant.ID)
	if len(pending.Problems) != 1 {
		t.Fatalf("expected one problem waiting, got %d", len(pending.Problems))
	}

	if _, err := problems.Decide(ctx, w.hana, w.tenant.ID, p.ID, domain.DecisionRemove, "someone"); !errors.As(err, &validation) {
		t.Fatalf("a fault must be chosen, got %v", err)
	}
	decided, err := problems.Decide(ctx, w.hana, w.tenant.ID, p.ID, domain.DecisionRemove, domain.FaultKitchen)
	if err != nil || *decided.Decision != domain.DecisionRemove || *decided.Fault != domain.FaultKitchen || *decided.RemovedAmount != 120 || decided.DecidedBy != "Hana" {
		t.Fatalf("unexpected decision %+v %v", decided, err)
	}
	if b := w.bill(billID); b.TotalAmount != 450 {
		t.Fatalf("the bill must drop the two coffees (120), got %v", b.TotalAmount)
	}
	if _, err := problems.Decide(ctx, w.hana, w.tenant.ID, p.ID, domain.DecisionRemake, domain.FaultNone); !errors.Is(err, domain.ErrAlreadyDecided) {
		t.Fatalf("a problem is decided once, got %v", err)
	}
	if _, err := problems.Report(ctx, w.abebe, w.tenant.ID, orderID, items[1], domain.ReasonCold, ""); !errors.Is(err, domain.ErrAlreadyDecided) {
		t.Fatalf("a removed dish takes no more problems, got %v", err)
	}
	if pending, _ := problems.Pending(ctx, w.tenant.ID); len(pending.Problems) != 0 {
		t.Fatal("decided problems no longer wait")
	}

	// Once the money is collected the bill is settled: nothing can be removed
	second, err := problems.Report(ctx, w.hana, w.tenant.ID, orderID, items[0], domain.ReasonUndercooked, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.uc.Collect(ctx, w.abebe, w.tenant.ID, billID, domain.CollectInput{Amount: 450, Method: domain.PayCash}); err != nil {
		t.Fatal(err)
	}
	if _, err := problems.Decide(ctx, w.hana, w.tenant.ID, second.ID, domain.DecisionRemove, domain.FaultKitchen); !errors.Is(err, domain.ErrBillState) {
		t.Fatalf("a collected bill cannot change, got %v", err)
	}
}

func TestDB_ProblemRemake(t *testing.T) {
	w := newBillWorld(t)
	ctx := context.Background()
	problems, _ := w.problems()
	orderID, billID, items := w.orderWithDishes("5", "s1", dish{"Tibs", 450, 1})

	p, err := problems.Report(ctx, w.abebe, w.tenant.ID, orderID, items[0], domain.ReasonUndercooked, "")
	if err != nil {
		t.Fatal(err)
	}
	decided, err := problems.Decide(ctx, w.hana, w.tenant.ID, p.ID, domain.DecisionRemake, domain.FaultNone)
	if err != nil || decided.RemakeOrderID == nil {
		t.Fatalf("expected a remake order, got %+v %v", decided, err)
	}

	remake, err := repository.NewOrderRepository(nil, w.q).GetByID(ctx, w.tenant.ID, *decided.RemakeOrderID)
	if err != nil || remake.RemakeOf == nil || *remake.RemakeOf != orderID || remake.Status != domain.StatusNotStarted || remake.TotalAmount != 0 {
		t.Fatalf("expected a free new order pointing at the original, got %+v %v", remake, err)
	}
	if len(remake.Items) != 1 || remake.Items[0].ItemName != "Tibs" || remake.Items[0].UnitPrice != 0 {
		t.Fatalf("expected the dish copied at no charge, got %+v", remake.Items)
	}
	if b := w.bill(billID); b.TotalAmount != 450 {
		t.Fatalf("a remake does not change the bill, got %v", b.TotalAmount)
	}
	if event, to := w.lastEvent(); event != "order:created" || len(to.Roles) != 2 {
		t.Fatalf("expected the remake sent to the kitchen, got %s %+v", event, to)
	}
}

func TestDB_Walkout(t *testing.T) {
	w := newBillWorld(t)
	ctx := context.Background()
	problems, _ := w.problems()
	_, billID, _ := w.orderWithDishes("5", "s1", dish{"Tibs", 450, 2})
	if _, err := w.uc.Collect(ctx, w.abebe, w.tenant.ID, billID, domain.CollectInput{Amount: 300, Method: domain.PayCash}); err != nil {
		t.Fatal(err)
	}

	if _, err := problems.MarkWalkout(ctx, w.bereket, w.tenant.ID, billID); !errors.Is(err, domain.ErrNotYourBill) {
		t.Fatalf("only the bill's waiter or a manager marks a walkout, got %v", err)
	}
	walkout, err := problems.MarkWalkout(ctx, w.abebe, w.tenant.ID, billID)
	if err != nil || walkout.Amount != 600 || walkout.WaiterName != "Abebe" || walkout.MarkedBy != "Abebe" || walkout.Decision != nil {
		t.Fatalf("expected a 600 Birr walkout (900 less 300 paid), got %+v %v", walkout, err)
	}
	if b := w.bill(billID); b.Status != domain.BillWalkout || b.ClosedAt == nil {
		t.Fatalf("expected the bill closed as a walkout, got %+v", b)
	}
	if event, to := w.lastEvent(); event != "walkout:marked" || to.Roles[0] != domain.RoleManager {
		t.Fatalf("expected the managers alerted, got %s %+v", event, to)
	}
	if _, err := problems.MarkWalkout(ctx, w.hana, w.tenant.ID, billID); !errors.Is(err, domain.ErrBillState) {
		t.Fatalf("a bill walks out once, got %v", err)
	}

	pending, _ := problems.Pending(ctx, w.tenant.ID)
	if len(pending.Walkouts) != 1 {
		t.Fatalf("expected the walkout waiting for a decision, got %d", len(pending.Walkouts))
	}
	var validation *domain.ValidationError
	if _, err := problems.DecideWalkout(ctx, w.hana, w.tenant.ID, billID, "split", ""); !errors.As(err, &validation) {
		t.Fatalf("expected a validation error, got %v", err)
	}
	decided, err := problems.DecideWalkout(ctx, w.hana, w.tenant.ID, billID, domain.RestaurantLoss, " busy night ")
	if err != nil || *decided.Decision != domain.RestaurantLoss || decided.Note != "busy night" || decided.DecidedBy != "Hana" {
		t.Fatalf("unexpected decision %+v %v", decided, err)
	}
	if _, err := problems.DecideWalkout(ctx, w.hana, w.tenant.ID, billID, domain.WaiterPays, ""); !errors.Is(err, domain.ErrAlreadyDecided) {
		t.Fatalf("a walkout is decided once, got %v", err)
	}
}

func TestDB_DailyReportAndShifts(t *testing.T) {
	w := newBillWorld(t)
	ctx := context.Background()
	problems, problemRepo := w.problems()
	reports := usecase.NewReportUsecase(repository.NewReportRepository(w.q), problemRepo, w.repo)

	if _, err := w.uc.StartShift(ctx, w.abebe, w.tenant.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := w.uc.StartShift(ctx, w.liya, w.tenant.ID); err != nil {
		t.Fatal(err)
	}

	// Table 5: paid by cash and Telebirr, confirmed. Table 6 (Bereket after handover): a walkout.
	orderA, billA, _ := w.orderWithDishes("5", "s1", dish{"Tibs", 450, 1}, dish{"Shiro", 220, 1})
	if _, err := w.uc.Collect(ctx, w.abebe, w.tenant.ID, billA, domain.CollectInput{Amount: 400, Method: domain.PayCash}); err != nil {
		t.Fatal(err)
	}
	if _, err := w.uc.Collect(ctx, w.abebe, w.tenant.ID, billA, domain.CollectInput{Amount: 270, Method: domain.PayTelebirr, Reference: "TX"}); err != nil {
		t.Fatal(err)
	}
	if _, err := w.uc.Confirm(ctx, w.liya, w.tenant.ID, billA); err != nil {
		t.Fatal(err)
	}
	_, billB, itemsB := w.orderWithDishes("6", "s2", dish{"Buna", 60, 1})
	if _, err := problems.MarkWalkout(ctx, w.hana, w.tenant.ID, billB); err != nil {
		t.Fatal(err)
	}
	_ = itemsB
	// Table 5 orders again and is still eating at the end of the day
	w.orderWithDishes("5", "s1", dish{"Buna", 60, 1})

	// The first order cooked in 20 minutes against a 15 minute target
	if _, err := w.tx.Exec(ctx, `UPDATE orders SET started_at = NOW() - interval '30 minutes', ready_at = NOW() - interval '10 minutes' WHERE id = $1`, orderA); err != nil {
		t.Fatal(err)
	}

	report, err := reports.Daily(ctx, w.tenant.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	methods := map[domain.PaymentMethod]float64{}
	for _, m := range report.Sales {
		methods[m.Method] = m.Amount
	}
	if methods[domain.PayCash] != 400 || methods[domain.PayTelebirr] != 270 || report.SalesSum != 670 {
		t.Fatalf("unexpected sales %+v (total %v)", report.Sales, report.SalesSum)
	}
	var abebe *domain.WaiterTotals
	for i := range report.Waiters {
		if report.Waiters[i].WaiterName == "Abebe" {
			abebe = &report.Waiters[i]
		}
	}
	if abebe == nil || abebe.Bills != 2 || abebe.Collected != 670 || abebe.Confirmed != 670 || abebe.CollectedNotConfirmed != 0 {
		t.Fatalf("unexpected totals for Abebe %+v", abebe)
	}
	if len(report.Walkouts) != 1 || report.Walkouts[0].Amount != 60 {
		t.Fatalf("expected the 60 Birr walkout, got %+v", report.Walkouts)
	}
	kitchen := map[string]domain.DishTiming{}
	for _, k := range report.Kitchen {
		kitchen[k.ItemName] = k
	}
	if tibs := kitchen["Tibs"]; tibs.Orders != 1 || tibs.AvgMinutes < 19.9 || tibs.AvgMinutes > 20.1 || tibs.TargetMinutes != 15 || tibs.Late != 1 {
		t.Fatalf("expected Tibs cooked in 20 of 15 minutes, late once, got %+v", tibs)
	}
	if len(report.OpenBills) != 1 || report.OpenBills[0].TableNumber != "5" || report.OpenBills[0].TotalAmount != 60 {
		t.Fatalf("expected table 5's new bill still open, got %+v", report.OpenBills)
	}
	if _, err := reports.Daily(ctx, w.tenant.ID, "05/11/2026"); err == nil {
		t.Fatal("a badly written date must be refused")
	}
	if old, err := reports.Daily(ctx, w.tenant.ID, "2020-01-01"); err != nil || len(old.Sales) != 0 || old.Date != "2020-01-01" {
		t.Fatalf("an old day has nothing, got %+v %v", old, err)
	}

	mine, err := reports.MyShift(ctx, w.abebe, w.tenant.ID)
	if err != nil || mine.Collected != 670 || mine.Bills != 1 || mine.NotConfirmed != 0 {
		t.Fatalf("unexpected waiter shift %+v %v", mine, err)
	}
	cashier, err := reports.MyShift(ctx, w.liya, w.tenant.ID)
	if err != nil || cashier.Confirmed != 670 || cashier.Bills != 1 {
		t.Fatalf("unexpected cashier shift %+v %v", cashier, err)
	}
	if _, err := reports.MyShift(ctx, w.bereket, w.tenant.ID); !errors.Is(err, domain.ErrNoShiftYet) {
		t.Fatalf("no shift yet, got %v", err)
	}
}

func TestDB_PushSubscriptions(t *testing.T) {
	w := newBillWorld(t)
	ctx := context.Background()
	repo := repository.NewPushRepository(w.q)
	save := func(user uuid.UUID, endpoint string) {
		if err := repo.Save(ctx, w.tenant.ID, user, domain.PushSubscription{Endpoint: endpoint, P256dh: "k", Auth: "a"}); err != nil {
			t.Fatal(err)
		}
	}
	save(w.abebe.ID, "https://push.example/abebe")
	save(w.hana.ID, "https://push.example/hana")
	save(w.liya.ID, "https://push.example/liya")
	save(w.abebe.ID, "https://push.example/abebe") // the same browser again

	endpoints := func(to domain.Audience) []string {
		subs, err := repo.For(ctx, w.tenant.ID, to)
		if err != nil {
			t.Fatal(err)
		}
		var out []string
		for _, s := range subs {
			out = append(out, s.Endpoint)
		}
		return out
	}
	if got := endpoints(domain.Audience{UserIDs: []uuid.UUID{w.abebe.ID}}); len(got) != 1 || got[0] != "https://push.example/abebe" {
		t.Fatalf("expected Abebe's one browser, got %v", got)
	}
	if got := endpoints(domain.Audience{Roles: []domain.Role{domain.RoleCashier, domain.RoleManager}}); len(got) != 2 {
		t.Fatalf("expected the cashier's and manager's browsers, got %v", got)
	}

	// A turned-off account gets nothing; a deleted subscription is gone
	if _, err := w.tx.Exec(ctx, `UPDATE users SET is_active = FALSE WHERE id = $1`, w.liya.ID); err != nil {
		t.Fatal(err)
	}
	if got := endpoints(domain.Audience{Roles: []domain.Role{domain.RoleCashier}}); len(got) != 0 {
		t.Fatalf("a turned-off cashier must get no pushes, got %v", got)
	}
	if err := repo.Delete(ctx, "https://push.example/hana"); err != nil {
		t.Fatal(err)
	}
	if got := endpoints(domain.Audience{Roles: []domain.Role{domain.RoleManager}}); len(got) != 0 {
		t.Fatalf("expected Hana's subscription removed, got %v", got)
	}
}
