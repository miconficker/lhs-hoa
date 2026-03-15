-- Migration: 0031_add_customer_id_to_notifications.sql
-- Date: 2026-03-15
-- Description: Add customer_id column to notifications table to support external guest notifications

-- Add customer_id column (nullable, for external guests)
ALTER TABLE notifications ADD COLUMN customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE;

-- Add index for customer_id lookups
CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON notifications(customer_id);

-- Update existing booking_status notifications from external_rentals to include customer_id
-- This is a one-time backfill for existing notifications
UPDATE notifications
SET customer_id = (
  SELECT c.id
  FROM (
    -- External rentals have guest info but no customer_id
    SELECT id, guest_email as email
    FROM external_rentals
    WHERE guest_email IS NOT NULL
  ) e
  INNER JOIN customers c ON c.email = e.email
  WHERE notifications.link LIKE '/bookings/' || e.id || '%'
)
WHERE type = 'booking_status'
  AND customer_id IS NULL
  AND user_id IS NULL;
