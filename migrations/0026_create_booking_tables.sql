-- Migration: 0026_create_booking_tables.sql
-- Date: 2026-03-14
-- Description: Create unified bookings tables (minimal version for new bookings)
--
-- This creates the tables needed for the unified bookings system.
-- Data migration from legacy tables will be done separately.

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

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_google_sub ON customers(google_sub);
CREATE INDEX IF NOT EXISTS idx_customers_blacklisted ON customers(is_blacklisted) WHERE is_blacklisted = 1;

-- ============================================================================
-- STEP 2: Create `amenity_closures` table for admin-created blocks
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_amenity_closures_unique ON amenity_closures(amenity_type, date, slot);

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
  booking_status TEXT DEFAULT 'inquiry_submitted' CHECK(booking_status IN (
    -- External guest path
    'inquiry_submitted',      -- guest submitted form
    'pending_approval',       -- admin approved, awaiting payment
    'pending_payment',        -- guest shown payment instructions
    'pending_verification',   -- proof uploaded, admin reviewing
    -- Shared terminal states
    'confirmed',
    'rejected',
    'cancelled',
    'no_show',
    -- Resident-only path
    'pending_resident',       -- resident submitted, pre-approved
    'awaiting_resident_payment'
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
  created_by TEXT REFERENCES users(id),
  created_by_customer_id TEXT REFERENCES customers(id),
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
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_household ON bookings(household_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_lookup ON bookings(amenity_type, date, slot) WHERE deleted_at IS NULL;
