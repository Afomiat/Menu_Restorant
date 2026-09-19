package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type PlanTier string

const (
	PlanStandard   PlanTier = "standard"
	PlanVIP        PlanTier = "vip"
)

type Tenant struct {
	ID          uuid.UUID              `json:"id"`
	Slug        string                 `json:"slug"`
	Name        string                 `json:"name"`
	Plan        PlanTier               `json:"plan"`
	Currency    string                 `json:"currency"`
	ThemeConfig map[string]interface{} `json:"theme_config"`
	IsActive    bool                   `json:"is_active"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// Helper: Checks if tenant has VIP features (ordering, KDS, live inventory)
func (t *Tenant) HasVIPFeatures() bool {
	return t.Plan == PlanVIP
}

// TenantRepository defines the contract for tenant database operations
type TenantRepository interface {
	GetBySlug(ctx context.Context, slug string) (*Tenant, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Tenant, error)
	Create(ctx context.Context, tenant *Tenant) error
	UpdatePlan(ctx context.Context, id uuid.UUID, plan PlanTier) error
	UpdateTheme(ctx context.Context, id uuid.UUID, themeConfig map[string]interface{}) (*Tenant, error)
}

// TenantUsecase defines the business logic contract for tenants
type TenantUsecase interface {
	GetTenantBySlug(ctx context.Context, slug string) (*Tenant, error)
	GetTenantByID(ctx context.Context, id uuid.UUID) (*Tenant, error)
	UpdatePlan(ctx context.Context, id uuid.UUID, plan PlanTier) error
	UpdateTheme(ctx context.Context, id uuid.UUID, themeConfig map[string]interface{}) (*Tenant, error)
	VerifyVIPAccess(ctx context.Context, tenantID uuid.UUID) (bool, error)
}
