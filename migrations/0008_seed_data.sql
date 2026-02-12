-- ============================================================================
-- SEED DATA
-- This migration contains seed data that was previously in 0001_base_schema.sql
-- Separating seed data makes it easier to distinguish between schema and data changes
-- ============================================================================

-- Default pass fees
INSERT OR IGNORE INTO pass_fees (id, fee_type, amount, effective_date)
VALUES
  ('default-sticker', 'sticker', 500, DATE('now')),
  ('default-rfid', 'rfid', 800, DATE('now')),
  ('default-both', 'both', 1000, DATE('now'));

-- Developer owner account (if not exists)
-- Email: developer@lagunahills.com
-- Password: devOwner2025! (CHANGE AFTER FIRST LOGIN)
INSERT OR IGNORE INTO users (id, email, role, password_hash)
VALUES ('developer-owner', 'developer@lagunahills.com', 'admin',
        '$2b$10$W1cH2hmDxtOjoMj8XGwqie6u4LvrqBNjEfFbH9YaCv9rTsk563SE.');
