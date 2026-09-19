package repository

import (
	"context"

	"github.com/google/uuid"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
)

type tableRepository struct {
	q *sqlc.Queries
}

func NewTableRepository(q *sqlc.Queries) domain.TableRepository {
	return &tableRepository{q: q}
}

func (r *tableRepository) GetByNumber(ctx context.Context, tenantID uuid.UUID, tableNumber string) (*domain.RestaurantTable, error) {
	t, err := r.q.GetTableByNumber(ctx, sqlc.GetTableByNumberParams{
		TenantID:    converter.UUIDToPg(tenantID),
		TableNumber: tableNumber,
	})
	if err != nil {
		return nil, err
	}
	return &domain.RestaurantTable{
		ID:          converter.PgToUUID(t.ID),
		TenantID:    converter.PgToUUID(t.TenantID),
		TableNumber: t.TableNumber,
		QrSecret:    t.QrSecret,
		IsActive:    t.IsActive,
	}, nil
}

func (r *tableRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]domain.RestaurantTable, error) {
	rows, err := r.q.ListTablesByTenant(ctx, converter.UUIDToPg(tenantID))
	if err != nil {
		return nil, err
	}
	tables := make([]domain.RestaurantTable, len(rows))
	for i, t := range rows {
		tables[i] = domain.RestaurantTable{
			ID:          converter.PgToUUID(t.ID),
			TenantID:    converter.PgToUUID(t.TenantID),
			TableNumber: t.TableNumber,
			QrSecret:    t.QrSecret,
			IsActive:    t.IsActive,
		}
	}
	return tables, nil
}

func (r *tableRepository) Create(ctx context.Context, table *domain.RestaurantTable) error {
	t, err := r.q.CreateTable(ctx, sqlc.CreateTableParams{
		TenantID:    converter.UUIDToPg(table.TenantID),
		TableNumber: table.TableNumber,
		QrSecret:    table.QrSecret,
		IsActive:    table.IsActive,
	})
	if err != nil {
		return err
	}
	table.ID = converter.PgToUUID(t.ID)
	return nil
}

func (r *tableRepository) UpdateQRSecret(ctx context.Context, id, tenantID uuid.UUID, qrSecret string) error {
	_, err := r.q.UpdateTableQRSecret(ctx, sqlc.UpdateTableQRSecretParams{
		ID:       converter.UUIDToPg(id),
		TenantID: converter.UUIDToPg(tenantID),
		QrSecret: qrSecret,
	})
	return err
}
