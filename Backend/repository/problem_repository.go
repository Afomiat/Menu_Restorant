package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
)

type problemRepository struct {
	db txStarter
	q  *sqlc.Queries
}

func NewProblemRepository(db txStarter, q *sqlc.Queries) domain.ProblemRepository {
	return &problemRepository{db: db, q: q}
}

func (r *problemRepository) ItemForProblem(ctx context.Context, tenantID, orderID, itemID uuid.UUID) (*domain.ProblemItem, error) {
	row, err := r.q.GetOrderItemForProblem(ctx, sqlc.GetOrderItemForProblemParams{
		ID:       converter.UUIDToPg(itemID),
		OrderID:  converter.UUIDToPg(orderID),
		TenantID: converter.UUIDToPg(tenantID),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrItemNotFound
	}
	if err != nil {
		return nil, err
	}
	return &domain.ProblemItem{
		ItemID:      converter.PgToUUID(row.ID),
		OrderID:     converter.PgToUUID(row.OrderID),
		ItemName:    row.ItemName,
		TableNumber: row.TableNumber,
		BillID:      converter.PgToUUIDPtr(row.BillID),
		Removed:     row.RemovedAt.Valid,
	}, nil
}

func (r *problemRepository) Create(ctx context.Context, tenantID uuid.UUID, item *domain.ProblemItem, reason domain.ProblemReason, note string, actorID uuid.UUID) (uuid.UUID, error) {
	id, err := r.q.CreateProblem(ctx, sqlc.CreateProblemParams{
		TenantID:    converter.UUIDToPg(tenantID),
		OrderID:     converter.UUIDToPg(item.OrderID),
		OrderItemID: converter.UUIDToPg(item.ItemID),
		Reason:      sqlc.ProblemReason(reason),
		Note:        note,
		ReportedBy:  converter.UUIDToPg(actorID),
	})
	return converter.PgToUUID(id), err
}

func (r *problemRepository) List(ctx context.Context, tenantID uuid.UUID, f domain.ProblemFilter) ([]domain.Problem, error) {
	until := f.Until
	if until.IsZero() {
		until = time.Now().Add(24 * time.Hour)
	}
	rows, err := r.q.ListProblems(ctx, sqlc.ListProblemsParams{
		TenantID:  converter.UUIDToPg(tenantID),
		ProblemID: converter.UUIDPtrToPg(f.ProblemID),
		OpenOnly:  f.OpenOnly,
		Since:     converter.TimeToPg(f.Since),
		Until:     converter.TimeToPg(until),
	})
	if err != nil {
		return nil, err
	}
	problems := make([]domain.Problem, len(rows))
	for i, row := range rows {
		p := domain.Problem{
			ID:            converter.PgToUUID(row.ID),
			OrderID:       converter.PgToUUID(row.OrderID),
			OrderItemID:   converter.PgToUUID(row.OrderItemID),
			ItemName:      row.ItemName,
			Quantity:      int(row.Quantity),
			TableNumber:   row.TableNumber,
			Reason:        domain.ProblemReason(row.Reason),
			Note:          row.Note,
			ReportedAt:    converter.PgToTime(row.ReportedAt),
			ReportedBy:    row.ReportedByName,
			ReadyBy:       row.ReadyByName,
			ServedBy:      row.ServedByName,
			StartedAt:     converter.PgToTimePtr(row.StartedAt),
			ReadyAt:       converter.PgToTimePtr(row.ReadyAt),
			ServedAt:      converter.PgToTimePtr(row.ServedAt),
			DecidedBy:     row.DecidedByName,
			DecidedAt:     converter.PgToTimePtr(row.DecidedAt),
			RemakeOrderID: converter.PgToUUIDPtr(row.RemakeOrderID),
		}
		if row.Decision.Valid {
			d := domain.ProblemDecision(row.Decision.ProblemDecision)
			p.Decision = &d
		}
		if row.Fault.Valid {
			fault := domain.Fault(row.Fault.Fault)
			p.Fault = &fault
		}
		if row.RemovedAmount.Valid {
			v := converter.NumericToFloat(row.RemovedAmount)
			p.RemovedAmount = &v
		}
		problems[i] = p
	}
	return problems, nil
}

func (r *problemRepository) Decide(ctx context.Context, tenantID, problemID uuid.UUID, decision domain.ProblemDecision, fault domain.Fault, actorID uuid.UUID, removed *float64, remakeOrderID *uuid.UUID) error {
	params := sqlc.DecideProblemParams{
		ID:            converter.UUIDToPg(problemID),
		TenantID:      converter.UUIDToPg(tenantID),
		Decision:      sqlc.NullProblemDecision{ProblemDecision: sqlc.ProblemDecision(decision), Valid: true},
		Fault:         sqlc.NullFault{Fault: sqlc.Fault(fault), Valid: true},
		DecidedBy:     converter.UUIDToPg(actorID),
		RemakeOrderID: converter.UUIDPtrToPg(remakeOrderID),
	}
	if removed != nil {
		params.RemovedAmount = converter.FloatToNumeric(*removed)
	}
	return r.q.DecideProblem(ctx, params)
}

func (r *problemRepository) RemoveItem(ctx context.Context, orderID, itemID uuid.UUID) (float64, error) {
	var value float64
	err := r.inTx(ctx, func(q *sqlc.Queries) error {
		v, err := q.ItemValue(ctx, converter.UUIDToPg(itemID))
		if err != nil {
			return err
		}
		n, err := q.MarkItemRemoved(ctx, converter.UUIDToPg(itemID))
		if err != nil {
			return err
		}
		if n == 0 {
			return domain.ErrAlreadyDecided
		}
		value = converter.NumericToFloat(v)
		return q.ReduceOrderTotal(ctx, sqlc.ReduceOrderTotalParams{Amount: v, ID: converter.UUIDToPg(orderID)})
	})
	return value, err
}

func (r *problemRepository) CreateRemake(ctx context.Context, tenantID, orderID, itemID uuid.UUID) (uuid.UUID, error) {
	var remake pgtype.UUID
	err := r.inTx(ctx, func(q *sqlc.Queries) error {
		var err error
		remake, err = q.CreateRemakeOrder(ctx, sqlc.CreateRemakeOrderParams{ID: converter.UUIDToPg(orderID), TenantID: converter.UUIDToPg(tenantID)})
		if err != nil {
			return err
		}
		return q.CopyItemToRemake(ctx, sqlc.CopyItemToRemakeParams{RemakeOrderID: remake, OrderItemID: converter.UUIDToPg(itemID)})
	})
	return converter.PgToUUID(remake), err
}

func (r *problemRepository) MarkWalkout(ctx context.Context, tenantID, billID uuid.UUID, amount float64, actorID uuid.UUID) error {
	return r.q.MarkWalkout(ctx, sqlc.MarkWalkoutParams{
		ID:              converter.UUIDToPg(billID),
		TenantID:        converter.UUIDToPg(tenantID),
		WalkoutMarkedBy: converter.UUIDToPg(actorID),
		WalkoutAmount:   converter.FloatToNumeric(amount),
	})
}

func (r *problemRepository) DecideWalkout(ctx context.Context, tenantID, billID uuid.UUID, decision domain.WalkoutDecision, note string, actorID uuid.UUID) error {
	return r.q.DecideWalkout(ctx, sqlc.DecideWalkoutParams{
		ID:               converter.UUIDToPg(billID),
		TenantID:         converter.UUIDToPg(tenantID),
		WalkoutDecision:  sqlc.NullWalkoutDecision{WalkoutDecision: sqlc.WalkoutDecision(decision), Valid: true},
		WalkoutDecidedBy: converter.UUIDToPg(actorID),
		WalkoutNote:      note,
	})
}

func (r *problemRepository) ListWalkouts(ctx context.Context, tenantID uuid.UUID, openOnly bool, since, until time.Time) ([]domain.Walkout, error) {
	rows, err := r.q.ListWalkouts(ctx, sqlc.ListWalkoutsParams{
		TenantID: converter.UUIDToPg(tenantID),
		OpenOnly: openOnly,
		Since:    converter.TimeToPg(since),
		Until:    converter.TimeToPg(until),
	})
	if err != nil {
		return nil, err
	}
	walkouts := make([]domain.Walkout, len(rows))
	for i, row := range rows {
		w := domain.Walkout{
			BillID:      converter.PgToUUID(row.ID),
			TableNumber: row.TableNumber,
			Amount:      converter.NumericToFloat(row.WalkoutAmount),
			WaiterID:    converter.PgToUUIDPtr(row.WaiterID),
			WaiterName:  row.WaiterName,
			MarkedBy:    row.MarkedByName,
			At:          converter.PgToTime(row.WalkoutAt),
			Note:        row.WalkoutNote,
			DecidedBy:   row.DecidedByName,
			DecidedAt:   converter.PgToTimePtr(row.WalkoutDecidedAt),
		}
		if row.WalkoutDecision.Valid {
			d := domain.WalkoutDecision(row.WalkoutDecision.WalkoutDecision)
			w.Decision = &d
		}
		walkouts[i] = w
	}
	return walkouts, nil
}

func (r *problemRepository) inTx(ctx context.Context, fn func(q *sqlc.Queries) error) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := fn(r.q.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type pushRepository struct {
	q *sqlc.Queries
}

func NewPushRepository(q *sqlc.Queries) domain.PushRepository {
	return &pushRepository{q: q}
}

func (r *pushRepository) Save(ctx context.Context, tenantID, userID uuid.UUID, sub domain.PushSubscription) error {
	return r.q.UpsertPushSubscription(ctx, sqlc.UpsertPushSubscriptionParams{
		TenantID: converter.UUIDToPg(tenantID),
		UserID:   converter.UUIDToPg(userID),
		Endpoint: sub.Endpoint,
		P256dh:   sub.P256dh,
		Auth:     sub.Auth,
	})
}

func (r *pushRepository) For(ctx context.Context, tenantID uuid.UUID, to domain.Audience) ([]domain.PushSubscription, error) {
	ids := make([]pgtype.UUID, len(to.UserIDs))
	for i, id := range to.UserIDs {
		ids[i] = converter.UUIDToPg(id)
	}
	roles := make([]string, len(to.Roles))
	for i, role := range to.Roles {
		roles[i] = string(role)
	}
	rows, err := r.q.ListPushSubscriptions(ctx, sqlc.ListPushSubscriptionsParams{TenantID: converter.UUIDToPg(tenantID), UserIds: ids, Roles: roles})
	if err != nil {
		return nil, err
	}
	subs := make([]domain.PushSubscription, len(rows))
	for i, row := range rows {
		subs[i] = domain.PushSubscription{Endpoint: row.Endpoint, P256dh: row.P256dh, Auth: row.Auth}
	}
	return subs, nil
}

func (r *pushRepository) Delete(ctx context.Context, endpoint string) error {
	return r.q.DeletePushSubscription(ctx, endpoint)
}
