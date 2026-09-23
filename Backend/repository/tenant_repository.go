package repository

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
)

type tenantRepository struct {
	q *sqlc.Queries
}

func NewTenantRepository(q *sqlc.Queries) domain.TenantRepository {
	return &tenantRepository{q: q}
}

func (r *tenantRepository) GetBySlug(ctx context.Context, slug string) (*domain.Tenant, error) {
	t, err := r.q.GetTenantBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	return toDomainTenant(t), nil
}

func (r *tenantRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	t, err := r.q.GetTenantByID(ctx, converter.UUIDToPg(id))
	if err != nil {
		return nil, err
	}
	return toDomainTenant(t), nil
}

func (r *tenantRepository) Create(ctx context.Context, tenant *domain.Tenant) error {
	themeBytes, _ := json.Marshal(tenant.ThemeConfig)
	t, err := r.q.CreateTenant(ctx, sqlc.CreateTenantParams{
		Slug:        tenant.Slug,
		Name:        tenant.Name,
		Plan:        sqlc.PlanTier(tenant.Plan),
		Currency:    tenant.Currency,
		ThemeConfig: themeBytes,
	})
	if err != nil {
		return err
	}
	tenant.ID = converter.PgToUUID(t.ID)
	tenant.CreatedAt = converter.PgToTime(t.CreatedAt)
	tenant.UpdatedAt = converter.PgToTime(t.UpdatedAt)
	tenant.IsActive = t.IsActive
	return nil
}

func (r *tenantRepository) UpdatePlan(ctx context.Context, id uuid.UUID, plan domain.PlanTier) error {
	_, err := r.q.UpdateTenantPlan(ctx, sqlc.UpdateTenantPlanParams{
		ID:   converter.UUIDToPg(id),
		Plan: sqlc.PlanTier(plan),
	})
	return err
}

func (r *tenantRepository) UpdateTheme(ctx context.Context, id uuid.UUID, themeConfig map[string]interface{}) (*domain.Tenant, error) {
	themeBytes, err := json.Marshal(themeConfig)
	if err != nil {
		return nil, err
	}
	t, err := r.q.UpdateTenantTheme(ctx, sqlc.UpdateTenantThemeParams{
		ID:          converter.UUIDToPg(id),
		ThemeConfig: themeBytes,
	})
	if err != nil {
		return nil, err
	}
	return toDomainTenant(t), nil
}

func (r *tenantRepository) ListActive(ctx context.Context) ([]domain.Tenant, error) {
	rows, err := r.q.ListActiveTenants(ctx)
	if err != nil {
		return nil, err
	}
	tenants := make([]domain.Tenant, len(rows))
	for i, t := range rows {
		tenants[i] = *toDomainTenant(t)
	}
	return tenants, nil
}

func toDomainTenant(t sqlc.Tenant) *domain.Tenant {
	var themeConfig map[string]interface{}
	if len(t.ThemeConfig) > 0 {
		_ = json.Unmarshal(t.ThemeConfig, &themeConfig)
	}

	return &domain.Tenant{
		ID:          converter.PgToUUID(t.ID),
		Slug:        t.Slug,
		Name:        t.Name,
		Plan:        domain.PlanTier(t.Plan),
		Currency:    t.Currency,
		ThemeConfig: themeConfig,
		IsActive:    t.IsActive,
		CreatedAt:   converter.PgToTime(t.CreatedAt),
		UpdatedAt:   converter.PgToTime(t.UpdatedAt),
	}
}
