# Laguna Hills HOA - System Architecture

## Overview
This document describes the architecture of the Laguna Hills HOA Information and Service Management System.

## Technology Stack

### Frontend
- **Framework**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand
- **Routing**: React Router v6
- **Mapping**: Leaflet + React Leaflet
- **Icons**: lucide-react (replaced Heroicons)

### Backend
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: D1 (SQLite)
- **Storage**: R2 for file uploads
- **Authentication**: JWT using jose library (Cloudflare Workers compatible)

## Database Architecture

### Core Tables

#### Users & Authentication
- `users` - User accounts with role-based access
- `pre_approved_emails` - Whitelist for user registration
- `sessions` - User sessions (if needed)

#### Households & Properties
- `households` - Household records linked to lots
- `lots` - Property lots with geospatial data
- `residents` - Residents linked to households

#### Payments & Dues
- `payments` - Unified payment tracking for all categories
- `payment_demands` - Annual dues demands
- `installment_plans` - Payment installment plans
- `installment_payments` - Installment payment tracking
- `dues_rates` - Configurable dues rates per year

#### Service Requests
- `service_requests` - Maintenance and service requests

#### Reservations & Amenities
- `reservations` - Amenity bookings
- `amenity_availabilities` - Amenity availability tracking

#### Communications
- `announcements` - Community announcements
- `notifications` - User notifications
- `polls` - Community polls
- `poll_votes` - Poll votes

#### Documents
- `documents` - HOA documents repository

#### Messaging
- `message_threads` - Conversation threads
- `thread_participants` - Thread participants
- `messages` - Individual messages

## Pass Management System (Unified Architecture)

### Overview
The pass management system was redesigned to separate **pass records** from **payment records** with a unified, extensible architecture supporting independent pass tracking and detailed payment history.

### Design Principles
1. **Separation of Concerns**: Pass records are separate from payment records
2. **Unified Payments**: Single `payments` table for all pass types
3. **Extensibility**: Add new pass types by inserting into `pass_types` table
4. **Clear Relationships**: Foreign key relationships maintain data integrity
5. **Payment History**: Complete audit trail across all pass types

### Tables

#### Pass Type Registry
```sql
CREATE TABLE pass_types (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,        -- 'sticker', 'rfid', 'employee_id', 'vip', 'valet'
  name TEXT NOT NULL,               -- Display name
  category TEXT NOT NULL,          -- 'vehicle', 'employee', 'resident', 'visitor'
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Defines all pass types in the system. New pass types can be added without schema changes.

**Seed Data**:
- `pt-sticker` - Gate Pass Sticker (vehicle)
- `pt-rfid` - RFID Card (vehicle)
- `pt-employee` - Employee ID (employee)
- `pt-vip` - VIP Pass (resident)
- `pt-valet` - Valet Pass (visitor)

#### Vehicle Registrations (Base Table)
```sql
CREATE TABLE vehicle_registrations (
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, plate_number)
);
```

**Purpose**: Base vehicle information. The `pass_type` field is kept for backward compatibility but the actual pass records are in `vehicle_passes`.

#### Vehicle Passes (Independent Pass Records)
```sql
CREATE TABLE vehicle_passes (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicle_registrations(id) ON DELETE CASCADE,
  pass_type_id TEXT NOT NULL REFERENCES pass_types(id),
  identifier TEXT NOT NULL,           -- sticker_number or rfid_code
  amount_due REAL NOT NULL DEFAULT 0,
  amount_paid REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'partial')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'replaced')),
  issued_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vehicle_id, pass_type_id),     -- One pass of each type per vehicle
  UNIQUE(pass_type_id, identifier)      -- Unique identifier per pass type
);
```

**Purpose**: Independent tracking of each pass type per vehicle. A vehicle can have:
- Sticker pass only
- Sticker passes expire at end of year (expiry_date set to Dec 31)
- RFID pass only
- RFID passes don't expire but can be replaced if damaged
- Both passes (two separate records)

**Status Values**:
- `active` - Pass is currently in use
- `inactive` - Pass is temporarily inactive
- `replaced` - Pass was replaced with a new one (e.g., damaged RFID)

#### Household Employees (Employee Passes)
```sql
CREATE TABLE household_employees (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  full_name TEXT NOT NULL,
  employee_type TEXT CHECK(employee_type IN ('driver', 'housekeeper', 'caretaker', 'other')),
  id_number TEXT NOT NULL UNIQUE,    -- Generated EMP-XXX-XXX
  photo_url TEXT,
  pass_type_id TEXT REFERENCES pass_types(id),
  amount_due REAL DEFAULT 0,
  amount_paid REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'partial')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'revoked', 'expired')),
  issued_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Employee passes with payment tracking. Each employee has one pass record linked to a pass type.

#### Pass Fees (Configurable Fees)
```sql
CREATE TABLE pass_fees (
  id TEXT PRIMARY KEY,
  pass_type_id TEXT NOT NULL REFERENCES pass_types(id),
  amount REAL NOT NULL,
  effective_date DATE NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pass_type_id, effective_date)
);
```

**Purpose**: Configurable fees per pass type. Multiple fees can exist with different effective dates, allowing for historical tracking and fee changes.

#### Unified Payments Table
```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id),
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'PHP',
  method TEXT CHECK(method IN ('gcash', 'paymaya', 'instapay', 'cash', 'in-person')),
  reference_number TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  payment_category TEXT CHECK(payment_category IN ('dues', 'vehicle_pass', 'employee_id', 'other')),
  period TEXT,                        -- YYYY for annual dues
  received_by TEXT REFERENCES users(id),

  -- Pass tracking fields (new)
  pass_type_id TEXT REFERENCES pass_types(id),
  vehicle_pass_id TEXT REFERENCES vehicle_passes(id),
  employee_pass_id TEXT REFERENCES household_employees(id),

  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Unified payment tracking for all pass types. The `pass_type_id`, `vehicle_pass_id`, and `employee_pass_id` fields allow linking payments to specific passes while maintaining the general `payment_category` for backward compatibility.

### Views

#### vehicles_with_passes_view
```sql
CREATE VIEW vehicles_with_passes_view AS
SELECT
  v.id,
  v.household_id,
  h.address as household_address,
  v.plate_number,
  v.make,
  v.model,
  v.color,
  v.status,
  -- Sticker pass details
  sticker.id as sticker_pass_id,
  sticker.identifier as sticker_number,
  sticker.amount_due as sticker_amount_due,
  sticker.amount_paid as sticker_amount_paid,
  sticker.payment_status as sticker_payment_status,
  -- RFID pass details
  rfid.id as rfid_pass_id,
  rfid.identifier as rfid_code,
  rfid.amount_due as rfid_amount_due,
  rfid.amount_paid as rfid_amount_paid,
  rfid.payment_status as rfid_payment_status,
  -- Computed
  COALESCE(sticker.amount_due, 0) + COALESCE(rfid.amount_due, 0) as total_amount_due,
  COALESCE(sticker.amount_paid, 0) + COALESCE(rfid.amount_paid, 0) as total_amount_paid
FROM vehicle_registrations v
JOIN households h ON h.id = v.household_id
LEFT JOIN vehicle_passes sticker ON sticker.vehicle_id = v.id AND sticker.pass_type_id = 'pt-sticker'
LEFT JOIN vehicle_passes rfid ON rfid.vehicle_id = v.id AND rfid.pass_type_id = 'pt-rfid';
```

**Purpose**: Simplified queries for vehicles with all their passes in one row.

### API Endpoints

#### Pass Types
- `GET /api/admin/pass-management/pass-types` - List all pass types

#### Vehicle Management
- `GET /api/admin/pass-management/vehicles` - List vehicles (uses `vehicles_with_passes_view`)
- `GET /api/admin/pass-management/vehicles/:id` - Get vehicle details
- `POST /api/admin/pass-management/vehicles` - Create vehicle with checkbox selection (has_sticker, has_rfid)
- `PUT /api/admin/pass-management/vehicles/:id/assign-rfid` - Assign RFID code
- `PUT /api/admin/pass-management/vehicles/:id/assign-sticker` - Assign sticker number
- `POST /api/admin/pass-management/vehicles/:id/replace-rfid` - Replace damaged RFID (old one set to 'replaced', new one created)
- `POST /api/admin/pass-management/vehicles/:id/record-payment` - Record payment for vehicle passes
- `PUT /api/admin/pass-management/vehicles/:id/status` - Update vehicle status
- `DELETE /api/admin/pass-management/vehicles/:id` - Delete vehicle

#### Employee Management
- `GET /api/admin/pass-management/employees` - List employees (uses `employees_with_pass_type_view`)
- `GET /api/admin/pass-management/employees/:id` - Get employee details
- `POST /api/admin/pass-management/employees` - Create employee pass
- `POST /api/admin/pass-management/employees/:id/record-payment` - Record payment for employee pass
- `PUT /api/admin/pass-management/employees/:id/status` - Update employee status
- `DELETE /api/admin/pass-management/employees/:id` - Delete employee

#### Pass Fees
- `GET /api/admin/pass-management/fees` - Get current fees
- `PUT /api/admin/pass-management/fees` - Update fees (sticker_fee, rfid_fee, employee_fee)

### Frontend Components

#### PassManagementPage.tsx (Admin)
- **Vehicle Form**: Uses checkboxes for pass selection instead of dropdown
- **Vehicle List**: Shows badges for Sticker/RFID passes
- **Payment Recording**: Per-pass payment support with pass_type selection
- **RFID Replacement**: "Replace RFID" button (🔄) for active vehicles with RFID passes
  - Old RFID is marked as 'replaced' status
  - New RFID is created with unpaid status
  - User prompted for replacement reason (e.g., "Damaged - needs replacement")

#### PassesPage.tsx (User)
- **Vehicle List**: Shows badges for Sticker/RFID passes
- **Payment Flow**: Users can view and pay for their passes

## Extensibility

### Adding a New Pass Type (e.g., VIP Pass)

1. **Database**: Insert into `pass_types` table
```sql
INSERT INTO pass_types (id, code, name, category, description)
VALUES ('pt-vip', 'vip', 'VIP Access Pass', 'resident', 'Priority access for VIP residents');
```

2. **Set Fee**: Insert into `pass_fees` table
```sql
INSERT INTO pass_fees (id, pass_type_id, amount, effective_date)
VALUES ('fee-vip-001', 'pt-vip', 2000, DATE('now'));
```

3. **Create Table** (if needed):
```sql
CREATE TABLE resident_passes (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  pass_type_id TEXT NOT NULL REFERENCES pass_types(id),
  identifier TEXT NOT NULL,
  amount_due REAL NOT NULL,
  amount_paid REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  -- ... other fields
);
```

4. **Payment Integration**: The `payments` table already supports the new pass type via `pass_type_id` field

## Key Design Decisions

1. **Backward Compatibility**: The `vehicle_registrations.pass_type` field is maintained for gradual migration
2. **Cascading Deletes**: `vehicle_passes` uses `ON DELETE CASCADE` to clean up passes when vehicles are deleted
3. **Unique Constraints**: Ensure one pass of each type per vehicle and unique identifiers per pass type
4. **Views for Simplification**: Complex joins are abstracted into views for cleaner API queries
5. **Flexible Fees**: Fees are time-stamped, allowing for historical tracking and future changes

## Future Enhancements

1. **Valet Pass System**: Already seeded in `pass_types`, ready for implementation
2. **Visitor Pass Tracking**: Extend system for temporary visitor passes
3. **Pass Expiry Management**: Add automated expiry notifications
4. **Pass Renewals**: Support for pass renewals with new fee structures
5. **Bulk Pass Operations**: Admin tools for bulk pass updates
