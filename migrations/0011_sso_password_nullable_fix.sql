-- Make password_hash nullable for SSO users
-- This version disables foreign keys temporarily to allow the table recreation

-- Step 1: Disable foreign key constraints
PRAGMA foreign_keys = OFF;

-- Step 2: Create new users table with nullable password_hash
CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'resident', 'staff', 'guest')),
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Copy existing data
INSERT INTO users_new (id, email, password_hash, role, phone, first_name, last_name, created_at)
SELECT id, email, password_hash, role, phone, first_name, last_name, created_at
FROM users;

-- Step 4: Drop old table
DROP TABLE users;

-- Step 5: Rename new table
ALTER TABLE users_new RENAME TO users;

-- Step 6: Re-enable foreign key constraints
PRAGMA foreign_keys = ON;
