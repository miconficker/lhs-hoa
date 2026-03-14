-- Migration: 0027_backfill_and_views.sql
-- Date: 2026-03-14
-- Works with actual remote schema (no guest_first_name/guest_last_name columns)

-- ============================================================================
-- STEP 1: Build dedup staging tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS _migration_dedup_email AS
SELECT
  guest_email AS email,
  (SELECT id FROM external_rentals e2
   WHERE e2.guest_email = e1.guest_email
   ORDER BY e2.created_at DESC LIMIT 1) AS canonical_id
FROM external_rentals e1
WHERE guest_email IS NOT NULL
GROUP BY guest_email;

CREATE TABLE IF NOT EXISTS _migration_dedup_contact AS
SELECT
  renter_contact AS email,
  (SELECT id FROM external_rentals e2
   WHERE e2.renter_contact = e1.renter_contact
     AND e1.guest_email IS NULL
   ORDER BY e2.created_at DESC LIMIT 1) AS canonical_id
FROM external_rentals e1
WHERE renter_contact IS NOT NULL
  AND guest_email IS NULL
GROUP BY renter_contact;

-- ============================================================================
-- STEP 2: Migrate external guests to customers
-- (Uses guest_name/renter_name only — no guest_first_name column on remote)
-- ============================================================================

-- Guests with email
INSERT OR IGNORE INTO customers (
  id, first_name, last_name, email, phone,
  guest_notes, created_at, updated_at, created_ip, ip_retained_until
)
SELECT
  dm.canonical_id,
  CASE
    WHEN COALESCE(er.guest_name, er.renter_name) IS NULL THEN 'Guest'
    WHEN Instr(COALESCE(er.guest_name, er.renter_name), ' ') > 0
    THEN Substr(COALESCE(er.guest_name, er.renter_name), 1,
         Instr(COALESCE(er.guest_name, er.renter_name), ' ') - 1)
    ELSE COALESCE(er.guest_name, er.renter_name)
  END AS first_name,
  CASE
    WHEN Instr(COALESCE(er.guest_name, er.renter_name, ''), ' ') > 0
    THEN Substr(COALESCE(er.guest_name, er.renter_name, ''),
         Instr(COALESCE(er.guest_name, er.renter_name, ''), ' ') + 1)
    ELSE NULL
  END AS last_name,
  er.guest_email,
  er.guest_phone,
  er.guest_notes,
  er.created_at,
  er.created_at,
  er.created_ip,
  datetime(er.created_at, '+90 days')
FROM _migration_dedup_email dm
JOIN external_rentals er ON er.id = dm.canonical_id;

-- Guests with renter_contact only (admin-created, no email)
INSERT OR IGNORE INTO customers (
  id, first_name, last_name, email, phone,
  guest_notes, created_at, updated_at, created_ip, ip_retained_until
)
SELECT
  dm.canonical_id,
  CASE
    WHEN COALESCE(er.renter_name, er.guest_name) IS NULL THEN 'Guest'
    WHEN Instr(COALESCE(er.renter_name, er.guest_name), ' ') > 0
    THEN Substr(COALESCE(er.renter_name, er.guest_name), 1,
         Instr(COALESCE(er.renter_name, er.guest_name), ' ') - 1)
    ELSE COALESCE(er.renter_name, er.guest_name)
  END AS first_name,
  CASE
    WHEN Instr(COALESCE(er.renter_name, er.guest_name, ''), ' ') > 0
    THEN Substr(COALESCE(er.renter_name, er.guest_name, ''),
         Instr(COALESCE(er.renter_name, er.guest_name, ''), ' ') + 1)
    ELSE NULL
  END AS last_name,
  NULL,
  er.renter_contact,
  er.guest_notes,
  er.created_at,
  er.created_at,
  er.created_ip,
  datetime(er.created_at, '+90 days')
FROM _migration_dedup_contact dm
JOIN external_rentals er ON er.id = dm.canonical_id;

-- Guests with no email and no renter_contact (one customer per booking)
INSERT OR IGNORE INTO customers (
  id, first_name, last_name, email, phone,
  guest_notes, created_at, updated_at, created_ip, ip_retained_until
)
SELECT
  er.id,
  CASE
    WHEN COALESCE(er.guest_name, er.renter_name) IS NULL THEN 'Guest'
    WHEN Instr(COALESCE(er.guest_name, er.renter_name), ' ') > 0
    THEN Substr(COALESCE(er.guest_name, er.renter_name), 1,
         Instr(COALESCE(er.guest_name, er.renter_name), ' ') - 1)
    ELSE COALESCE(er.guest_name, er.renter_name)
  END AS first_name,
  CASE
    WHEN Instr(COALESCE(er.guest_name, er.renter_name, ''), ' ') > 0
    THEN Substr(COALESCE(er.guest_name, er.renter_name, ''),
         Instr(COALESCE(er.guest_name, er.renter_name, ''), ' ') + 1)
    ELSE NULL
  END AS last_name,
  NULL,
  er.guest_phone,
  er.guest_notes,
  er.created_at,
  er.created_at,
  er.created_ip,
  datetime(er.created_at, '+90 days')
FROM external_rentals er
WHERE er.guest_email IS NULL
  AND er.renter_contact IS NULL
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = er.id);

-- ============================================================================
-- STEP 3: Migrate external_rentals to bookings
-- ============================================================================
INSERT OR IGNORE INTO bookings (
  id, customer_id, amenity_type, date, slot,
  base_rate, duration_hours, day_multiplier, season_multiplier,
  resident_discount, amount, pricing_calculated_at,
  payment_status, amount_paid, payment_method, receipt_number,
  proof_of_payment_url, booking_status, purpose,
  admin_notes, rejection_reason, approved_at, approved_by,
  created_at, created_by, created_ip, updated_at
)
SELECT
  er.id,
  COALESCE(
    (SELECT canonical_id FROM _migration_dedup_email WHERE email = er.guest_email),
    (SELECT canonical_id FROM _migration_dedup_contact WHERE email = er.renter_contact),
    er.id
  ) AS customer_id,
  er.amenity_type,
  er.date,
  er.slot,
  COALESCE(er.amount, 0),
  CASE er.slot WHEN 'AM' THEN 4 WHEN 'PM' THEN 4 ELSE 9 END,
  1.0, 1.0, 0,
  COALESCE(er.amount, 0),
  er.created_at,
  COALESCE(er.payment_status, 'unpaid'),
  COALESCE(er.amount_paid, 0),
  er.payment_method,
  er.receipt_number,
  er.proof_of_payment_url,
  CASE er.booking_status
    WHEN 'pending_payment'      THEN 'inquiry_submitted'
    WHEN 'pending_approval'     THEN 'pending_approval'
    WHEN 'pending_verification' THEN 'pending_verification'
    WHEN 'confirmed'            THEN 'confirmed'
    WHEN 'rejected'             THEN 'rejected'
    WHEN 'cancelled'            THEN 'cancelled'
    ELSE 'inquiry_submitted'
  END,
  er.guest_notes,
  er.admin_notes,
  er.rejection_reason,
  CASE WHEN er.booking_status IN ('confirmed', 'pending_verification')
       THEN er.created_at ELSE NULL END,
  er.created_by,
  er.created_at,
  er.created_by,
  er.created_ip,
  er.created_at
FROM external_rentals er;

-- ============================================================================
-- STEP 4: Migrate resident reservations to bookings
-- ============================================================================
INSERT OR IGNORE INTO bookings (
  id, user_id, household_id, amenity_type, date, slot,
  base_rate, duration_hours, day_multiplier, season_multiplier,
  resident_discount, amount, pricing_calculated_at,
  payment_status, amount_paid, payment_method, receipt_number,
  booking_status, purpose, created_at, updated_at
)
SELECT
  r.id,
  lm.user_id,
  lm.household_id,
  r.amenity_type,
  r.date,
  r.slot,
  COALESCE(r.amount, 0),
  CASE r.slot WHEN 'AM' THEN 4 WHEN 'PM' THEN 4 ELSE 9 END,
  1.0, 1.0, 0.5,
  COALESCE(r.amount, 0),
  r.created_at,
  COALESCE(r.payment_status, 'unpaid'),
  COALESCE(r.amount_paid, 0),
  r.payment_method,
  r.receipt_number,
  CASE r.status
    WHEN 'pending'   THEN 'pending_resident'
    WHEN 'confirmed' THEN 'confirmed'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'pending_resident'
  END,
  r.purpose,
  r.created_at,
  r.created_at
FROM reservations r
JOIN lot_members lm ON lm.household_id = r.household_id
  AND lm.member_type = 'primary_owner';

-- ============================================================================
-- STEP 5: Compatibility views
-- ============================================================================
CREATE VIEW IF NOT EXISTS reservations_legacy AS
  SELECT
    b.id, b.household_id, b.amenity_type, b.date, b.slot,
    b.amount, b.payment_status, b.amount_paid, b.payment_method,
    b.receipt_number, b.booking_status AS status,
    b.purpose, b.created_at, b.created_by
  FROM bookings b
  WHERE b.user_id IS NOT NULL AND b.deleted_at IS NULL;

CREATE VIEW IF NOT EXISTS external_rentals_legacy AS
  SELECT
    b.id, b.amenity_type, b.date, b.slot,
    b.amount, b.payment_status, b.amount_paid, b.payment_method,
    b.receipt_number, b.booking_status,
    c.first_name || ' ' || c.last_name AS guest_name,
    c.first_name AS guest_first_name,
    c.last_name AS guest_last_name,
    c.email AS guest_email,
    c.phone AS guest_phone,
    b.proof_of_payment_url, b.admin_notes, b.rejection_reason,
    b.created_at, b.created_by, b.created_ip,
    b.approved_at, b.approved_by,
    c.guest_notes, b.purpose
  FROM bookings b
  JOIN customers c ON b.customer_id = c.id
  WHERE b.user_id IS NULL AND b.deleted_at IS NULL;

-- ============================================================================
-- STEP 6: Drop staging tables
-- ============================================================================
DROP TABLE IF EXISTS _migration_dedup_email;
DROP TABLE IF EXISTS _migration_dedup_contact;