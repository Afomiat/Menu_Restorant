-- name: GetTableByNumber :one
SELECT id, tenant_id, table_number, qr_secret, is_active
FROM restaurant_tables
WHERE tenant_id = $1 AND table_number = $2 AND is_active = TRUE
LIMIT 1;

-- name: ListTablesByTenant :many
SELECT id, tenant_id, table_number, qr_secret, is_active
FROM restaurant_tables
WHERE tenant_id = $1 AND is_active = TRUE
ORDER BY table_number ASC;

-- name: CreateTable :one
INSERT INTO restaurant_tables (tenant_id, table_number, qr_secret, is_active)
VALUES ($1, $2, $3, $4)
RETURNING id, tenant_id, table_number, qr_secret, is_active;

-- name: UpdateTableQRSecret :one
UPDATE restaurant_tables
SET qr_secret = $3
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, table_number, qr_secret;
