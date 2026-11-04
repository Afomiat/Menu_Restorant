-- Today's roles map onto the Pro roles: owner becomes manager, kitchen becomes chef.
-- The old values stay in the type, unused.
UPDATE users SET role = 'manager' WHERE role = 'owner';
UPDATE users SET role = 'chef' WHERE role = 'kitchen';
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'manager';

-- Staff accounts: a name for alerts and reports, a phone to log in with, and a switch
-- to turn off someone who left without deleting their history.
ALTER TABLE users ADD COLUMN full_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL);

-- Staff log in with their phone at their own restaurant, so a phone is unique per restaurant
CREATE UNIQUE INDEX users_tenant_phone_key ON users (tenant_id, phone) WHERE phone IS NOT NULL;

-- Who did what: every staff action in a restaurant, recorded under the person who did it
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_activity_log_tenant_created ON activity_log (tenant_id, created_at DESC);
