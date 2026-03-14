-- Migration: 0025_unified_bookings.sql
-- Date: 2026-03-14
-- Description: Create unified bookings system with scoped customers table for external guests only
--
-- PREREQUISITE: lot_members Phase 2 backfill must be completed before running this migration
--
-- This migration unifies resident and external bookings into a single `bookings` table
-- while keeping the existing `booking_blocked_dates` table for confirmed slot enforcement.
--
-- Key architectural decisions:
-- - `customers` table: external guests ONLY (not residents)
-- - `bookings` table: unified bookings with either user_id (residents) OR customer_id (guests)
-- - Status workflow: preserves existing inquiry-based flow, extends for residents
-- - booking_blocked_dates: unchanged, still used for confirmed slot enforcement

-- ============================================================================
-- PREREQUISITE CHECK: Abort if lot_members Phase 2 backfill hasn't run
-- ============================================================================
SELECT CASE
  WHEN (SELECT COUNT(*) FROM lot_members WHERE member_type = 'primary_owner') = 0
  THEN RAISE(ABORT, 'lot_members Phase 2 backfill must be completed before running this migration')
END;

-- ============================================================================
-- STEP 1: Create `customers` table for external guests only
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,

  -- Guest identity (split names for all customers)
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,

  -- Google SSO fields
  google_sub TEXT UNIQUE,
  google_picture_url TEXT,

  -- Guest-specific fields
  guest_notes TEXT,

  -- Admin moderation
  is_blacklisted INTEGER DEFAULT 0,
  blacklist_reason TEXT,
  blacklist_date TEXT,

  -- Audit
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_booking_at TEXT,

  -- GDPR compliance for external guests
  created_ip TEXT,
  ip_retained_until TEXT
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_google_sub ON customers(google_sub);
CREATE INDEX idx_customers_blacklisted ON customers(is_blacklisted) WHERE is_blacklisted = 1;

-- ============================================================================
-- STEP 2: Create `amenity_closures` table for admin-created blocks
-- (Separate from booking_blocked_dates which is for confirmed bookings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS amenity_closures (
  id TEXT PRIMARY KEY,
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),
  reason TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_amenity_closures_unique ON amenity_closures(amenity_type, date, slot);

-- ============================================================================
-- STEP 3: Create unified `bookings` table
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,

  -- Exactly one of these must be set (CHECK constraint below)
  user_id TEXT REFERENCES users(id),         -- for residents
  customer_id TEXT REFERENCES customers(id), -- for external guests

  household_id TEXT REFERENCES households(id), -- for resident bookings

  -- Booking details
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),

  -- Pricing breakdown
  base_rate REAL NOT NULL,
  duration_hours INTEGER NOT NULL,
  day_multiplier REAL NOT NULL DEFAULT 1.0,
  season_multiplier REAL NOT NULL DEFAULT 1.0,
  resident_discount REAL DEFAULT 0,  -- 0 = no discount, 0.5 = 50% off
  amount REAL NOT NULL,
  pricing_calculated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Payment tracking
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partial', 'paid', 'overdue', 'waived')),
  amount_paid REAL DEFAULT 0,
  payment_method TEXT,
  receipt_number TEXT,
  proof_of_payment_url TEXT,

  -- Unified status workflow
  -- External path: inquiry_submitted → pending_approval → pending_payment → pending_verification → confirmed
  -- Resident path: pending_resident → confirmed (or directly to confirmed)
  booking_status TEXT DEFAULT 'inquiry_submitted' CHECK(booking_status IN (
    -- External guest path (existing, unchanged)
    'inquiry_submitted',      -- guest submitted form
    'pending_approval',       -- admin approved, awaiting payment
    'pending_payment',        -- guest shown payment instructions
    'pending_verification',   -- proof uploaded, admin reviewing
    -- Shared terminal states
    'confirmed',
    'rejected',
    'cancelled',
    'no_show',
    -- Resident-only path (new, simpler)
    'pending_resident',       -- resident submitted, pre-approved pending slot check
    'awaiting_resident_payment' -- if resident bookings also need payment
  )),

  -- Event details
  event_type TEXT CHECK(event_type IN ('wedding', 'birthday', 'meeting', 'sports', 'other', NULL)),
  purpose TEXT,
  attendee_count INTEGER,

  -- Admin notes
  admin_notes TEXT,
  rejection_reason TEXT,

  -- For external guests workflow
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id),

  -- Audit
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES users(id),                    -- for admin-created bookings
  created_by_customer_id TEXT REFERENCES customers(id),    -- for guest-created bookings
  created_ip TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES users(id),

  -- Soft delete
  deleted_at TEXT,
  deleted_by TEXT REFERENCES users(id),

  -- Ensure exactly one of user_id or customer_id is set
  CHECK (
    (user_id IS NOT NULL AND customer_id IS NULL) OR
    (user_id IS NULL AND customer_id IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_household ON bookings(household_id);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_date ON bookings(date);
CREATE INDEX idx_bookings_slot_lookup ON bookings(amenity_type, date, slot) WHERE deleted_at IS NULL;

-- ============================================================================
-- STEP 4: Migrate external guests to customers (two-pass deduplication)
-- ============================================================================

-- Step 4a: Build dedup map (canonical ID per email)
-- Pick the most recently created row as canonical for each email
CREATE TEMP TABLE customer_dedup_map AS
SELECT
  guest_email AS email,
  (SELECT id FROM external_rentals e2
   WHERE e2.guest_email = e1.guest_email
   ORDER BY e2.created_at DESC LIMIT 1) AS canonical_id
FROM external_rentals e1
WHERE guest_email IS NOT NULL
GROUP BY guest_email;

-- Step 4b: Also build dedup map for renter_contact (for admin-created bookings)
CREATE TEMP TABLE customer_dedup_map_renter AS
SELECT
  renter_contact AS email,
  (SELECT id FROM external_rentals e2
   WHERE e2.renter_contact = e1.renter_contact
     AND e1.guest_email IS NULL  -- Only for rows without guest_email
   ORDER BY e2.created_at DESC LIMIT 1) AS canonical_id
FROM external_rentals e1
WHERE renter_contact IS NOT NULL
  AND guest_email IS NULL
GROUP BY renter_contact;

-- Step 4c: Insert canonical customers from guest_email
INSERT INTO customers (id, first_name, last_name, email, phone, google_sub, google_picture_url, guest_notes, created_at, updated_at, created_ip, ip_retained_until)
SELECT
  dm.canonical_id AS id,
  COALESCE(er.guest_first_name,
    CASE
      WHEN Instr(er.guest_name, ' ') > 0
      THEN Substr(er.guest_name, 1, Instr(er.guest_name, ' ') - 1)
      ELSE er.guest_name
    END
  ) AS first_name,
  COALESCE(er.guest_last_name,
    CASE
      WHEN Instr(er.guest_name, ' ') > 0
      THEN Substr(er.guest_name, Instr(er.guest_name, ' ') + 1)
      ELSE NULL
    END
  ) AS last_name,
  er.guest_email AS email,
  er.guest_phone AS phone,
  NULL AS google_sub,
  NULL AS google_picture_url,
  er.guest_notes,
  er.created_at,
  er.created_at AS updated_at,
  er.created_ip,
  datetime(er.created_at, '+90 days') AS ip_retained_until
FROM external_rentals er
INNER JOIN customer_dedup_map dm ON er.id = dm.canonical_id
WHERE er.guest_email IS NOT NULL;

-- Step 4d: Insert canonical customers from renter_contact (admin-created)
INSERT INTO customers (id, first_name, last_name, email, phone, guest_notes, created_at, updated_at)
SELECT
  dm.canonical_id AS id,
  COALESCE(er.guest_first_name,
    CASE
      WHEN Instr(er.renter_name, ' ') > 0
      THEN Substr(er.renter_name, 1, Instr(er.renter_name, ' ') - 1)
      ELSE er.renter_name
    END
  ) AS first_name,
  COALESCE(er.guest_last_name,
    CASE
      WHEN Instr(er.renter_name, ' ') > 0
      THEN Substr(er.renter_name, Instr(er.renter_name, ' ') + 1)
      ELSE NULL
    END
  ) AS last_name,
  er.renter_contact AS email,
  NULL AS phone,
  er.notes AS guest_notes,
  er.created_at,
  er.created_at AS updated_at
FROM external_rentals er
INNER JOIN customer_dedup_map_renter dm ON er.id = dm.canonical_id
WHERE er.renter_contact IS NOT NULL
  AND er.guest_email IS NULL;

-- Step 4e: Insert customers with no email (one per booking, since they're unidentifiable)
INSERT INTO customers (id, first_name, last_name, email, phone, guest_notes, created_at, updated_at, created_ip, ip_retained_until)
SELECT
  er.id,
  COALESCE(er.guest_first_name,
    CASE
      WHEN Instr(COALESCE(er.guest_name, er.renter_name, 'Guest'), ' ') > 0
      THEN Substr(COALESCE(er.guest_name, er.renter_name, 'Guest'), 1, Instr(COALESCE(er.guest_name, er.renter_name, 'Guest'), ' ') - 1)
      ELSE COALESCE(er.guest_name, er.renter_name, 'Guest')
    END
  ) AS first_name,
  COALESCE(er.guest_last_name,
    CASE
      WHEN Instr(COALESCE(er.guest_name, er.renter_name, ''), ' ') > 0
      THEN Substr(COALESCE(er.guest_name, er.renter_name, ''), Instr(COALESCE(er.guest_name, er.renter_name, ''), ' ') + 1)
      ELSE NULL
    END
  ) AS last_name,
  NULL AS email,
  er.guest_phone AS phone,
  er.guest_notes,
  er.created_at,
  er.created_at AS updated_at,
  er.created_ip,
  datetime(er.created_at, '+90 days') AS ip_retained_until
FROM external_rentals er
WHERE er.guest_email IS NULL
  AND er.renter_contact IS NULL
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = er.id);

-- ============================================================================
-- STEP 5: Migrate external_rentals to bookings
-- ============================================================================
INSERT INTO bookings (
  id,
  customer_id,
  amenity_type,
  date,
  slot,
  base_rate,
  duration_hours,
  day_multiplier,
  season_multiplier,
  resident_discount,
  amount,
  pricing_calculated_at,
  payment_status,
  amount_paid,
  payment_method,
  receipt_number,
  proof_of_payment_url,
  booking_status,
  event_type,
  purpose,
  attendee_count,
  admin_notes,
  rejection_reason,
  approved_at,
  approved_by,
  created_at,
  created_by,
  created_ip,
  updated_at
)
SELECT
  er.id,
  -- Map to canonical customer ID via dedup map
  COALESCE(
    (SELECT canonical_id FROM customer_dedup_map WHERE email = er.guest_email),
    (SELECT canonical_id FROM customer_dedup_map_renter WHERE email = er.renter_contact),
    er.id  -- fallback to self if no email (one customer per booking)
  ) AS customer_id,
  er.amenity_type,
  er.date,
  er.slot,
  COALESCE(er.amount, 0) AS base_rate,
  CASE er.slot WHEN 'AM' THEN 4 WHEN 'PM' THEN 4 ELSE 9 END AS duration_hours,
  1.0 AS day_multiplier,
  1.0 AS season_multiplier,
  0 AS resident_discount,
  COALESCE(er.amount, 0) AS amount,
  er.created_at AS pricing_calculated_at,
  COALESCE(er.payment_status, 'unpaid') AS payment_status,
  COALESCE(er.amount_paid, 0) AS amount_paid,
  er.payment_method,
  er.receipt_number,
  er.proof_of_payment_url,
  -- Map old booking_status to new unified workflow
  CASE er.booking_status
    WHEN 'pending_payment' THEN 'inquiry_submitted'
    WHEN 'pending_verification' THEN 'pending_verification'
    ELSE er.booking_status
  END AS booking_status,
  er.guest_notes AS event_type,
  er.guest_notes AS purpose,
  NULL AS attendee_count,
  er.admin_notes,
  er.rejection_reason,
  CASE WHEN er.booking_status IN ('confirmed', 'pending_verification') THEN er.created_at ELSE NULL END AS approved_at,
  er.created_by AS approved_by,
  er.created_at,
  er.created_by,
  er.created_ip,
  er.created_at AS updated_at
FROM external_rentals er;

-- ============================================================================
-- STEP 6: Migrate resident reservations to bookings
-- ============================================================================

-- First, ensure lot_members Phase 2 has populated household_id correctly
-- This uses the lot_members table to link users to households
INSERT INTO bookings (
  id,
  user_id,
  household_id,
  amenity_type,
  date,
  slot,
  base_rate,
  duration_hours,
  day_multiplier,
  season_multiplier,
  resident_discount,
  amount,
  pricing_calculated_at,
  payment_status,
  amount_paid,
  payment_method,
  receipt_number,
  booking_status,
  event_type,
  purpose,
  created_at,
  created_by,
  updated_at
)
SELECT
  r.id,
  u.id AS user_id,
  lm.household_id,
  r.amenity_type,
  r.date,
  r.slot,
  COALESCE(r.amount, 0) AS base_rate,
  CASE r.slot WHEN 'AM' THEN 4 WHEN 'PM' THEN 4 ELSE 9 END AS duration_hours,
  1.0 AS day_multiplier,
  1.0 AS season_multiplier,
  -- Note: Original resident bookings didn't track discount, assume 0.5 (50%)
  0.5 AS resident_discount,
  COALESCE(r.amount, 0) AS amount,
  r.created_at AS pricing_calculated_at,
  COALESCE(r.payment_status, 'unpaid') AS payment_status,
  COALESCE(r.amount_paid, 0) AS amount_paid,
  r.payment_method,
  r.receipt_number,
  -- Map old status to new workflow
  CASE r.status
    WHEN 'pending' THEN 'pending_resident'
    WHEN 'confirmed' THEN 'confirmed'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE r.status
  END AS booking_status,
  r.purpose AS event_type,
  r.purpose,
  r.created_at,
  r.created_by,
  r.created_at AS updated_at
FROM reservations r
JOIN users u ON r.household_id IN (
  -- Find household via lot_members (Phase 2)
  SELECT household_id FROM lot_members WHERE user_id = u.id
)
JOIN lot_members lm ON lm.user_id = u.id
WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.id = r.id);

-- ============================================================================
-- STEP 7: Create compatibility views for gradual migration
-- ============================================================================

-- View for legacy reservations table (resident bookings)
CREATE VIEW IF NOT EXISTS reservations_legacy AS
  SELECT
    b.id,
    b.household_id,
    b.amenity_type,
    b.date,
    b.slot,
    b.amount,
    b.payment_status,
    b.amount_paid,
    b.payment_method,
    b.receipt_number,
    b.booking_status AS status,
    b.purpose,
    b.created_at,
    b.created_by
  FROM bookings b
  WHERE b.user_id IS NOT NULL AND b.deleted_at IS NULL;

-- View for legacy external_rentals table (guest bookings)
CREATE VIEW IF NOT EXISTS external_rentals_legacy AS
  SELECT
    b.id,
    b.amenity_type,
    b.date,
    b.slot,
    b.amount,
    b.payment_status,
    b.amount_paid,
    b.payment_method,
    b.receipt_number,
    b.booking_status,
    c.first_name || ' ' || c.last_name AS guest_name,
    c.first_name AS guest_first_name,
    c.last_name AS guest_last_name,
    c.email AS guest_email,
    c.phone AS guest_phone,
    b.proof_of_payment_url,
    b.admin_notes,
    b.rejection_reason,
    b.created_at,
    b.created_by,
    b.created_ip,
    b.approved_at,
    b.approved_by,
    c.guest_notes,
    b.purpose
  FROM bookings b
  JOIN customers c ON b.customer_id = c.id
  WHERE b.user_id IS NULL AND b.deleted_at IS NULL;

-- ============================================================================
-- STEP 8: Clean up temp tables
-- ============================================================================
DROP TABLE IF EXISTS customer_dedup_map;
DROP TABLE IF EXISTS customer_dedup_map_renter;

-- ============================================================================
-- Post-migration verification queries
-- ============================================================================

-- Verify customer counts
-- SELECT customer_type, COUNT(*) FROM customers GROUP BY customer_type;

-- Verify booking counts by status
-- SELECT booking_status, COUNT(*) FROM bookings GROUP BY booking_status;

-- Verify no orphaned bookings (all have either user_id or customer_id)
-- SELECT COUNT(*) FROM bookings WHERE user_id IS NULL AND customer_id IS NULL;
-- Expected: 0

-- Verify resident bookings have household_id
-- SELECT COUNT(*) FROM bookings WHERE user_id IS NOT NULL AND household_id IS NULL;
-- Expected: 0
