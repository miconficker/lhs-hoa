-- Migration: Add status field to vehicle_passes for tracking active/inactive/replaced passes
-- This enables RFID replacement functionality

-- Add status column to vehicle_passes
ALTER TABLE vehicle_passes ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'replaced'));

-- Set all existing passes to active
UPDATE vehicle_passes SET status = 'active' WHERE status IS NULL;

-- Update the vehicles_with_passes_view to include status
DROP VIEW IF EXISTS vehicles_with_passes_view;

CREATE VIEW vehicles_with_passes_view AS
SELECT
  v.id,
  v.household_id,
  h.address as household_address,
  v.plate_number,
  v.make,
  v.model,
  v.color,
  v.status as vehicle_status,

  -- Sticker pass info
  sticker.id as sticker_pass_id,
  sticker.identifier as sticker_number,
  sticker.amount_due as sticker_amount_due,
  sticker.amount_paid as sticker_amount_paid,
  sticker.payment_status as sticker_payment_status,
  sticker.issued_date as sticker_issued_date,
  sticker.expiry_date as sticker_expiry_date,
  sticker.status as sticker_status,

  -- RFID pass info
  rfid.id as rfid_pass_id,
  rfid.identifier as rfid_code,
  rfid.amount_due as rfid_amount_due,
  rfid.amount_paid as rfid_amount_paid,
  rfid.payment_status as rfid_payment_status,
  rfid.issued_date as rfid_issued_date,
  rfid.expiry_date as rfid_expiry_date,
  rfid.status as rfid_status,

  -- Computed pass type (only consider active passes)
  CASE
    WHEN sticker.id IS NOT NULL AND sticker.status = 'active' AND rfid.id IS NOT NULL AND rfid.status = 'active' THEN 'both'
    WHEN sticker.id IS NOT NULL AND sticker.status = 'active' THEN 'sticker'
    WHEN rfid.id IS NOT NULL AND rfid.status = 'active' THEN 'rfid'
    ELSE NULL
  END as pass_type,

  -- Totals (only count active passes)
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
