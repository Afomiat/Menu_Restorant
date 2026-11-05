-- name: ReportSalesByMethod :many
-- Money collected between the times, by payment method (walkouts' part payments included)
SELECT p.method, COUNT(*)::int AS payments, COALESCE(SUM(p.amount), 0)::numeric AS amount
FROM bill_payments p
WHERE p.tenant_id = $1 AND p.collected_at >= $2 AND p.collected_at < $3
GROUP BY p.method
ORDER BY p.method;

-- name: ReportWaiters :many
-- Per waiter, for bills opened between the times
SELECT b.waiter_id, COALESCE(w.full_name, '')::text AS waiter_name,
       COUNT(*)::int AS bills,
       COALESCE(SUM((SELECT SUM(o.total_amount) FROM orders o WHERE o.bill_id = b.id AND o.status <> 'cancelled')), 0)::numeric AS sales,
       COALESCE(SUM((SELECT SUM(p.amount) FROM bill_payments p WHERE p.bill_id = b.id)), 0)::numeric AS collected,
       COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN (SELECT SUM(p.amount) FROM bill_payments p WHERE p.bill_id = b.id) END), 0)::numeric AS confirmed,
       COALESCE(SUM(CASE WHEN b.status = 'collected' THEN (SELECT SUM(p.amount) FROM bill_payments p WHERE p.bill_id = b.id) END), 0)::numeric AS collected_not_confirmed,
       COUNT(*) FILTER (WHERE b.status = 'walkout')::int AS walkouts
FROM bills b
LEFT JOIN users w ON w.id = b.waiter_id
WHERE b.tenant_id = $1 AND b.created_at >= $2 AND b.created_at < $3
GROUP BY b.waiter_id, w.full_name
ORDER BY waiter_name;

-- name: ReportKitchen :many
-- Per dish: how many orders with it were cooked, average cooking minutes against the target, and how many ran late
SELECT i.item_name,
       COUNT(DISTINCT o.id)::int AS orders,
       COALESCE(AVG(EXTRACT(EPOCH FROM (o.ready_at - o.started_at)) / 60), 0)::float8 AS avg_minutes,
       COALESCE(AVG(o.target_minutes), 0)::float8 AS target_minutes,
       COUNT(DISTINCT o.id) FILTER (WHERE o.ready_at - o.started_at > make_interval(mins => o.target_minutes))::int AS late
FROM orders o
JOIN order_items i ON i.order_id = o.id
WHERE o.tenant_id = $1 AND o.started_at >= $2 AND o.started_at < $3
  AND o.ready_at IS NOT NULL AND o.target_minutes IS NOT NULL AND o.remake_of IS NULL
GROUP BY i.item_name
ORDER BY i.item_name;

-- name: ReportOpenBills :many
-- Bills opened between the times that are still not confirmed (end of day check)
SELECT b.id, b.table_number, b.status, COALESCE(w.full_name, '')::text AS waiter_name,
       COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE o.bill_id = b.id AND o.status <> 'cancelled'), 0)::numeric AS total_amount,
       COALESCE((SELECT SUM(p.amount) FROM bill_payments p WHERE p.bill_id = b.id), 0)::numeric AS amount_paid
FROM bills b
LEFT JOIN users w ON w.id = b.waiter_id
WHERE b.tenant_id = $1 AND b.created_at >= $2 AND b.created_at < $3
  AND b.status IN ('open', 'bill_requested', 'collected')
ORDER BY b.created_at;

-- name: ReportWaiterShift :one
-- One waiter's money between the times
SELECT COUNT(DISTINCT b.id)::int AS bills,
       COALESCE(SUM(p.amount), 0)::numeric AS collected,
       COALESCE(SUM(p.amount) FILTER (WHERE b.status = 'collected'), 0)::numeric AS not_confirmed
FROM bill_payments p
JOIN bills b ON b.id = p.bill_id
WHERE p.tenant_id = $1 AND p.collected_by = $2 AND p.collected_at >= $3 AND p.collected_at < $4;

-- name: ReportCashierShift :one
-- One cashier's confirmed money between the times
SELECT COUNT(DISTINCT b.id)::int AS bills,
       COALESCE(SUM((SELECT SUM(p.amount) FROM bill_payments p WHERE p.bill_id = b.id)), 0)::numeric AS confirmed
FROM bills b
WHERE b.tenant_id = $1 AND b.confirmed_by = $2 AND b.confirmed_at >= $3 AND b.confirmed_at < $4;

-- name: LastShift :one
SELECT id, tenant_id, user_id, started_at, ended_at FROM staff_shifts
WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1;
