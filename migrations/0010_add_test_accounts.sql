-- ============================================================================
-- ADD TEST ACCOUNTS
-- This migration adds test accounts for development and testing
-- ============================================================================

-- Admin test account
-- Email: admin@test.com
-- Password: admin123
-- Role: admin
INSERT OR IGNORE INTO users (id, email, role, password_hash, first_name, last_name)
VALUES ('test-admin', 'admin@test.com', 'admin',
        '$2b$10$2T0JM3QvRlgJBXzaCw/cOOLCcAP2h2YeR6sZPrM/eYQOHQuz/ew1G',
        'Test', 'Admin');

-- Resident test account
-- Email: resident@test.com
-- Password: resident123
-- Role: resident
INSERT OR IGNORE INTO users (id, email, role, password_hash, first_name, last_name)
VALUES ('test-resident', 'resident@test.com', 'resident',
        '$2b$10$a4EXn0fOLKWaln9SVjVloOoQCPywNFm1uk5AK6a5sOvE8m1d63UvS',
        'Test', 'Resident');

-- Create a test household for the resident
INSERT OR IGNORE INTO households (id, address, street, block, lot, owner_id, lot_status, lot_type)
VALUES ('test-household', '123 Test Street', 'Test Street', '1', '1', 'test-resident', 'built', 'residential');

-- Link resident to household
INSERT OR IGNORE INTO residents (id, household_id, user_id, first_name, last_name, is_primary)
VALUES ('test-resident-record', 'test-household', 'test-resident', 'Test', 'Resident', 1);
