-- migrations/0006_household_grouping.sql
-- Add household grouping for merged lots
ALTER TABLE households ADD COLUMN household_group_id TEXT;
ALTER TABLE households ADD COLUMN is_primary_lot BOOLEAN DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_household_group ON households(household_group_id);
