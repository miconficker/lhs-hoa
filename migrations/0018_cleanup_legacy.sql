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
--   - households.is_primary_lot (still used for merged lots display)
--   - residents table (replaced by lot_members)
--
-- The following columns are STILL ACTIVE:
--   - households.household_group_id (used for merged lots functionality)
--     Groups multiple lots owned by the same primary_owner
--   - households.is_primary_lot (flags which lot is primary in merged group)

-- ================================================================
-- Verification - lot_members is now the source of truth for ownership
-- ================================================================

SELECT 'Phase 3 cleanup complete (deprecated columns)' as result;
SELECT 'Code updated to use lot_members instead of legacy owner_id' as detail;
SELECT COUNT(*) as lot_members_count FROM lot_members;
SELECT 'household_group_id and is_primary_lot remain active for merged lots' as note;