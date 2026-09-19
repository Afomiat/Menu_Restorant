-- name: GetUserByEmail :one
SELECT id, tenant_id, email, password_hash, role, created_at
FROM users
WHERE email = $1
LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (tenant_id, email, password_hash, role)
VALUES ($1, $2, $3, $4)
RETURNING id, tenant_id, email, password_hash, role, created_at;
