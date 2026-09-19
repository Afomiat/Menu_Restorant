-- name: GetTenantBySlug :one
SELECT id, slug, name, plan, currency, theme_config, is_active, created_at, updated_at
FROM tenants
WHERE slug = $1 AND is_active = TRUE
LIMIT 1;

-- name: GetTenantByID :one
SELECT id, slug, name, plan, currency, theme_config, is_active, created_at, updated_at
FROM tenants
WHERE id = $1
LIMIT 1;

-- name: CreateTenant :one
INSERT INTO tenants (slug, name, plan, currency, theme_config)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, slug, name, plan, currency, theme_config, is_active, created_at, updated_at;

-- name: UpdateTenantPlan :one
UPDATE tenants
SET plan = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, slug, name, plan, currency, theme_config, is_active, created_at, updated_at;

-- name: UpdateTenantTheme :one
UPDATE tenants
SET theme_config = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, slug, name, plan, currency, theme_config, is_active, created_at, updated_at;
