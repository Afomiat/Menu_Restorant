DROP TABLE IF EXISTS activity_log;

DROP INDEX IF EXISTS users_tenant_phone_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_or_phone;
-- Accounts that only have a phone cannot exist without the new columns
DELETE FROM users WHERE email IS NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users DROP COLUMN IF EXISTS is_active;
ALTER TABLE users DROP COLUMN IF EXISTS phone;
ALTER TABLE users DROP COLUMN IF EXISTS full_name;

UPDATE users SET role = 'owner' WHERE role = 'manager';
UPDATE users SET role = 'kitchen' WHERE role = 'chef';
UPDATE users SET role = 'waiter' WHERE role = 'cashier';
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'owner';
