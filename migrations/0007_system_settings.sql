-- Create system_settings table for centralized configuration
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- Seed default settings
INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, category, description) VALUES
  ('config-gcash-name', 'gcash_name', 'Laguna Hills HOA', 'payment', 'GCash account name'),
  ('config-gcash-number', 'gcash_number', '', 'payment', 'GCash contact number'),
  ('config-bank-name', 'bank_name', 'BPI', 'payment', 'Bank name'),
  ('config-bank-account', 'bank_account', '1234-5678-90', 'payment', 'Bank account number'),
  ('config-bank-account-name', 'bank_account_name', 'Laguna Hills HOA', 'payment', 'Bank account name'),
  ('config-file-size-limit', 'file_size_limit_mb', '5', 'uploads', 'Maximum file upload size in MB'),
  ('config-token-expiry-days', 'token_expiry_days', '7', 'auth', 'JWT token expiry in days'),
  ('config-pagination-limit', 'pagination_limit', '20', 'ui', 'Default items per page');
