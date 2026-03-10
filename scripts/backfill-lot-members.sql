-- ================================================================
-- Phase 2 Backfill Script
-- Migrate existing ownership data to lot_members table
-- Run this after Phase 1 is verified in production
-- ================================================================

-- Verify counts before backfill
SELECT '=== Current state (before backfill) ===' as step;
SELECT
  (SELECT COUNT(*) FROM households WHERE owner_id IS NOT NULL AND lot_type IN ('residential','resort','commercial')) AS current_primary_owners,
  (SELECT COUNT(*) FROM residents WHERE user_id IS NOT NULL AND is_primary = 0) AS current_secondary_members;

-- Backfill primary owners from households.owner_id → lot_members
-- Each becomes a verified primary_owner
INSERT OR IGNORE INTO lot_members
  (id, household_id, user_id, member_type, can_vote,
   verified, verified_at, notes, created_at)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(6))),
  h.id,
  h.owner_id,
  'primary_owner',
  1,
  1,
  h.created_at,
  'Migrated from households.owner_id',
  CURRENT_TIMESTAMP
FROM households h
WHERE h.owner_id IS NOT NULL
  AND h.lot_type IN ('residential','resort','commercial');

-- Backfill secondary members from residents table
-- Non-primary residents with user accounts become secondary members
INSERT OR IGNORE INTO lot_members
  (id, household_id, user_id, member_type, can_vote,
   verified, verified_at, notes, created_at)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(6))),
  r.household_id,
  r.user_id,
  'secondary',
  0,
  1,
  r.created_at,
  'Migrated from residents table',
  CURRENT_TIMESTAMP
FROM residents r
WHERE r.user_id IS NOT NULL
  AND r.is_primary = 0;

-- Verification queries after backfill
SELECT '=== Verification after backfill ===' as step;

-- 1. Check lot_members counts
SELECT
  (SELECT COUNT(*) FROM lot_members WHERE member_type = 'primary_owner') AS backfilled_primary,
  (SELECT COUNT(*) FROM lot_members WHERE member_type = 'secondary') AS backfilled_secondary;

-- 2. Verify all primary_owners have can_vote = 1 and verified = 1
SELECT COUNT(*) AS primary_issues FROM lot_members
WHERE member_type = 'primary_owner'
  AND (can_vote != 1 OR verified != 1);
-- Should return 0

-- 3. Verify no community/utility/open_space lots were migrated
SELECT COUNT(*) AS community_issues FROM lot_members lm
JOIN households h ON lm.household_id = h.id
WHERE h.lot_type IN ('community', 'utility', 'open_space');
-- Should return 0

-- 4. Show sample of migrated data
SELECT '=== Sample migrated data ===' as step;
SELECT
  h.block,
  h.lot,
  h.address,
  h.lot_type,
  u.email,
  lm.member_type,
  lm.can_vote,
  lm.verified,
  lm.notes
FROM lot_members lm
JOIN households h ON lm.household_id = h.id
JOIN users u ON lm.user_id = u.id
LIMIT 10;
