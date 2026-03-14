-- Migration: 0028_unify_booking_statuses.sql
-- Date: 2026-03-14
-- Description: Unify booking statuses across resident/external and add workflow column

PRAGMA foreign_keys = OFF;

-- Create a new bookings table with unified status values and explicit workflow
CREATE TABLE IF NOT EXISTS bookings_new (
  id TEXT PRIMARY KEY,

  -- Exactly one of these must be set (CHECK constraint below)
  user_id TEXT REFERENCES users(id),         -- for residents
  customer_id TEXT REFERENCES customers(id), -- for external guests

  household_id TEXT REFERENCES households(id), -- for resident bookings

  -- Explicit workflow (kept even though user_id/customer_id implies it)
  workflow TEXT NOT NULL CHECK(workflow IN ('resident', 'external')),

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

  -- Unified status workflow (simplified)
  booking_status TEXT NOT NULL DEFAULT 'submitted' CHECK(booking_status IN (
    'submitted',        -- awaiting admin approval
    'payment_due',      -- approved; awaiting payment/proof
    'payment_review',   -- proof uploaded; admin reviewing
    'confirmed',
    'rejected',
    'cancelled',
    'no_show'
  )),

  -- Event details
  event_type TEXT CHECK(event_type IN ('wedding', 'birthday', 'meeting', 'sports', 'other', NULL)),
  purpose TEXT,
  attendee_count INTEGER,

  -- Admin notes
  admin_notes TEXT,
  rejection_reason TEXT,

  -- Admin approval metadata
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

-- Migrate data from old bookings to new bookings with status mapping
INSERT INTO bookings_new (
  id,
  user_id,
  customer_id,
  household_id,
  workflow,
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
  created_by_customer_id,
  created_ip,
  updated_at,
  updated_by,
  deleted_at,
  deleted_by
)
SELECT
  id,
  user_id,
  customer_id,
  household_id,
  CASE WHEN user_id IS NOT NULL THEN 'resident' ELSE 'external' END AS workflow,
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
  CASE booking_status
    WHEN 'inquiry_submitted' THEN 'submitted'
    WHEN 'pending_approval' THEN 'submitted'
    WHEN 'pending_payment' THEN 'payment_due'
    WHEN 'pending_verification' THEN 'payment_review'
    WHEN 'pending_resident' THEN 'submitted'
    WHEN 'awaiting_resident_payment' THEN 'payment_due'
    WHEN 'confirmed' THEN 'confirmed'
    WHEN 'rejected' THEN 'rejected'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'no_show' THEN 'no_show'
    ELSE 'submitted'
  END AS booking_status,
  event_type,
  purpose,
  attendee_count,
  admin_notes,
  rejection_reason,
  approved_at,
  approved_by,
  created_at,
  created_by,
  created_by_customer_id,
  created_ip,
  updated_at,
  updated_by,
  deleted_at,
  deleted_by
FROM bookings;

DROP TABLE bookings;
ALTER TABLE bookings_new RENAME TO bookings;

-- Recreate indexes (include workflow for filtering)
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_household ON bookings(household_id);
CREATE INDEX IF NOT EXISTS idx_bookings_workflow ON bookings(workflow);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_lookup ON bookings(amenity_type, date, slot) WHERE deleted_at IS NULL;

-- Update compatibility views (best-effort)
DROP VIEW IF EXISTS reservations_legacy;
DROP VIEW IF EXISTS external_rentals_legacy;

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
    CASE b.booking_status
      WHEN 'confirmed' THEN 'confirmed'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'pending'
    END AS status,
    b.purpose,
    b.created_at,
    b.created_by
  FROM bookings b
  WHERE b.workflow = 'resident' AND b.deleted_at IS NULL;

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
    CASE b.booking_status
      WHEN 'submitted' THEN 'inquiry_submitted'
      WHEN 'payment_due' THEN 'pending_payment'
      WHEN 'payment_review' THEN 'pending_verification'
      ELSE b.booking_status
    END AS booking_status,
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
  WHERE b.workflow = 'external' AND b.deleted_at IS NULL;

PRAGMA foreign_keys = ON;

