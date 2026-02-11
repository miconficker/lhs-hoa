-- Migration: Add lot_coordinates column for storing polygon/point data
-- Date: 2026-02-11
--
-- Rationale: Enable database-first architecture
-- Store geometry (lot coordinates, lot polygons) directly in database
-- This eliminates need for static GeoJSON files and sync steps

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Add lot_coordinates column to households table (for storing point data)
ALTER TABLE households ADD COLUMN lot_coordinates TEXT;

-- Add lot_polygon column to households table (for storing lot boundary data)
ALTER TABLE households ADD COLUMN lot_polygon TEXT;

-- Create index for spatial queries
CREATE INDEX IF NOT EXISTS idx_households_lot_coordinates ON households(lot_coordinates);
