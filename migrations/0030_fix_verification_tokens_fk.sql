-- Migration: 0030_fix_verification_tokens_fk.sql
-- Date: 2026-03-14
-- Description: Fix verification_tokens foreign key to reference unified bookings table
--
-- Root cause: verification_tokens.booking_id still referenced external_rentals(id)
-- but the unified booking system now uses bookings(id).

PRAGMA foreign_keys = OFF;

-- Create new table with correct foreign key
CREATE TABLE IF NOT EXISTS verification_tokens_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  booking_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- Migrate existing data
INSERT OR IGNORE INTO verification_tokens_new SELECT * FROM verification_tokens;

-- Drop old table and rename new one
DROP TABLE verification_tokens;
ALTER TABLE verification_tokens_new RENAME TO verification_tokens;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at ON verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_booking_id ON verification_tokens(booking_id);

PRAGMA foreign_keys = ON;
