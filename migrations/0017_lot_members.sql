-- ================================================================
-- Migration 0017: lot_members table + users.profile_complete
-- ADDITIVE ONLY — no existing tables or columns modified
-- Safe to run immediately on production
-- ================================================================

-- 1. Add profile_complete to users table
ALTER TABLE users ADD COLUMN profile_complete BOOLEAN NOT NULL DEFAULT 0;

-- Backfill: mark existing users complete if they have name + phone
UPDATE users
   SET profile_complete = 1
 WHERE first_name IS NOT NULL
   AND last_name  IS NOT NULL
   AND phone      IS NOT NULL;

-- 2. Create lot_members table (new unified ownership/access table)
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

-- Indexes for common query patterns
CREATE INDEX idx_lot_members_household ON lot_members(household_id);
CREATE INDEX idx_lot_members_user       ON lot_members(user_id);
CREATE INDEX idx_lot_members_verified   ON lot_members(verified, member_type);
