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

// txStarter is a database pool, or a transaction (where Begin opens a savepoint)
type txStarter interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

type billRepository struct {
	db txStarter
	q  *sqlc.Queries
}

func NewBillRepository(db txStarter, q *sqlc.Queries) domain.BillRepository {
	return &billRepository{db: db, q: q}
}

func (r *billRepository) ActiveBillForTable(ctx context.Context, tenantID uuid.UUID, table *domain.RestaurantTable) (uuid.UUID, error) {
	// Insert-if-missing, then read: two orders at once still end on the same bill
	if err := r.q.InsertActiveBill(ctx, sqlc.InsertActiveBillParams{
		TenantID:    converter.UUIDToPg(tenantID),
		TableID:     converter.UUIDToPg(table.ID),
		TableNumber: table.TableNumber,
		WaiterID:    converter.UUIDPtrToPg(table.AssignedWaiterID),
	}); err != nil {
		return uuid.Nil, err
	}
	id, err := r.q.GetActiveBillForTable(ctx, sqlc.GetActiveBillForTableParams{
		TenantID:    converter.UUIDToPg(tenantID),
		TableNumber: table.TableNumber,
	})
	if err != nil {
		return uuid.Nil, err
	}
	return converter.PgToUUID(id), nil
}

func (r *billRepository) AttachOrder(ctx context.Context, orderID, billID uuid.UUID) error {
	return r.q.SetOrderBill(ctx, sqlc.SetOrderBillParams{ID: converter.UUIDToPg(orderID), BillID: converter.UUIDToPg(billID)})
}

func (r *billRepository) List(ctx context.Context, tenantID uuid.UUID, filter domain.BillFilter) ([]domain.Bill, error) {
	rows, err := r.q.ListBills(ctx, sqlc.ListBillsParams{
		TenantID: converter.UUIDToPg(tenantID),
		WaiterID: converter.UUIDPtrToPg(filter.WaiterID),
		BillID:   converter.UUIDPtrToPg(filter.BillID),
		Since:    converter.TimeToPg(filter.Since),
	})
	if err != nil {
		return nil, err
	}

	bills := make([]domain.Bill, len(rows))
	ids := make([]pgtype.UUID, len(rows))
	index := make(map[uuid.UUID]int, len(rows))
	for i, row := range rows {
		total := converter.NumericToFloat(row.TotalAmount)
		paid := converter.NumericToFloat(row.AmountPaid)
		bills[i] = domain.Bill{
			ID:          converter.PgToUUID(row.ID),
			TenantID:    converter.PgToUUID(row.TenantID),
			TableID:     converter.PgToUUIDPtr(row.TableID),
			TableNumber: row.TableNumber,
			WaiterID:    converter.PgToUUIDPtr(row.WaiterID),
			WaiterName:  row.WaiterName,
			Status:      domain.BillStatus(row.Status),
			TotalAmount: total,
			AmountPaid:  paid,
			AmountOwed:  roundMoney(total - paid),
			RequestedAt: converter.PgToTimePtr(row.RequestedAt),
			CollectedBy: converter.PgToUUIDPtr(row.CollectedBy),
			CollectedAt: converter.PgToTimePtr(row.CollectedAt),
			ConfirmedBy: converter.PgToUUIDPtr(row.ConfirmedBy),
			ConfirmedAt: converter.PgToTimePtr(row.ConfirmedAt),
			CreatedAt:   converter.PgToTime(row.CreatedAt),
			ClosedAt:    converter.PgToTimePtr(row.ClosedAt),
			Payments:    []domain.BillPayment{},
		}
		ids[i] = row.ID
		index[bills[i].ID] = i
	}
	if len(ids) == 0 {
		return bills, nil
	}

	payments, err := r.q.ListBillPayments(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, p := range payments {
		i := index[converter.PgToUUID(p.BillID)]
		bills[i].Payments = append(bills[i].Payments, domain.BillPayment{
			ID:              converter.PgToUUID(p.ID),
			Amount:          converter.NumericToFloat(p.Amount),
			Method:          domain.PaymentMethod(p.Method),
			Reference:       p.Reference,
			CollectedBy:     converter.PgToUUIDPtr(p.CollectedBy),
			CollectedByName: p.CollectedByName,
			CollectedAt:     converter.PgToTime(p.CollectedAt),
		})
	}
	return bills, nil
}

func (r *billRepository) Get(ctx context.Context, tenantID, billID uuid.UUID) (*domain.Bill, error) {
	// Closed bills of any age, so a confirmed bill can still be read back
	bills, err := r.List(ctx, tenantID, domain.BillFilter{BillID: &billID, Since: time.Unix(0, 0)})
	if err != nil {
		return nil, err
	}
	if len(bills) == 0 {
		return nil, domain.ErrBillNotFound
	}
	return &bills[0], nil
}

func (r *billRepository) AddPayment(ctx context.Context, tenantID, billID uuid.UUID, input domain.CollectInput, actorID uuid.UUID) error {
	return r.q.AddBillPayment(ctx, sqlc.AddBillPaymentParams{
		BillID:      converter.UUIDToPg(billID),
		TenantID:    converter.UUIDToPg(tenantID),
		Amount:      converter.FloatToNumeric(input.Amount),
		Method:      sqlc.PaymentMethod(input.Method),
		Reference:   input.Reference,
		CollectedBy: converter.UUIDToPg(actorID),
	})
}

func (r *billRepository) SetStatus(ctx context.Context, tenantID, billID uuid.UUID, status domain.BillStatus, actorID uuid.UUID) error {
	return r.q.SetBillStatus(ctx, sqlc.SetBillStatusParams{
		Status:   sqlc.BillStatus(status),
		ActorID:  converter.UUIDToPg(actorID),
		ID:       converter.UUIDToPg(billID),
		TenantID: converter.UUIDToPg(tenantID),
	})
}

func (r *billRepository) SetWaiter(ctx context.Context, tenantID, billID uuid.UUID, waiterID *uuid.UUID) error {
	return r.q.SetBillWaiter(ctx, sqlc.SetBillWaiterParams{
		ID:       converter.UUIDToPg(billID),
		TenantID: converter.UUIDToPg(tenantID),
		WaiterID: converter.UUIDPtrToPg(waiterID),
	})
}

func (r *billRepository) MoveToTable(ctx context.Context, tenantID, billID uuid.UUID, table *domain.RestaurantTable) error {
	return r.inTx(ctx, func(q *sqlc.Queries) error {
		if err := q.MoveBillToTable(ctx, sqlc.MoveBillToTableParams{
			ID:          converter.UUIDToPg(billID),
			TenantID:    converter.UUIDToPg(tenantID),
			TableID:     converter.UUIDToPg(table.ID),
			TableNumber: table.TableNumber,
			WaiterID:    converter.UUIDPtrToPg(table.AssignedWaiterID),
		}); err != nil {
			return err
		}
		return q.MoveBillOrders(ctx, sqlc.MoveBillOrdersParams{
			ToBillID:    converter.UUIDToPg(billID),
			TableID:     converter.UUIDToPg(table.ID),
			TableNumber: table.TableNumber,
			FromBillID:  converter.UUIDToPg(billID),
			TenantID:    converter.UUIDToPg(tenantID),
		})
	})
}

func (r *billRepository) Merge(ctx context.Context, tenantID, fromBillID, toBillID uuid.UUID, table *domain.RestaurantTable) error {
	return r.inTx(ctx, func(q *sqlc.Queries) error {
		if err := q.MoveBillOrders(ctx, sqlc.MoveBillOrdersParams{
			ToBillID:    converter.UUIDToPg(toBillID),
			TableID:     converter.UUIDToPg(table.ID),
			TableNumber: table.TableNumber,
			FromBillID:  converter.UUIDToPg(fromBillID),
			TenantID:    converter.UUIDToPg(tenantID),
		}); err != nil {
			return err
		}
		if err := q.MoveBillPayments(ctx, sqlc.MoveBillPaymentsParams{
			ToBillID:   converter.UUIDToPg(toBillID),
			FromBillID: converter.UUIDToPg(fromBillID),
			TenantID:   converter.UUIDToPg(tenantID),
		}); err != nil {
			return err
		}
		return q.DeleteBill(ctx, sqlc.DeleteBillParams{ID: converter.UUIDToPg(fromBillID), TenantID: converter.UUIDToPg(tenantID)})
	})
}

func (r *billRepository) inTx(ctx context.Context, fn func(q *sqlc.Queries) error) error {
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

func (r *billRepository) CountWaiterUnpaid(ctx context.Context, tenantID, waiterID uuid.UUID) (int, error) {
	n, err := r.q.CountWaiterUnpaidBills(ctx, sqlc.CountWaiterUnpaidBillsParams{
		TenantID: converter.UUIDToPg(tenantID),
		WaiterID: converter.UUIDToPg(waiterID),
	})
	return int(n), err
}

func (r *billRepository) RequestedBillForTable(ctx context.Context, tenantID uuid.UUID, tableNumber string) (*domain.Bill, error) {
	row, err := r.q.GetRequestedBillForTable(ctx, sqlc.GetRequestedBillForTableParams{
		TenantID:    converter.UUIDToPg(tenantID),
		TableNumber: tableNumber,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &domain.Bill{ID: converter.PgToUUID(row.ID), TenantID: tenantID, TableNumber: tableNumber, WaiterID: converter.PgToUUIDPtr(row.WaiterID), Status: domain.BillRequested}, nil
}

func (r *billRepository) SessionOrderedOnBill(ctx context.Context, billID uuid.UUID, sessionToken string) (bool, error) {
	return r.q.BillSessionHasOrdered(ctx, sqlc.BillSessionHasOrderedParams{
		BillID:               converter.UUIDToPg(billID),
		CustomerSessionToken: sessionToken,
	})
}

func (r *billRepository) ListDue(ctx context.Context, now time.Time) ([]domain.BillDue, error) {
	rows, err := r.q.ListBillsDue(ctx, converter.TimeToPg(now))
	if err != nil {
		return nil, err
	}
	var due []domain.BillDue
	for _, row := range rows {
		d := domain.BillDue{
			ID:           converter.PgToUUID(row.ID),
			TenantID:     converter.PgToUUID(row.TenantID),
			TableNumber:  row.TableNumber,
			WaiterID:     converter.PgToUUIDPtr(row.WaiterID),
			RemindWaiter: row.RemindWaiter.Bool,
			Escalate:     row.Escalate.Bool,
			Unconfirmed:  row.Unconfirmed.Bool,
			LongOpen:     row.LongOpen.Bool,
		}
		if d.RemindWaiter || d.Escalate || d.Unconfirmed || d.LongOpen {
			due = append(due, d)
		}
	}
	return due, nil
}

func (r *billRepository) MarkReminded(ctx context.Context, d domain.BillDue) error {
	return r.q.MarkBillReminded(ctx, sqlc.MarkBillRemindedParams{
		RemindWaiter: d.RemindWaiter,
		Escalate:     d.Escalate,
		Unconfirmed:  d.Unconfirmed,
		LongOpen:     d.LongOpen,
		ID:           converter.UUIDToPg(d.ID),
	})
}

func (r *billRepository) OpenShift(ctx context.Context, userID uuid.UUID) (*domain.Shift, error) {
	s, err := r.q.GetOpenShift(ctx, converter.UUIDToPg(userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return toShift(s), nil
}

func (r *billRepository) StartShift(ctx context.Context, tenantID, userID uuid.UUID) (*domain.Shift, error) {
	s, err := r.q.StartShift(ctx, sqlc.StartShiftParams{TenantID: converter.UUIDToPg(tenantID), UserID: converter.UUIDToPg(userID)})
	if err != nil {
		return nil, err
	}
	return toShift(s), nil
}

func (r *billRepository) EndShift(ctx context.Context, userID uuid.UUID) (*domain.Shift, error) {
	s, err := r.q.EndShift(ctx, converter.UUIDToPg(userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNoShift
	}
	if err != nil {
		return nil, err
	}
	return toShift(s), nil
}

func toShift(s sqlc.StaffShift) *domain.Shift {
	return &domain.Shift{
		ID:        converter.PgToUUID(s.ID),
		UserID:    converter.PgToUUID(s.UserID),
		StartedAt: converter.PgToTime(s.StartedAt),
		EndedAt:   converter.PgToTimePtr(s.EndedAt),
	}
}

// roundMoney keeps Birr amounts to two decimals so sums of payments compare exactly
func roundMoney(v float64) float64 {
	if v < 0 {
		return -float64(int64(-v*100+0.5)) / 100
	}
	return float64(int64(v*100+0.5)) / 100
}
