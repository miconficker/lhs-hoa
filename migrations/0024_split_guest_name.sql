-- Migration: Split guest_name into guest_first_name and guest_last_name
-- This makes external bookings consistent with resident bookings

-- Add new columns
ALTER TABLE external_rentals ADD COLUMN guest_first_name TEXT;
ALTER TABLE external_rentals ADD COLUMN guest_last_name TEXT;

-- Backfill existing data by splitting guest_name
-- Logic: Last word is last_name, everything before is first_name
UPDATE external_rentals
SET
  guest_first_name = CASE
    WHEN guest_name IS NULL THEN NULL
    WHEN Instr(guest_name, ' ') = 0 THEN guest_name  -- No space, entire name is first_name
    ELSE Substr(guest_name, 1, Instr(guest_name, ' ') - 1)  -- Everything before first space
  END,
  guest_last_name = CASE
    WHEN guest_name IS NULL THEN NULL
    WHEN Instr(guest_name, ' ') = 0 THEN NULL  -- No space, no last_name
    ELSE Substr(guest_name, Instr(guest_name, ' ') + 1)  -- Everything after first space
  END
WHERE guest_name IS NOT NULL
  AND (guest_first_name IS NULL OR guest_last_name IS NULL);

-- Also backfill from renter_name for admin-created bookings
UPDATE external_rentals
SET
  guest_first_name = CASE
    WHEN renter_name IS NULL THEN guest_first_name
    WHEN Instr(renter_name, ' ') = 0 THEN renter_name
    ELSE Substr(renter_name, 1, Instr(renter_name, ' ') - 1)
  END,
  guest_last_name = CASE
    WHEN renter_name IS NULL THEN guest_last_name
    WHEN Instr(renter_name, ' ') = 0 THEN NULL
    ELSE Substr(renter_name, Instr(renter_name, ' ') + 1)
  END
WHERE renter_name IS NOT NULL
  AND guest_name IS NULL
  AND (guest_first_name IS NULL OR guest_last_name IS NULL);

-- Note: We're keeping guest_name column for backward compatibility
-- Future insertions should populate guest_first_name and guest_last_name
