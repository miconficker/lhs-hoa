-- migrations/0019_manual_delinquencies.sql
-- Track manual delinquency overrides with full audit trail
-- Date: 2026-03-12

CREATE TABLE IF NOT EXISTS manual_delinquencies (
  id TEXT PRIMARY KEY,
  lot_member_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  reason TEXT,
  marked_by TEXT NOT NULL,
  marked_at TEXT NOT NULL,
  waived_by TEXT,
  waived_at TEXT,
  waiver_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lot_member_id) REFERENCES lot_members(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id),
  FOREIGN KEY (waived_by) REFERENCES users(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_manual_delinquencies_lot_member ON manual_delinquencies(lot_member_id);
CREATE INDEX IF NOT EXISTS idx_manual_delinquencies_active ON manual_delinquencies(is_active);
CREATE INDEX IF NOT EXISTS idx_manual_delinquencies_marked_by ON manual_delinquencies(marked_by);
