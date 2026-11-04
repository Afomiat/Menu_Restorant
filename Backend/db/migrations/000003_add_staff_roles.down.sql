-- Postgres cannot remove enum values; 'cashier' and 'chef' stay in the type, unused
-- once 000004 is rolled back.
SELECT 1;
