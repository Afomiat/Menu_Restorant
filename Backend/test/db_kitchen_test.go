package test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
	"menu-backend/repository"
)

func newDBOrder(t *testing.T, q *sqlc.Queries, tenantID uuid.UUID, target int) uuid.UUID {
	t.Helper()
	o, err := q.CreateOrder(context.Background(), sqlc.CreateOrderParams{
		TenantID:             converter.UUIDToPg(tenantID),
		TableNumber:          "5",
		CustomerSessionToken: "session",
		Status:               sqlc.OrderStatusNotStarted,
		PaymentStatus:        sqlc.PaymentStatusUnpaid,
		TotalAmount:          converter.FloatToNumeric(450),
		GracePeriodEndsAt:    converter.TimeToPg(time.Now()),
		TargetMinutes:        pgtype.Int4{Int32: int32(target), Valid: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	return converter.PgToUUID(o.ID)
}

func TestDB_OrderStepsRecordWhoAndWhen(t *testing.T) {
	tx := dbTx(t)
	ctx := context.Background()
	q := sqlc.New(tx)
	tenantID := newDBTenant(t, q, "test-steps-"+uuid.NewString()[:8])
	staff := repository.NewStaffRepository(q)
	chef, _ := staff.Create(ctx, tenantID, domain.NewStaffInput{FullName: "Chef", Phone: "+251911000001", Role: domain.RoleChef}, "h")
	waiter, _ := staff.Create(ctx, tenantID, domain.NewStaffInput{FullName: "Waiter", Phone: "+251911000002", Role: domain.RoleWaiter}, "h")
	orders := repository.NewOrderRepository(nil, q)
	orderID := newDBOrder(t, q, tenantID, 15)

	step := func(status domain.OrderStatus, actor uuid.UUID) *domain.Order {
		t.Helper()
		if _, err := orders.UpdateStatus(ctx, tenantID, orderID, status, actor); err != nil {
			t.Fatal(err)
		}
		o, err := orders.GetByID(ctx, tenantID, orderID)
		if err != nil {
			t.Fatal(err)
		}
		return o
	}

	o := step(domain.StatusPreparing, chef.ID)
	if o.StartedAt == nil || *o.StartedBy != chef.ID || o.ReadyAt != nil || o.TargetMinutes != 15 {
		t.Fatalf("expected started by the chef, got %+v", o)
	}
	started := *o.StartedAt

	// Saving the same status again keeps the original time
	if o := step(domain.StatusPreparing, waiter.ID); !o.StartedAt.Equal(started) || *o.StartedBy != chef.ID {
		t.Fatalf("a repeated start must keep the first start, got %+v", o)
	}

	o = step(domain.StatusReady, chef.ID)
	if o.ReadyAt == nil || *o.ReadyBy != chef.ID || !o.StartedAt.Equal(started) {
		t.Fatalf("expected ready by the chef with the start kept, got %+v", o)
	}

	o = step(domain.StatusDelivered, waiter.ID)
	if o.ServedAt == nil || *o.ServedBy != waiter.ID || o.ReadyAt == nil {
		t.Fatalf("expected served by the waiter, got %+v", o)
	}

	// Undo back to cooking clears ready and served, keeps the start
	o = step(domain.StatusPreparing, chef.ID)
	if o.ReadyAt != nil || o.ReadyBy != nil || o.ServedAt != nil || o.ServedBy != nil || o.StartedAt == nil {
		t.Fatalf("undo to cooking must clear the later steps, got %+v", o)
	}
	// Undo to not started clears everything
	o = step(domain.StatusNotStarted, chef.ID)
	if o.StartedAt != nil || o.StartedBy != nil {
		t.Fatalf("undo to new must clear the start, got %+v", o)
	}

	if _, err := orders.UpdateStatus(ctx, uuid.New(), orderID, domain.StatusReady, chef.ID); err == nil {
		t.Fatal("another restaurant must not move the order")
	}
}

func TestDB_VeryLateOrders(t *testing.T) {
	tx := dbTx(t)
	ctx := context.Background()
	q := sqlc.New(tx)
	pro := newDBTenant(t, q, "test-late-pro-"+uuid.NewString()[:8])
	plusTenant, err := q.CreateTenant(ctx, sqlc.CreateTenantParams{Slug: "test-late-plus-" + uuid.NewString()[:8], Name: "plus", Plan: sqlc.PlanTierPlus, Currency: "ETB", ThemeConfig: []byte("{}")})
	if err != nil {
		t.Fatal(err)
	}
	plus := converter.PgToUUID(plusTenant.ID)
	orders := repository.NewOrderRepository(nil, q)

	late := newDBOrder(t, q, pro, 15)
	fresh := newDBOrder(t, q, pro, 15)
	plusLate := newDBOrder(t, q, plus, 15)
	for _, id := range []uuid.UUID{late, fresh, plusLate} {
		if _, err := orders.UpdateStatus(ctx, uuid.Nil, id, domain.StatusPreparing, uuid.Nil); err == nil {
			t.Fatal("tenant scoping should refuse a missing restaurant")
		}
	}
	for id, tenant := range map[uuid.UUID]uuid.UUID{late: pro, fresh: pro, plusLate: plus} {
		if _, err := orders.UpdateStatus(ctx, tenant, id, domain.StatusPreparing, uuid.Nil); err != nil {
			t.Fatal(err)
		}
	}
	// Started 31 minutes ago for the late ones, 5 minutes ago for the fresh one
	if _, err := tx.Exec(ctx, `UPDATE orders SET started_at = NOW() - interval '31 minutes' WHERE id = ANY($1)`, []uuid.UUID{late, plusLate}); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `UPDATE orders SET started_at = NOW() - interval '5 minutes' WHERE id = $1`, fresh); err != nil {
		t.Fatal(err)
	}

	ours := func() []uuid.UUID {
		list, err := orders.ListVeryLate(ctx, time.Now())
		if err != nil {
			t.Fatal(err)
		}
		var ids []uuid.UUID
		for _, o := range list {
			if o.ID == late || o.ID == fresh || o.ID == plusLate {
				ids = append(ids, o.ID)
			}
		}
		return ids
	}

	if ids := ours(); len(ids) != 1 || ids[0] != late {
		t.Fatalf("expected only the Pro order past twice its target, got %v", ids)
	}
	if err := orders.MarkVeryLateAlerted(ctx, late); err != nil {
		t.Fatal(err)
	}
	if ids := ours(); len(ids) != 0 {
		t.Fatalf("an alerted order must not be listed again, got %v", ids)
	}
}

func TestDB_SettingsPrepTimesAndWaiters(t *testing.T) {
	tx := dbTx(t)
	ctx := context.Background()
	q := sqlc.New(tx)
	tenantID := newDBTenant(t, q, "test-settings-"+uuid.NewString()[:8])

	tenants := repository.NewTenantRepository(q)
	if tenant, err := tenants.GetByID(ctx, tenantID); err != nil || tenant.Settings != domain.DefaultTenantSettings {
		t.Fatalf("a new restaurant must have the default settings, got %+v %v", tenant.Settings, err)
	}
	custom := domain.DefaultTenantSettings
	custom.DefaultPrepMinutes = 20
	if _, err := tenants.UpdateSettings(ctx, tenantID, custom); err != nil {
		t.Fatal(err)
	}
	if tenant, _ := tenants.GetByID(ctx, tenantID); tenant.Settings != custom {
		t.Fatalf("expected the saved settings, got %+v", tenant.Settings)
	}

	menu := repository.NewMenuRepository(q)
	cat := &domain.Category{TenantID: tenantID, Name: "Mains", IsActive: true}
	if err := menu.CreateCategory(ctx, cat); err != nil {
		t.Fatal(err)
	}
	tibs := &domain.MenuItem{TenantID: tenantID, CategoryID: cat.ID, Name: "Tibs", Price: 450, IsAvailable: true, PrepMinutes: intPtr(25)}
	buna := &domain.MenuItem{TenantID: tenantID, CategoryID: cat.ID, Name: "Buna", Price: 60, IsAvailable: true}
	for _, it := range []*domain.MenuItem{tibs, buna} {
		if err := menu.CreateItem(ctx, it); err != nil {
			t.Fatal(err)
		}
	}
	if got, _ := menu.GetItemByID(ctx, tenantID, tibs.ID); got.PrepMinutes == nil || *got.PrepMinutes != 25 {
		t.Fatalf("expected prep 25, got %v", got.PrepMinutes)
	}
	if got, _ := menu.GetItemByID(ctx, tenantID, buna.ID); got.PrepMinutes != nil {
		t.Fatalf("expected no prep time, got %v", *got.PrepMinutes)
	}

	staff := repository.NewStaffRepository(q)
	abebe, _ := staff.Create(ctx, tenantID, domain.NewStaffInput{FullName: "Abebe", Phone: "+251911000002", Role: domain.RoleWaiter}, "h")
	tables := repository.NewTableRepository(q)
	table := &domain.RestaurantTable{TenantID: tenantID, TableNumber: "5", QrSecret: "s", IsActive: true}
	if err := tables.Create(ctx, table); err != nil {
		t.Fatal(err)
	}
	if _, err := tables.UpdateWaiter(ctx, tenantID, table.ID, &abebe.ID); err != nil {
		t.Fatal(err)
	}
	list, _ := tables.ListByTenant(ctx, tenantID)
	if len(list) != 1 || *list[0].AssignedWaiterID != abebe.ID || list[0].AssignedWaiterName != "Abebe" {
		t.Fatalf("expected Abebe on table 5, got %+v", list)
	}
	if byNumber, _ := tables.GetByNumber(ctx, tenantID, "5"); byNumber.AssignedWaiterID == nil || *byNumber.AssignedWaiterID != abebe.ID {
		t.Fatalf("expected the waiter when looking up by number, got %+v", byNumber)
	}
	if _, err := tables.UpdateWaiter(ctx, uuid.New(), table.ID, nil); err != domain.ErrTableNotFound {
		t.Fatalf("another restaurant's table must not be found, got %v", err)
	}
}
