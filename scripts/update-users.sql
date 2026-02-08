-- Delete existing test users and recreate with proper password hashes
DELETE FROM users WHERE id = 'admin-user';
DELETE FROM users WHERE id = 'resident-user';

INSERT INTO users (id, email, password_hash, role) VALUES 
  ('admin-user', 'admin@lagunahills.com', '$2b$10$.P2hOApEP/9bcs7yVqWwTeWktEPC4Y7urMUtpyu0MJQbu4n9AN8gG', 'admin'),
  ('resident-user', 'resident@lagunahills.com', '$2b$10$vK1r6Z9ayCnNdDNEuiNVTetI/REDEYCM11wSHrrGQ1vYU9cI2v5Yq', 'resident');
