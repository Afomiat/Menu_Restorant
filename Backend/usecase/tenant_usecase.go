package usecase

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"menu-backend/domain"
)

type tenantUsecase struct {
	tenantRepo domain.TenantRepository
}

func NewTenantUsecase(tenantRepo domain.TenantRepository) domain.TenantUsecase {
	return &tenantUsecase{
		tenantRepo: tenantRepo,
	}
}

func (u *tenantUsecase) GetTenantBySlug(ctx context.Context, slug string) (*domain.Tenant, error) {
	return u.tenantRepo.GetBySlug(ctx, slug)
}

func (u *tenantUsecase) GetTenantByID(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	return u.tenantRepo.GetByID(ctx, id)
}

func (u *tenantUsecase) UpdatePlan(ctx context.Context, id uuid.UUID, plan domain.PlanTier) error {
	if plan != domain.PlanStandard && plan != domain.PlanVIP {
		return errors.New("invalid plan tier; allowed: standard, vip")
	}
	return u.tenantRepo.UpdatePlan(ctx, id, plan)
}

func (u *tenantUsecase) UpdateTheme(ctx context.Context, id uuid.UUID, themeConfig map[string]interface{}) (*domain.Tenant, error) {
	return u.tenantRepo.UpdateTheme(ctx, id, themeConfig)
}

func (u *tenantUsecase) VerifyVIPAccess(ctx context.Context, tenantID uuid.UUID) (bool, error) {
	tenant, err := u.tenantRepo.GetByID(ctx, tenantID)
	if err != nil {
		return false, err
	}
	return tenant.HasVIPFeatures(), nil
}

func (u *tenantUsecase) ListActive(ctx context.Context) ([]domain.Tenant, error) {
	return u.tenantRepo.ListActive(ctx)
}
