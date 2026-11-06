-- Plans are now Basic, Plus and Pro. Renaming the values in place keeps every
-- restaurant on the plan it already has.
ALTER TYPE plan_tier RENAME VALUE 'standard' TO 'basic';
ALTER TYPE plan_tier RENAME VALUE 'vip' TO 'plus';
ALTER TYPE plan_tier RENAME VALUE 'enterprise' TO 'pro';

ALTER TABLE tenants ALTER COLUMN plan SET DEFAULT 'basic';
