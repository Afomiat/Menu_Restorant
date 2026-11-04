package test

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/repository"
)

// dbTx opens a transaction on the database in TEST_DATABASE_URL (make test-db) that is rolled
// back after the test, so tests leave no data behind. Tests are skipped without a database.
func dbTx(t *testing.T) pgx.Tx {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL (make test-db) to run database tests")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = tx.Rollback(ctx) })
	return tx
}

// expectErr runs fn in a savepoint, so a failing statement does not end the test's transaction
func expectErr(t *testing.T, tx pgx.Tx, fn func(q *sqlc.Queries) error) error {
	t.Helper()
	ctx := context.Background()
	sp, err := tx.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = sp.Rollback(ctx) }()
	return fn(sqlc.New(sp))
}

func newDBTenant(t *testing.T, q *sqlc.Queries, slug string) uuid.UUID {
	t.Helper()
	tenant, err := q.CreateTenant(context.Background(), sqlc.CreateTenantParams{
		Slug: slug, Name: slug, Plan: sqlc.PlanTierPro, Currency: "ETB", ThemeConfig: []byte("{}"),
	})
	if err != nil {
		t.Fatal(err)
	}
	return uuid.UUID(tenant.ID.Bytes)
}

func TestDB_StaffRepository(t *testing.T) {
	tx := dbTx(t)
	ctx := context.Background()
	q := sqlc.New(tx)
	repo := repository.NewStaffRepository(q)
	tenantA := newDBTenant(t, q, "test-staff-a-"+uuid.NewString()[:8])
	tenantB := newDBTenant(t, q, "test-staff-b-"+uuid.NewString()[:8])

	manager, err := repo.Create(ctx, tenantA, domain.NewStaffInput{
		FullName: "Hana", Phone: "+251911000001", Email: "hana-" + uuid.NewString()[:8] + "@test.et", Role: domain.RoleManager,
	}, "hash")
	if err != nil {
		t.Fatal(err)
	}
	waiter, err := repo.Create(ctx, tenantA, domain.NewStaffInput{FullName: "Abebe", Phone: "+251911000002", Role: domain.RoleWaiter}, "hash")
	if err != nil {
		t.Fatal(err)
	}
	if waiter.Email != "" || !waiter.IsActive || waiter.Role != domain.RoleWaiter {
		t.Fatalf("unexpected waiter %+v", waiter)
	}

	byPhone, err := repo.GetByTenantPhone(ctx, tenantA, "+251911000001")
	if err != nil || byPhone.ID != manager.ID || byPhone.PasswordHash != "hash" {
		t.Fatalf("GetByTenantPhone: %+v %v", byPhone, err)
	}
	if byEmail, err := repo.GetByEmail(ctx, manager.Email); err != nil || byEmail.ID != manager.ID {
		t.Fatalf("GetByEmail: %+v %v", byEmail, err)
	}
	if _, err := repo.GetByTenantPhone(ctx, tenantB, "+251911000001"); !errors.Is(err, domain.ErrStaffNotFound) {
		t.Fatalf("a phone must only be found at its own restaurant, got %v", err)
	}
	if _, err := repo.GetByID(ctx, tenantB, manager.ID); !errors.Is(err, domain.ErrStaffNotFound) {
		t.Fatalf("staff of another restaurant must not be found, got %v", err)
	}

	err = expectErr(t, tx, func(q *sqlc.Queries) error {
		_, err := repository.NewStaffRepository(q).Create(ctx, tenantA, domain.NewStaffInput{FullName: "Copy", Phone: "+251911000002", Role: domain.RoleChef}, "hash")
		return err
	})
	if !errors.Is(err, domain.ErrPhoneTaken) {
		t.Fatalf("expected ErrPhoneTaken, got %v", err)
	}
	err = expectErr(t, tx, func(q *sqlc.Queries) error {
		_, err := repository.NewStaffRepository(q).Create(ctx, tenantB, domain.NewStaffInput{FullName: "Copy", Phone: "+251911000009", Email: manager.Email, Role: domain.RoleChef}, "hash")
		return err
	})
	if !errors.Is(err, domain.ErrEmailTaken) {
		t.Fatalf("expected ErrEmailTaken, got %v", err)
	}
	err = expectErr(t, tx, func(q *sqlc.Queries) error {
		_, err := repository.NewStaffRepository(q).Create(ctx, tenantB, domain.NewStaffInput{FullName: "Nobody", Role: domain.RoleChef}, "hash")
		return err
	})
	if err == nil {
		t.Fatal("an account without phone and email must be refused")
	}
	if _, err := repo.Create(ctx, tenantB, domain.NewStaffInput{FullName: "Same phone", Phone: "+251911000002", Role: domain.RoleChef}, "hash"); err != nil {
		t.Fatalf("the same phone is allowed at another restaurant, got %v", err)
	}

	name, role, off, hash := "Abebe K.", domain.RoleCashier, false, "new-hash"
	updated, err := repo.Update(ctx, tenantA, waiter.ID, domain.StaffChanges{FullName: &name, Role: &role, IsActive: &off, PasswordHash: &hash})
	if err != nil || updated.FullName != name || updated.Role != domain.RoleCashier || updated.IsActive {
		t.Fatalf("Update: %+v %v", updated, err)
	}
	if creds, _ := repo.GetByTenantPhone(ctx, tenantA, "+251911000002"); creds.PasswordHash != "new-hash" {
		t.Fatal("expected the new password hash")
	}
	unchanged, err := repo.Update(ctx, tenantA, manager.ID, domain.StaffChanges{})
	if err != nil || unchanged.FullName != "Hana" || unchanged.Role != domain.RoleManager {
		t.Fatalf("an empty change must keep every field, got %+v %v", unchanged, err)
	}
	if _, err := repo.Update(ctx, tenantB, waiter.ID, domain.StaffChanges{FullName: &name}); !errors.Is(err, domain.ErrStaffNotFound) {
		t.Fatalf("staff of another restaurant must not be changed, got %v", err)
	}

	if active, err := repo.IsActive(ctx, waiter.ID); err != nil || active {
		t.Fatalf("expected the waiter to be off, got %v %v", active, err)
	}
	if _, err := repo.IsActive(ctx, uuid.New()); !errors.Is(err, domain.ErrStaffNotFound) {
		t.Fatalf("expected ErrStaffNotFound, got %v", err)
	}
	if n, err := repo.CountActiveManagers(ctx, tenantA); err != nil || n != 1 {
		t.Fatalf("expected 1 active manager, got %d %v", n, err)
	}

	list, err := repo.List(ctx, tenantA)
	if err != nil || len(list) != 2 || list[0].ID != manager.ID {
		t.Fatalf("expected active staff first, got %+v %v", list, err)
	}
}

func TestDB_ActivityRepository(t *testing.T) {
	tx := dbTx(t)
	ctx := context.Background()
	q := sqlc.New(tx)
	tenantID := newDBTenant(t, q, "test-activity-"+uuid.NewString()[:8])
	staff, err := repository.NewStaffRepository(q).Create(ctx, tenantID, domain.NewStaffInput{FullName: "Hana", Phone: "+251911000001", Role: domain.RoleManager}, "hash")
	if err != nil {
		t.Fatal(err)
	}
	repo := repository.NewActivityRepository(q)

	if err := repo.Record(ctx, domain.Activity{TenantID: tenantID, Action: domain.ActionPlanChanged}); err != nil {
		t.Fatalf("an entry without a person or details must be accepted, got %v", err)
	}
	if err := repo.Record(ctx, domain.Activity{
		TenantID: tenantID, ActorID: staff.ID, Action: domain.ActionStaffCreated,
		Details: map[string]interface{}{"role": "waiter"},
	}); err != nil {
		t.Fatal(err)
	}

	list, err := repo.List(ctx, tenantID, 10)
	if err != nil || len(list) != 2 {
		t.Fatalf("expected 2 entries, got %d %v", len(list), err)
	}
	actors := map[string]uuid.UUID{list[0].Action: list[0].ActorID, list[1].Action: list[1].ActorID}
	if actors[domain.ActionStaffCreated] != staff.ID || actors[domain.ActionPlanChanged] != uuid.Nil {
		t.Fatalf("unexpected actors %v", actors)
	}
	for _, a := range list {
		if a.Action == domain.ActionStaffCreated && a.Details["role"] != "waiter" {
			t.Fatalf("expected details to round-trip, got %v", a.Details)
		}
	}
	if limited, _ := repo.List(ctx, tenantID, 1); len(limited) != 1 {
		t.Fatalf("expected the limit to apply, got %d", len(limited))
	}
}
