-- Migration: Add payment verification notification types
-- Date: 2025-02-11
--
-- Rationale: Add new notification types for payment verification workflow
-- These types are used in the CHECK constraint of the notifications table

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Since SQLite doesn't support ALTER TABLE on CHECK constraints,
-- we need to recreate the notifications table with updated constraint

-- Step 1: Create new notifications table with updated CHECK constraint
CREATE TABLE IF NOT EXISTS notifications_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'demand_letter',
    'reminder',
    'late_notice',
    'announcement',
    'alert',
    'payment_verification_requested',
    'payment_verified',
    'payment_rejected'
  )),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME
);

-- Step 2: Copy existing data to new table
INSERT INTO notifications_new
SELECT * FROM notifications;

-- Step 3: Drop old table
DROP TABLE notifications;

-- Step 4: Rename new table
ALTER TABLE notifications_new RENAME TO notifications;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
