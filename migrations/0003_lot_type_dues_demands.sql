-- Migration: Add lot_type, dues_rates, payment_demands, and installment_plans
-- Date: 2025-02-07
-- Based on HOA bylaws and deed of restrictions

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Add lot_type column to households table
ALTER TABLE households ADD COLUMN lot_type TEXT
  CHECK (lot_type IN ('residential', 'resort', 'commercial'))
  DEFAULT 'residential';

-- Create dues_rates table for managing annual dues rates
CREATE TABLE IF NOT EXISTS dues_rates (
  id TEXT PRIMARY KEY,
  rate_per_sqm REAL NOT NULL,
  year INTEGER NOT NULL,
  effective_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id)
);

-- Create index on year for active rate lookups
CREATE INDEX IF NOT EXISTS idx_dues_rates_year ON dues_rates(year);

-- Create payment_demands table for tracking payment demands and delinquency
CREATE TABLE IF NOT EXISTS payment_demands (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  year INTEGER NOT NULL,
  demand_sent_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount_due REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'suspended')),
  paid_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for finding active demands
CREATE INDEX IF NOT EXISTS idx_payment_demands_user_year ON payment_demands(user_id, year);
CREATE INDEX IF NOT EXISTS idx_payment_demands_status ON payment_demands(status);

-- Create installment_plans table for board-approved payment plans
CREATE TABLE IF NOT EXISTS installment_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  year INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  schedule TEXT NOT NULL,  -- JSON: [{due_date, amount}, ...]
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  approved_by TEXT NOT NULL REFERENCES users(id),
  approved_at DATETIME NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create installment_payments table for tracking installment schedule
CREATE TABLE IF NOT EXISTS installment_payments (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES installment_plans(id),
  due_date DATE NOT NULL,
  amount REAL NOT NULL,
  paid_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'missed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for installment queries
CREATE INDEX IF NOT EXISTS idx_installment_plans_user ON installment_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_installment_payments_plan ON installment_payments(plan_id);

-- Add lot_count to poll_votes for proxy voting (1 vote = multiple lots)
ALTER TABLE poll_votes ADD COLUMN lot_count INTEGER DEFAULT 1;

-- Add voting_method field for tracking in-person vs online votes
ALTER TABLE poll_votes ADD COLUMN voting_method TEXT
  CHECK (voting_method IN ('online', 'in-person'))
  DEFAULT 'online';

-- Add recorded_by for in-person votes (admin who recorded)
ALTER TABLE poll_votes ADD COLUMN recorded_by TEXT REFERENCES users(id);

-- Add late_fee_amount and late_fee_months to payments for tracking accumulated late fees
ALTER TABLE payments ADD COLUMN late_fee_amount REAL DEFAULT 0;
ALTER TABLE payments ADD COLUMN late_fee_months INTEGER DEFAULT 0;
