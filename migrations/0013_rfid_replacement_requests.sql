-- Migration: Add RFID replacement requests table
-- This enables user-initiated RFID replacement requests with admin approval workflow

CREATE TABLE IF NOT EXISTS rfid_replacement_requests (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicle_registrations(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id),
  old_rfid_pass_id TEXT NOT NULL REFERENCES vehicle_passes(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_notes TEXT,
  new_rfid_pass_id TEXT REFERENCES vehicle_passes(id),
  requested_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rfid_replacement_status ON rfid_replacement_requests(status);
CREATE INDEX IF NOT EXISTS idx_rfid_replacement_household ON rfid_replacement_requests(household_id);
