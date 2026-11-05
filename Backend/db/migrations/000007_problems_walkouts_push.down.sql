DROP TABLE IF EXISTS push_subscriptions;
ALTER TABLE bills
    DROP COLUMN IF EXISTS walkout_note,
    DROP COLUMN IF EXISTS walkout_decided_at,
    DROP COLUMN IF EXISTS walkout_decided_by,
    DROP COLUMN IF EXISTS walkout_decision,
    DROP COLUMN IF EXISTS walkout_amount,
    DROP COLUMN IF EXISTS walkout_at,
    DROP COLUMN IF EXISTS walkout_marked_by;
ALTER TABLE orders DROP COLUMN IF EXISTS remake_of;
ALTER TABLE order_items DROP COLUMN IF EXISTS removed_at;
DROP TABLE IF EXISTS order_problems;
DROP TYPE IF EXISTS walkout_decision;
DROP TYPE IF EXISTS fault;
DROP TYPE IF EXISTS problem_decision;
DROP TYPE IF EXISTS problem_reason;
