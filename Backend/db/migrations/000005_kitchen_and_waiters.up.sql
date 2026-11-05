-- Restaurant settings for the Pro plan: default prep time and reminder times, in minutes.
-- Missing keys use the defaults in the code.
ALTER TABLE tenants ADD COLUMN settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- How long a dish takes; empty means the restaurant's default prep time
ALTER TABLE menu_items ADD COLUMN prep_minutes INT CHECK (prep_minutes BETWEEN 1 AND 240);

-- The waiter who looks after a table; empty sends the table's waiter alerts to the managers
ALTER TABLE restaurant_tables ADD COLUMN assigned_waiter_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Who started, readied and served each order and when; the target is fixed when the order is placed
ALTER TABLE orders
    ADD COLUMN target_minutes INT,
    ADD COLUMN started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN started_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN ready_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN ready_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN served_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN served_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN very_late_alerted_at TIMESTAMP WITH TIME ZONE;

-- The background check looks for cooking orders
CREATE INDEX idx_orders_preparing ON orders (started_at) WHERE status = 'preparing';
