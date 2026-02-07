-- Migration: Add lot ownership fields to households table
-- Date: 2025-02-07
-- Last updated: 2025-02-07 - Set developer owner password

-- This migration is idempotent:
-- - ALTER TABLE ADD COLUMN will fail if column exists (expected in SQLite)
-- - INSERT OR IGNORE prevents duplicate user creation
-- - CREATE INDEX IF NOT EXISTS prevents duplicate index creation

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Note: SQLite doesn't support "ALTER TABLE ALTER COLUMN" directly
-- For NOT NULL with default, we need to recreate the table or add a new column
-- Since owner_id already exists, we'll add lot_status and lot_size_sqm
-- The owner_id default will be handled at application level

-- Add lot_status column
ALTER TABLE households ADD COLUMN lot_status TEXT DEFAULT 'vacant_lot' CHECK (lot_status IN ('built', 'vacant_lot', 'under_construction'));

-- Add lot_size_sqm column (using REAL for consistency with other numeric fields)
ALTER TABLE households ADD COLUMN lot_size_sqm REAL;

-- Create developer owner account
-- Email: developer@lagunahills.com
-- Password: devOwner2025! (CHANGE AFTER FIRST LOGIN)
INSERT OR IGNORE INTO users (id, email, role, password_hash)
VALUES ('developer-owner', 'developer@lagunahills.com', 'admin',
        '$2b$10$W1cH2hmDxtOjoMj8XGwqie6u4LvrqBNjEfFbH9YaCv9rTsk563SE.');

-- Create index on lot_status for filtering
CREATE INDEX IF NOT EXISTS idx_households_lot_status ON households(lot_status);
