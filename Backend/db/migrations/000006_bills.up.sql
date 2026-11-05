-- Pro plan bills: each table has one bill taking orders; the waiter collects, the cashier confirms.
CREATE TYPE bill_status AS ENUM ('open', 'bill_requested', 'collected', 'confirmed', 'walkout');
CREATE TYPE payment_method AS ENUM ('cash', 'telebirr', 'cbe_birr_bank');

CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    table_number VARCHAR(20) NOT NULL,
    -- The waiter responsible for the bill: the table's waiter when it opened, or who it was handed to
    waiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status bill_status NOT NULL DEFAULT 'open',
    requested_at TIMESTAMP WITH TIME ZONE,
    collected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    collected_at TIMESTAMP WITH TIME ZONE,
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    -- When each reminder or alert went out, so each goes out once
    reminded_at TIMESTAMP WITH TIME ZONE,
    escalated_at TIMESTAMP WITH TIME ZONE,
    confirm_reminded_at TIMESTAMP WITH TIME ZONE,
    long_open_reminded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- One bill taking orders per table. A collected bill no longer takes orders: new customers start a new bill.
CREATE UNIQUE INDEX bills_one_active_per_table ON bills (tenant_id, table_number) WHERE status IN ('open', 'bill_requested');
CREATE INDEX idx_bills_tenant_status ON bills (tenant_id, status);

-- Money taken for a bill; several payments allow part payment and mixed methods
CREATE TABLE bill_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    method payment_method NOT NULL,
    -- Telebirr / CBE transaction id, so the cashier can check the SMS
    reference VARCHAR(64) NOT NULL DEFAULT '',
    collected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_bill_payments_bill ON bill_payments (bill_id);

ALTER TABLE orders ADD COLUMN bill_id UUID REFERENCES bills(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_bill ON orders (bill_id);
ALTER TABLE activity_log ADD COLUMN bill_id UUID REFERENCES bills(id) ON DELETE SET NULL;

-- Staff shifts: a waiter cannot end a shift while they still hold unpaid bills
CREATE TABLE staff_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX staff_shifts_one_open ON staff_shifts (user_id) WHERE ended_at IS NULL;
