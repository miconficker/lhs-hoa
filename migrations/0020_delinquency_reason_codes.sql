-- migrations/0020_delinquency_reason_codes.sql
-- Add structured reason fields to manual_delinquencies
-- Date: 2026-03-12
-- ADDITIVE ONLY - safe to run immediately

-- Add reason_code with CHECK constraint for valid bylaw grounds
ALTER TABLE manual_delinquencies ADD COLUMN reason_code TEXT
  CHECK(reason_code IN (
    'failure_to_pay',
    'repeated_violation',
    'detrimental_conduct',
    'failure_to_attend'
  ));

-- Add reason_detail for supplementary information (e.g., rule citation)
ALTER TABLE manual_delinquencies ADD COLUMN reason_detail TEXT;

-- Backfill: migrate existing freeform reason into reason_detail
-- reason_code left NULL for legacy rows (they predate the structured system)
UPDATE manual_delinquencies
  SET reason_detail = reason
  WHERE reason IS NOT NULL AND reason_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_delinquencies_reason_code
  ON manual_delinquencies(reason_code);
