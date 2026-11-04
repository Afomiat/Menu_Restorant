-- name: GetUserByEmail :one
SELECT id, tenant_id, email, password_hash, role, created_at, full_name, phone, is_active
FROM users
WHERE email = $1
LIMIT 1;

-- name: GetUserByTenantPhone :one
SELECT id, tenant_id, email, password_hash, role, created_at, full_name, phone, is_active
FROM users
WHERE tenant_id = $1 AND phone = $2
LIMIT 1;

-- name: GetStaffByID :one
SELECT id, tenant_id, email, password_hash, role, created_at, full_name, phone, is_active
FROM users
WHERE tenant_id = $1 AND id = $2
LIMIT 1;

-- name: ListStaff :many
SELECT id, tenant_id, email, password_hash, role, created_at, full_name, phone, is_active
FROM users
WHERE tenant_id = $1
ORDER BY is_active DESC, full_name, created_at;

-- name: CreateUser :one
INSERT INTO users (tenant_id, email, phone, full_name, password_hash, role)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, tenant_id, email, password_hash, role, created_at, full_name, phone, is_active;

-- name: UpdateStaff :one
UPDATE users
SET full_name = COALESCE(sqlc.narg('full_name'), full_name),
    role = COALESCE(sqlc.narg('role'), role),
    is_active = COALESCE(sqlc.narg('is_active'), is_active),
    password_hash = COALESCE(sqlc.narg('password_hash'), password_hash)
WHERE tenant_id = sqlc.arg('tenant_id') AND id = sqlc.arg('id')
RETURNING id, tenant_id, email, password_hash, role, created_at, full_name, phone, is_active;

-- name: IsUserActive :one
SELECT is_active FROM users WHERE id = $1;

-- name: CountActiveManagers :one
SELECT COUNT(*) FROM users
WHERE tenant_id = $1 AND role = 'manager' AND is_active;
