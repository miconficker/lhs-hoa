# Phase 3 Safety Checklist

> **STOP** - Do not proceed with Phase 3 until all items are checked.

## Pre-Phase 3 Requirements

- [ ] **Phase 1 deployed to production** - `lot_members` table exists
- [ ] **Phase 2 backfill run on production** - All ownership data migrated
- [ ] **Verification queries pass** - Row counts match expected totals
- [ ] **All features tested** - Voting, access control, household features work
- [ ] **Minimum 1 week stable** - No issues reported from Phase 1+2 changes
- [ ] **Full backup created** - Database dump saved (see below)
- [ ] **Rollback plan documented** - Team knows how to revert if needed

## Backup Procedure

### 1. Cloudflare D1 Backup

```bash
# Export all data to SQL file
npx wrangler d1 export laguna_hills_hoa --output=backups/pre-phase3-$(date +%Y%m%d).sql

# Verify backup file exists
ls -lh backups/pre-phase3-*.sql
```

### 2. Verification Backup

Run `scripts/verify-phase3-ready.sql` to confirm data integrity:

```sql
-- Expected outputs before Phase 3:
-- 1. lot_members has data (migrated from Phase 2)
SELECT COUNT(*) FROM lot_members;
-- Expected: > 0

-- 2. All primary_owners have can_vote = 1
SELECT COUNT(*) FROM lot_members
WHERE member_type = 'primary_owner' AND (can_vote != 1 OR verified != 1);
-- Expected: 0

-- 3. No community lots in lot_members
SELECT COUNT(*) FROM lot_members lm
JOIN households h ON lm.household_id = h.id
WHERE h.lot_type IN ('community', 'utility', 'open_space');
-- Expected: 0

-- 4. Legacy data still intact (for rollback)
SELECT COUNT(*) FROM households WHERE owner_id IS NOT NULL;
-- Expected: Same count as lot_members primary_owner

-- 5. residents table still exists
SELECT COUNT(*) FROM residents WHERE user_id IS NOT NULL;
-- Expected: Same as lot_members secondary count
```

Save outputs to `backups/pre-phase3-verification-$(date +%Y%m%d).txt`

### 3. Backup Locations

- **Local**: `backups/pre-phase3-YYYYMMDD.sql`
- **Cloudflare**: Automatic backups (verify retention policy)
- **Git**: Migration scripts are version controlled

## Rollback Plan

If Phase 3 causes issues:

### Option A: Restore from Backup (Clean)

```bash
# Drop new schema
npx wrangler d1 execute laguna_hills_hoa --local --command="DROP TABLE IF EXISTS households_new;"
npx wrangler d1 execute laguna_hills_hoa --local --command="DROP TABLE IF EXISTS residents;"

# Restore from backup (manual process via Cloudflare dashboard or API)
# Contact Cloudflare support for D1 restore if needed
```

### Option B: Recreate Legacy Columns (Partial)

```sql
-- Recreate households.owner_id from lot_members
ALTER TABLE households ADD COLUMN owner_id TEXT REFERENCES users(id);

UPDATE households
SET owner_id = (SELECT user_id FROM lot_members
                WHERE household_id = households.id
                  AND member_type = 'primary_owner'
                  AND verified = 1 LIMIT 1);

-- Recreate residents table from lot_members secondary members
CREATE TABLE residents (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  user_id TEXT REFERENCES users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO residents
SELECT
  lower(hex(randomblob(4))),
  household_id,
  user_id,
  u.first_name,
  u.last_name,
  0,
  lm.created_at
FROM lot_members lm
JOIN users u ON lm.user_id = u.id
WHERE lm.member_type = 'secondary';
```

## Phase 3 Execution Steps

1. **Create backup** (above)
2. **Run verification** - confirm all checks pass
3. **Deploy Phase 3 migration** - `migrations/0018_cleanup_legacy.sql`
4. **Test all features** - voting, access control, reservations, payments
5. **Monitor for 1 week** - watch for issues
6. **Clean up code** - remove transitional dual-write code

## Emergency Contacts

- **Database Owner**: [Name]
- **Cloudflare Support**: https://developers.cloudflare.com/d1/
- **Rollback Decision**: [Who decides to roll back?]

---

**Signed off by**: ____________________
**Date**: ____________________
**Backup Location**: ____________________
