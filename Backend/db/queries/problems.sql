-- name: GetOrderItemForProblem :one
-- The dish a problem is about, with its order's table, bill and kitchen people
SELECT i.id, i.order_id, i.item_name, i.quantity, i.removed_at, o.table_number, o.bill_id, o.ready_by, o.served_by
FROM order_items i
JOIN orders o ON o.id = i.order_id
WHERE i.id = $1 AND i.order_id = $2 AND o.tenant_id = $3;

-- name: CreateProblem :one
INSERT INTO order_problems (tenant_id, order_id, order_item_id, reason, note, reported_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id;

-- name: ListProblems :many
-- Problems with the dish, table and people involved; open_only lists those waiting for a decision
SELECT p.id, p.order_id, p.order_item_id, p.reason, p.note, p.reported_at, p.decision, p.fault, p.decided_at,
       p.removed_amount, p.remake_order_id,
       i.item_name, i.quantity, o.table_number,
       COALESCE(rep.full_name, '')::text AS reported_by_name,
       COALESCE(chef.full_name, '')::text AS ready_by_name,
       COALESCE(srv.full_name, '')::text AS served_by_name,
       COALESCE(dec.full_name, '')::text AS decided_by_name,
       o.started_at, o.ready_at, o.served_at
FROM order_problems p
JOIN order_items i ON i.id = p.order_item_id
JOIN orders o ON o.id = p.order_id
LEFT JOIN users rep ON rep.id = p.reported_by
LEFT JOIN users chef ON chef.id = o.ready_by
LEFT JOIN users srv ON srv.id = o.served_by
LEFT JOIN users dec ON dec.id = p.decided_by
WHERE p.tenant_id = sqlc.arg('tenant_id')
  AND (sqlc.narg('problem_id')::uuid IS NULL OR p.id = sqlc.narg('problem_id')::uuid)
  AND (NOT sqlc.arg('open_only')::bool OR p.decision IS NULL)
  AND p.reported_at >= sqlc.arg('since')::timestamptz
  AND p.reported_at < sqlc.arg('until')::timestamptz
ORDER BY p.reported_at;

-- name: DecideProblem :exec
UPDATE order_problems
SET decision = $3, fault = $4, decided_by = $5, decided_at = NOW(), removed_amount = $6, remake_order_id = $7
WHERE id = $1 AND tenant_id = $2;

-- name: ItemValue :one
-- What a dish costs on the bill: its price with modifiers, times the quantity
SELECT ((i.unit_price + COALESCE((SELECT SUM(m.price_applied) FROM order_item_modifiers m WHERE m.order_item_id = i.id), 0)) * i.quantity)::numeric AS value
FROM order_items i WHERE i.id = $1;

-- name: MarkItemRemoved :execrows
UPDATE order_items SET removed_at = NOW() WHERE id = $1 AND removed_at IS NULL;

-- name: ReduceOrderTotal :exec
UPDATE orders SET total_amount = GREATEST(total_amount - sqlc.arg('amount')::numeric, 0), updated_at = NOW()
WHERE id = sqlc.arg('id');

-- name: CreateRemakeOrder :one
-- A free copy of the order (same table, bill and target) for the kitchen to cook again
INSERT INTO orders (tenant_id, table_id, table_number, customer_session_token, status, payment_status,
                    total_amount, grace_period_ends_at, target_minutes, bill_id, remake_of)
SELECT src.tenant_id, src.table_id, src.table_number, src.customer_session_token, 'not_started', src.payment_status,
       0, NOW(), src.target_minutes, src.bill_id, src.id
FROM orders src WHERE src.id = $1 AND src.tenant_id = $2
RETURNING id;

-- name: CopyItemToRemake :exec
INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, notes)
SELECT sqlc.arg('remake_order_id')::uuid, src.menu_item_id, src.item_name, 0, src.quantity, src.notes
FROM order_items src WHERE src.id = sqlc.arg('order_item_id')::uuid;

-- name: MarkWalkout :exec
-- Closes an unpaid bill as a walkout, keeping what was still owed
UPDATE bills
SET status = 'walkout', walkout_marked_by = $3, walkout_at = NOW(), closed_at = NOW(), walkout_amount = $4
WHERE id = $1 AND tenant_id = $2;

-- name: DecideWalkout :exec
UPDATE bills
SET walkout_decision = $3, walkout_decided_by = $4, walkout_decided_at = NOW(), walkout_note = $5
WHERE id = $1 AND tenant_id = $2 AND status = 'walkout';

-- name: ListWalkouts :many
SELECT b.id, b.table_number, b.walkout_at, b.walkout_amount, b.walkout_decision, b.walkout_note, b.walkout_decided_at,
       COALESCE(w.full_name, '')::text AS waiter_name, b.waiter_id,
       COALESCE(m.full_name, '')::text AS marked_by_name,
       COALESCE(d.full_name, '')::text AS decided_by_name
FROM bills b
LEFT JOIN users w ON w.id = b.waiter_id
LEFT JOIN users m ON m.id = b.walkout_marked_by
LEFT JOIN users d ON d.id = b.walkout_decided_by
WHERE b.tenant_id = sqlc.arg('tenant_id') AND b.status = 'walkout'
  AND (NOT sqlc.arg('open_only')::bool OR b.walkout_decision IS NULL)
  AND b.walkout_at >= sqlc.arg('since')::timestamptz
  AND b.walkout_at < sqlc.arg('until')::timestamptz
ORDER BY b.walkout_at;

-- name: UpsertPushSubscription :exec
INSERT INTO push_subscriptions (tenant_id, user_id, endpoint, p256dh, auth)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, tenant_id = EXCLUDED.tenant_id,
    p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth;

-- name: ListPushSubscriptions :many
-- The browsers of the given people, and of everyone active in the restaurant with the given roles
SELECT s.id, s.endpoint, s.p256dh, s.auth
FROM push_subscriptions s
JOIN users u ON u.id = s.user_id
WHERE s.tenant_id = sqlc.arg('tenant_id') AND u.is_active
  AND (s.user_id = ANY(sqlc.arg('user_ids')::uuid[]) OR u.role::text = ANY(sqlc.arg('roles')::text[]));

-- name: DeletePushSubscription :exec
DELETE FROM push_subscriptions WHERE endpoint = $1;
