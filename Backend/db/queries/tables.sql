-- name: GetTableByNumber :one
SELECT id, tenant_id, table_number, qr_secret, is_active, assigned_waiter_id
FROM restaurant_tables
WHERE tenant_id = $1 AND table_number = $2 AND is_active = TRUE
LIMIT 1;

-- name: ListTablesByTenant :many
SELECT t.id, t.tenant_id, t.table_number, t.qr_secret, t.is_active, t.assigned_waiter_id,
       COALESCE(u.full_name, '')::text AS assigned_waiter_name
FROM restaurant_tables t
LEFT JOIN users u ON u.id = t.assigned_waiter_id
WHERE t.tenant_id = $1 AND t.is_active = TRUE
ORDER BY t.table_number ASC;

-- name: CreateTable :one
INSERT INTO restaurant_tables (tenant_id, table_number, qr_secret, is_active)
VALUES ($1, $2, $3, $4)
RETURNING id, tenant_id, table_number, qr_secret, is_active, assigned_waiter_id;

-- name: UpdateTableQRSecret :one
UPDATE restaurant_tables
SET qr_secret = $3
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, table_number, qr_secret;

-- name: UpdateTableWaiter :one
UPDATE restaurant_tables
SET assigned_waiter_id = $3
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, table_number, qr_secret, is_active, assigned_waiter_id;
