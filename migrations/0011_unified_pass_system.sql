-- ============================================================================
-- Unified Pass Management System Migration
-- Migration: 0011_unified_pass_system.sql
-- Purpose: Separate pass records from payment records with unified architecture
-- ============================================================================

-- ============================================================================
-- PHASE 1: Create New Tables (can be done independently)
-- ============================================================================

-- Pass Type Registry (defines all pass types in the system)
CREATE TABLE IF NOT EXISTS pass_types (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('vehicle', 'employee', 'resident', 'visitor')),
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial pass types
INSERT OR IGNORE INTO pass_types (id, code, name, category) VALUES
  ('pt-sticker', 'sticker', 'Gate Pass Sticker', 'vehicle'),
  ('pt-rfid', 'rfid', 'RFID Card', 'vehicle'),
  ('pt-employee', 'employee_id', 'Employee ID', 'employee'),
  ('pt-vip', 'vip', 'VIP Pass', 'resident'),
  ('pt-valet', 'valet', 'Valet Pass', 'visitor');

-- Vehicle Passes (independent records per pass type)
CREATE TABLE IF NOT EXISTS vehicle_passes (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicle_registrations(id) ON DELETE CASCADE,
  pass_type_id TEXT NOT NULL REFERENCES pass_types(id),

  -- Pass-specific identifiers
  identifier TEXT NOT NULL,

  -- Financial tracking
  amount_due REAL NOT NULL DEFAULT 0,
  amount_paid REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'partial')),

  -- Dates
  issued_date DATE,
  expiry_date DATE,

  -- Notes
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- One pass of each type per vehicle
  UNIQUE(vehicle_id, pass_type_id),

  -- Unique identifier per pass type
  UNIQUE(pass_type_id, identifier) CHECK (
    (pass_type_id = 'pt-sticker' AND identifier LIKE 'ST-%') OR
    (pass_type_id = 'pt-rfid' AND identifier LIKE 'RF-%')
  )
);

CREATE INDEX IF NOT EXISTS idx_vehicle_passes_vehicle_id ON vehicle_passes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_passes_pass_type_id ON vehicle_passes(pass_type_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_passes_payment_status ON vehicle_passes(payment_status);

-- ============================================================================
-- PHASE 2: Add payment fields to household_employees
-- ============================================================================

-- Add payment tracking columns to household_employees if they don't exist
ALTER TABLE household_employees ADD COLUMN pass_type_id TEXT REFERENCES pass_types(id);
ALTER TABLE household_employees ADD COLUMN amount_due REAL DEFAULT 0;
ALTER TABLE household_employees ADD COLUMN amount_paid REAL DEFAULT 0;
ALTER TABLE household_employees ADD COLUMN payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'partial'));

-- Update existing employees to have employee_id pass type and default payment
UPDATE household_employees
SET pass_type_id = 'pt-employee',
    amount_due = 100,
    amount_paid = 0,
    payment_status = 'unpaid'
WHERE pass_type_id IS NULL;

-- ============================================================================
-- PHASE 3: Update pass_fees to reference pass_types
-- ============================================================================

-- Recreate pass_fees table with new structure
DROP TABLE IF EXISTS pass_fees;

CREATE TABLE IF NOT EXISTS pass_fees (
  id TEXT PRIMARY KEY,
  pass_type_id TEXT NOT NULL REFERENCES pass_types(id),
  amount REAL NOT NULL,
  effective_date DATE NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pass_type_id, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_pass_fees_pass_type_id ON pass_fees(pass_type_id);
CREATE INDEX IF NOT EXISTS idx_pass_fees_effective_date ON pass_fees(effective_date);

-- Seed fees based on current defaults
INSERT OR IGNORE INTO pass_fees (id, pass_type_id, amount, effective_date) VALUES
  ('fee-sticker-001', 'pt-sticker', 500, DATE('now')),
  ('fee-rfid-001', 'pt-rfid', 800, DATE('now')),
  ('fee-employee-001', 'pt-employee', 100, DATE('now'));

-- ============================================================================
-- PHASE 4: Add columns to payments table for pass tracking
-- ============================================================================

-- Add pass tracking columns to payments if they don't exist
ALTER TABLE payments ADD COLUMN pass_type_id TEXT REFERENCES pass_types(id);
ALTER TABLE payments ADD COLUMN vehicle_pass_id TEXT REFERENCES vehicle_passes(id);
ALTER TABLE payments ADD COLUMN employee_pass_id TEXT REFERENCES household_employees(id);

-- Add CHECK constraint for pass linking
-- Note: SQLite doesn't support ADD CONSTRAINT with CHECK directly, so we'll rely on application logic

-- ============================================================================
-- PHASE 5: Migrate existing vehicle data to vehicle_passes
-- ============================================================================

-- Migrate existing vehicle registrations to the new structure
-- This creates vehicle_pass records for each existing vehicle based on its pass_type

-- Step 1: Migrate sticker-only vehicles
INSERT INTO vehicle_passes (id, vehicle_id, pass_type_id, identifier, amount_due, amount_paid, payment_status, issued_date, created_at, updated_at)
SELECT
  'vp-' || substr(hex(randomblob(16)), 1, 32),
  vr.id,
  'pt-sticker',
  COALESCE(vr.sticker_number, 'ST-' || strftime('%Y%m%d%H%M%S', vr.created_at) || '-' || upper(substr(hex(randomblob(4)), 1, 4))),
  COALESCE(vr.amount_due, 500),
  COALESCE(vr.amount_paid, 0),
  COALESCE(vr.payment_status, 'unpaid'),
  vr.issued_date,
  vr.created_at,
  vr.updated_at
FROM vehicle_registrations vr
WHERE vr.pass_type = 'sticker'
AND NOT EXISTS (SELECT 1 FROM vehicle_passes vp WHERE vp.vehicle_id = vr.id AND vp.pass_type_id = 'pt-sticker');

-- Step 2: Migrate RFID-only vehicles
INSERT INTO vehicle_passes (id, vehicle_id, pass_type_id, identifier, amount_due, amount_paid, payment_status, issued_date, created_at, updated_at)
SELECT
  'vp-' || substr(hex(randomblob(16)), 1, 32),
  vr.id,
  'pt-rfid',
  COALESCE(vr.rfid_code, 'RF-' || strftime('%Y%m%d%H%M%S', vr.created_at) || '-' || upper(substr(hex(randomblob(4)), 1, 4))),
  COALESCE(vr.amount_due, 800),
  COALESCE(vr.amount_paid, 0),
  COALESCE(vr.payment_status, 'unpaid'),
  vr.issued_date,
  vr.created_at,
  vr.updated_at
FROM vehicle_registrations vr
WHERE vr.pass_type = 'rfid'
AND NOT EXISTS (SELECT 1 FROM vehicle_passes vp WHERE vp.vehicle_id = vr.id AND vp.pass_type_id = 'pt-rfid');

-- Step 3: Migrate both-pass vehicles (create two records)
INSERT INTO vehicle_passes (id, vehicle_id, pass_type_id, identifier, amount_due, amount_paid, payment_status, issued_date, created_at, updated_at)
SELECT
  'vp-' || substr(hex(randomblob(16)), 1, 32),
  vr.id,
  'pt-sticker',
  COALESCE(vr.sticker_number, 'ST-' || strftime('%Y%m%d%H%M%S', vr.created_at) || '-' || upper(substr(hex(randomblob(4)), 1, 4))),
  500,
  CASE WHEN vr.payment_status = 'paid' THEN 500 ELSE 0 END,
  COALESCE(vr.payment_status, 'unpaid'),
  vr.issued_date,
  vr.created_at,
  vr.updated_at
FROM vehicle_registrations vr
WHERE vr.pass_type = 'both'
AND vr.sticker_number IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM vehicle_passes vp WHERE vp.vehicle_id = vr.id AND vp.pass_type_id = 'pt-sticker');

INSERT INTO vehicle_passes (id, vehicle_id, pass_type_id, identifier, amount_due, amount_paid, payment_status, issued_date, created_at, updated_at)
SELECT
  'vp-' || substr(hex(randomblob(16)), 1, 32),
  vr.id,
  'pt-rfid',
  COALESCE(vr.rfid_code, 'RF-' || strftime('%Y%m%d%H%M%S', vr.created_at) || '-' || upper(substr(hex(randomblob(4)), 1, 4))),
  800,
  CASE WHEN vr.payment_status = 'paid' THEN 800 ELSE 0 END,
  COALESCE(vr.payment_status, 'unpaid'),
  vr.issued_date,
  vr.created_at,
  vr.updated_at
FROM vehicle_registrations vr
WHERE vr.pass_type = 'both'
AND vr.rfid_code IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM vehicle_passes vp WHERE vp.vehicle_id = vr.id AND vp.pass_type_id = 'pt-rfid');

-- ============================================================================
-- PHASE 6: Create Views for simplified queries
-- ============================================================================

-- View for vehicle passes with pass type details
CREATE VIEW IF NOT EXISTS vehicle_passes_view AS
SELECT
  vp.id,
  vp.vehicle_id,
  v.household_id,
  v.plate_number,
  v.make,
  v.model,
  v.color,
  v.status as vehicle_status,

  -- Pass type info
  pt.code as pass_type_code,
  pt.name as pass_type_name,
  pt.category as pass_type_category,
  vp.identifier,

  -- Financial
  vp.amount_due,
  vp.amount_paid,
  vp.payment_status,

  -- Dates
  vp.issued_date,
  vp.expiry_date,

  -- Computed
  (vp.amount_due - vp.amount_paid) as balance_due,

  -- Metadata
  vp.notes,
  vp.created_at,
  vp.updated_at
FROM vehicle_passes vp
JOIN vehicle_registrations v ON v.id = vp.vehicle_id
JOIN pass_types pt ON pt.id = vp.pass_type_id;

-- View for vehicles with all their passes
CREATE VIEW IF NOT EXISTS vehicles_with_passes_view AS
SELECT
  v.id,
  v.household_id,
  h.address as household_address,
  v.plate_number,
  v.make,
  v.model,
  v.color,
  v.status,

  -- Sticker pass (if exists)
  sticker.id as sticker_pass_id,
  sticker.identifier as sticker_number,
  sticker.amount_due as sticker_amount_due,
  sticker.amount_paid as sticker_amount_paid,
  sticker.payment_status as sticker_payment_status,

  -- RFID pass (if exists)
  rfid.id as rfid_pass_id,
  rfid.identifier as rfid_code,
  rfid.amount_due as rfid_amount_due,
  rfid.amount_paid as rfid_amount_paid,
  rfid.payment_status as rfid_payment_status,

  -- Computed
  CASE
    WHEN sticker.id IS NOT NULL AND rfid.id IS NOT NULL THEN 'both'
    WHEN sticker.id IS NOT NULL THEN 'sticker'
    WHEN rfid.id IS NOT NULL THEN 'rfid'
    ELSE NULL
  END as pass_type,

  COALESCE(sticker.amount_due, 0) + COALESCE(rfid.amount_due, 0) as total_amount_due,
  COALESCE(sticker.amount_paid, 0) + COALESCE(rfid.amount_paid, 0) as total_amount_paid,
  (COALESCE(sticker.amount_due, 0) + COALESCE(rfid.amount_due, 0)) -
  (COALESCE(sticker.amount_paid, 0) + COALESCE(rfid.amount_paid, 0)) as total_balance_due,

  v.created_at,
  v.updated_at
FROM vehicle_registrations v
JOIN households h ON h.id = v.household_id
LEFT JOIN vehicle_passes sticker ON sticker.vehicle_id = v.id AND sticker.pass_type_id = 'pt-sticker'
LEFT JOIN vehicle_passes rfid ON rfid.vehicle_id = v.id AND rfid.pass_type_id = 'pt-rfid';

-- View for employees with pass type details
CREATE VIEW IF NOT EXISTS employees_with_pass_type_view AS
SELECT
  he.id,
  he.household_id,
  h.address as household_address,
  he.full_name,
  he.employee_type,
  he.id_number,

  -- Pass type info
  pt.code as pass_type_code,
  pt.name as pass_type_name,

  -- Photo
  he.photo_url,

  -- Financial
  he.amount_due,
  he.amount_paid,
  he.payment_status,
  (he.amount_due - he.amount_paid) as balance_due,

  -- Status and dates
  he.status,
  he.issued_date,
  he.expiry_date,

  -- Notes
  he.notes,
  he.created_at,
  he.updated_at
FROM household_employees he
JOIN households h ON h.id = he.household_id
LEFT JOIN pass_types pt ON pt.id = he.pass_type_id;

-- View for all payments with pass details
CREATE VIEW IF NOT EXISTS pass_payments_view AS
SELECT
  p.id,

  -- Pass type info
  pt.code as pass_type_code,
  pt.name as pass_type_name,
  pt.category as pass_type_category,

  -- Household info
  p.household_id,
  h.address as household_address,

  -- Vehicle info (if applicable)
  vp.vehicle_id,
  v.plate_number,
  vp.identifier as vehicle_identifier,

  -- Employee info (if applicable)
  he.id as employee_id,
  he.full_name as employee_name,
  he.id_number as employee_id_number,

  -- Payment details
  p.amount,
  p.method as payment_method,
  p.reference_number,
  p.status as payment_status,

  -- Who received
  u.email as received_by_email,
  u.first_name || ' ' || u.last_name as received_by_name,

  -- Notes and date
  p.notes,
  p.created_at
FROM payments p
LEFT JOIN pass_types pt ON pt.id = p.pass_type_id
LEFT JOIN households h ON h.id = p.household_id
LEFT JOIN vehicle_passes vp ON vp.id = p.vehicle_pass_id
LEFT JOIN vehicle_registrations v ON v.id = vp.vehicle_id
LEFT JOIN household_employees he ON he.id = p.employee_pass_id
LEFT JOIN users u ON u.id = p.received_by
WHERE p.payment_category IN ('vehicle_pass', 'employee_id');

-- ============================================================================
-- End of Migration
-- ============================================================================
