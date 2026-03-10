-- ================================================================
-- Pre-Phase 3 Verification Script
-- Run this BEFORE executing Phase 3 cleanup migration
-- Save the output as evidence of system state
-- ================================================================

.mode column
.headers on
.timer on

SELECT '=== PRE-PHASE 3 VERIFICATION ===' as phase;
SELECT datetime('now') as verification_timestamp;

-- ================================================================
-- 1. Verify lot_members table exists and has data
-- ================================================================
SELECT '1. lot_members table exists and has data' as check;
SELECT COUNT(*) as lot_members_count FROM lot_members;

-- Expected: > 0 (should equal primary + secondary members)

-- ================================================================
-- 2. Verify primary_owner data integrity
-- ================================================================
SELECT '2. All primary_owners have correct flags' as check;
SELECT
  COUNT(*) as total_primary_owners,
  SUM(CASE WHEN can_vote = 1 THEN 1 ELSE 0 END) as with_can_vote,
  SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified,
  SUM(CASE WHEN can_vote = 1 AND verified = 1 THEN 1 ELSE 0 END) as correct_flags
FROM lot_members
WHERE member_type = 'primary_owner';

-- Expected: All 4 columns should have same number

-- ================================================================
-- 3. Verify no community lots migrated
-- ================================================================
SELECT '3. No community/utility/open_space in lot_members' as check;
SELECT
  h.lot_type,
  COUNT(*) as count
FROM lot_members lm
JOIN households h ON lm.household_id = h.id
WHERE h.lot_type IN ('community', 'utility', 'open_space')
GROUP BY h.lot_type;

-- Expected: 0 rows

-- ================================================================
-- 4. Compare with legacy data (for rollback safety)
-- ================================================================
SELECT '4. Legacy data still intact (for rollback)' as check;

-- households.owner_id should match lot_members primary_owner count
SELECT
  (SELECT COUNT(*) FROM households WHERE owner_id IS NOT NULL AND lot_type IN ('residential','resort','commercial')) as households_with_owner,
  (SELECT COUNT(*) FROM lot_members WHERE member_type = 'primary_owner') as lot_members_primary;

-- Expected: Numbers should be equal or lot_members >= households (some may not be migrated yet)

-- residents table should still exist
SELECT COUNT(*) as residents_count FROM residents WHERE user_id IS NOT NULL;

-- ================================================================
-- 5. Vote count calculation test
-- ================================================================
SELECT '5. Vote count calculation test' as check;

-- Count votes using new method
SELECT COUNT(*) as votes_using_lot_members
FROM lot_members lm
JOIN households h ON lm.household_id = h.id
WHERE lm.member_type = 'primary_owner'
  AND lm.can_vote = 1
  AND lm.verified = 1
  AND h.lot_type NOT IN ('community', 'utility', 'open_space');

-- ================================================================
-- 6. Access control test
-- ================================================================
SELECT '6. Sample household members with names' as check;
SELECT
  h.block,
  h.lot,
  h.address,
  u.email,
  lm.member_type,
  lm.can_vote,
  lm.verified
FROM lot_members lm
JOIN households h ON lm.household_id = h.id
JOIN users u ON lm.user_id = u.id
ORDER BY h.block, h.lot, lm.member_type DESC
LIMIT 10;

-- ================================================================
-- 7. Schema verification (columns that will be dropped)
-- ================================================================
SELECT '7. Legacy columns still exist (will be dropped)' as check;
PRAGMA table_info(households);

-- Look for: owner_id, household_group_id, is_primary_lot
-- These should exist NOW but will be dropped in Phase 3

SELECT 'residents table still exists' as check;
SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='residents';

-- Expected: 1 (table exists)

-- ================================================================
-- 8. Data quality checks
-- ================================================================
SELECT '8. Data quality checks' as check;

-- No orphaned lot_members (household doesn't exist)
SELECT 'Orphaned lot_members (should be 0)' as check,
  COUNT(*) as count
FROM lot_members lm
LEFT JOIN households h ON lm.household_id = h.id
WHERE h.id IS NULL;

-- No orphaned lot_members (user doesn't exist)
SELECT 'Orphaned users (should be 0)' as check,
  COUNT(*) as count
FROM lot_members lm
LEFT JOIN users u ON lm.user_id = u.id
WHERE u.id IS NULL;

-- No duplicate primary_owners per household
SELECT 'Duplicate primary_owners (should be 0)' as check,
  COUNT(*) as count
FROM lot_members lm
WHERE member_type = 'primary_owner'
  AND household_id IN (
    SELECT household_id FROM lot_members
    WHERE member_type = 'primary_owner'
    GROUP BY household_id
    HAVING COUNT(*) > 1
  );

-- ================================================================
-- SUMMARY
-- ================================================================
SELECT '=== VERIFICATION COMPLETE ===' as phase;
SELECT 'Review all outputs above before proceeding to Phase 3' as reminder;
SELECT 'Save this output to backups/pre-phase3-verification-YYYYMMDD.txt' as instruction;
