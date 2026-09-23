-- name: CreateOrder :one
INSERT INTO orders (
    tenant_id, table_id, table_number, customer_session_token,
    status, payment_status, total_amount, grace_period_ends_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, tenant_id, table_id, table_number, customer_session_token, status, payment_status, total_amount, grace_period_ends_at, created_at;

-- name: CreateOrderItem :one
INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, notes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, order_id, menu_item_id, item_name, unit_price, quantity, notes;

-- name: CreateOrderItemModifier :one
INSERT INTO order_item_modifiers (order_item_id, modifier_id, modifier_name, price_applied)
VALUES ($1, $2, $3, $4)
RETURNING id, order_item_id, modifier_id, modifier_name, price_applied;

-- name: GetOrderByID :one
SELECT id, tenant_id, table_id, table_number, customer_session_token, status, payment_status, total_amount, grace_period_ends_at, created_at
FROM orders
WHERE id = $1 AND tenant_id = $2
LIMIT 1;

-- name: ListActiveOrdersByTenant :many
SELECT id, tenant_id, table_id, table_number, status, payment_status, total_amount, grace_period_ends_at, created_at
FROM orders
WHERE tenant_id = $1 AND status NOT IN ('delivered', 'cancelled')
ORDER BY created_at DESC;

-- name: UpdateOrderStatus :one
UPDATE orders
SET status = $3, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, status, updated_at;

-- name: CancelOrderInGrace :one
UPDATE orders
SET status = 'cancelled', updated_at = NOW()
WHERE id = $1 
  AND tenant_id = $2 
  AND customer_session_token = $3 
  AND status = 'pending_grace' 
  AND grace_period_ends_at > NOW()
RETURNING id, tenant_id, status;

-- name: ListOrderItemsByOrderID :many
SELECT id, order_id, menu_item_id, item_name, unit_price, quantity, notes
FROM order_items
WHERE order_id = $1;

-- name: ListOrderItemModifiersByItemID :many
SELECT id, order_item_id, modifier_id, modifier_name, price_applied
FROM order_item_modifiers
WHERE order_item_id = $1;

-- name: BulkCancelTableOrders :exec
UPDATE orders
SET status = 'cancelled', updated_at = NOW()
WHERE tenant_id = $1
  AND table_number = $2
  AND status NOT IN ('delivered', 'cancelled');

-- name: BulkCancelAllActiveOrders :exec
UPDATE orders
SET status = 'cancelled', updated_at = NOW()
WHERE tenant_id = $1
  AND status NOT IN ('delivered', 'cancelled');
