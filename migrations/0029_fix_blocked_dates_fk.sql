-- Migration: 0029_fix_blocked_dates_fk.sql
-- Date: 2026-03-14
-- Description: Fix booking_blocked_dates foreign key to reference unified bookings table
--
-- Root cause: booking_blocked_dates.booking_id still referenced external_rentals(id)
-- but the unified booking system now uses bookings(id). This caused FK constraint
-- violations when confirming bookings or recording payments.
--
-- Solution: Recreate booking_blocked_dates with correct FK to bookings table

PRAGMA foreign_keys = OFF;

-- Create new table with correct foreign key
CREATE TABLE IF NOT EXISTS booking_blocked_dates_new (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
  booking_date DATE NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  UNIQUE(amenity_type, booking_date, slot)
);

-- Migrate existing data (both external_rentals and bookings IDs should be preserved)
-- Note: external_rentals that were migrated to bookings will have different IDs,
-- so we need to handle the migration carefully
INSERT OR IGNORE INTO booking_blocked_dates_new (id, booking_id, amenity_type, booking_date, slot, created_at)
SELECT id, booking_id, amenity_type, booking_date, slot, created_at
FROM booking_blocked_dates;

-- Drop old table and rename new one
DROP TABLE booking_blocked_dates;
ALTER TABLE booking_blocked_dates_new RENAME TO booking_blocked_dates;

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_booking_blocked_dates_lookup ON booking_blocked_dates(amenity_type, booking_date, slot);

PRAGMA foreign_keys = ON;
