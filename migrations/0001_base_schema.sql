-- ============================================================================
-- Laguna Hills HOA - Base Schema
-- ============================================================================
-- This is a compressed schema combining all previous migrations.
-- Date: 2026-02-11
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- USERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,  -- Nullable for SSO users
  role TEXT NOT NULL CHECK(role IN ('admin', 'resident', 'staff', 'guest')),
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pre-approved emails for SSO authentication
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

CREATE INDEX IF NOT EXISTS idx_pre_approved_emails_email ON pre_approved_emails(email);
CREATE INDEX IF NOT EXISTS idx_pre_approved_emails_active ON pre_approved_emails(is_active, accepted_at);

-- ============================================================================
-- HOUSEHOLDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  street TEXT,
  block TEXT,
  lot TEXT,
  latitude REAL,
  longitude REAL,
  map_marker_x REAL,
  map_marker_y REAL,
  owner_id TEXT REFERENCES users(id),
  lot_status TEXT DEFAULT 'vacant_lot' CHECK (lot_status IN ('built', 'vacant_lot', 'under_construction')),
  lot_type TEXT DEFAULT 'residential' CHECK (lot_type IN ('residential', 'resort', 'commercial', 'community', 'utility', 'open_space')),
  lot_size_sqm REAL,
  lot_label TEXT,
  lot_description TEXT,
  household_group_id TEXT,
  is_primary_lot BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_households_owner ON households(owner_id);
CREATE INDEX IF NOT EXISTS idx_households_block_lot ON households(block, lot);
CREATE INDEX IF NOT EXISTS idx_households_street ON households(street);
CREATE INDEX IF NOT EXISTS idx_households_street_block_lot ON households(street, block, lot);
CREATE INDEX IF NOT EXISTS idx_households_lot_status ON households(lot_status);
CREATE INDEX IF NOT EXISTS idx_household_group ON households(household_group_id);

-- ============================================================================
-- RESIDENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS residents (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  user_id TEXT REFERENCES users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SERVICE REQUESTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in-progress', 'completed', 'rejected')),
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- ============================================================================
-- RESERVATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court')),
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'cancelled')),
  purpose TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, amenity_type, date, slot)
);

-- ============================================================================
-- ANNOUNCEMENTS & EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT CHECK(category IN ('event', 'urgent', 'info', 'policy')),
  is_pinned BOOLEAN DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATETIME NOT NULL,
  location TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PAYMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'PHP',
  method TEXT NOT NULL CHECK(method IN ('gcash', 'paymaya', 'instapay', 'cash', 'in-person')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  reference_number TEXT,
  period TEXT NOT NULL,
  payment_category TEXT DEFAULT 'dues' CHECK(payment_category IN ('dues', 'vehicle_pass', 'employee_id')),
  late_fee_amount REAL DEFAULT 0,
  late_fee_months INTEGER DEFAULT 0,
  received_by TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME
);

-- ============================================================================
-- DOCUMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT CHECK(category IN ('rules', 'forms', 'minutes', 'policies')),
  file_url TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- POLLS
-- ============================================================================
CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  ends_at DATETIME NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES polls(id),
  household_id TEXT NOT NULL REFERENCES households(id),
  selected_option TEXT NOT NULL,
  lot_count INTEGER DEFAULT 1,
  voting_method TEXT DEFAULT 'online' CHECK (voting_method IN ('online', 'in-person')),
  recorded_by TEXT REFERENCES users(id),
  voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(poll_id, household_id)
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('demand_letter', 'reminder', 'late_notice', 'announcement', 'alert')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- DUES & PAYMENT DEMANDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS dues_rates (
  id TEXT PRIMARY KEY,
  rate_per_sqm REAL NOT NULL,
  year INTEGER,
  effective_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_dues_rates_year ON dues_rates(year);
CREATE INDEX IF NOT EXISTS idx_dues_rates_effective_date ON dues_rates(effective_date);

CREATE TABLE IF NOT EXISTS payment_demands (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  year INTEGER NOT NULL,
  demand_sent_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount_due REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'suspended')),
  paid_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_demands_user_year ON payment_demands(user_id, year);
CREATE INDEX IF NOT EXISTS idx_payment_demands_status ON payment_demands(status);

CREATE TABLE IF NOT EXISTS installment_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  year INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  schedule TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  approved_by TEXT NOT NULL REFERENCES users(id),
  approved_at DATETIME NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_installment_plans_user ON installment_plans(user_id);

CREATE TABLE IF NOT EXISTS installment_payments (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES installment_plans(id),
  due_date DATE NOT NULL,
  amount REAL NOT NULL,
  paid_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'missed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_installment_payments_plan ON installment_payments(plan_id);

-- ============================================================================
-- PASS MANAGEMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS household_employees (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  full_name TEXT NOT NULL,
  employee_type TEXT NOT NULL CHECK(employee_type IN ('driver', 'housekeeper', 'caretaker', 'other')),
  id_number TEXT NOT NULL UNIQUE,
  photo_url TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'revoked', 'expired')),
  issued_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_household_employees_household_id ON household_employees(household_id);
CREATE INDEX IF NOT EXISTS idx_household_employees_status ON household_employees(status);
CREATE INDEX IF NOT EXISTS idx_household_employees_expiry_date ON household_employees(expiry_date);

CREATE TABLE IF NOT EXISTS vehicle_registrations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  plate_number TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT NOT NULL,
  pass_type TEXT NOT NULL CHECK(pass_type IN ('sticker', 'rfid', 'both')),
  rfid_code TEXT UNIQUE,
  sticker_number TEXT UNIQUE,
  status TEXT DEFAULT 'pending_payment' CHECK(status IN ('pending_payment', 'pending_approval', 'active', 'cancelled')),
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid')),
  issued_date DATE,
  amount_due REAL,
  amount_paid REAL,
  payment_method TEXT CHECK(payment_method IN ('gcash', 'paymaya', 'instapay', 'cash', 'in-person')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, plate_number)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_household_id ON vehicle_registrations(household_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_status ON vehicle_registrations(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_plate ON vehicle_registrations(plate_number);

CREATE TABLE IF NOT EXISTS pass_fees (
  id TEXT PRIMARY KEY,
  fee_type TEXT NOT NULL CHECK(fee_type IN ('sticker', 'rfid', 'both')),
  amount REAL NOT NULL,
  effective_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEED DATA
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
