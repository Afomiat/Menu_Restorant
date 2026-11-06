package domain

import "github.com/google/uuid"

// Audience is who on a restaurant's staff screens should get an event: everyone with one of
// the roles, plus the listed people
type Audience struct {
	Roles   []Role
	UserIDs []uuid.UUID
}

// Notifier sends live events to staff screens (the WebSocket hub)
type Notifier interface {
	NotifyStaff(tenantID uuid.UUID, to Audience, event string, data interface{})
}

// WaiterOrManagers is the audience for a table's waiter alerts: the waiter, or the managers
// when no waiter looks after the table
func WaiterOrManagers(waiterID *uuid.UUID) Audience {
	if waiterID != nil && *waiterID != uuid.Nil {
		return Audience{UserIDs: []uuid.UUID{*waiterID}}
	}
	return Audience{Roles: []Role{RoleManager}}
}
