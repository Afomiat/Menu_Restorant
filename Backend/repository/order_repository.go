package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
)

type orderRepository struct {
	pool *pgxpool.Pool
	q    *sqlc.Queries
}

func NewOrderRepository(pool *pgxpool.Pool, q *sqlc.Queries) domain.OrderRepository {
	return &orderRepository{
		pool: pool,
		q:    q,
	}
}

func (r *orderRepository) Create(ctx context.Context, order *domain.Order) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	qtx := r.q.WithTx(tx)

	var tableID = uuid.Nil
	if order.TableID != nil {
		tableID = *order.TableID
	}

	createdOrder, err := qtx.CreateOrder(ctx, sqlc.CreateOrderParams{
		TenantID:             converter.UUIDToPg(order.TenantID),
		TableID:              converter.UUIDToPg(tableID),
		TableNumber:          order.TableNumber,
		CustomerSessionToken: order.CustomerSessionToken,
		Status:               sqlc.OrderStatus(order.Status),
		PaymentStatus:        sqlc.PaymentStatusUnpaid,
		TotalAmount:          converter.FloatToNumeric(order.TotalAmount),
		GracePeriodEndsAt:    converter.TimeToPg(order.GracePeriodEndsAt),
	})
	if err != nil {
		return err
	}

	order.ID = converter.PgToUUID(createdOrder.ID)
	order.CreatedAt = converter.PgToTime(createdOrder.CreatedAt)

	for i := range order.Items {
		item := &order.Items[i]
		createdItem, err := qtx.CreateOrderItem(ctx, sqlc.CreateOrderItemParams{
			OrderID:    createdOrder.ID,
			MenuItemID: converter.UUIDToPg(item.MenuItemID),
			ItemName:   item.ItemName,
			UnitPrice:  converter.FloatToNumeric(item.UnitPrice),
			Quantity:   item.Quantity,
			Notes:      converter.StringToText(item.Notes),
		})
		if err != nil {
			return err
		}
		item.ID = converter.PgToUUID(createdItem.ID)
		item.OrderID = order.ID

		for j := range item.Modifiers {
			mod := &item.Modifiers[j]
			createdMod, err := qtx.CreateOrderItemModifier(ctx, sqlc.CreateOrderItemModifierParams{
				OrderItemID:  createdItem.ID,
				ModifierID:   converter.UUIDToPg(mod.ModifierID),
				ModifierName: mod.ModifierName,
				PriceApplied: converter.FloatToNumeric(mod.PriceApplied),
			})
			if err != nil {
				return err
			}
			mod.ID = converter.PgToUUID(createdMod.ID)
			mod.OrderItemID = item.ID
		}
	}

	return tx.Commit(ctx)
}

func (r *orderRepository) GetByID(ctx context.Context, tenantID, orderID uuid.UUID) (*domain.Order, error) {
	row, err := r.q.GetOrderByID(ctx, sqlc.GetOrderByIDParams{
		ID:       converter.UUIDToPg(orderID),
		TenantID: converter.UUIDToPg(tenantID),
	})
	if err != nil {
		return nil, err
	}

	tID := converter.PgToUUID(row.TableID)
	var tableIDPtr *uuid.UUID
	if tID != uuid.Nil {
		tableIDPtr = &tID
	}

	order := &domain.Order{
		ID:                   converter.PgToUUID(row.ID),
		TenantID:             converter.PgToUUID(row.TenantID),
		TableID:              tableIDPtr,
		TableNumber:          row.TableNumber,
		CustomerSessionToken: row.CustomerSessionToken,
		Status:               domain.OrderStatus(row.Status),
		TotalAmount:          converter.NumericToFloat(row.TotalAmount),
		GracePeriodEndsAt:    converter.PgToTime(row.GracePeriodEndsAt),
		CreatedAt:            converter.PgToTime(row.CreatedAt),
	}

	items, err := r.loadOrderItems(ctx, order.ID)
	if err == nil {
		order.Items = items
	}

	return order, nil
}

func (r *orderRepository) ListActiveByTenant(ctx context.Context, tenantID uuid.UUID) ([]domain.Order, error) {
	rows, err := r.q.ListActiveOrdersByTenant(ctx, converter.UUIDToPg(tenantID))
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return []domain.Order{}, nil
	}

	orders := make([]domain.Order, len(rows))
	orderIDs := make([]pgtype.UUID, len(rows))
	orderMap := make(map[uuid.UUID]*domain.Order, len(rows))

	for i, row := range rows {
		tID := converter.PgToUUID(row.TableID)
		var tableIDPtr *uuid.UUID
		if tID != uuid.Nil {
			tableIDPtr = &tID
		}
		id := converter.PgToUUID(row.ID)
		orderIDs[i] = row.ID
		orders[i] = domain.Order{
			ID:                id,
			TenantID:          converter.PgToUUID(row.TenantID),
			TableID:           tableIDPtr,
			TableNumber:       row.TableNumber,
			Status:            domain.OrderStatus(row.Status),
			TotalAmount:       converter.NumericToFloat(row.TotalAmount),
			GracePeriodEndsAt: converter.PgToTime(row.GracePeriodEndsAt),
			CreatedAt:         converter.PgToTime(row.CreatedAt),
			Items:             []domain.OrderItem{},
		}
		orderMap[id] = &orders[i]
	}

	// Batch query all items for all active orders in a single round-trip
	itemRows, err := r.pool.Query(ctx, `
		SELECT id, order_id, menu_item_id, item_name, unit_price, quantity, notes
		FROM order_items
		WHERE order_id = ANY($1)
	`, orderIDs)
	if err != nil {
		return orders, nil
	}
	defer itemRows.Close()

	var itemIDs []pgtype.UUID
	itemMap := make(map[uuid.UUID]*domain.OrderItem)

	for itemRows.Next() {
		var (
			id, orderID, menuItemID pgtype.UUID
			itemName                string
			unitPrice               pgtype.Numeric
			quantity                int32
			notes                   pgtype.Text
		)
		if err := itemRows.Scan(&id, &orderID, &menuItemID, &itemName, &unitPrice, &quantity, &notes); err != nil {
			continue
		}
		itemUUID := converter.PgToUUID(id)
		itemIDs = append(itemIDs, id)
		domItem := domain.OrderItem{
			ID:         itemUUID,
			OrderID:    converter.PgToUUID(orderID),
			MenuItemID: converter.PgToUUID(menuItemID),
			ItemName:   itemName,
			UnitPrice:  converter.NumericToFloat(unitPrice),
			Quantity:   quantity,
			Notes:      converter.TextToString(notes),
			Modifiers:  []domain.OrderItemModifier{},
		}
		if ord, ok := orderMap[domItem.OrderID]; ok {
			ord.Items = append(ord.Items, domItem)
			itemMap[itemUUID] = &ord.Items[len(ord.Items)-1]
		}
	}

	if len(itemIDs) > 0 {
		modRows, err := r.pool.Query(ctx, `
			SELECT id, order_item_id, modifier_id, modifier_name, price_applied
			FROM order_item_modifiers
			WHERE order_item_id = ANY($1)
		`, itemIDs)
		if err == nil {
			defer modRows.Close()
			for modRows.Next() {
				var (
					id, orderItemID, modifierID pgtype.UUID
					modifierName                string
					priceApplied                pgtype.Numeric
				)
				if err := modRows.Scan(&id, &orderItemID, &modifierID, &modifierName, &priceApplied); err == nil {
					domMod := domain.OrderItemModifier{
						ID:           converter.PgToUUID(id),
						OrderItemID:  converter.PgToUUID(orderItemID),
						ModifierID:   converter.PgToUUID(modifierID),
						ModifierName: modifierName,
						PriceApplied: converter.NumericToFloat(priceApplied),
					}
					if itm, ok := itemMap[domMod.OrderItemID]; ok {
						itm.Modifiers = append(itm.Modifiers, domMod)
					}
				}
			}
		}
	}

	return orders, nil
}

func (r *orderRepository) loadOrderItems(ctx context.Context, orderID uuid.UUID) ([]domain.OrderItem, error) {
	dbItems, err := r.q.ListOrderItemsByOrderID(ctx, converter.UUIDToPg(orderID))
	if err != nil {
		return nil, err
	}

	items := make([]domain.OrderItem, len(dbItems))
	for i, dbItem := range dbItems {
		dbMods, err := r.q.ListOrderItemModifiersByItemID(ctx, dbItem.ID)
		if err != nil {
			return nil, err
		}

		mods := make([]domain.OrderItemModifier, len(dbMods))
		for j, dbMod := range dbMods {
			mods[j] = domain.OrderItemModifier{
				ID:           converter.PgToUUID(dbMod.ID),
				OrderItemID:  converter.PgToUUID(dbMod.OrderItemID),
				ModifierID:   converter.PgToUUID(dbMod.ModifierID),
				ModifierName: dbMod.ModifierName,
				PriceApplied: converter.NumericToFloat(dbMod.PriceApplied),
			}
		}

		items[i] = domain.OrderItem{
			ID:         converter.PgToUUID(dbItem.ID),
			OrderID:    converter.PgToUUID(dbItem.OrderID),
			MenuItemID: converter.PgToUUID(dbItem.MenuItemID),
			ItemName:   dbItem.ItemName,
			UnitPrice:  converter.NumericToFloat(dbItem.UnitPrice),
			Quantity:   dbItem.Quantity,
			Notes:      converter.TextToString(dbItem.Notes),
			Modifiers:  mods,
		}
	}
	return items, nil
}

func (r *orderRepository) UpdateStatus(ctx context.Context, tenantID, orderID uuid.UUID, status domain.OrderStatus) error {
	_, err := r.q.UpdateOrderStatus(ctx, sqlc.UpdateOrderStatusParams{
		ID:       converter.UUIDToPg(orderID),
		TenantID: converter.UUIDToPg(tenantID),
		Status:   sqlc.OrderStatus(status),
	})
	return err
}

func (r *orderRepository) CancelInGrace(ctx context.Context, tenantID, orderID uuid.UUID, sessionToken string) error {
	_, err := r.q.CancelOrderInGrace(ctx, sqlc.CancelOrderInGraceParams{
		ID:                   converter.UUIDToPg(orderID),
		TenantID:             converter.UUIDToPg(tenantID),
		CustomerSessionToken: sessionToken,
	})
	return err
}

func (r *orderRepository) BulkCancelTableOrders(ctx context.Context, tenantID uuid.UUID, tableNumber string) error {
	return r.q.BulkCancelTableOrders(ctx, sqlc.BulkCancelTableOrdersParams{
		TenantID:    converter.UUIDToPg(tenantID),
		TableNumber: tableNumber,
	})
}

func (r *orderRepository) BulkCancelAllActive(ctx context.Context, tenantID uuid.UUID) error {
	return r.q.BulkCancelAllActiveOrders(ctx, converter.UUIDToPg(tenantID))
}
