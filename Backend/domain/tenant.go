package domain

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

type PlanTier string

const (
	PlanBasic PlanTier = "basic"
	PlanPlus  PlanTier = "plus"
	PlanPro   PlanTier = "pro"
)

var ErrInvalidPlan = errors.New("invalid plan; allowed values are 'basic', 'plus' or 'pro'")

// Plan describes a plan tier for plan pickers such as the admin dashboard
type Plan struct {
	Value       PlanTier `json:"value"`
	Label       string   `json:"label"`
	Description string   `json:"description"`
}

// Plans lists every plan from lowest to highest; each plan includes everything below it
var Plans = []Plan{
	{Value: PlanBasic, Label: "Basic", Description: "Digital menu reached by QR code"},
	{Value: PlanPlus, Label: "Plus", Description: "Basic + QR table ordering and kitchen screen"},
	{Value: PlanPro, Label: "Pro", Description: "Plus + staff roles, cooking timers, bills, payments and reports"},
}

func (p PlanTier) rank() int {
	for i, plan := range Plans {
		if plan.Value == p {
			return i
		}
	}
	return -1
}

func (p PlanTier) IsValid() bool {
	return p.rank() >= 0
}

// AtLeast reports whether p includes the features of min
func (p PlanTier) AtLeast(min PlanTier) bool {
	return p.IsValid() && p.rank() >= min.rank()
}

func (p PlanTier) Label() string {
	if r := p.rank(); r >= 0 {
		return Plans[r].Label
	}
	return string(p)
}

type Tenant struct {
	ID          uuid.UUID              `json:"id"`
	Slug        string                 `json:"slug"`
	Name        string                 `json:"name"`
	Plan        PlanTier               `json:"plan"`
	Currency    string                 `json:"currency"`
	ThemeConfig map[string]interface{} `json:"theme_config"`
	IsActive    bool                   `json:"is_active"`
	Settings    TenantSettings         `json:"settings"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// TenantSettings are a restaurant's Pro timings, all in minutes
type TenantSettings struct {
	// DefaultPrepMinutes is the cooking time of dishes without their own prep time
	DefaultPrepMinutes int `json:"default_prep_minutes"`
	// BillReminderMinutes after the customer asks for the bill, the waiter is reminded
	BillReminderMinutes int `json:"bill_reminder_minutes"`
	// BillEscalationMinutes after the customer asks for the bill, the manager is alerted
	BillEscalationMinutes int `json:"bill_escalation_minutes"`
	// ConfirmReminderMinutes after the waiter collects, the cashier is reminded to confirm
	ConfirmReminderMinutes int `json:"confirm_reminder_minutes"`
	// LongTableMinutes after a table opens, its waiter is reminded the table is still open
	LongTableMinutes int `json:"long_table_minutes"`
}

// DefaultTenantSettings are used for any setting a restaurant has not changed
var DefaultTenantSettings = TenantSettings{
	DefaultPrepMinutes:     15,
	BillReminderMinutes:    10,
	BillEscalationMinutes:  20,
	ConfirmReminderMinutes: 15,
	LongTableMinutes:       120,
}

// WithDefaults fills settings that are not set (zero) with the defaults
func (s TenantSettings) WithDefaults() TenantSettings {
	d := DefaultTenantSettings
	if s.DefaultPrepMinutes > 0 {
		d.DefaultPrepMinutes = s.DefaultPrepMinutes
	}
	if s.BillReminderMinutes > 0 {
		d.BillReminderMinutes = s.BillReminderMinutes
	}
	if s.BillEscalationMinutes > 0 {
		d.BillEscalationMinutes = s.BillEscalationMinutes
	}
	if s.ConfirmReminderMinutes > 0 {
		d.ConfirmReminderMinutes = s.ConfirmReminderMinutes
	}
	if s.LongTableMinutes > 0 {
		d.LongTableMinutes = s.LongTableMinutes
	}
	return d
}

// TenantSettingsChanges changes only the settings that are set
type TenantSettingsChanges struct {
	DefaultPrepMinutes     *int `json:"default_prep_minutes"`
	BillReminderMinutes    *int `json:"bill_reminder_minutes"`
	BillEscalationMinutes  *int `json:"bill_escalation_minutes"`
	ConfirmReminderMinutes *int `json:"confirm_reminder_minutes"`
	LongTableMinutes       *int `json:"long_table_minutes"`
}

// HasPlan reports whether the tenant's plan includes the features of min
func (t *Tenant) HasPlan(min PlanTier) bool {
	return t.Plan.AtLeast(min)
}

// TenantRepository defines the contract for tenant database operations
type TenantRepository interface {
	GetBySlug(ctx context.Context, slug string) (*Tenant, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Tenant, error)
	Create(ctx context.Context, tenant *Tenant) error
	UpdatePlan(ctx context.Context, id uuid.UUID, plan PlanTier) error
	UpdateTheme(ctx context.Context, id uuid.UUID, themeConfig map[string]interface{}) (*Tenant, error)
	UpdateSettings(ctx context.Context, id uuid.UUID, settings TenantSettings) (*Tenant, error)
	ListActive(ctx context.Context) ([]Tenant, error)
}

// TenantUsecase defines the business logic contract for tenants
type TenantUsecase interface {
	GetTenantBySlug(ctx context.Context, slug string) (*Tenant, error)
	GetTenantByID(ctx context.Context, id uuid.UUID) (*Tenant, error)
	// UpdatePlan changes a restaurant's plan and records who changed it
	UpdatePlan(ctx context.Context, actorID, id uuid.UUID, plan PlanTier) error
	UpdateTheme(ctx context.Context, id uuid.UUID, themeConfig map[string]interface{}) (*Tenant, error)
	VerifyPlanAccess(ctx context.Context, tenantID uuid.UUID, min PlanTier) (bool, error)
	// UpdateSettings changes a restaurant's Pro timings and records who changed them
	UpdateSettings(ctx context.Context, actorID, tenantID uuid.UUID, changes TenantSettingsChanges) (*TenantSettings, error)
	ListActive(ctx context.Context) ([]Tenant, error)
}
