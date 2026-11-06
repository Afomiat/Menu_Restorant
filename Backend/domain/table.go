package domain

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// RestaurantTable represents a physical dining table in a restaurant
type RestaurantTable struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	TableNumber string    `json:"table_number"`
	QrSecret    string    `json:"-"`
	IsActive    bool      `json:"is_active"`
	// AssignedWaiterID is the waiter who looks after the table; nil sends its alerts to managers
	AssignedWaiterID   *uuid.UUID `json:"assigned_waiter_id"`
	AssignedWaiterName string     `json:"assigned_waiter_name"`
}

type CreateTableInput struct {
	TenantID    uuid.UUID `json:"tenant_id"`
	TableNumber string    `json:"table_number"`
}

// TableRepository defines the persistence interface for dining tables
type TableRepository interface {
	GetByNumber(ctx context.Context, tenantID uuid.UUID, tableNumber string) (*RestaurantTable, error)
	ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]RestaurantTable, error)
	Create(ctx context.Context, table *RestaurantTable) error
	UpdateQRSecret(ctx context.Context, id, tenantID uuid.UUID, qrSecret string) error
	UpdateWaiter(ctx context.Context, tenantID, tableID uuid.UUID, waiterID *uuid.UUID) (*RestaurantTable, error)
}

// TableUsecase defines the business logic for table validation and tamper-proof QR codes
type TableUsecase interface {
	GenerateTableQR(ctx context.Context, tenantSlug string, tenantID uuid.UUID, tableNumber string) (string, error)
	ValidateTableToken(ctx context.Context, tenantID uuid.UUID, tableNumber, token string) (bool, error)
	ListTables(ctx context.Context, tenantID uuid.UUID) ([]RestaurantTable, error)
	CreateTable(ctx context.Context, input CreateTableInput) (*RestaurantTable, error)
	// AssignWaiter gives a table to an active waiter of the restaurant, or to nobody (nil)
	AssignWaiter(ctx context.Context, actorID, tenantID, tableID uuid.UUID, waiterID *uuid.UUID) (*RestaurantTable, error)
}

var (
	ErrTableNotFound = errors.New("table not found")
	ErrNotAWaiter    = errors.New("choose an active waiter of this restaurant")
)
