-- migrations/0007_lot_types_labels.sql
-- For SQLite, we need to recreate the table to modify CHECK constraint
-- First, create new table with updated constraints
CREATE TABLE IF NOT EXISTS households_new (
  id TEXT PRIMARY KEY,
  address TEXT,
  block TEXT,
  lot TEXT,
  latitude REAL,
  longitude REAL,
  map_marker_x REAL,
  map_marker_y REAL,
  owner_id TEXT,
  lot_status TEXT DEFAULT 'vacant_lot' CHECK (lot_status IN ('built', 'vacant_lot', 'under_construction')),
  lot_type TEXT DEFAULT 'residential' CHECK (lot_type IN ('residential', 'resort', 'commercial', 'community', 'utility', 'open_space')),
  lot_size_sqm REAL,
  lot_label TEXT,
  lot_description TEXT,
  household_group_id TEXT,
  is_primary_lot BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Copy data from old table
INSERT INTO households_new
SELECT
  id, address, block, lot, latitude, longitude, map_marker_x, map_marker_y,
  owner_id, lot_status,
  -- Update lot_type: if existing value is not in new enum, default to residential
  CASE
    WHEN lot_type IN ('residential', 'resort', 'commercial') THEN lot_type
    ELSE 'residential'
  END as lot_type,
  lot_size_sqm,
  NULL as lot_label,
  NULL as lot_description,
  household_group_id,
  is_primary_lot,
  created_at
FROM households;

-- Drop old table and rename new one
DROP TABLE households;
ALTER TABLE households_new RENAME TO households;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_households_owner ON households(owner_id);
CREATE INDEX IF NOT EXISTS idx_households_block_lot ON households(block, lot);
CREATE INDEX IF NOT EXISTS idx_household_group ON households(household_group_id);
