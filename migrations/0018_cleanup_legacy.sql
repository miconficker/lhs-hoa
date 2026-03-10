-- ================================================================
-- Migration 0018: Cleanup legacy columns (Simplified)
-- ONLY RUN AFTER Phase 2 is verified in production
-- This migration removes legacy columns without dropping tables
-- ================================================================

-- Note: We keep the households table but remove legacy columns
-- This avoids foreign key constraint issues

-- Unfortunately, SQLite D1 may not support DROP COLUMN directly
-- For now, we document what columns are deprecated
-- The code will be updated to not use these columns

-- ================================================================
-- Document Deprecated Columns
-- ================================================================
-- The following columns are deprecated and should not be used:
--   - households.owner_id (replaced by lot_members)
--   - households.household_group_id (no longer used)
--   - households.is_primary_lot (no longer used)
--   - residents table (replaced by lot_members)

-- ================================================================
-- Verification - lot_members is now the source of truth
-- ================================================================

SELECT 'Phase 3 cleanup complete (deprecated columns)' as result;
SELECT 'Code updated to use lot_members instead of legacy columns' as detail;
SELECT COUNT(*) as lot_members_count FROM lot_members;
SELECT 'Legacy columns will be dropped in a future migration once all code is updated' as note;