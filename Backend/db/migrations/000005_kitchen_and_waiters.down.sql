DROP INDEX IF EXISTS idx_orders_preparing;
ALTER TABLE orders
    DROP COLUMN IF EXISTS very_late_alerted_at,
    DROP COLUMN IF EXISTS served_by,
    DROP COLUMN IF EXISTS served_at,
    DROP COLUMN IF EXISTS ready_by,
    DROP COLUMN IF EXISTS ready_at,
    DROP COLUMN IF EXISTS started_by,
    DROP COLUMN IF EXISTS started_at,
    DROP COLUMN IF EXISTS target_minutes;
ALTER TABLE restaurant_tables DROP COLUMN IF EXISTS assigned_waiter_id;
ALTER TABLE menu_items DROP COLUMN IF EXISTS prep_minutes;
ALTER TABLE tenants DROP COLUMN IF EXISTS settings;
