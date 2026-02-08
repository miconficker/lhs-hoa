-- Migration: Employee and Vehicle Pass Management
-- Date: 2025-02-08
-- Last updated: 2025-02-08

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Household employees table
CREATE TABLE IF NOT EXISTS household_employees (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  full_name TEXT NOT NULL,
  employee_type TEXT NOT NULL CHECK(employee_type IN ('driver', 'housekeeper', 'caretaker', 'other')),
  id_number TEXT NOT NULL UNIQUE,
  photo_url TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'revoked', 'expired')),
  issued_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle registrations table
CREATE TABLE IF NOT EXISTS vehicle_registrations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  plate_number TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT NOT NULL,
  pass_type TEXT NOT NULL CHECK(pass_type IN ('sticker', 'rfid', 'both')),
  rfid_code TEXT UNIQUE,
  sticker_number TEXT UNIQUE,
  status TEXT DEFAULT 'pending_payment' CHECK(status IN ('pending_payment', 'pending_approval', 'active', 'cancelled')),
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid')),
  issued_date DATE,
  amount_due REAL,
  amount_paid REAL,
  payment_method TEXT CHECK(payment_method IN ('gcash', 'paymaya', 'instapay', 'cash', 'in-person')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, plate_number)
);

-- Pass fees table
CREATE TABLE IF NOT EXISTS pass_fees (
  id TEXT PRIMARY KEY,
  fee_type TEXT NOT NULL CHECK(fee_type IN ('sticker', 'rfid', 'both')),
  amount REAL NOT NULL,
  effective_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default fees (configurable, will be set by admin)
INSERT OR IGNORE INTO pass_fees (id, fee_type, amount, effective_date)
VALUES
  ('default-sticker', 'sticker', 500, DATE('now')),
  ('default-rfid', 'rfid', 800, DATE('now')),
  ('default-both', 'both', 1000, DATE('now'));

-- Add payment_category to payments table
ALTER TABLE payments ADD COLUMN payment_category TEXT DEFAULT 'dues' CHECK(payment_category IN ('dues', 'vehicle_pass', 'employee_id'));

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_household_employees_household_id ON household_employees(household_id);
CREATE INDEX IF NOT EXISTS idx_household_employees_status ON household_employees(status);
CREATE INDEX IF NOT EXISTS idx_household_employees_expiry_date ON household_employees(expiry_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_household_id ON vehicle_registrations(household_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_status ON vehicle_registrations(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_plate ON vehicle_registrations(plate_number);
