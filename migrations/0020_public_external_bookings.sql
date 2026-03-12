-- Migration: 0020_public_external_bookings.sql
-- Date: 2026-03-12
-- Description: Add public external booking system with pending requests that don't block slots

-- ============================================================================
-- STEP 1: Recreate external_rentals table WITHOUT UNIQUE constraint
-- This allows multiple pending requests for the same slot
-- Only confirmed bookings block slots via booking_blocked_dates table
-- ============================================================================

-- Create new table with updated schema
CREATE TABLE external_rentals_new (
  id TEXT PRIMARY KEY,
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),
  renter_name TEXT,
  renter_contact TEXT,
  amount REAL,
  notes TEXT,
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partial', 'paid', 'overdue')),
  amount_paid REAL DEFAULT 0,
  payment_method TEXT,
  receipt_number TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- New columns for public bookings
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  proof_of_payment_url TEXT,
  booking_status TEXT NOT NULL DEFAULT 'pending_payment' CHECK(booking_status IN ('pending_payment', 'pending_verification', 'confirmed', 'rejected', 'cancelled')),
  rejection_reason TEXT,
  created_ip TEXT,
  guest_notes TEXT,
  admin_notes TEXT,
  ip_retained_until TEXT,
  created_by TEXT REFERENCES users(id)
);

-- Copy existing data
INSERT INTO external_rentals_new
SELECT
  id, amenity_type, date, slot, renter_name, renter_contact, amount, notes, payment_status,
  COALESCE(amount_paid, 0) as amount_paid, payment_method, receipt_number, created_at,
  NULL as guest_name, NULL as guest_email, NULL as guest_phone, NULL as proof_of_payment_url,
  'confirmed' as booking_status, NULL as rejection_reason, NULL as created_ip,
  NULL as guest_notes, NULL as admin_notes, NULL as ip_retained_until,
  created_by
FROM external_rentals;

-- Drop old table and rename
DROP TABLE external_rentals;
ALTER TABLE external_rentals_new RENAME TO external_rentals;

-- Recreate indexes (without unique constraint on slot)
CREATE INDEX IF NOT EXISTS idx_external_rentals_lookup ON external_rentals(amenity_type, date, slot);
CREATE INDEX IF NOT EXISTS idx_external_rentals_status ON external_rentals(booking_status);
CREATE INDEX IF NOT EXISTS idx_external_rentals_email ON external_rentals(guest_email);
CREATE INDEX IF NOT EXISTS idx_external_rentals_created_at ON external_rentals(created_at);

-- ============================================================================
-- STEP 2: Create booking_blocked_dates table for CONFIRMED bookings only
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_blocked_dates (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
  booking_date DATE NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES external_rentals(id) ON DELETE CASCADE,
  UNIQUE(amenity_type, booking_date, slot)
);
CREATE INDEX IF NOT EXISTS idx_booking_blocked_dates_lookup ON booking_blocked_dates(amenity_type, booking_date, slot);

-- Migrate existing paid bookings to blocked_dates
INSERT INTO booking_blocked_dates (id, booking_id, amenity_type, booking_date, slot, created_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  amenity_type,
  date,
  slot,
  created_at
FROM external_rentals
WHERE payment_status = 'paid';

-- ============================================================================
-- STEP 3: Add external pricing to system_settings
-- ============================================================================

-- Base hourly rates
INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, category, description) VALUES
  ('external-pricing-001', 'external_pricing_clubhouse_hourly', '500', 'external_pricing', 'Clubhouse hourly rate for external bookings'),
  ('external-pricing-002', 'external_pricing_pool_hourly', '300', 'external_pricing', 'Pool hourly rate for external bookings'),
  ('external-pricing-003', 'external_pricing_basketball-court_hourly', '200', 'external_pricing', 'Basketball court hourly rate for external bookings'),
  ('external-pricing-004', 'external_pricing_tennis-court_hourly', '250', 'external_pricing', 'Tennis court hourly rate for external bookings');

-- Resident discount (50% off)
INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, category, description) VALUES
  ('external-pricing-005', 'external_pricing_resident_discount_percent', '0.50', 'external_pricing', 'Resident discount percentage for external bookings');

-- Day multipliers (JSON for flexibility)
INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, category, description) VALUES
  ('external-pricing-006', 'external_pricing_day_multipliers', '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}', 'external_pricing', 'Day-based pricing multipliers');

-- Season multipliers
INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, category, description) VALUES
  ('external-pricing-007', 'external_pricing_season_multipliers', '{"peak": 1.3, "off_peak": 1.0}', 'external_pricing', 'Season-based pricing multipliers');

-- Peak season definition
INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, category, description) VALUES
  ('external-pricing-008', 'external_pricing_peak_months', '12,1,2,3,4,5', 'external_pricing', 'Peak season months (December to May)');

-- Holidays 2026
INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, category, description) VALUES
  ('external-pricing-009', 'external_pricing_holidays_2026', '2026-01-01,2026-03-28,2026-03-29,2026-04-09,2026-04-10,2026-05-01,2026-06-12,2026-12-25,2026-12-30', 'external_pricing', 'Holidays for 2026 with holiday multiplier pricing');

-- ============================================================================
-- STEP 4: Add payment details to system_settings
-- ============================================================================

-- GCash details (update existing or insert new)
INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, category, description) VALUES
  ('payment-gcash-001', 'payment_gcash_name', 'Laguna Hills HOA', 'payment', 'GCash account name for external bookings'),
  ('payment-gcash-002', 'payment_gcash_number', '0917-XXX-XXXX', 'payment', 'GCash contact number for external bookings');

-- Bank transfer details
INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, category, description) VALUES
  ('payment-bank-001', 'payment_bank_name', 'BPI', 'payment', 'Bank name for external bookings'),
  ('payment-bank-002', 'payment_account_name', 'Laguna Hills HOA Association', 'payment', 'Bank account name for external bookings'),
  ('payment-bank-003', 'payment_account_number', 'XXXX-XXXX-XXXX', 'payment', 'Bank account number for external bookings'),
  ('payment-bank-004', 'payment_branch', 'Laguna Hills Branch', 'payment', 'Bank branch for external bookings');
