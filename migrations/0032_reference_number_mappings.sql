-- Migration: Reference Number Mappings Table
-- Purpose: Store obfuscated reference numbers to booking ID mappings
-- This allows secure, non-enumerable reference numbers (LH-XXXXXX format)
-- while maintaining internal lookups

-- Create reference number mappings table
CREATE TABLE IF NOT EXISTS reference_number_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_number TEXT NOT NULL UNIQUE,
  booking_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create index for fast lookups by reference number
CREATE INDEX IF NOT EXISTS idx_reference_number_mappings_ref
  ON reference_number_mappings(reference_number);

-- Create index for lookups by booking ID
CREATE INDEX IF NOT EXISTS idx_reference_number_mappings_booking
  ON reference_number_mappings(booking_id);

-- Foreign key to bookings table
-- Note: This is a logical reference; we don't use FK constraint
-- because bookings may be soft-deleted

-- Add comments for documentation
-- Reference number format: LH-XXXXXX (6 random alphanumeric characters)
-- Legacy format support: EXT-YYYYMMDD-XXX (for backward compatibility)
