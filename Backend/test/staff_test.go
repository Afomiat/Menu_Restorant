package test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/internal/phone"
	"menu-backend/internal/security"
	"menu-backend/usecase"
)

// slugTenantRepo finds restaurants by slug, for logins that name a restaurant
type slugTenantRepo struct {
	mockTenantRepo
	bySlug map[string]*domain.Tenant
}

func (r *slugTenantRepo) GetBySlug(ctx context.Context, slug string) (*domain.Tenant, error) {
	if t, ok := r.bySlug[slug]; ok {
		return t, nil
	}
	return nil, errors.New("not found")
}

type staffEnv struct {
	uc       domain.StaffUsecase
	repo     *memStaffRepo
	activity *mockActivityRepo
	tenant   *domain.Tenant
	other    *domain.Tenant
	manager  domain.Staff
}

func newStaffEnv() *staffEnv {
	tenant := &domain.Tenant{ID: uuid.New(), Slug: "demo-pro", Plan: domain.PlanPro}
	other := &domain.Tenant{ID: uuid.New(), Slug: "other", Plan: domain.PlanPro}
	repo := newMemStaffRepo()
	activity := &mockActivityRepo{}
	tenants := &slugTenantRepo{bySlug: map[string]*domain.Tenant{"demo-pro": tenant, "other": other}}
	return &staffEnv{
		uc:       usecase.NewStaffUsecase(repo, tenants, activity),
		repo:     repo,
		activity: activity,
		tenant:   tenant,
		other:    other,
		manager:  repo.add(tenant.ID, "Hana Manager", "+251911000001", "hana@demo.et", "secret123", domain.RoleManager),
	}
}

func TestPhone_Normalize(t *testing.T) {
	valid := map[string]string{
		"0911234567":       "+251911234567",
		"0711234567":       "+251711234567",
		"911234567":        "+251911234567",
		"251911234567":     "+251911234567",
		"+251911234567":    "+251911234567",
		"+251 91 123 4567": "+251911234567",
		"0911-234-567":     "+251911234567",
		" (0911) 234567 ":  "+251911234567",
	}
	for raw, want := range valid {
		got, err := phone.Normalize(raw)
		if err != nil || got != want {
			t.Errorf("Normalize(%q) = %q, %v; want %q", raw, got, err, want)
		}
	}
	for _, raw := range []string{"", "0111234567", "091123456", "09112345678", "+1 911 234 567", "09112345ab", "abc"} {
		if _, err := phone.Normalize(raw); !errors.Is(err, phone.ErrInvalid) {
			t.Errorf("Normalize(%q) should be rejected, got %v", raw, err)
		}
	}
}

func TestRole_NormalizeAndLabels(t *testing.T) {
	cases := map[string]domain.Role{
		"owner": domain.RoleManager, "kitchen": domain.RoleChef, "manager": domain.RoleManager,
		"cashier": domain.RoleCashier, "waiter": domain.RoleWaiter, "chef": domain.RoleChef, "super_admin": domain.RoleSuperAdmin,
	}
	for raw, want := range cases {
		if got := domain.NormalizeRole(raw); got != want {
			t.Errorf("NormalizeRole(%q) = %q, want %q", raw, got, want)
		}
	}
	for _, role := range domain.StaffRoles {
		if !role.IsStaffRole() {
			t.Errorf("%q should be a staff role", role)
		}
	}
	if domain.RoleSuperAdmin.IsStaffRole() || domain.Role("owner").IsStaffRole() {
		t.Error("super_admin and old role names must not be given to staff")
	}
	if domain.RoleChef.Label() != "Chef" || domain.RoleCashier.Label() != "Cashier" {
		t.Error("unexpected role labels")
	}
}

func TestStaffLogin_PhoneAtRestaurant(t *testing.T) {
	env := newStaffEnv()
	ctx := context.Background()

	for _, typed := range []string{"0911000001", "+251 911 000 001", "911000001"} {
		staff, err := env.uc.Login(ctx, domain.LoginInput{Phone: typed, RestaurantSlug: "demo-pro", Password: "secret123"})
		if err != nil || staff.ID != env.manager.ID {
			t.Errorf("phone %q: expected Hana to sign in, got %v %v", typed, staff, err)
		}
	}

	// Same phone at another restaurant, wrong password, unknown phone, no restaurant
	for name, input := range map[string]domain.LoginInput{
		"other restaurant": {Phone: "0911000001", RestaurantSlug: "other", Password: "secret123"},
		"unknown slug":     {Phone: "0911000001", RestaurantSlug: "nope", Password: "secret123"},
		"wrong password":   {Phone: "0911000001", RestaurantSlug: "demo-pro", Password: "wrong"},
		"unknown phone":    {Phone: "0911999999", RestaurantSlug: "demo-pro", Password: "secret123"},
		"no restaurant":    {Phone: "0911000001", Password: "secret123"},
		"bad phone":        {Phone: "12", RestaurantSlug: "demo-pro", Password: "secret123"},
		"nothing":          {Password: "secret123"},
	} {
		if _, err := env.uc.Login(ctx, input); !errors.Is(err, domain.ErrInvalidLogin) {
			t.Errorf("%s: expected ErrInvalidLogin, got %v", name, err)
		}
	}
}

func TestStaffLogin_EmailAndTurnedOffAccounts(t *testing.T) {
	env := newStaffEnv()
	ctx := context.Background()

	if staff, err := env.uc.Login(ctx, domain.LoginInput{Email: "hana@demo.et", Password: "secret123"}); err != nil || staff.ID != env.manager.ID {
		t.Fatalf("expected email login, got %v %v", staff, err)
	}

	waiter := env.repo.add(env.tenant.ID, "Abebe", "+251911000002", "", "secret123", domain.RoleWaiter)
	off := false
	if _, err := env.uc.Update(ctx, env.manager.ID, env.tenant.ID, waiter.ID, domain.UpdateStaffInput{IsActive: &off}); err != nil {
		t.Fatal(err)
	}
	_, err := env.uc.Login(ctx, domain.LoginInput{Phone: "0911000002", RestaurantSlug: "demo-pro", Password: "secret123"})
	if !errors.Is(err, domain.ErrStaffInactive) {
		t.Fatalf("expected a turned-off account to be refused, got %v", err)
	}
	// The wrong password still says wrong password, so it does not reveal the account is off
	_, err = env.uc.Login(ctx, domain.LoginInput{Phone: "0911000002", RestaurantSlug: "demo-pro", Password: "nope"})
	if !errors.Is(err, domain.ErrInvalidLogin) {
		t.Fatalf("expected ErrInvalidLogin for a wrong password, got %v", err)
	}
}

func TestStaffCreate_ValidatesAndRecords(t *testing.T) {
	env := newStaffEnv()
	ctx := context.Background()

	staff, err := env.uc.Create(ctx, env.manager.ID, env.tenant.ID, domain.NewStaffInput{
		FullName: "  Abebe Kebede ", Phone: "0911 234 567", Password: "pass123", Role: domain.RoleWaiter,
	})
	if err != nil {
		t.Fatal(err)
	}
	if staff.FullName != "Abebe Kebede" || staff.Phone != "+251911234567" || staff.Role != domain.RoleWaiter || !staff.IsActive {
		t.Fatalf("unexpected staff %+v", staff)
	}
	hash := env.repo.passwordHash(staff.ID)
	if hash == "pass123" || !security.CheckPassword("pass123", hash) {
		t.Fatal("password must be stored hashed")
	}
	if got := env.activity.actions(); len(got) != 1 || got[0] != domain.ActionStaffCreated || env.activity.records[0].ActorID != env.manager.ID {
		t.Fatalf("expected staff.created by the manager, got %v", env.activity.records)
	}

	// The new waiter can sign in with the phone written another way
	if _, err := env.uc.Login(ctx, domain.LoginInput{Phone: "+251911234567", RestaurantSlug: "demo-pro", Password: "pass123"}); err != nil {
		t.Fatalf("new staff should sign in, got %v", err)
	}

	bad := map[string]domain.NewStaffInput{
		"no name":        {FullName: " ", Phone: "0911000009", Password: "pass123", Role: domain.RoleChef},
		"long name":      {FullName: strings.Repeat("a", 101), Phone: "0911000009", Password: "pass123", Role: domain.RoleChef},
		"super admin":    {FullName: "X", Phone: "0911000009", Password: "pass123", Role: domain.RoleSuperAdmin},
		"old role name":  {FullName: "X", Phone: "0911000009", Password: "pass123", Role: "kitchen"},
		"bad phone":      {FullName: "X", Phone: "123", Password: "pass123", Role: domain.RoleChef},
		"short password": {FullName: "X", Phone: "0911000009", Password: "12345", Role: domain.RoleChef},
		"bad email":      {FullName: "X", Phone: "0911000009", Email: "not-an-email", Password: "pass123", Role: domain.RoleChef},
	}
	for name, input := range bad {
		var validation *domain.ValidationError
		if _, err := env.uc.Create(ctx, env.manager.ID, env.tenant.ID, input); !errors.As(err, &validation) {
			t.Errorf("%s: expected a validation error, got %v", name, err)
		}
	}

	_, err = env.uc.Create(ctx, env.manager.ID, env.tenant.ID, domain.NewStaffInput{
		FullName: "Copy", Phone: "0911234567", Password: "pass123", Role: domain.RoleChef,
	})
	if !errors.Is(err, domain.ErrPhoneTaken) {
		t.Fatalf("expected ErrPhoneTaken, got %v", err)
	}
	// The same phone is fine at another restaurant
	if _, err := env.uc.Create(ctx, env.manager.ID, env.other.ID, domain.NewStaffInput{
		FullName: "Other", Phone: "0911234567", Password: "pass123", Role: domain.RoleChef,
	}); err != nil {
		t.Fatalf("a phone may be used once per restaurant, got %v", err)
	}
	if n := len(env.activity.records); n != 2 {
		t.Fatalf("only successful creations are recorded, got %d entries", n)
	}
}

func TestStaffUpdate_ChangesAndRecords(t *testing.T) {
	env := newStaffEnv()
	ctx := context.Background()
	chef := env.repo.add(env.tenant.ID, "Tsion", "+251911000003", "", "secret123", domain.RoleChef)

	name, role, password := "Tsion Alemu", domain.RoleWaiter, "newpass1"
	updated, err := env.uc.Update(ctx, env.manager.ID, env.tenant.ID, chef.ID, domain.UpdateStaffInput{FullName: &name, Role: &role, Password: &password})
	if err != nil {
		t.Fatal(err)
	}
	if updated.FullName != name || updated.Role != domain.RoleWaiter {
		t.Fatalf("unexpected staff %+v", updated)
	}
	if !security.CheckPassword("newpass1", env.repo.passwordHash(chef.ID)) {
		t.Fatal("expected the new password to work")
	}

	entry := env.activity.records[0]
	if entry.Action != domain.ActionStaffUpdated || entry.ActorID != env.manager.ID {
		t.Fatalf("unexpected entry %+v", entry)
	}
	if r, ok := entry.Details["role"].(map[string]domain.Role); !ok || r["from"] != domain.RoleChef || r["to"] != domain.RoleWaiter {
		t.Fatalf("expected the role change from chef to waiter, got %v", entry.Details["role"])
	}
	if entry.Details["password"] != "reset" {
		t.Fatalf("expected a password reset note, got %v", entry.Details["password"])
	}
	for _, v := range entry.Details {
		if s, ok := v.(string); ok && strings.Contains(s, "newpass1") {
			t.Fatal("the activity log must never contain a password")
		}
	}

	// Sending the current values changes nothing and records nothing
	same := domain.RoleWaiter
	if _, err := env.uc.Update(ctx, env.manager.ID, env.tenant.ID, chef.ID, domain.UpdateStaffInput{Role: &same}); err != nil {
		t.Fatal(err)
	}
	if len(env.activity.records) != 1 {
		t.Fatalf("a change with nothing new must not be recorded, got %d entries", len(env.activity.records))
	}

	bad := domain.RoleSuperAdmin
	var validation *domain.ValidationError
	if _, err := env.uc.Update(ctx, env.manager.ID, env.tenant.ID, chef.ID, domain.UpdateStaffInput{Role: &bad}); !errors.As(err, &validation) {
		t.Fatalf("expected a validation error for super_admin, got %v", err)
	}
	if _, err := env.uc.Update(ctx, env.manager.ID, env.other.ID, chef.ID, domain.UpdateStaffInput{FullName: &name}); !errors.Is(err, domain.ErrStaffNotFound) {
		t.Fatalf("another restaurant's staff must not be found, got %v", err)
	}
}

func TestStaffUpdate_SafetyRules(t *testing.T) {
	env := newStaffEnv()
	ctx := context.Background()
	off := false
	waiter := domain.RoleWaiter

	// A manager cannot demote or turn off themselves, but can rename themselves
	if _, err := env.uc.Update(ctx, env.manager.ID, env.tenant.ID, env.manager.ID, domain.UpdateStaffInput{Role: &waiter}); !errors.Is(err, domain.ErrChangeOwnStaff) {
		t.Fatalf("expected ErrChangeOwnStaff for own role, got %v", err)
	}
	if _, err := env.uc.Update(ctx, env.manager.ID, env.tenant.ID, env.manager.ID, domain.UpdateStaffInput{IsActive: &off}); !errors.Is(err, domain.ErrChangeOwnStaff) {
		t.Fatalf("expected ErrChangeOwnStaff for own account, got %v", err)
	}
	newName := "Hana M."
	if _, err := env.uc.Update(ctx, env.manager.ID, env.tenant.ID, env.manager.ID, domain.UpdateStaffInput{FullName: &newName}); err != nil {
		t.Fatalf("a manager may rename themselves, got %v", err)
	}

	// The last active manager cannot be demoted or turned off by anyone
	superAdmin := uuid.New()
	if _, err := env.uc.Update(ctx, superAdmin, env.tenant.ID, env.manager.ID, domain.UpdateStaffInput{IsActive: &off}); !errors.Is(err, domain.ErrLastManager) {
		t.Fatalf("expected ErrLastManager, got %v", err)
	}

	// With a second manager, one of them can be demoted
	second := env.repo.add(env.tenant.ID, "Second", "+251911000004", "", "secret123", domain.RoleManager)
	if _, err := env.uc.Update(ctx, env.manager.ID, env.tenant.ID, second.ID, domain.UpdateStaffInput{Role: &waiter}); err != nil {
		t.Fatalf("expected the second manager to be demoted, got %v", err)
	}
}

func TestStaffIsActive_CachedAndClearedWhenTurnedOff(t *testing.T) {
	env := newStaffEnv()
	ctx := context.Background()
	chef := env.repo.add(env.tenant.ID, "Tsion", "+251911000003", "", "secret123", domain.RoleChef)

	for i := 0; i < 3; i++ {
		if active, err := env.uc.IsActive(ctx, chef.ID); err != nil || !active {
			t.Fatalf("expected active, got %v %v", active, err)
		}
	}
	if env.repo.activeReads != 1 {
		t.Fatalf("expected one database read for repeated checks, got %d", env.repo.activeReads)
	}

	off := false
	if _, err := env.uc.Update(ctx, env.manager.ID, env.tenant.ID, chef.ID, domain.UpdateStaffInput{IsActive: &off}); err != nil {
		t.Fatal(err)
	}
	if active, _ := env.uc.IsActive(ctx, chef.ID); active {
		t.Fatal("a turned-off account must be refused straight away")
	}

	if active, err := env.uc.IsActive(ctx, uuid.New()); err != nil || active {
		t.Fatalf("an unknown account is not active, got %v %v", active, err)
	}
}
