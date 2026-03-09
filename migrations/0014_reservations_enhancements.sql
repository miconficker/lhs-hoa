-- Migration: Reservations Enhancements
-- Description: Add time blocks and external rentals tables, include tennis court as amenity
-- Date: 2026-03-09

-- Step 1: Recreate reservations table to include 'tennis-court' in amenity_type constraint
-- SQLite doesn't support ALTER CONSTRAINT, so we need to recreate the table

-- Current reservations table structure:
-- id, household_id, amenity_type, date, slot, status, purpose, created_at

-- Create new reservations table with updated constraint
CREATE TABLE IF NOT EXISTS reservations_new (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')) DEFAULT 'clubhouse',
    date DATE NOT NULL,
    slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
    purpose TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
    UNIQUE(household_id, amenity_type, date, slot)
);

-- Copy existing data to new table (if old table exists)
-- This will only copy rows that match the old constraint, so 'tennis-court' won't cause issues
INSERT OR IGNORE INTO reservations_new (id, household_id, amenity_type, date, slot, status, purpose, created_at)
SELECT id, household_id, amenity_type, date, slot, status, purpose, created_at
FROM reservations;

-- Drop old table
DROP TABLE IF EXISTS reservations;

-- Rename new table to reservations
ALTER TABLE reservations_new RENAME TO reservations;

-- Recreate indexes for reservations
CREATE INDEX IF NOT EXISTS idx_reservations_household ON reservations(household_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- Step 2: Create time_blocks table
-- This table stores blocks of time when amenities are unavailable for resident reservations
-- Reasons include: maintenance, private events, external rentals, HOA activities
CREATE TABLE IF NOT EXISTS time_blocks (
    id TEXT PRIMARY KEY,
    amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
    date DATE NOT NULL,
    slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),
    reason TEXT NOT NULL,
    created_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(amenity_type, date, slot)
);

-- Step 3: Create indexes for time_blocks
CREATE INDEX IF NOT EXISTS idx_time_blocks_date ON time_blocks(date);
CREATE INDEX IF NOT EXISTS idx_time_blocks_amenity_date ON time_blocks(amenity_type, date);

-- Step 4: Create external_rentals table
-- This table tracks rentals made by non-residents (external parties)
CREATE TABLE IF NOT EXISTS external_rentals (
    id TEXT PRIMARY KEY,
    amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
    date DATE NOT NULL,
    slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),
    renter_name TEXT NOT NULL,
    renter_contact TEXT,
    amount REAL NOT NULL,
    payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partial', 'paid', 'overdue')),
    amount_paid REAL DEFAULT 0,
    payment_method TEXT,
    receipt_number TEXT,
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(amenity_type, date, slot)
);

-- Step 5: Create indexes for external_rentals
CREATE INDEX IF NOT EXISTS idx_external_rentals_date ON external_rentals(date);
CREATE INDEX IF NOT EXISTS idx_external_rentals_payment_status ON external_rentals(payment_status);
CREATE INDEX IF NOT EXISTS idx_external_rentals_amenity_date ON external_rentals(amenity_type, date);
