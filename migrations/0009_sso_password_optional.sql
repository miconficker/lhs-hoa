-- Allow password_hash to be NULL for SSO users
-- SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table

-- Step 1: Create new users table with nullable password_hash
CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'resident', 'staff', 'guest')),
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Copy existing data
INSERT INTO users_new (id, email, password_hash, role, phone, created_at)
SELECT id, email, password_hash, role, phone, created_at
FROM users;

-- Step 3: Drop old table
DROP TABLE users;

-- Step 4: Rename new table
ALTER TABLE users_new RENAME TO users;
