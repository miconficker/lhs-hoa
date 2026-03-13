-- Migration: Add inquiry workflow statuses to external_rentals table
-- This adds new statuses for the inquiry-based booking workflow

-- Note: SQLite doesn't support ALTER COLUMN with CHECK constraint modification
-- We need to recreate the table with the new constraint

-- First, create the new external_rentals table with updated status values
-- This must match the existing remote schema exactly
CREATE TABLE IF NOT EXISTS external_rentals_new (
  id TEXT PRIMARY KEY,
  amenity_type TEXT NOT NULL,
  date DATE NOT NULL,
  slot TEXT NOT NULL,
  renter_name TEXT,
  renter_contact TEXT,
  amount REAL,
  notes TEXT,
  payment_status TEXT DEFAULT 'unpaid',
  amount_paid REAL DEFAULT 0,
  payment_method TEXT,
  receipt_number TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  proof_of_payment_url TEXT,
  booking_status TEXT NOT NULL DEFAULT 'pending_payment',
  rejection_reason TEXT,
  created_ip TEXT,
  guest_notes TEXT,
  admin_notes TEXT,
  ip_retained_until TEXT,
  created_by TEXT,

  CHECK (booking_status IN (
    'inquiry_submitted',
    'pending_approval',
    'pending_payment',
    'pending_verification',
    'confirmed',
    'rejected',
    'cancelled'
  ))
);

-- Copy existing data from old table to new table
-- Explicitly list columns to match the exact schema
INSERT INTO external_rentals_new (
  id, amenity_type, date, slot, renter_name, renter_contact, amount, notes,
  payment_status, amount_paid, payment_method, receipt_number, created_at,
  guest_name, guest_email, guest_phone, proof_of_payment_url, booking_status,
  rejection_reason, created_ip, guest_notes, admin_notes, ip_retained_until, created_by
)
SELECT
  id, amenity_type, date, slot, renter_name, renter_contact, amount, notes,
  payment_status, amount_paid, payment_method, receipt_number, created_at,
  guest_name, guest_email, guest_phone, proof_of_payment_url, booking_status,
  rejection_reason, created_ip, guest_notes, admin_notes, ip_retained_until, created_by
FROM external_rentals;

-- Drop old table
DROP TABLE external_rentals;

-- Rename new table to original name
ALTER TABLE external_rentals_new RENAME TO external_rentals;

-- Recreate indexes for performance
CREATE INDEX IF NOT EXISTS idx_external_rentals_booking_status
  ON external_rentals(booking_status);

CREATE INDEX IF NOT EXISTS idx_external_rentals_date_slot
  ON external_rentals(date, slot, amenity_type);

CREATE INDEX IF NOT EXISTS idx_external_rentals_guest_email
  ON external_rentals(guest_email);
