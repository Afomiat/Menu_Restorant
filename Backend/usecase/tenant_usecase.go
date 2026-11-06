package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"menu-backend/domain"
)

type tenantUsecase struct {
	tenantRepo   domain.TenantRepository
	activityRepo domain.ActivityRepository
}

func NewTenantUsecase(tenantRepo domain.TenantRepository, activityRepo domain.ActivityRepository) domain.TenantUsecase {
	return &tenantUsecase{
		tenantRepo:   tenantRepo,
		activityRepo: activityRepo,
	}
}

func (u *tenantUsecase) GetTenantBySlug(ctx context.Context, slug string) (*domain.Tenant, error) {
	return u.tenantRepo.GetBySlug(ctx, slug)
}

func (u *tenantUsecase) GetTenantByID(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	return u.tenantRepo.GetByID(ctx, id)
}

func (u *tenantUsecase) UpdatePlan(ctx context.Context, actorID, id uuid.UUID, plan domain.PlanTier) error {
	if !plan.IsValid() {
		return domain.ErrInvalidPlan
	}
	tenant, err := u.tenantRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if err := u.tenantRepo.UpdatePlan(ctx, id, plan); err != nil {
		return err
	}

	recordActivity(ctx, u.activityRepo, domain.Activity{
		TenantID: id,
		ActorID:  actorID,
		Action:   domain.ActionPlanChanged,
		Details:  map[string]interface{}{"from": tenant.Plan, "to": plan},
	})
	return nil
}

func (u *tenantUsecase) UpdateTheme(ctx context.Context, id uuid.UUID, themeConfig map[string]interface{}) (*domain.Tenant, error) {
	return u.tenantRepo.UpdateTheme(ctx, id, themeConfig)
}

func (u *tenantUsecase) VerifyPlanAccess(ctx context.Context, tenantID uuid.UUID, min domain.PlanTier) (bool, error) {
	tenant, err := u.tenantRepo.GetByID(ctx, tenantID)
	if err != nil {
		return false, err
	}
	return tenant.HasPlan(min), nil
}

func (u *tenantUsecase) UpdateSettings(ctx context.Context, actorID, tenantID uuid.UUID, changes domain.TenantSettingsChanges) (*domain.TenantSettings, error) {
	tenant, err := u.tenantRepo.GetByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	settings := tenant.Settings.WithDefaults()
	changed := map[string]interface{}{}
	apply := func(name string, value *int, max int, target *int) error {
		if value == nil || *value == *target {
			return nil
		}
		if *value < 1 || *value > max {
			return &domain.ValidationError{Message: fmt.Sprintf("%s must be between 1 and %d minutes", name, max)}
		}
		changed[name] = map[string]int{"from": *target, "to": *value}
		*target = *value
		return nil
	}
	for _, s := range []struct {
		name   string
		value  *int
		max    int
		target *int
	}{
		{"default_prep_minutes", changes.DefaultPrepMinutes, 240, &settings.DefaultPrepMinutes},
		{"bill_reminder_minutes", changes.BillReminderMinutes, 600, &settings.BillReminderMinutes},
		{"bill_escalation_minutes", changes.BillEscalationMinutes, 600, &settings.BillEscalationMinutes},
		{"confirm_reminder_minutes", changes.ConfirmReminderMinutes, 600, &settings.ConfirmReminderMinutes},
		{"long_table_minutes", changes.LongTableMinutes, 600, &settings.LongTableMinutes},
	} {
		if err := apply(s.name, s.value, s.max, s.target); err != nil {
			return nil, err
		}
	}
	if settings.BillEscalationMinutes < settings.BillReminderMinutes {
		return nil, &domain.ValidationError{Message: "the manager alert for an unpaid bill must come after the waiter reminder"}
	}
	if len(changed) == 0 {
		return &settings, nil
	}

	updated, err := u.tenantRepo.UpdateSettings(ctx, tenantID, settings)
	if err != nil {
		return nil, err
	}
	recordActivity(ctx, u.activityRepo, domain.Activity{
		TenantID: tenantID,
		ActorID:  actorID,
		Action:   domain.ActionSettingsChanged,
		Details:  changed,
	})
	return &updated.Settings, nil
}

func (u *tenantUsecase) ListActive(ctx context.Context) ([]domain.Tenant, error) {
	return u.tenantRepo.ListActive(ctx)
}
