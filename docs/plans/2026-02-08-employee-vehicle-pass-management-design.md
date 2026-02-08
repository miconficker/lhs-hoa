# Employee & Vehicle Pass Management System

**Date:** 2026-02-08
**Status:** Design Approved
**Related:** Laguna Hills HOA Management System

## Overview

This system manages the **issuance and administration** of employee IDs and vehicle gate passes for the Laguna Hills HOA. It does **not** track gate entry/exit activity - that responsibility lies with the security agency's own systems.

**Key distinction:** This is an administrative system for issuing passes, not a gate access monitoring system.

## Scope

### Employee Access
- Physical photo ID cards for household employees (drivers, housekeepers, caretakers)
- Security guards visually verify IDs at the gate (no automated entry)
- Verification that employee is authorized to work in the subdivision
- No household-specific tracking at the gate

### Vehicle Access
- Vehicle gate pass stickers (visual verification)
- Optional RFID passes for automated entry
- Visitors are manually verified at the gate
- Residents can opt for both sticker and RFID

### Management Model
- **Admin manages both** employee IDs and vehicle registrations
- **Residents submit requests**, admin approves and issues
- **Security agency** handles actual gate tracking and entry/exit logs

## Database Schema

### New Table: `household_employees`

Tracks employees working in the subdivision.

| Column | Type | Description |
|--------|------|-------------|
| `id` | PK | UUID |
| `household_id` | FK | References `households.id` |
| `full_name` | string | Employee name |
| `employee_type` | enum | "driver" \| "housekeeper" \| "caretaker" \| "other" |
| `id_number` | string | Unique ID number (auto-generated) |
| `photo_url` | string | R2 storage path to employee photo |
| `status` | enum | "pending" \| "active" \| "revoked" \| "expired" |
| `issued_date` | date | When ID was issued |
| `expiry_date` | date | Optional, for contractors |
| `notes` | text | Admin notes |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### New Table: `vehicle_registrations`

Tracks vehicles authorized for gate passes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | PK | UUID |
| `household_id` | FK | References `households.id` |
| `plate_number` | string | Vehicle plate |
| `make` | string | e.g., "Toyota" |
| `model` | string | e.g., "Vios" |
| `color` | string | e.g., "White" |
| `pass_type` | enum | "sticker" \| "rfid" \| "both" |
| `rfid_code` | string | Optional, if RFID assigned |
| `sticker_number` | string | Optional, if sticker issued |
| `status` | enum | "pending_payment" \| "pending_approval" \| "active" \| "cancelled" |
| `payment_status` | enum | "unpaid" \| "paid" |
| `issued_date` | date | When pass was issued |
| `amount_due` | decimal | Pass fee amount |
| `amount_paid` | decimal | Actual amount paid |
| `payment_method` | enum | Payment method used |
| `notes` | text | Admin notes |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### New Table: `pass_fees`

Admin-configurable fee structure.

| Column | Type | Description |
|--------|------|-------------|
| `id` | PK | UUID |
| `fee_type` | enum | "sticker" \| "rfid" \| "both" |
| `amount` | decimal | Fee amount |
| `effective_date` | date | When fee takes effect |
| `created_at` | timestamp | |

### Payment Table Update

Extend `payments` table:
- New `payment_category` enum: "dues" \| "vehicle_pass" \| "employee_id"

## API Endpoints

### Resident Endpoints (`/api/pass-requests`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/employees` | List my sponsored employees |
| POST | `/employees` | Request new employee ID |
| PUT | `/employees/:id` | Update employee details |
| DELETE | `/employees/:id` | Request revocation |
| GET | `/vehicles` | List my vehicle registrations |
| POST | `/vehicles` | Request vehicle pass |
| PUT | `/vehicles/:id` | Update vehicle details |
| DELETE | `/vehicles/:id` | Request cancellation |

### Admin Endpoints (`/api/admin/pass-management`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/employees` | List all employees (with filters) |
| GET | `/employees/:id` | Get employee details |
| PUT | `/employees/:id/status` | Approve/revoke employee ID |
| GET | `/employees/:id/print` | Generate ID card for printing |
| GET | `/vehicles` | List all vehicles (with filters) |
| GET | `/vehicles/:id` | Get vehicle details |
| PUT | `/vehicles/:id/status` | Approve/cancel registration |
| PUT | `/vehicles/:id/assign-rfid` | Assign RFID code |
| PUT | `/vehicles/:id/assign-sticker` | Assign sticker number |
| POST | `/vehicles/:id/record-payment` | Record in-person payment |
| GET | `/fees` | List current fee structure |
| PUT | `/fees` | Update fee amounts |

## UI Components

### Resident Dashboard - New Section: "My Passes"

**Employee Cards**
- List of sponsored employees
- Shows: name, type, ID number, status, expiry date
- Status badges: Pending (yellow), Active (green), Revoked (red)
- "Request New Employee ID" button

**Vehicle Passes**
- List of registered vehicles
- Shows: plate, make/model/color, pass type, status
- "Register Vehicle" button

### Admin Panel - New Section: "Pass Management"

**Employee IDs Tab**
- Table of all employees
- Filters: status, household, employee type
- Search by name or ID number
- Actions: approve, issue, revoke, print ID card

**Vehicle Passes Tab**
- Table of all registered vehicles
- Filters: status, household, pass type
- Search by plate or owner name
- Actions: approve, assign RFID/sticker, cancel, record payment

**Forms**
- Request Employee ID: name, type, photo upload, optional expiry
- Register Vehicle: plate, make/model/color, pass type preference

## Workflows

### Employee ID Request Flow

```
1. Resident submits form → status: "pending"
2. Admin sees pending requests in dashboard
3. Admin reviews
4. Admin clicks "Approve & Issue" → status: "active", issued_date set
5. Admin clicks "Print ID Card" → generates ID card
6. Physical card handed to employee
```

### Vehicle Registration Flow

```
1. Resident submits form → status: "pending_payment"
2. Payment options shown:
   - Online payment (GCash, PayMaya, InstaPay)
   - Pay in person at HOA office
3. After payment recorded → status: "pending_approval"
4. Admin reviews and approves → status: "active"
5. Admin assigns RFID/sticker number and notes issuance
```

### In-Person Payment at Office

```
1. Resident comes to office
2. Admin pulls up pending request by plate number or request ID
3. Admin clicks "Record In-Person Payment"
4. Admin enters payment details (OR number, receipt number, receiver)
5. System records payment → status: "pending_approval"
6. Admin can immediately approve and issue pass
```

### Revocation/Cancellation Flow

```
1. Resident requests revocation (or admin initiates)
2. Admin confirms → status: "revoked" / "cancelled"
3. Admin notes reason (e.g., "employee terminated", "vehicle sold")
4. For RFID: admin notes if physical RFID was returned
```

## Business Rules

### Limits (configurable by admin)
- Maximum 5 employees per household
- Maximum 3 vehicles per household
- Admin can override any limit with reason

### Payment
- Vehicle passes require payment (fees TBD, configurable)
- Employee IDs may be free or have fee (configurable)
- **Dues arrears do NOT block pass issuance** - if they pay for the pass, they get it

### Validation
- Duplicate plate numbers are rejected
- Employee ID numbers are auto-generated to prevent conflicts
- Admin can bypass any validation with reason

## ID Card Printing

The `/api/admin/pass-management/employees/:id/print` endpoint generates:

**ID Card Content:**
- Employee photo
- Full name
- Unique ID number
- Employee type
- "Laguna Hills HOA - Authorized Personnel"
- Validity dates (if applicable)
- Subdivision logo

**Format:** PDF or HTML template suitable for standard ID card printing

## Edge Cases

| Case | Solution |
|------|----------|
| Vehicle sold to another resident | Transfer option: reassign to new household, keep same sticker/RFID |
| Employee leaves, rehired later | Can reactivate with same ID number or issue new |
| Lost RFID/sticker | Mark as lost, issue new with new code/number, old voided |
| Incorrect plate on submission | Admin can edit before approval |
| Payment recorded but approval forgot | Dashboard shows "Paid - Awaiting Approval" nudge |
| Concurrent edits | Optimistic locking with `updated_at` timestamps |

## Dashboard Additions

### Resident Dashboard
```
Passes
├── 2 Active Employees
├── 1 Vehicle Registered
└── [Request New Pass] button
```

### Admin Dashboard
```
├── 15 Active Employee IDs
├── 47 Active Vehicle Passes
├── 3 Pending Approvals
└── ₱23,500 - Pass Revenue (this month)
```

## TypeScript Types

```typescript
export type EmployeeType = "driver" | "housekeeper" | "caretaker" | "other";
export type EmployeeStatus = "pending" | "active" | "revoked" | "expired";
export type PassType = "sticker" | "rfid" | "both";
export type VehicleStatus = "pending_payment" | "pending_approval" | "active" | "cancelled";
export type VehiclePaymentStatus = "unpaid" | "paid";

export interface HouseholdEmployee {
  id: string;
  household_id: string;
  household_address?: string;
  full_name: string;
  employee_type: EmployeeType;
  id_number: string;
  photo_url?: string;
  status: EmployeeStatus;
  issued_date?: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleRegistration {
  id: string;
  household_id: string;
  household_address?: string;
  plate_number: string;
  make: string;
  model: string;
  color: string;
  pass_type: PassType;
  rfid_code?: string;
  sticker_number?: string;
  status: VehicleStatus;
  payment_status: VehiclePaymentStatus;
  issued_date?: string;
  amount_due?: number;
  amount_paid?: number;
  payment_method?: PaymentMethod;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PassFee {
  id: string;
  fee_type: PassType;
  amount: number;
  effective_date: string;
  created_at: string;
}
```

## Implementation Notes

1. **Photo Storage:** Use R2 for employee photo uploads
2. **ID Generation:** Use a simple sequential or hashed format for employee ID numbers
3. **Payment Integration:** Reuse existing payment infrastructure
4. **Email Notifications:** Send confirmation emails when passes are approved/issued
5. **Audit Trail:** All status changes should be logged with who made the change and why
