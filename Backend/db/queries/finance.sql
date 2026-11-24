-- name: FinanceSummary :one
SELECT
  COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN (SELECT SUM(o.total_amount) FROM orders o WHERE o.bill_id = b.id AND o.status <> 'cancelled') END), 0)::numeric AS sales_total,
  COALESCE(SUM((SELECT SUM(p.amount) FROM bill_payments p WHERE p.bill_id = b.id)), 0)::numeric AS collected,
  COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN (SELECT SUM(p.amount) FROM bill_payments p WHERE p.bill_id = b.id) END), 0)::numeric AS confirmed,
  COALESCE(SUM(CASE WHEN b.status <> 'confirmed' THEN (SELECT SUM(p.amount) FROM bill_payments p WHERE p.bill_id = b.id) END), 0)::numeric AS collected_not_confirmed,
  COALESCE(SUM(b.walkout_amount) FILTER (WHERE b.status = 'walkout'), 0)::numeric AS walkout_loss,
  COALESCE((
    SELECT SUM(pr.removed_amount)
    FROM order_problems pr
    WHERE pr.tenant_id = sqlc.arg('tenant_id')::uuid
      AND pr.reported_at >= sqlc.arg('from')::timestamptz
      AND pr.reported_at < sqlc.arg('to')::timestamptz
      AND pr.decision = 'remove_from_bill'
  ), 0)::numeric AS removed_loss
FROM bills b
WHERE b.tenant_id = sqlc.arg('tenant_id')::uuid
  AND b.created_at >= sqlc.arg('from')::timestamptz
  AND b.created_at < sqlc.arg('to')::timestamptz;

-- name: FinanceTrendDaily :many
SELECT
  to_char(b.created_at AT TIME ZONE 'Africa/Addis_Ababa', 'YYYY-MM-DD') AS period,
  COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN (SELECT SUM(o.total_amount) FROM orders o WHERE o.bill_id = b.id AND o.status <> 'cancelled') END), 0)::numeric AS revenue,
  COALESCE(SUM((SELECT SUM(p.amount) FROM bill_payments p WHERE p.bill_id = b.id)), 0)::numeric AS collected,
  COALESCE(SUM(b.walkout_amount) FILTER (WHERE b.status = 'walkout'), 0)::numeric AS walkout_loss
FROM bills b
WHERE b.tenant_id = sqlc.arg('tenant_id')::uuid
  AND b.created_at >= sqlc.arg('from')::timestamptz
  AND b.created_at < sqlc.arg('to')::timestamptz
GROUP BY period
ORDER BY period;

-- name: FinanceTrendWeekly :many
SELECT
  to_char(date_trunc('week', b.created_at AT TIME ZONE 'Africa/Addis_Ababa'), 'YYYY-"W"IW') AS period,
  COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN (SELECT SUM(o.total_amount) FROM orders o WHERE o.bill_id = b.id AND o.status <> 'cancelled') END), 0)::numeric AS revenue,
  COALESCE(SUM((SELECT SUM(p.amount) FROM bill_payments p WHERE p.bill_id = b.id)), 0)::numeric AS collected,
  COALESCE(SUM(b.walkout_amount) FILTER (WHERE b.status = 'walkout'), 0)::numeric AS walkout_loss
FROM bills b
WHERE b.tenant_id = sqlc.arg('tenant_id')::uuid
  AND b.created_at >= sqlc.arg('from')::timestamptz
  AND b.created_at < sqlc.arg('to')::timestamptz
GROUP BY period
ORDER BY period;

-- name: FinanceTopDishes :many
SELECT i.item_name,
       SUM(i.quantity)::int AS quantity_sold,
       SUM((i.unit_price + COALESCE((SELECT SUM(m.price_applied) FROM order_item_modifiers m WHERE m.order_item_id = i.id), 0)) * i.quantity)::numeric AS revenue
FROM order_items i
JOIN orders o ON o.id = i.order_id
JOIN bills b ON b.id = o.bill_id
WHERE b.tenant_id = sqlc.arg('tenant_id')::uuid
  AND b.created_at >= sqlc.arg('from')::timestamptz
  AND b.created_at < sqlc.arg('to')::timestamptz
  AND b.status = 'confirmed' AND o.status <> 'cancelled' AND i.removed_at IS NULL
GROUP BY i.item_name
ORDER BY revenue DESC
LIMIT sqlc.arg('limit_count')::int;
