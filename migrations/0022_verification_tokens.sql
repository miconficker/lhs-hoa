-- Migration: Verification Tokens for Public Booking Proof Upload
-- This adds a table for storing short-lived verification tokens
-- to confirm ownership before allowing proof of payment uploads

CREATE TABLE IF NOT EXISTS verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  booking_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES external_rentals(id) ON DELETE CASCADE
);

-- Index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token
  ON verification_tokens(token);

-- Index for cleaning up expired tokens
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at
  ON verification_tokens(expires_at);

-- Index for booking lookups
CREATE INDEX IF NOT EXISTS idx_verification_tokens_booking_id
  ON verification_tokens(booking_id);
