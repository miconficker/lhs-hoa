-- Add pricing and payment tracking to reservations table
-- This allows residents to pay for reservations at discounted rates vs external rentals

-- Step 1: Add payment columns to reservations table
ALTER TABLE reservations ADD COLUMN amount REAL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN amount_paid REAL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partial', 'paid', 'overdue'));
ALTER TABLE reservations ADD COLUMN payment_method TEXT;
ALTER TABLE reservations ADD COLUMN receipt_number TEXT;
ALTER TABLE reservations ADD COLUMN payment_due_date DATE;

-- Step 2: Create index on payment_status for filtering
CREATE INDEX IF NOT EXISTS idx_reservations_payment_status ON reservations(payment_status);

-- Step 3: Add pricing settings to system_settings table
-- Format: amenity_pricing_{amenity}_{slot}_{type}
-- Examples:
--   amenity_pricing_clubhouse_AM_resident = 500
--   amenity_pricing_clubhouse_AM_external = 1000
--   amenity_pricing_pool_FULL_DAY_resident = 800
--   amenity_pricing_pool_FULL_DAY_external = 1500

-- Insert default pricing (resident = 50% of external rate)
-- Category: pricing
INSERT INTO system_settings (id, setting_key, setting_value, category, description) VALUES
  -- Clubhouse
  ('pricing-001', 'amenity_pricing_clubhouse_AM_resident', '500', 'pricing', 'Resident rate for Clubhouse morning slot'),
  ('pricing-002', 'amenity_pricing_clubhouse_AM_external', '1000', 'pricing', 'External rate for Clubhouse morning slot'),
  ('pricing-003', 'amenity_pricing_clubhouse_PM_resident', '500', 'pricing', 'Resident rate for Clubhouse afternoon slot'),
  ('pricing-004', 'amenity_pricing_clubhouse_PM_external', '1000', 'pricing', 'External rate for Clubhouse afternoon slot'),
  ('pricing-005', 'amenity_pricing_clubhouse_FULL_DAY_resident', '800', 'pricing', 'Resident rate for Clubhouse full day'),
  ('pricing-006', 'amenity_pricing_clubhouse_FULL_DAY_external', '1500', 'pricing', 'External rate for Clubhouse full day'),

  -- Pool
  ('pricing-007', 'amenity_pricing_pool_AM_resident', '400', 'pricing', 'Resident rate for Pool morning slot'),
  ('pricing-008', 'amenity_pricing_pool_AM_external', '800', 'pricing', 'External rate for Pool morning slot'),
  ('pricing-009', 'amenity_pricing_pool_PM_resident', '400', 'pricing', 'Resident rate for Pool afternoon slot'),
  ('pricing-010', 'amenity_pricing_pool_PM_external', '800', 'pricing', 'External rate for Pool afternoon slot'),
  ('pricing-011', 'amenity_pricing_pool_FULL_DAY_resident', '600', 'pricing', 'Resident rate for Pool full day'),
  ('pricing-012', 'amenity_pricing_pool_FULL_DAY_external', '1200', 'pricing', 'External rate for Pool full day'),

  -- Basketball Court
  ('pricing-013', 'amenity_pricing_basketball-court_AM_resident', '200', 'pricing', 'Resident rate for Basketball Court morning slot'),
  ('pricing-014', 'amenity_pricing_basketball-court_AM_external', '400', 'pricing', 'External rate for Basketball Court morning slot'),
  ('pricing-015', 'amenity_pricing_basketball-court_PM_resident', '200', 'pricing', 'Resident rate for Basketball Court afternoon slot'),
  ('pricing-016', 'amenity_pricing_basketball-court_PM_external', '400', 'pricing', 'External rate for Basketball Court afternoon slot'),
  ('pricing-017', 'amenity_pricing_basketball-court_FULL_DAY_resident', '300', 'pricing', 'Resident rate for Basketball Court full day'),
  ('pricing-018', 'amenity_pricing_basketball-court_FULL_DAY_external', '600', 'pricing', 'External rate for Basketball Court full day'),

  -- Tennis Court
  ('pricing-019', 'amenity_pricing_tennis-court_AM_resident', '200', 'pricing', 'Resident rate for Tennis Court morning slot'),
  ('pricing-020', 'amenity_pricing_tennis-court_AM_external', '400', 'pricing', 'External rate for Tennis Court morning slot'),
  ('pricing-021', 'amenity_pricing_tennis-court_PM_resident', '200', 'pricing', 'Resident rate for Tennis Court afternoon slot'),
  ('pricing-022', 'amenity_pricing_tennis-court_PM_external', '400', 'pricing', 'External rate for Tennis Court afternoon slot'),
  ('pricing-023', 'amenity_pricing_tennis-court_FULL_DAY_resident', '300', 'pricing', 'Resident rate for Tennis Court full day'),
  ('pricing-024', 'amenity_pricing_tennis-court_FULL_DAY_external', '600', 'pricing', 'External rate for Tennis Court full day')
ON CONFLICT(setting_key) DO NOTHING;
