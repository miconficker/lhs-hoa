# Lot Members Migration Design

**Date:** 2026-03-10
**Status:** Approved
**Approach:** Sequential (Phase 1 → Phase 2 → Phase 3)

---

## Overview

This design implements a new ownership and access control system for the Laguna Hills HOA platform. The current model has two separate mechanisms for household access (`households.owner_id` and the `residents` table), which causes confusion and makes authorization logic complex.

The new `lot_members` table unifies ownership and access into a single source of truth, with explicit verification workflow and clear role distinctions.

---

## Current State

### Existing Tables

```sql
-- households table (master lot registry)
CREATE TABLE households (
  id                 TEXT     PRIMARY KEY,
  address            TEXT     NOT NULL,
  owner_id           TEXT     REFERENCES users(id),  -- legacy, to be deprecated
  lot_status         TEXT     DEFAULT 'vacant_lot',
  lot_type           TEXT     DEFAULT 'residential',
  -- ... other fields
);

-- residents table (to be deprecated)
CREATE TABLE residents (
  id            TEXT    PRIMARY KEY,
  household_id  TEXT    NOT NULL REFERENCES households(id),
  user_id       TEXT    REFERENCES users(id),
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  is_primary   BOOLEAN  DEFAULT 0
);

-- users table
CREATE TABLE users (
  id            TEXT    PRIMARY KEY,
  email         TEXT    UNIQUE NOT NULL,
  role          TEXT    NOT NULL,
  phone         TEXT,
  first_name    TEXT,
  last_name     TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Current Access Control Pattern

The system checks access via two separate paths:
1. `households.owner_id = userId` (direct ownership)
2. `residents.user_id = userId` (resident membership)

This dual-path approach is scattered throughout the codebase and has no verification workflow.

---

## Target State

### New Table: lot_members

```sql
CREATE TABLE lot_members (
  id            TEXT     PRIMARY KEY,
  household_id  TEXT     NOT NULL REFERENCES households(id),
  user_id       TEXT     NOT NULL REFERENCES users(id),
  member_type   TEXT     NOT NULL
                CHECK(member_type IN ('primary_owner','secondary')),
  can_vote      BOOLEAN  NOT NULL DEFAULT 0,
  verified      BOOLEAN  NOT NULL DEFAULT 0,
  verified_at   DATETIME,
  verified_by   TEXT     REFERENCES users(id),
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, user_id)
);

CREATE INDEX idx_lot_members_household ON lot_members(household_id);
CREATE INDEX idx_lot_members_user       ON lot_members(user_id);
CREATE INDEX idx_lot_members_verified   ON lot_members(verified, member_type);
```

### Updated Users Table

```sql
ALTER TABLE users ADD COLUMN profile_complete BOOLEAN NOT NULL DEFAULT 0;
```

---

## Phase 1: Additive Only

**Goal:** Create new structures without modifying existing data.

### Migration: `migrations/0017_lot_members.sql`

```sql
-- Add profile_complete to users
ALTER TABLE users ADD COLUMN profile_complete BOOLEAN NOT NULL DEFAULT 0;

UPDATE users SET profile_complete = 1
 WHERE first_name IS NOT NULL
   AND last_name  IS NOT NULL
   AND phone      IS NOT NULL;

-- Create lot_members table
CREATE TABLE lot_members (
  id            TEXT     PRIMARY KEY,
  household_id  TEXT     NOT NULL REFERENCES households(id),
  user_id       TEXT     NOT NULL REFERENCES users(id),
  member_type   TEXT     NOT NULL
                CHECK(member_type IN ('primary_owner','secondary')),
  can_vote      BOOLEAN  NOT NULL DEFAULT 0,
  verified      BOOLEAN  NOT NULL DEFAULT 0,
  verified_at   DATETIME,
  verified_by   TEXT     REFERENCES users(id),
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, user_id)
);

CREATE INDEX idx_lot_members_household ON lot_members(household_id);
CREATE INDEX idx_lot_members_user       ON lot_members(user_id);
CREATE INDEX idx_lot_members_verified   ON lot_members(verified, member_type);
```

### New API Routes

**File:** `functions/routes/lot-members.ts`

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/api/lot-members/my` | Get current user's memberships | Authenticated |
| GET | `/api/lot-members/household/:id` | Get all members of a household | Authenticated (members only) |
| POST | `/api/admin/lot-members` | Create membership | Admin |
| PUT | `/api/admin/lot-members/:id/verify` | Verify ownership | Admin |
| DELETE | `/api/admin/lot-members/:id` | Remove membership | Admin |

### Access Control Helper

**File:** `functions/lib/lot-access.ts`

```typescript
export async function canAccessHousehold(
  userId: string,
  householdId: string,
  env: Env
): Promise<boolean> {
  // Check lot_members first (new)
  const member = await env.db.lot_members.findFirst({
    where: {
      user_id: userId,
      household_id: householdId,
      verified: 1
    }
  });
  if (member) return true;

  // Fall back to legacy checks during transition
  const household = await env.db.households.findFirst({
    where: { id: householdId }
  });
  if (household?.owner_id === userId) return true;

  const resident = await env.db.residents.findFirst({
    where: { user_id: userId, household_id: householdId }
  });
  return !!resident;
}
```

### Admin UI Components

**New files in `src/components/admin/lots/`:**

| Component | Purpose |
|-----------|---------|
| `LotsManagementPage.tsx` | Main lots management page |
| `LotMembersList.tsx` | Display all members of a household |
| `AssignMemberDialog.tsx` | Add primary owner or secondary member |
| `VerifyMemberDialog.tsx` | Verify ownership with notes |

### Frontend API Client

**File:** `src/lib/api.ts`

```typescript
export const lotMembersApi = {
  getMyMemberships: () => api.get('/lot-members/my'),
  getHouseholdMembers: (id: string) => api.get(`/lot-members/household/${id}`),
  assignMember: (data: AssignMemberDto) => api.post('/admin/lot-members', data),
  verifyMember: (id: string, notes?: string) => api.put(`/admin/lot-members/${id}/verify`, { notes }),
  removeMember: (id: string) => api.delete(`/admin/lot-members/${id}`)
};
```

---

## Phase 2: Data Backfill

**Goal:** Migrate existing ownership data to `lot_members`. Runs after Phase 1 is verified in production.

### Backfill Script

```sql
-- Backfill primary owners from households.owner_id
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

-- Backfill secondary members from residents
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
```

### Verification Queries

```sql
-- Verify row counts
SELECT
  (SELECT COUNT(*) FROM lot_members WHERE member_type = 'primary_owner') AS primary_count,
  (SELECT COUNT(*) FROM households WHERE owner_id IS NOT NULL AND lot_type IN ('residential','resort','commercial')) AS expected_primary,
  (SELECT COUNT(*) FROM lot_members WHERE member_type = 'secondary') AS secondary_count,
  (SELECT COUNT(*) FROM residents WHERE user_id IS NOT NULL AND is_primary = 0) AS expected_secondary;

-- Verify no community lots were migrated
SELECT COUNT(*) FROM lot_members lm
JOIN households h ON lm.household_id = h.id
WHERE h.lot_type IN ('community', 'utility', 'open_space');
-- Should return 0
```

### API Updates (Phase 2)

| Feature | File | Change |
|---------|------|--------|
| Poll voting | `functions/routes/polls.ts` | Use `lot_members` for vote count |
| My Lots page | `functions/routes/lots.ts` | Query via `lot_members` |
| Access control | `functions/lib/lot-access.ts` | Primary check through `lot_members` |
| Ownership assignment | `functions/routes/admin/lots.ts` | Write to both `owner_id` and `lot_members` |

---

## Phase 3: Cleanup

**Goal:** Remove legacy columns and tables after Phase 2 is verified.

### Columns to Drop

**From `households` table:**
- `owner_id`
- `household_group_id`
- `is_primary_lot`

### Tables to Drop

- `residents`

### Cleanup Migration

```sql
-- SQLite doesn't support DROP COLUMN directly
-- Recreate households without legacy columns
CREATE TABLE households_new (
  id                 TEXT     PRIMARY KEY,
  address            TEXT     NOT NULL,
  street             TEXT,
  block              TEXT,
  lot                TEXT,
  latitude           REAL,
  longitude          REAL,
  map_marker_x       REAL,
  map_marker_y       REAL,
  lot_status         TEXT     DEFAULT 'vacant_lot'
                     CHECK(lot_status IN ('built','vacant_lot','under_construction')),
  lot_type           TEXT     DEFAULT 'residential'
                     CHECK(lot_type IN ('residential','resort','commercial',
                                        'community','utility','open_space')),
  lot_size_sqm       REAL,
  lot_label          TEXT,
  lot_description    TEXT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO households_new SELECT
  id, address, street, block, lot, latitude, longitude,
  map_marker_x, map_marker_y, lot_status, lot_type,
  lot_size_sqm, lot_label, lot_description, created_at
FROM households;

DROP TABLE households;
ALTER TABLE households_new RENAME TO households;

-- Recreate indexes
CREATE INDEX idx_households_owner      ON households(owner_id);
CREATE INDEX idx_households_block_lot  ON households(block, lot);
CREATE INDEX idx_households_street     ON households(street);

-- Drop residents table
DROP TABLE residents;
```

---

## Business Rules

### Ownership Assignment

- Only one `primary_owner` per `household_id` at any time
- `can_vote = 1` only when `member_type = 'primary_owner'` AND `verified = 1`
- Ownership only assignable to `lot_type IN ('residential', 'resort', 'commercial')`
- Community/utility/open_space lots are never assignable

### Ownership States

| State | Definition | User Access |
|-------|------------|-------------|
| UNOWNED | No `lot_members` row | Admin only |
| PENDING | `lot_members` row with `verified = 0` | Read-only |
| OWNED | `lot_members` row with `verified = 1` | Full access per role |

### Permission Matrix

| Action | Primary Owner (verified) | Secondary (verified) | Pending | Admin |
|--------|-------------------------|---------------------|---------|-------|
| View household | ✅ | ✅ | Read-only | ✅ |
| Service requests | ✅ | ✅ | ❌ | ✅ |
| Payments | ✅ | ✅ | ❌ | ✅ |
| Reservations | ✅ | ✅ | ❌ | ✅ |
| Vehicle passes | ✅ | ✅ | ❌ | ✅ |
| Employee passes | ✅ | ✅ | ❌ | ✅ |
| Vote | ✅ (1 per lot) | ❌ | ❌ | ✅ |
| Dues notifications | ✅ | ❌ | ❌ | ✅ |

---

## Database Queries

### Get All Lots for a User

```sql
SELECT h.block, h.lot, h.address, h.lot_type, h.lot_status, lm.verified
  FROM lot_members lm
  JOIN households h ON lm.household_id = h.id
 WHERE lm.user_id     = :user_id
   AND lm.member_type = 'primary_owner';
```

### Count User Votes

```sql
SELECT COUNT(*) AS eligible_vote_count
  FROM lot_members lm
  JOIN households h ON lm.household_id = h.id
 WHERE lm.user_id     = :user_id
   AND lm.member_type = 'primary_owner'
   AND lm.can_vote    = 1
   AND lm.verified    = 1
   AND h.lot_type NOT IN ('community','utility','open_space');
```

### Get Household Members

```sql
SELECT u.first_name, u.last_name, u.email,
       lm.member_type, lm.can_vote, lm.verified
  FROM lot_members lm
  JOIN users u ON lm.user_id = u.id
 WHERE lm.household_id = :household_id;
```

### Unassigned Assignable Lots (Admin)

```sql
SELECT h.block, h.lot, h.address, h.lot_status
  FROM households h
 WHERE h.lot_type IN ('residential','resort','commercial')
   AND NOT EXISTS (
       SELECT 1 FROM lot_members lm
        WHERE lm.household_id = h.id
          AND lm.member_type  = 'primary_owner'
          AND lm.verified     = 1
   )
 ORDER BY h.block, h.lot;
```

---

## Deployment Strategy

### Phase 1 Deployment

1. Run migration `0017_lot_members.sql` locally
2. Deploy to production (additive only, zero risk)
3. Deploy new API endpoints
4. Deploy admin UI components
5. Test with manual lot assignments
6. **Gate:** Confirm `lot_members` table works correctly

### Phase 2 Deployment

1. Run backfill script on production
2. Verify row counts match expected totals
3. Deploy updated API queries (voting, my-lots, access control)
4. Test voting and access control
5. **Gate:** Confirm all features work with `lot_members`

### Phase 3 Deployment

1. Confirm Phase 2 is stable in production (minimum 1 week)
2. Run cleanup migration
3. Remove transitional dual-write code
4. Final verification test

---

## Testing Strategy

### Phase 1 Testing

- Create `lot_members` entries manually via admin UI
- Verify access control helper returns correct results
- Test both new (`lot_members`) and legacy (`owner_id`, `residents`) paths

### Phase 2 Testing

- Run backfill on staging database
- Verify counts: `lot_members.primary_owner` == `households.owner_id`
- Test voting with migrated data
- Test my-lots page displays correctly
- Verify no community lots appear in ownership

### Phase 3 Testing

- Verify all queries still work after `owner_id` is dropped
- Verify `residents` table removal doesn't break anything
- Full regression test of all household-dependent features

---

## Rollback Plan

### Phase 1 Rollback

- Drop `lot_members` table (no data loss)
- Remove `profile_complete` column from users

### Phase 2 Rollback

- Delete backfilled rows from `lot_members`
- Legacy data remains intact in `households.owner_id` and `residents`

### Phase 3 Rollback

- Restore from pre-Phase 3 backup (required before cleanup)
- Recreate dropped columns/tables from backup

---

## Success Criteria

- [ ] Phase 1: `lot_members` table created, admin UI functional
- [ ] Phase 2: All existing ownership migrated correctly
- [ ] Phase 2: Voting counts match expected totals
- [ ] Phase 2: All household features work with new access control
- [ ] Phase 3: Legacy columns/tables dropped without issues
- [ ] Final: All tests pass, no regressions

---

## References

- Original spec: User-provided "Laguna Hills HOA — Definitive Data Model Plan v1.0"
- Current migrations: `migrations/0001_base_schema.sql` through `migrations/0016_board_members.sql`
- Access control patterns: `functions/lib/auth.ts`
- Admin panel: `src/pages/AdminPanel.tsx`
