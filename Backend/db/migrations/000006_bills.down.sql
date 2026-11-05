DROP TABLE IF EXISTS staff_shifts;
ALTER TABLE activity_log DROP COLUMN IF EXISTS bill_id;
DROP INDEX IF EXISTS idx_orders_bill;
ALTER TABLE orders DROP COLUMN IF EXISTS bill_id;
DROP TABLE IF EXISTS bill_payments;
DROP TABLE IF EXISTS bills;
DROP TYPE IF EXISTS payment_method;
DROP TYPE IF EXISTS bill_status;
