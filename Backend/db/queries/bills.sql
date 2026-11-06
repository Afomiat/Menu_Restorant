-- name: InsertActiveBill :exec
-- Opens a bill for the table unless one is already taking orders
INSERT INTO bills (tenant_id, table_id, table_number, waiter_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (tenant_id, table_number) WHERE status IN ('open', 'bill_requested') DO NOTHING;

-- name: GetActiveBillForTable :one
SELECT id FROM bills
WHERE tenant_id = $1 AND table_number = $2 AND status IN ('open', 'bill_requested')
LIMIT 1;

-- name: ListBills :many
-- Bills with their totals (orders not cancelled) and what has been paid.
-- since: bills confirmed or walked out after this time are included; active ones always are.
SELECT b.id, b.tenant_id, b.table_id, b.table_number, b.waiter_id, b.status,
       b.requested_at, b.collected_by, b.collected_at, b.confirmed_by, b.confirmed_at,
       b.created_at, b.closed_at,
       COALESCE(w.full_name, '')::text AS waiter_name,
       COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE o.bill_id = b.id AND o.status <> 'cancelled'), 0)::numeric AS total_amount,
       COALESCE((SELECT SUM(p.amount) FROM bill_payments p WHERE p.bill_id = b.id), 0)::numeric AS amount_paid
FROM bills b
LEFT JOIN users w ON w.id = b.waiter_id
WHERE b.tenant_id = sqlc.arg('tenant_id')
  AND (sqlc.narg('waiter_id')::uuid IS NULL OR b.waiter_id = sqlc.narg('waiter_id')::uuid)
  AND (sqlc.narg('bill_id')::uuid IS NULL OR b.id = sqlc.narg('bill_id')::uuid)
  AND (b.status IN ('open', 'bill_requested', 'collected') OR b.closed_at >= sqlc.arg('since')::timestamptz)
ORDER BY b.created_at;

-- name: ListBillPayments :many
SELECT p.id, p.bill_id, p.amount, p.method, p.reference, p.collected_by, p.collected_at,
       COALESCE(u.full_name, '')::text AS collected_by_name
FROM bill_payments p
LEFT JOIN users u ON u.id = p.collected_by
WHERE p.bill_id = ANY(sqlc.arg('bill_ids')::uuid[])
ORDER BY p.collected_at;

-- name: AddBillPayment :exec
INSERT INTO bill_payments (bill_id, tenant_id, amount, method, reference, collected_by)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: SetBillStatus :exec
-- Moves a bill and records who did the step and when
UPDATE bills
SET status = sqlc.arg('status')::bill_status,
    requested_at = CASE WHEN sqlc.arg('status')::bill_status = 'bill_requested' THEN COALESCE(requested_at, NOW()) ELSE requested_at END,
    collected_by = CASE WHEN sqlc.arg('status')::bill_status = 'collected' THEN sqlc.narg('actor_id')::uuid ELSE collected_by END,
    collected_at = CASE WHEN sqlc.arg('status')::bill_status = 'collected' THEN NOW() ELSE collected_at END,
    confirmed_by = CASE WHEN sqlc.arg('status')::bill_status = 'confirmed' THEN sqlc.narg('actor_id')::uuid ELSE confirmed_by END,
    confirmed_at = CASE WHEN sqlc.arg('status')::bill_status = 'confirmed' THEN NOW() ELSE confirmed_at END,
    closed_at = CASE WHEN sqlc.arg('status')::bill_status IN ('confirmed', 'walkout') THEN NOW() ELSE closed_at END
WHERE id = sqlc.arg('id') AND tenant_id = sqlc.arg('tenant_id');

-- name: SetBillWaiter :exec
UPDATE bills SET waiter_id = $3 WHERE id = $1 AND tenant_id = $2;

-- name: MoveBillToTable :exec
UPDATE bills SET table_id = $3, table_number = $4, waiter_id = $5 WHERE id = $1 AND tenant_id = $2;

-- name: MoveBillOrders :exec
-- Moves a bill's orders onto another bill and table (merge or move)
UPDATE orders SET bill_id = sqlc.arg('to_bill_id'), table_id = sqlc.narg('table_id'), table_number = sqlc.arg('table_number')
WHERE bill_id = sqlc.arg('from_bill_id') AND tenant_id = sqlc.arg('tenant_id');

-- name: MoveBillPayments :exec
UPDATE bill_payments SET bill_id = sqlc.arg('to_bill_id') WHERE bill_id = sqlc.arg('from_bill_id') AND tenant_id = sqlc.arg('tenant_id');

-- name: DeleteBill :exec
DELETE FROM bills WHERE id = $1 AND tenant_id = $2;

-- name: CountWaiterUnpaidBills :one
-- Bills a waiter still holds that are not collected yet
SELECT COUNT(*) FROM bills WHERE tenant_id = $1 AND waiter_id = $2 AND status IN ('open', 'bill_requested');

-- name: BillSessionHasOrdered :one
-- Whether this customer phone already ordered on the bill (same party) or not (new customers)
SELECT EXISTS (SELECT 1 FROM orders WHERE bill_id = $1 AND customer_session_token = $2);

-- name: GetRequestedBillForTable :one
SELECT id, waiter_id FROM bills
WHERE tenant_id = $1 AND table_number = $2 AND status = 'bill_requested'
LIMIT 1;

-- name: ListBillsDue :many
-- Pro bills whose reminder or alert is due, with the restaurant's times (defaults 10/20/15/120)
SELECT b.id, b.tenant_id, b.table_number, b.waiter_id, b.status, b.requested_at, b.collected_at, b.created_at,
       (b.status = 'bill_requested' AND b.reminded_at IS NULL
          AND b.requested_at + make_interval(mins => COALESCE((t.settings->>'bill_reminder_minutes')::int, 10)) <= sqlc.arg('now')::timestamptz) AS remind_waiter,
       (b.status = 'bill_requested' AND b.escalated_at IS NULL
          AND b.requested_at + make_interval(mins => COALESCE((t.settings->>'bill_escalation_minutes')::int, 20)) <= sqlc.arg('now')::timestamptz) AS escalate,
       (b.status = 'collected' AND b.confirm_reminded_at IS NULL
          AND b.collected_at + make_interval(mins => COALESCE((t.settings->>'confirm_reminder_minutes')::int, 15)) <= sqlc.arg('now')::timestamptz) AS unconfirmed,
       (b.status IN ('open', 'bill_requested') AND b.long_open_reminded_at IS NULL
          AND b.created_at + make_interval(mins => COALESCE((t.settings->>'long_table_minutes')::int, 120)) <= sqlc.arg('now')::timestamptz) AS long_open
FROM bills b
JOIN tenants t ON t.id = b.tenant_id
WHERE t.plan = 'pro' AND b.status IN ('open', 'bill_requested', 'collected');

-- name: MarkBillReminded :exec
UPDATE bills SET
    reminded_at = CASE WHEN sqlc.arg('remind_waiter')::bool THEN NOW() ELSE reminded_at END,
    escalated_at = CASE WHEN sqlc.arg('escalate')::bool THEN NOW() ELSE escalated_at END,
    confirm_reminded_at = CASE WHEN sqlc.arg('unconfirmed')::bool THEN NOW() ELSE confirm_reminded_at END,
    long_open_reminded_at = CASE WHEN sqlc.arg('long_open')::bool THEN NOW() ELSE long_open_reminded_at END
WHERE id = sqlc.arg('id');

-- name: SetOrderBill :exec
UPDATE orders SET bill_id = $2 WHERE id = $1;

-- name: GetOpenShift :one
SELECT id, tenant_id, user_id, started_at, ended_at FROM staff_shifts WHERE user_id = $1 AND ended_at IS NULL LIMIT 1;

-- name: StartShift :one
INSERT INTO staff_shifts (tenant_id, user_id) VALUES ($1, $2)
RETURNING id, tenant_id, user_id, started_at, ended_at;

-- name: EndShift :one
UPDATE staff_shifts SET ended_at = NOW() WHERE user_id = $1 AND ended_at IS NULL
RETURNING id, tenant_id, user_id, started_at, ended_at;
