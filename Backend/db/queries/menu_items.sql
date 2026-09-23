-- name: ListMenuItemsByTenant :many
SELECT id, tenant_id, category_id, name, description, price, image_url, tags, is_available, is_sold_out, created_at
FROM menu_items
WHERE tenant_id = $1 AND is_available = TRUE
ORDER BY name ASC;

-- name: ListMenuItemsByCategory :many
SELECT id, tenant_id, category_id, name, description, price, image_url, tags, is_available, is_sold_out, created_at
FROM menu_items
WHERE tenant_id = $1 AND category_id = $2 AND is_available = TRUE
ORDER BY name ASC;

-- name: GetMenuItemByID :one
SELECT id, tenant_id, category_id, name, description, price, image_url, tags, is_available, is_sold_out, created_at
FROM menu_items
WHERE id = $1 AND tenant_id = $2
LIMIT 1;

-- name: CreateMenuItem :one
INSERT INTO menu_items (tenant_id, category_id, name, description, price, image_url, tags, is_available, is_sold_out)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, tenant_id, category_id, name, description, price, image_url, tags, is_available, is_sold_out, created_at;

-- name: UpdateMenuItem :one
UPDATE menu_items
SET category_id = $3, name = $4, description = $5, price = $6, image_url = $7, tags = $8, is_available = $9
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, category_id, name, description, price, image_url, tags, is_available, is_sold_out, created_at;

-- name: ToggleMenuItemSoldOut :one
UPDATE menu_items
SET is_sold_out = $3
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, name, is_sold_out;

-- name: DeleteMenuItem :exec
DELETE FROM menu_items
WHERE id = $1 AND tenant_id = $2;

-- name: GetModifierByID :one
SELECT m.id, m.modifier_group_id, m.name, m.price_adjustment, mg.tenant_id
FROM modifiers m
JOIN modifier_groups mg ON m.modifier_group_id = mg.id
WHERE m.id = $1 AND mg.tenant_id = $2
LIMIT 1;

-- name: GetModifierByIDAndMenuItemID :one
SELECT m.id, m.modifier_group_id, m.name, m.price_adjustment, mg.tenant_id
FROM modifiers m
JOIN modifier_groups mg ON m.modifier_group_id = mg.id
JOIN item_modifier_groups img ON img.modifier_group_id = mg.id
WHERE m.id = $1 AND img.menu_item_id = $2 AND mg.tenant_id = $3
LIMIT 1;

