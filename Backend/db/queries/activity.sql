-- name: RecordActivity :exec
INSERT INTO activity_log (tenant_id, actor_id, action, order_id, details)
VALUES ($1, $2, $3, $4, $5);

-- name: ListActivity :many
SELECT id, tenant_id, actor_id, action, order_id, details, created_at
FROM activity_log
WHERE tenant_id = $1
ORDER BY created_at DESC
LIMIT $2;
