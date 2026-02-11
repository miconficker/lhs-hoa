-- Migration: Payment verification system
-- Date: 2025-02-11
--
-- Rationale: Enable resident-initiated payments with admin verification workflow
-- Supports unified payment tracking for dues, vehicle passes, and employee IDs
-- Residents upload proof → Admin verifies → Status updated

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- =============================================================================
-- New Tables
-- =============================================================================

-- payment_proofs: Stores uploaded proof files (receipts, screenshots)
CREATE TABLE IF NOT EXISTS payment_proofs (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified BOOLEAN DEFAULT 0,
  verified_by TEXT REFERENCES users(id),
  verified_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_payment_id ON payment_proofs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_verified ON payment_proofs(verified);

-- payment_verification_queue: Tracks pending verifications for admin review
CREATE TABLE IF NOT EXISTS payment_verification_queue (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  household_id TEXT REFERENCES households(id),
  payment_type TEXT CHECK(payment_type IN ('dues', 'vehicle_pass', 'employee_id')),
  amount REAL NOT NULL,
  reference_number TEXT,
  proof_uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  notified_admin BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_verification_queue_payment_id ON payment_verification_queue(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_verification_queue_status ON payment_verification_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_verification_queue_admin_notified ON payment_verification_queue(notified_admin, status);

-- =============================================================================
-- Modify Existing Tables
-- =============================================================================

-- Add verification tracking to payments table
ALTER TABLE payments ADD COLUMN verification_status TEXT DEFAULT 'not_required' CHECK(verification_status IN ('pending', 'verified', 'not_required'));
ALTER TABLE payments ADD COLUMN proof_uploaded_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_payments_verification_status ON payments(verification_status);

-- =============================================================================
-- Note: Notification Types
-- =============================================================================
-- The notification system uses CHECK constraints for type validation.
-- New payment verification types will be handled at the API layer:
-- - payment_verification_requested
-- - payment_verified
-- - payment_rejected
-- The notifications table CHECK constraint should be updated separately to include these types.
