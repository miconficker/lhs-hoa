-- Board members table for tracking elected officials
CREATE TABLE IF NOT EXISTS board_members (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  position TEXT,
  term_start TEXT NOT NULL,
  term_end TEXT NOT NULL,
  resigned_at TEXT,
  resignation_reason TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Add is_free_booking column to reservations table (if not exists)
-- This marks reservations that use board member free booking benefit
-- NOTE: Column already added from previous partial run
-- ALTER TABLE reservations ADD COLUMN is_free_booking INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_board_members_user ON board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_board_members_dates ON board_members(term_start, term_end);

-- Election and board member settings
INSERT INTO system_settings (id, setting_key, setting_value, category, description) VALUES
  ('election-001', 'last_election_date', '2025-12-00', 'election', 'Last board election date (YYYY-MM)'),
  ('election-002', 'election_cycle_years', '2', 'election', 'Years between elections'),
  ('board-001', 'board_member_free_bookings', '1', 'pricing', 'Free bookings per calendar year for board members')
ON CONFLICT(setting_key) DO NOTHING;
