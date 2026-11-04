package usecase

import (
	"context"

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

func (u *tenantUsecase) ListActive(ctx context.Context) ([]domain.Tenant, error) {
	return u.tenantRepo.ListActive(ctx)
}
