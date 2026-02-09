-- Pre-approved emails table for SSO authentication
-- Admins add emails here, then users can sign in with Google OAuth

CREATE TABLE IF NOT EXISTS pre_approved_emails (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'resident', 'staff', 'guest')),
  household_id TEXT REFERENCES households(id),
  invited_by TEXT REFERENCES users(id),
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME,
  is_active BOOLEAN DEFAULT 1
);

-- Index for faster lookups during login
CREATE INDEX IF NOT EXISTS idx_pre_approved_emails_email ON pre_approved_emails(email);
CREATE INDEX IF NOT EXISTS idx_pre_approved_emails_active ON pre_approved_emails(is_active, accepted_at);
