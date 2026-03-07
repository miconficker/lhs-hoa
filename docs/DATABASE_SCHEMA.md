# Database Schema Documentation

**Laguna Hills HOA Management System**
**Last Updated:** 2026-03-07
**Database:** Cloudflare D1 (SQLite)
**Migration Version:** 0009

---

## Table of Contents

- [Overview](#overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Core Tables](#core-tables)
- [Supporting Tables](#supporting-tables)
- [Indexes](#indexes)
- [Relationships](#relationships)
- [Migration History](#migration-history)
- [Query Patterns](#query-patterns)

---

## Overview

The Laguna Hills HOA system uses **Cloudflare D1** (SQLite) as its primary database. D1 provides a serverless, edge-hosted SQLite database with automatic scaling and global distribution.

### Database Characteristics

- **Type:** SQLite (D1)
- **Environment:** Cloudflare Workers (edge computing)
- **Local Development:** Wrangler CLI with `--local` flag
- **Migrations:** Located in `migrations/` directory
- **Total Tables:** 23 tables
- **Total Indexes:** 15+ indexes

### Design Principles

1. **UUID Primary Keys:** All tables use `TEXT` UUIDs for primary keys
2. **Soft Deletes:** No hard deletes (audit trail maintained)
3. **Timestamps:** All tables include `created_at` DATETIME
4. **Foreign Keys:** Referential integrity enforced where applicable
5. **JSON Columns:** Used for flexible data (poll options, settings)

---

## Entity Relationship Diagram

```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│    users    │────1:N──│ households  │────1:N──│  residents   │
│             │         │             │         │              │
│ - id (PK)   │         │ - id (PK)   │         │ - id (PK)    │
│ - email     │         │ - owner_id  │         │ - user_id    │
│ - role      │         │ - address   │         │ - household  │
└─────────────┘         └──────┬──────┘         └──────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼──────┐  ┌────▼─────┐  ┌─────▼──────┐
        │ service_req  │  │ payments │  │reservations│
        │              │  │          │  │            │
        │ - household  │  │ - house  │  │ - household│
        └──────────────┘  └──────────┘  └────────────┘

┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│    polls    │────1:N──│ poll_votes  │         │ notifications│
│             │         │             │         │              │
│ - id (PK)   │         │ - poll_id   │         │ - user_id    │
│ - question  │         │ - household │         │ - type       │
└─────────────┘         └─────────────┘         └──────────────┘
```

---

## Core Tables

### `users`

User accounts and authentication records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID identifier |
| `email` | TEXT | UNIQUE, NOT NULL | User email address |
| `password_hash` | TEXT | NULLABLE | Bcrypt hash (NULL for OAuth) |
| `role` | TEXT | NOT NULL, CHECK | admin, resident, staff, guest |
| `phone` | TEXT | NULLABLE | Phone number |
| `first_name` | TEXT | NULLABLE | First name |
| `last_name` | TEXT | NULLABLE | Last name |
| `created_at` | DATETIME | DEFAULT NOW() | Account creation timestamp |

**Indexes:**
- `idx_users_email` on `email` (unique)

**Business Rules:**
- Email must be unique across all users
- Role determines access permissions (RBAC)
- Password hash uses bcryptjs (10 rounds)
- OAuth users have NULL password_hash

---

### `households`

Property and household information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID identifier |
| `address` | TEXT | NOT NULL | Full property address |
| `street` | TEXT | NULLABLE | Street name |
| `block` | TEXT | NULLABLE | Block number |
| `lot` | TEXT | NULLABLE | Lot number |
| `latitude` | REAL | NULLABLE | GPS latitude |
| `longitude` | REAL | NULLABLE | GPS longitude |
| `map_marker_x` | REAL | NULLABLE | Map X coordinate (pixels) |
| `map_marker_y` | REAL | NULLABLE | Map Y coordinate (pixels) |
| `owner_id` | TEXT | FK → users.id | Property owner |
| `lot_status` | TEXT | DEFAULT 'vacant_lot' | built, vacant_lot, under_construction |
| `lot_type` | TEXT | DEFAULT 'residential' | residential, commercial, community, utility |
| `lot_size_sqm` | REAL | NULLABLE | Lot size in square meters |
| `lot_label` | TEXT | NULLABLE | Display label for map |
| `lot_description` | TEXT | NULLABLE | Additional description |
| `household_group_id` | TEXT | NULLABLE | For merged lots (shared ownership) |
| `is_primary_lot` | BOOLEAN | DEFAULT 1 | Primary lot in merged group |
| `created_at` | DATETIME | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- `owner_id` → `users(id)` (one household belongs to one owner)
- One household has many residents
- One household has many service requests
- One household has many payments
- One household has many reservations

**Business Rules:**
- `household_group_id` links multiple lots (e.g., dual-lot properties)
- Only primary lot (`is_primary_lot = 1`) pays dues
- Vacant lots have NULL `owner_id`

---

### `residents`

Household resident records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID identifier |
| `household_id` | TEXT | FK → households.id, NOT NULL | Household reference |
| `user_id` | TEXT | FK → users.id, NULLABLE | User account (if registered) |
| `first_name` | TEXT | NOT NULL | First name |
| `last_name` | TEXT | NOT NULL | Last name |
| `is_primary` | BOOLEAN | DEFAULT 0 | Primary resident flag |
| `created_at` | DATETIME | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- `household_id` → `households(id)` (many residents per household)
- `user_id` → `users(id)` (optional link to user account)

**Business Rules:**
- Residents can exist without user accounts (non-digital residents)
- `is_primary = 1` designates primary contact for household
- One household can have multiple residents

---

### `service_requests`

Maintenance and service request tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID identifier |
| `household_id` | TEXT | FK → households.id, NOT NULL | Requesting household |
| `category` | TEXT | NOT NULL | Request category (plumbing, electrical, etc.) |
| `description` | TEXT | NOT NULL | Request details |
| `status` | TEXT | DEFAULT 'pending' | pending, in-progress, completed, rejected |
| `priority` | TEXT | DEFAULT 'normal' | low, normal, high, urgent |
| `assigned_to` | TEXT | FK → users.id, NULLABLE | Assigned staff/admin |
| `created_at` | DATETIME | DEFAULT NOW() | Request created |
| `updated_at` | DATETIME | DEFAULT NOW() | Last updated |
| `completed_at` | DATETIME | NULLABLE | Completion timestamp |

**Indexes:**
- `idx_service_requests_status` on `status`
- `idx_service_requests_household` on `household_id`

**Business Rules:**
- Status workflow: pending → in-progress → completed
- `completed_at` set when status changes to 'completed'
- Only admin/staff can be assigned to requests

---

### `payments`

Payment records and tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID identifier |
| `household_id` | TEXT | FK → households.id, NOT NULL | Paying household |
| `amount` | REAL | NOT NULL | Payment amount |
| `currency` | TEXT | DEFAULT 'PHP' | Currency code |
| `method` | TEXT | NOT NULL | gcash, paymaya, instapay, cash, bank |
| `status` | TEXT | DEFAULT 'pending' | pending, completed, failed |
| `reference_number` | TEXT | NULLABLE | Transaction reference |
| `period` | TEXT | NOT NULL | Payment period (YYYY-MM format) |
| `payment_category` | TEXT | DEFAULT 'dues' | dues, special_assessment, fine |
| `late_fee_amount` | REAL | DEFAULT 0 | Calculated late fee |
| `late_fee_months` | INTEGER | DEFAULT 0 | Months late |
| `received_by` | TEXT | FK → users.id, NULLABLE | Admin who recorded payment |
| `proof_file_url` | TEXT | NULLABLE | R2 proof of payment file |
| `verification_status` | TEXT | DEFAULT 'pending' | pending, approved, rejected |
| `verification_notes` | TEXT | NULLABLE | Admin verification notes |
| `verified_at` | DATETIME | NULLABLE | Verification timestamp |
| `created_at` | DATETIME | DEFAULT NOW() | Payment record created |
| `paid_at` | DATETIME | NULLABLE | Payment confirmed |

**Indexes:**
- `idx_payments_household` on `household_id`
- `idx_payments_status` on `status`
- `idx_payments_period` on `period`

**Business Rules:**
- Online payments require `proof_file_url` before verification
- Manual cash payments skip verification
- Late fees calculated based on `period` vs current date
- One household can have multiple payments per period

---

### `reservations`

Amenity booking system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID identifier |
| `household_id` | TEXT | FK → households.id, NOT NULL | Booking household |
| `amenity_type` | TEXT | NOT NULL, CHECK | clubhouse, pool, basketball-court |
| `date` | DATE | NOT NULL | Reservation date |
| `slot` | TEXT | NOT NULL, CHECK | AM, PM |
| `status` | TEXT | DEFAULT 'pending' | pending, confirmed, cancelled |
| `purpose` | TEXT | NULLABLE | Event purpose |
| `created_at` | DATETIME | DEFAULT NOW() | Booking created |

**Constraints:**
- `UNIQUE(household_id, amenity_type, date, slot)` - One slot per household per day

**Business Rules:**
- Max 2 reservations per household per day (AM + PM slots)
- Admin must confirm reservations (prevent conflicts)
- Cancellation frees up slot for other households

---

### `polls` & `poll_votes`

Community polling and weighted voting system.

#### `polls`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID identifier |
| `question` | TEXT | NOT NULL | Poll question |
| `options` | TEXT | NOT NULL | JSON array of options |
| `ends_at` | DATETIME | NOT NULL | Poll expiration |
| `created_by` | TEXT | FK → users.id, NULLABLE | Poll creator |
| `created_at` | DATETIME | DEFAULT NOW() | Creation timestamp |

#### `poll_votes`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID identifier |
| `poll_id` | TEXT | FK → polls.id, NOT NULL | Poll reference |
| `household_id` | TEXT | FK → households.id, NOT NULL | Voting household |
| `selected_option` | TEXT | NOT NULL | Chosen option |
| `lot_count` | INTEGER | DEFAULT 1 | Weight (number of lots owned) |
| `voting_method` | TEXT | DEFAULT 'online' | online, in_person |
| `recorded_by` | TEXT | FK → users.id, NULLABLE | Admin who recorded vote |
| `voted_at` | DATETIME | DEFAULT NOW() | Vote timestamp |

**Constraints:**
- `UNIQUE(poll_id, household_id)` - One vote per household per poll

**Business Rules:**
- Weighted voting: `lot_count` determines vote weight
- Merged lots: Only primary lot can vote
- In-person votes recorded by admin

---

### `notifications`

User notification system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID identifier |
| `user_id` | TEXT | FK → users.id, NOT NULL | Recipient user |
| `type` | TEXT | NOT NULL | demand_letter, reminder, announcement, alert |
| `title` | TEXT | NOT NULL | Notification title |
| `content` | TEXT | NOT NULL | Notification body |
| `link` | TEXT | NULLABLE | Deep link URL |
| `read` | BOOLEAN | DEFAULT 0 | Read status |
| `created_at` | DATETIME | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- `user_id` → `users(id)` with `ON DELETE CASCADE`

**Business Rules:**
- Notifications cascade deleted when user deleted
- Bulk send via admin panel
- Real-time polling (30-second intervals)

---

## Supporting Tables

### `announcements`
Community announcements and news.
- `id`, `title`, `content`, `category`, `is_pinned`, `created_by`, `created_at`

### `events`
Community calendar events.
- `id`, `title`, `description`, `event_date`, `event_time`, `location`, `created_by`, `created_at`

### `documents`
Document repository (R2 storage).
- `id`, `title`, `category`, `file_url` (R2), `uploaded_by`, `created_at`

### `dues_rates`
Configurable dues rates.
- `id`, `lot_type`, `rate_amount`, `effective_date`, `created_at`

### `payment_demands`
Demand letter generation.
- `id`, `household_id`, `demand_type`, `amount`, `status`, `created_at`

### `installment_plans`
Payment installment plans.
- `id`, `household_id`, `total_amount`, `months`, `monthly_amount`, `status`

### `installment_payments`
Installment payment tracking.
- `id`, `plan_id`, `amount`, `due_date`, `paid_date`, `status`

### `household_employees`
Employee ID card records.
- `id`, `household_id`, `full_name`, `employee_type`, `status`, `rfid`, `expiry_date`

### `vehicle_registrations`
Vehicle pass registrations.
- `id`, `household_id`, `plate_number`, `vehicle_type`, `status`, `expiry_date`

### `pass_fees`
Pass fee configuration.
- `id`, `pass_type`, `fee_amount`, `duration_days`

### `late_fee_config`
Configurable late fee rules.
- `id`, `grace_period_days`, `flat_fee`, `percentage_rate`, `max_fee`

### `system_settings`
Application configuration.
- `id`, `key`, `value` (JSON), `updated_at`

### `message_threads`, `thread_participants`, `messages`
Messaging system (see migration 0009).

---

## Indexes

### Performance Indexes

```sql
-- User lookups
CREATE INDEX idx_users_email ON users(email);

-- Service request filtering
CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_service_requests_household ON service_requests(household_id);

-- Payment queries
CREATE INDEX idx_payments_household ON payments(household_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_period ON payments(period);

-- Reservation conflicts
CREATE INDEX idx_reservations_date ON reservations(date);
CREATE INDEX idx_reservations_amenity ON reservations(amenity_type);

-- Vote uniqueness
CREATE UNIQUE INDEX idx_poll_votes_unique ON poll_votes(poll_id, household_id);
```

---

## Relationships

### One-to-Many

```
users (1) ──< (N) households          (owner_id)
users (1) ──< (N) service_requests    (assigned_to)
users (1) ──< (N) payments            (received_by)
users (1) ──< (N) residents           (user_id)
users (1) ──< (N) notifications       (user_id)
users (1) ──< (N) polls               (created_by)

households (1) ──< (N) residents
households (1) ──< (N) service_requests
households (1) ──< (N) payments
households (1) ──< (N) reservations
households (1) ──< (N) poll_votes

polls (1) ──< (N) poll_votes
```

### Many-to-Many (via junction tables)

```
households ──< household_employees >── users (as employees)
households ──< vehicle_registrations >── vehicles
```

---

## Migration History

| Migration | Description | Date |
|-----------|-------------|------|
| `0001_base_schema.sql` | Initial schema (users, households, residents, service_requests, reservations, announcements, events, payments, documents, polls) | Initial |
| `0002_add_lot_coordinates.sql` | Added map_marker_x, map_marker_y to households | 2025-02 |
| `0003_payment_verification.sql` | Added payment proof upload and verification queue | 2025-02 |
| `0004_add_payment_notification_types.sql` | Notification types for payment reminders | 2025-02 |
| `0005_late_fee_config.sql` | Configurable late fee system | 2025-02 |
| `0006_poll_votes_indexes.sql` | Performance indexes for poll queries | 2025-02 |
| `0007_system_settings.sql` | System settings table | 2025-03 |
| `0008_seed_data.sql` | Initial test data | 2025-03 |
| `0009_messaging_system.sql` | Messaging tables (threads, participants, messages) | 2026-03 |

---

## Query Patterns

### Common Joins

```sql
-- Household with owner and residents
SELECT
  h.*,
  u.email as owner_email,
  u.first_name || ' ' || u.last_name as owner_name,
  GROUP_CONCAT(r.first_name || ' ' || r.last_name, ', ') as residents
FROM households h
LEFT JOIN users u ON h.owner_id = u.id
LEFT JOIN residents r ON h.id = r.household_id
GROUP BY h.id;
```

### Payment Status by Household

```sql
-- Households with unpaid dues for current month
SELECT
  h.address,
  h.block,
  h.lot,
  p.amount,
  p.period,
  p.status
FROM households h
LEFT JOIN payments p ON h.id = p.household_id
  AND p.period = strftime('%Y-%m', 'now')
WHERE h.lot_status = 'built'
  AND (p.id IS NULL OR p.status != 'completed');
```

### Service Request Metrics

```sql
-- Pending requests by category
SELECT
  category,
  COUNT(*) as count,
  AVG(CASE WHEN status = 'completed'
    THEN julianday(completed_at) - julianday(created_at)
    END) as avg_days_to_complete
FROM service_requests
WHERE status = 'completed'
GROUP BY category;
```

---

## Database Constraints

### Foreign Key Constraints

All foreign keys enforce referential integrity:

```sql
-- Example: households.owner_id
FOREIGN KEY (owner_id) REFERENCES users(id)

-- Cascade deletes
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

### Check Constraints

```sql
-- Role validation
CHECK(role IN ('admin', 'resident', 'staff', 'guest'))

-- Amenity type validation
CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court'))

-- Time slot validation
CHECK(slot IN ('AM', 'PM'))
```

### Unique Constraints

```sql
-- Email uniqueness
UNIQUE(email)

-- One vote per household per poll
UNIQUE(poll_id, household_id)

-- One reservation per slot
UNIQUE(household_id, amenity_type, date, slot)
```

---

## Data Access Patterns

### Admin Queries
- Full access to all tables
- Can update payment verification status
- Can assign service requests
- Can confirm reservations

### Resident Queries
- Read-only access to own household data
- Can create service requests
- Can create reservations
- Can view own payments

### Staff Queries
- Can view all households
- Can update service request status
- Cannot delete records

---

## Performance Considerations

1. **D1 Limitations:**
   - No native transaction support (partial updates possible)
   - Query timeouts: 30 seconds max
   - Result size limits: 10,000 rows

2. **Optimization Strategies:**
   - Use indexes on foreign keys
   - Filter by date ranges (`created_at`) for large tables
   - Paginate results (`LIMIT` + `OFFSET`)
   - Denormalize for complex queries (create materialized views)

3. **Edge Cases:**
   - Merged lots: Query via `household_group_id`
   - Vacant lots: `owner_id IS NULL`
   - OAuth users: `password_hash IS NULL`

---

## Backup and Recovery

### Local Development

```bash
# Backup local D1 database
npx wrangler d1 export laguna_hills_hoa --local --output=backup.sql

# Restore from backup
npx wrangler d1 execute laguna_hills_hoa --local --file=backup.sql
```

### Production (Remote)

```bash
# Export remote data
npx wrangler d1 export laguna_hills_hoa --remote --output=backup-$(date +%Y%m%d).sql

# Run migrations (manual process)
npx wrangler d1 execute laguna_hills_hoa --remote --file=migrations/XXXX_name.sql
```

---

## Troubleshooting

### Common Issues

**Issue:** Foreign key constraint failures
- **Cause:** Referencing non-existent parent record
- **Fix:** Ensure parent record exists before inserting child

**Issue:** Duplicate entry errors
- **Cause:** Violating UNIQUE constraints
- **Fix:** Check for existing records before insert

**Issue:** Query timeouts
- **Cause:** Unbounded queries on large tables
- **Fix:** Add `LIMIT` and date range filters

---

**Document Version:** 1.0.0
**Last Modified:** 2026-03-07
**Maintained By:** @developer-2
