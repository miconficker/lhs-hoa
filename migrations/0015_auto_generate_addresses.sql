-- Migration: Auto-generate addresses from street, block, lot
-- Date: 2026-02-11
--
-- Rationale: Address field should be auto-generated from street, block, lot
-- to eliminate redundancy and ensure consistency.

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Update all households to have address auto-generated from street, block, lot
UPDATE households
SET address =
  CASE
    WHEN street IS NOT NULL AND street != '' AND block IS NOT NULL AND block != '' AND lot IS NOT NULL AND lot != ''
    THEN street || ', Block ' || block || ', Lot ' || lot
    WHEN block IS NOT NULL AND block != '' AND lot IS NOT NULL AND lot != ''
    THEN 'Block ' || block || ', Lot ' || lot
    WHEN block IS NOT NULL AND block != ''
    THEN 'Block ' || block
    WHEN lot IS NOT NULL AND lot != ''
    THEN 'Lot ' || lot
    ELSE COALESCE(address, '')
  END
WHERE 1=1;
