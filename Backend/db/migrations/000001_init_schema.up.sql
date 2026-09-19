-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE plan_tier AS ENUM ('standard', 'vip', 'enterprise');
CREATE TYPE user_role AS ENUM ('super_admin', 'owner', 'manager', 'kitchen', 'waiter');
CREATE TYPE order_status AS ENUM ('pending_grace', 'not_started', 'preparing', 'ready', 'delivered', 'cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');

-- 1. Tenants (Restaurants)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    plan plan_tier DEFAULT 'standard' NOT NULL,
    currency VARCHAR(10) DEFAULT 'ETB' NOT NULL,
    theme_config JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- 2. Users (Staff / Owners)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'owner' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- 3. Restaurant Tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    table_number VARCHAR(20) NOT NULL,
    qr_secret VARCHAR(64) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    UNIQUE(tenant_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_tables_tenant ON restaurant_tables(tenant_id);

-- 4. Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);

-- 5. Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT DEFAULT '' NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    image_url TEXT DEFAULT '' NOT NULL,
    tags TEXT[] DEFAULT '{}' NOT NULL,
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    is_sold_out BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_items_tenant ON menu_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

-- 6. Modifier Groups
CREATE TABLE IF NOT EXISTS modifier_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    min_selections INT DEFAULT 0 NOT NULL,
    max_selections INT DEFAULT 1 NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mod_groups_tenant ON modifier_groups(tenant_id);

-- 7. Item Modifier Groups Bridge (Many-to-Many)
CREATE TABLE IF NOT EXISTS item_modifier_groups (
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_item_id, modifier_group_id)
);

-- 8. Modifiers (Options inside a group)
CREATE TABLE IF NOT EXISTS modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_adjustment NUMERIC(10, 2) DEFAULT 0.00 NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_modifiers_group ON modifiers(modifier_group_id);

-- 9. Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    table_number VARCHAR(20) NOT NULL,
    customer_session_token VARCHAR(128) NOT NULL,
    status order_status DEFAULT 'pending_grace' NOT NULL,
    payment_status payment_status DEFAULT 'unpaid' NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    grace_period_ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 10. Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name VARCHAR(150) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL,
    notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 11. Order Item Modifiers
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_id UUID REFERENCES modifiers(id) ON DELETE SET NULL,
    modifier_name VARCHAR(100) NOT NULL,
    price_applied NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_item_mods ON order_item_modifiers(order_item_id);
