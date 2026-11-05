-- Pro plan: problems with dishes, walkouts, and web push for locked phones.
CREATE TYPE problem_reason AS ENUM ('cold', 'wrong_dish', 'undercooked', 'too_slow', 'foreign_object', 'other');
CREATE TYPE problem_decision AS ENUM ('remake', 'remove_from_bill');
CREATE TYPE fault AS ENUM ('kitchen', 'waiter', 'none');
CREATE TYPE walkout_decision AS ENUM ('waiter_pays', 'restaurant_loss');

-- A problem reported on one dish; the manager decides remake or remove, and who was at fault
CREATE TABLE order_problems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    reason problem_reason NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    decision problem_decision,
    fault fault,
    decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    decided_at TIMESTAMP WITH TIME ZONE,
    -- Removed dishes keep their value here for the losses report
    removed_amount NUMERIC(10, 2),
    remake_order_id UUID REFERENCES orders(id) ON DELETE SET NULL
);
CREATE INDEX idx_order_problems_tenant ON order_problems (tenant_id, reported_at DESC);

-- A dish taken off the bill; its price is taken off its order's total
ALTER TABLE order_items ADD COLUMN removed_at TIMESTAMP WITH TIME ZONE;
-- A remake points at the order it replaces, so the kitchen shows it first
ALTER TABLE orders ADD COLUMN remake_of UUID REFERENCES orders(id) ON DELETE SET NULL;

-- Walkouts: who marked it, what was owed, and the manager's decision
ALTER TABLE bills
    ADD COLUMN walkout_marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN walkout_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN walkout_amount NUMERIC(10, 2),
    ADD COLUMN walkout_decision walkout_decision,
    ADD COLUMN walkout_decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN walkout_decided_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN walkout_note TEXT NOT NULL DEFAULT '';

-- Web push keys from each staff member's browser, so locked phones still get alerts
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);
