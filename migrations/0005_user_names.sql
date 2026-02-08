-- migrations/0005_user_names.sql
-- Add first and last name to users table
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;

-- Seed existing users from residents (if primary resident exists)
UPDATE users
SET first_name = (
  SELECT r.first_name FROM residents r
  JOIN households h ON r.household_id = h.id
  WHERE h.owner_id = users.id AND r.is_primary = 1
  LIMIT 1
),
last_name = (
  SELECT r.last_name FROM residents r
  JOIN households h ON r.household_id = h.id
  WHERE h.owner_id = users.id AND r.is_primary = 1
  LIMIT 1
);
