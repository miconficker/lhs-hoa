-- Migration: Fix inquiry workflow - add new statuses to existing table
-- This migration adds the new inquiry workflow statuses without recreating the table

-- First, check if we need to update the booking_status constraint
-- SQLite doesn't support ALTER COLUMN for CHECK constraints, so we'll use a trigger instead

-- Drop the old trigger if exists
DROP TRIGGER IF EXISTS validate_booking_status;

-- Create a trigger to validate booking status values
CREATE TRIGGER IF NOT EXISTS validate_booking_status
BEFORE INSERT ON external_rentals
BEGIN
  SELECT CASE
    WHEN NEW.booking_status NOT IN (
      'inquiry_submitted',
      'pending_approval',
      'pending_payment',
      'pending_verification',
      'confirmed',
      'rejected',
      'cancelled'
    )
    THEN RAISE(ABORT, 'Invalid booking_status value')
  END;
END;

CREATE TRIGGER IF NOT EXISTS validate_booking_status_update
BEFORE UPDATE OF booking_status ON external_rentals
BEGIN
  SELECT CASE
    WHEN NEW.booking_status NOT IN (
      'inquiry_submitted',
      'pending_approval',
      'pending_payment',
      'pending_verification',
      'confirmed',
      'rejected',
      'cancelled'
    )
    THEN RAISE(ABORT, 'Invalid booking_status value')
  END;
END;

-- Add a note column if it doesn't exist (for guest_notes)
-- This will fail silently if the column already exists
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN, so we use a try-catch approach
-- This will be handled by the application layer
