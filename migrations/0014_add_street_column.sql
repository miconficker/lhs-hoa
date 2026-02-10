-- Migration: Add street column to households table
-- Date: 2026-02-10
--
-- Rationale: Subdivisions have multiple streets/phases. A hierarchical structure
-- of street -> block -> lot provides better organization and sorting capabilities.
-- This also makes addresses more unique and meaningful.

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Add street column to households table (nullable initially for backward compatibility)
ALTER TABLE households ADD COLUMN street TEXT;

-- Create index on street for filtering and sorting by street name
CREATE INDEX IF NOT EXISTS idx_households_street ON households(street);

-- Create composite index for street, block, lot ordering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_households_street_block_lot ON households(street, block, lot);
