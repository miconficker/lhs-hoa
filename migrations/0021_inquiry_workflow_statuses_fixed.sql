-- Migration: Add inquiry workflow statuses to existing external_rentals table
-- This migration updates the CHECK constraint to allow new inquiry workflow statuses
-- without recreating the table (which can cause issues with existing data)

-- Step 1: Create a new table with the correct schema including new statuses
CREATE TABLE external_rentals_updated (
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

-- Step 2: Copy all existing data to the new table
-- Map any invalid statuses to 'pending_payment'
INSERT INTO external_rentals_updated
SELECT
  id,
  amenity_type,
  date,
  slot,
  renter_name,
  renter_contact,
  amount,
  notes,
  payment_status,
  amount_paid,
  payment_method,
  receipt_number,
  created_at,
  guest_name,
  guest_email,
  guest_phone,
  proof_of_payment_url,
  CASE
    WHEN booking_status NOT IN (
      'inquiry_submitted',
      'pending_approval',
      'pending_payment',
      'pending_verification',
      'confirmed',
      'rejected',
      'cancelled'
    ) THEN 'pending_payment'
    ELSE booking_status
  END as booking_status,
  rejection_reason,
  created_ip,
  guest_notes,
  admin_notes,
  ip_retained_until,
  created_by
FROM external_rentals;

-- Step 3: Drop old table and rename new one
DROP TABLE external_rentals;
ALTER TABLE external_rentals_updated RENAME TO external_rentals;

-- Step 4: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_external_rentals_booking_status
  ON external_rentals(booking_status);

CREATE INDEX IF NOT EXISTS idx_external_rentals_date_slot
  ON external_rentals(date, slot, amenity_type);

CREATE INDEX IF NOT EXISTS idx_external_rentals_guest_email
  ON external_rentals(guest_email);
