-- name: ListCategoriesByTenant :many
SELECT id, tenant_id, name, sort_order, is_active
FROM categories
WHERE tenant_id = $1 AND is_active = TRUE
ORDER BY sort_order ASC, name ASC;

-- name: GetCategoryByID :one
SELECT id, tenant_id, name, sort_order, is_active
FROM categories
WHERE id = $1 AND tenant_id = $2
LIMIT 1;

-- name: CreateCategory :one
INSERT INTO categories (tenant_id, name, sort_order, is_active)
VALUES ($1, $2, $3, $4)
RETURNING id, tenant_id, name, sort_order, is_active;

-- name: UpdateCategory :one
UPDATE categories
SET name = $3, sort_order = $4, is_active = $5
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, name, sort_order, is_active;

-- name: DeleteCategory :exec
DELETE FROM categories
WHERE id = $1 AND tenant_id = $2;
