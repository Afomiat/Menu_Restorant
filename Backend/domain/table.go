package domain

import (
	"context"

	"github.com/google/uuid"
)

// RestaurantTable represents a physical dining table in a restaurant
type RestaurantTable struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	TableNumber string    `json:"table_number"`
	QrSecret    string    `json:"-"`
	IsActive    bool      `json:"is_active"`
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
}

// TableUsecase defines the business logic for table validation and tamper-proof QR codes
type TableUsecase interface {
	GenerateTableQR(ctx context.Context, tenantSlug string, tenantID uuid.UUID, tableNumber string) (string, error)
	ValidateTableToken(ctx context.Context, tenantID uuid.UUID, tableNumber, token string) (bool, error)
	ListTables(ctx context.Context, tenantID uuid.UUID) ([]RestaurantTable, error)
	CreateTable(ctx context.Context, input CreateTableInput) (*RestaurantTable, error)
}
