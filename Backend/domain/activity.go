package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Actions recorded in the activity log
const (
	ActionPlanChanged  = "plan.changed"
	ActionStaffCreated = "staff.created"
	ActionStaffUpdated = "staff.updated"

	ActionSettingsChanged = "settings.changed"
	ActionWaiterAssigned  = "table.waiter_assigned"
)

// Activity is one entry of a restaurant's who-did-what log
type Activity struct {
	ID       uuid.UUID `json:"id"`
	TenantID uuid.UUID `json:"tenant_id"`
	// ActorID is uuid.Nil when no person did it (for example a background check)
	ActorID   uuid.UUID              `json:"actor_id"`
	Action    string                 `json:"action"`
	OrderID   *uuid.UUID             `json:"order_id,omitempty"`
	Details   map[string]interface{} `json:"details"`
	CreatedAt time.Time              `json:"created_at"`
}

type ActivityRepository interface {
	Record(ctx context.Context, activity Activity) error
	List(ctx context.Context, tenantID uuid.UUID, limit int) ([]Activity, error)
}
