-- Make year column nullable in dues_rates table
-- This allows rates to be tracked by effective_date rather than year
-- Year becomes optional metadata for historical reference

-- SQLite doesn't support ALTER TABLE directly for this, so we recreate
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS dues_rates_new (
  id TEXT PRIMARY KEY,
  rate_per_sqm REAL NOT NULL,
  year INTEGER,
  effective_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id)
);

INSERT INTO dues_rates_new (id, rate_per_sqm, year, effective_date, created_at, created_by)
SELECT id, rate_per_sqm, year, effective_date, created_at, created_by
FROM dues_rates;

DROP TABLE dues_rates;
ALTER TABLE dues_rates_new RENAME TO dues_rates;

CREATE INDEX IF NOT EXISTS idx_dues_rates_year ON dues_rates(year);
CREATE INDEX IF NOT EXISTS idx_dues_rates_effective_date ON dues_rates(effective_date);

PRAGMA foreign_keys = ON;
