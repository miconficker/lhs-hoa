-- ============================================================================
-- SEED DATA
-- This migration contains seed data that was previously in 0001_base_schema.sql
-- Separating seed data makes it easier to distinguish between schema and data changes
-- ============================================================================

-- Default pass fees (updated for unified pass system - uses pass_type_id)
INSERT OR IGNORE INTO pass_fees (id, pass_type_id, amount, effective_date)
VALUES
  ('default-sticker', 'pt-sticker', 500, DATE('now')),
  ('default-rfid', 'pt-rfid', 800, DATE('now'));

-- Developer owner account (if not exists)
-- Email: developer@lagunahills.com
-- Password: devOwner2025! (CHANGE AFTER FIRST LOGIN)
INSERT OR IGNORE INTO users (id, email, role, password_hash)
VALUES ('developer-owner', 'developer@lagunahills.com', 'admin',
        '$2b$10$W1cH2hmDxtOjoMj8XGwqie6u4LvrqBNjEfFbH9YaCv9rTsk563SE.');
