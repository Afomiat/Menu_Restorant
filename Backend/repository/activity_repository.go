package repository

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
)

type activityRepository struct {
	q *sqlc.Queries
}

func NewActivityRepository(q *sqlc.Queries) domain.ActivityRepository {
	return &activityRepository{q: q}
}

func (r *activityRepository) Record(ctx context.Context, a domain.Activity) error {
	details := a.Details
	if details == nil {
		details = map[string]interface{}{}
	}
	detailsJSON, err := json.Marshal(details)
	if err != nil {
		return err
	}

	params := sqlc.RecordActivityParams{
		TenantID: converter.UUIDToPg(a.TenantID),
		ActorID:  converter.UUIDToPg(a.ActorID),
		Action:   a.Action,
		Details:  detailsJSON,
	}
	params.BillID = converter.UUIDPtrToPg(a.BillID)
	if a.OrderID != nil {
		params.OrderID = converter.UUIDToPg(*a.OrderID)
	}
	return r.q.RecordActivity(ctx, params)
}

func (r *activityRepository) List(ctx context.Context, tenantID uuid.UUID, limit int) ([]domain.Activity, error) {
	rows, err := r.q.ListActivity(ctx, sqlc.ListActivityParams{
		TenantID: converter.UUIDToPg(tenantID),
		Limit:    int32(limit),
	})
	if err != nil {
		return nil, err
	}

	activities := make([]domain.Activity, 0, len(rows))
	for _, row := range rows {
		a := domain.Activity{
			ID:        converter.PgToUUID(row.ID),
			TenantID:  converter.PgToUUID(row.TenantID),
			ActorID:   converter.PgToUUID(row.ActorID),
			Action:    row.Action,
			CreatedAt: converter.PgToTime(row.CreatedAt),
		}
		if row.OrderID.Valid {
			id := converter.PgToUUID(row.OrderID)
			a.OrderID = &id
		}
		_ = json.Unmarshal(row.Details, &a.Details)
		activities = append(activities, a)
	}
	return activities, nil
}
