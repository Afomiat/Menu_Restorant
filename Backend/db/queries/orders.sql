-- name: CreateOrder :one
INSERT INTO orders (
    tenant_id, table_id, table_number, customer_session_token,
    status, payment_status, total_amount, grace_period_ends_at, target_minutes
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, tenant_id, table_id, table_number, customer_session_token, status, payment_status, total_amount, grace_period_ends_at, created_at, target_minutes, started_at, started_by, ready_at, ready_by, served_at, served_by;

-- name: CreateOrderItem :one
INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, notes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, order_id, menu_item_id, item_name, unit_price, quantity, notes;

-- name: CreateOrderItemModifier :one
INSERT INTO order_item_modifiers (order_item_id, modifier_id, modifier_name, price_applied)
VALUES ($1, $2, $3, $4)
RETURNING id, order_item_id, modifier_id, modifier_name, price_applied;

-- name: GetOrderByID :one
SELECT id, tenant_id, table_id, table_number, customer_session_token, status, payment_status, total_amount, grace_period_ends_at, created_at, target_minutes, started_at, started_by, ready_at, ready_by, served_at, served_by
FROM orders
WHERE id = $1 AND tenant_id = $2
LIMIT 1;

-- name: ListActiveOrdersByTenant :many
SELECT id, tenant_id, table_id, table_number, status, payment_status, total_amount, grace_period_ends_at, created_at,
       target_minutes, started_at, started_by, ready_at, ready_by, served_at, served_by
FROM orders
WHERE tenant_id = $1 AND status NOT IN ('delivered', 'cancelled')
ORDER BY created_at DESC;

-- name: UpdateOrderStatus :one
-- Records who did each kitchen step and when. Moving an order back (undo) clears the later steps.
UPDATE orders
SET status = sqlc.arg('status')::order_status,
    updated_at = NOW(),
    started_at = CASE
        WHEN sqlc.arg('status')::order_status = 'preparing' AND status <> 'preparing' THEN NOW()
        WHEN sqlc.arg('status')::order_status IN ('pending_grace', 'not_started') THEN NULL
        ELSE started_at END,
    started_by = CASE
        WHEN sqlc.arg('status')::order_status = 'preparing' AND status <> 'preparing' THEN sqlc.narg('actor_id')::uuid
        WHEN sqlc.arg('status')::order_status IN ('pending_grace', 'not_started') THEN NULL
        ELSE started_by END,
    ready_at = CASE
        WHEN sqlc.arg('status')::order_status = 'ready' AND status <> 'ready' THEN NOW()
        WHEN sqlc.arg('status')::order_status IN ('pending_grace', 'not_started', 'preparing') THEN NULL
        ELSE ready_at END,
    ready_by = CASE
        WHEN sqlc.arg('status')::order_status = 'ready' AND status <> 'ready' THEN sqlc.narg('actor_id')::uuid
        WHEN sqlc.arg('status')::order_status IN ('pending_grace', 'not_started', 'preparing') THEN NULL
        ELSE ready_by END,
    served_at = CASE
        WHEN sqlc.arg('status')::order_status = 'delivered' AND status <> 'delivered' THEN NOW()
        WHEN sqlc.arg('status')::order_status <> 'delivered' THEN NULL
        ELSE served_at END,
    served_by = CASE
        WHEN sqlc.arg('status')::order_status = 'delivered' AND status <> 'delivered' THEN sqlc.narg('actor_id')::uuid
        WHEN sqlc.arg('status')::order_status <> 'delivered' THEN NULL
        ELSE served_by END
WHERE id = sqlc.arg('id') AND tenant_id = sqlc.arg('tenant_id')
RETURNING id, tenant_id, table_id, table_number, status, updated_at;

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

-- name: ListVeryLateOrders :many
-- Pro orders cooking for twice their target that no manager has been alerted about yet
SELECT o.id, o.tenant_id, o.table_number, o.target_minutes, o.started_at
FROM orders o
JOIN tenants t ON t.id = o.tenant_id
WHERE o.status = 'preparing'
  AND t.plan = 'pro'
  AND o.very_late_alerted_at IS NULL
  AND o.target_minutes IS NOT NULL
  AND o.started_at + make_interval(mins => o.target_minutes * 2) <= sqlc.arg('now')::timestamptz;

-- name: MarkOrderVeryLateAlerted :exec
UPDATE orders SET very_late_alerted_at = NOW() WHERE id = $1;
