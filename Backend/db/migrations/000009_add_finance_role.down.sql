-- Postgres cannot remove enum values; 'finance' stays in the type, unused
-- once 000009 is rolled back.
SELECT 1;
