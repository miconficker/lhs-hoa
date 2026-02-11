-- Migration: Late fee configuration table
-- Date: 2025-02-11
--
-- Rationale: Add configurable late fee rules for payment system
-- Admins can set rate percent, grace period, and max months

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Create late fee configuration table
CREATE TABLE IF NOT EXISTS late_fee_config (
  id TEXT PRIMARY KEY,
  rate_percent REAL NOT NULL DEFAULT 1,  -- 1% per month
  grace_period_days INTEGER NOT NULL DEFAULT 30,  -- days before late fees apply
  max_months INTEGER NOT NULL DEFAULT 12,  -- maximum months to calculate late fees
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT OR IGNORE INTO late_fee_config (id, rate_percent, grace_period_days, max_months)
VALUES ('default', 1, 30, 12);
