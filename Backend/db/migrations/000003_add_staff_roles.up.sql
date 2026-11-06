-- Pro plan roles: Manager, Cashier, Waiter and Chef. A new enum value can only be used
-- after the transaction that adds it commits, so existing users move in the next migration.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'chef';
