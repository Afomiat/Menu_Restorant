ALTER TYPE plan_tier RENAME VALUE 'basic' TO 'standard';
ALTER TYPE plan_tier RENAME VALUE 'plus' TO 'vip';
ALTER TYPE plan_tier RENAME VALUE 'pro' TO 'enterprise';

ALTER TABLE tenants ALTER COLUMN plan SET DEFAULT 'standard';
