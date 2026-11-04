-- Sample data for the LOCAL development database only (make seed). Never run against Supabase.
-- One restaurant per plan, with staff, tables, categories and dishes.
-- Every staff account uses the password: password123

BEGIN;

DELETE FROM users WHERE email LIKE '%@azai.local';
DELETE FROM tenants WHERE slug IN ('demo-basic', 'demo-plus', 'demo-pro');

INSERT INTO tenants (id, slug, name, plan, theme_config) VALUES
  ('00000000-0000-0000-0000-00000000000b', 'demo-basic', 'Demo Basic Cafe', 'basic',
   '{"template": "classic", "welcomeMessage": "Menu only (Basic plan)"}'),
  ('00000000-0000-0000-0000-00000000000c', 'demo-plus', 'Demo Plus Bistro', 'plus',
   '{"template": "modern", "welcomeMessage": "QR ordering and kitchen screen (Plus plan)"}'),
  ('00000000-0000-0000-0000-00000000000d', 'demo-pro', 'Demo Pro Restaurant', 'pro',
   '{"template": "modern", "welcomeMessage": "Everything in Plus, plus staff tools (Pro plan)"}');

-- Staff sign in with their phone at /<restaurant>/admin, or with their email.
-- bcrypt hash of "password123"
INSERT INTO users (tenant_id, full_name, phone, email, password_hash, role) VALUES
  (NULL, 'Azai Team', NULL, 'superadmin@azai.local', '$2a$10$h1FfJxEZkCmxiqHhuwDuZeeCOu7KHmGYSrgfCTVFrBj3x3VruwkQ6', 'super_admin'),

  ('00000000-0000-0000-0000-00000000000b', 'Meron Tadesse', '+251911300001', 'manager@basic.azai.local', '$2a$10$h1FfJxEZkCmxiqHhuwDuZeeCOu7KHmGYSrgfCTVFrBj3x3VruwkQ6', 'manager'),

  ('00000000-0000-0000-0000-00000000000c', 'Dawit Bekele', '+251911100001', 'manager@plus.azai.local', '$2a$10$h1FfJxEZkCmxiqHhuwDuZeeCOu7KHmGYSrgfCTVFrBj3x3VruwkQ6', 'manager'),
  ('00000000-0000-0000-0000-00000000000c', 'Selam Girma', '+251911100002', 'chef@plus.azai.local', '$2a$10$h1FfJxEZkCmxiqHhuwDuZeeCOu7KHmGYSrgfCTVFrBj3x3VruwkQ6', 'chef'),
  ('00000000-0000-0000-0000-00000000000c', 'Yonas Haile', '+251911100003', 'waiter@plus.azai.local', '$2a$10$h1FfJxEZkCmxiqHhuwDuZeeCOu7KHmGYSrgfCTVFrBj3x3VruwkQ6', 'waiter'),

  ('00000000-0000-0000-0000-00000000000d', 'Hana Alemu', '+251911200001', 'manager@pro.azai.local', '$2a$10$h1FfJxEZkCmxiqHhuwDuZeeCOu7KHmGYSrgfCTVFrBj3x3VruwkQ6', 'manager'),
  ('00000000-0000-0000-0000-00000000000d', 'Liya Mekonnen', '+251911200002', 'cashier@pro.azai.local', '$2a$10$h1FfJxEZkCmxiqHhuwDuZeeCOu7KHmGYSrgfCTVFrBj3x3VruwkQ6', 'cashier'),
  ('00000000-0000-0000-0000-00000000000d', 'Abebe Kebede', '+251911200003', 'waiter@pro.azai.local', '$2a$10$h1FfJxEZkCmxiqHhuwDuZeeCOu7KHmGYSrgfCTVFrBj3x3VruwkQ6', 'waiter'),
  ('00000000-0000-0000-0000-00000000000d', 'Tigist Worku', '+251911200004', 'chef@pro.azai.local', '$2a$10$h1FfJxEZkCmxiqHhuwDuZeeCOu7KHmGYSrgfCTVFrBj3x3VruwkQ6', 'chef'),
  ('00000000-0000-0000-0000-00000000000d', 'Bereket Assefa', '+251911200005', 'waiter2@pro.azai.local', '$2a$10$h1FfJxEZkCmxiqHhuwDuZeeCOu7KHmGYSrgfCTVFrBj3x3VruwkQ6', 'waiter');

-- Tables 1 to 5 in every restaurant
INSERT INTO restaurant_tables (tenant_id, table_number, qr_secret)
SELECT t.id, n::text, 'local'
FROM tenants t, generate_series(1, 5) AS n
WHERE t.slug IN ('demo-basic', 'demo-plus', 'demo-pro');

-- The same Ethiopian menu in every restaurant
WITH cats AS (
  INSERT INTO categories (tenant_id, name, sort_order)
  SELECT t.id, c.name, c.sort_order
  FROM tenants t,
       (VALUES ('Mains', 1), ('Breakfast', 2), ('Drinks', 3)) AS c(name, sort_order)
  WHERE t.slug IN ('demo-basic', 'demo-plus', 'demo-pro')
  RETURNING id, tenant_id, name
)
INSERT INTO menu_items (tenant_id, category_id, name, description, price, tags)
SELECT cats.tenant_id, cats.id, d.name, d.description, d.price, d.tags
FROM cats
JOIN (VALUES
  ('Mains', 'Tibs', 'Sauteed beef with onion, rosemary and green pepper', 450.00, ARRAY['spicy']),
  ('Mains', 'Shiro', 'Chickpea stew served with injera', 220.00, ARRAY['vegan']),
  ('Mains', 'Doro Wat', 'Chicken stew with boiled egg and berbere', 520.00, ARRAY['spicy']),
  ('Breakfast', 'Firfir', 'Shredded injera with spiced butter', 180.00, ARRAY[]::text[]),
  ('Breakfast', 'Chechebsa', 'Flatbread with butter and berbere', 200.00, ARRAY[]::text[]),
  ('Drinks', 'Buna', 'Ethiopian coffee', 60.00, ARRAY[]::text[]),
  ('Drinks', 'Fresh Juice', 'Avocado, mango and papaya layers', 150.00, ARRAY['vegan'])
) AS d(category, name, description, price, tags) ON d.category = cats.name;

COMMIT;
