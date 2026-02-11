# Payment Management System - API Reference

Technical documentation for the payment management system APIs, database schema, and component architecture.

---

## Table of Contents

- [Overview](#overview)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [React Components](#react-components)
- [Type Definitions](#type-definitions)
- [File Upload Flow](#file-upload-flow)
- [Error Handling](#error-handling)

---

## Overview

The payment management system is built with:

- **Backend**: Cloudflare Workers + Hono framework
- **Database**: D1 (SQLite)
- **File Storage**: R2 for payment proof uploads
- **Frontend**: React 18 + TypeScript

### Key Features

1. **Unified Payments** - Single system for dues, vehicle passes, and employee IDs
2. **Proof Verification** - Residents upload proof, admins verify
3. **Late Fee Calculation** - Configurable rules with automatic calculation
4. **Notification System** - Alerts for pending verifications and status changes
5. **CSV Export** - Filtered export for accounting

---

## Database Schema

### Tables

#### `payments`

Main payment records table.

```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  method TEXT NOT NULL CHECK(method IN ('gcash', 'paymaya', 'instapay', 'bank_transfer', 'cash')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  reference_number TEXT,
  period TEXT NOT NULL,
  payment_category TEXT CHECK(payment_category IN ('dues', 'vehicle_pass', 'employee_id')),
  verification_status TEXT DEFAULT 'not_required' CHECK(verification_status IN ('pending', 'verified', 'not_required')),
  proof_uploaded_at DATETIME,
  late_fee_amount REAL,
  late_fee_months INTEGER,
  received_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME
);
```

#### `payment_proofs`

Stores uploaded proof file references.

```sql
CREATE TABLE payment_proofs (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified BOOLEAN DEFAULT 0,
  verified_by TEXT REFERENCES users(id),
  verified_at DATETIME,
  notes TEXT
);
```

#### `payment_verification_queue`

Tracks pending verification requests.

```sql
CREATE TABLE payment_verification_queue (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  household_id TEXT REFERENCES households(id),
  payment_type TEXT CHECK(payment_type IN ('dues', 'vehicle_pass', 'employee_id')),
  amount REAL NOT NULL,
  reference_number TEXT,
  proof_uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  notified_admin BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `late_fee_config`

Stores late fee configuration.

```sql
CREATE TABLE late_fee_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  rate_percent REAL NOT NULL DEFAULT 1.0,
  grace_period_days INTEGER NOT NULL DEFAULT 30,
  max_months INTEGER NOT NULL DEFAULT 12,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Resident Endpoints

#### `POST /api/payments/initiate`

Initiate a new payment with proof upload.

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| payment_type | string | Yes | `dues`, `vehicle_pass`, `employee_id` |
| amount | number | Yes | Payment amount |
| method | string | Yes | `bank_transfer`, `gcash`, `paymaya`, `cash` |
| reference_number | string | No | Transaction reference |
| proof | File | Yes | Proof file (JPG/PNG/PDF, max 5MB) |

**Response**: `201 Created`

```json
{
  "payment": {
    "id": "uuid",
    "household_id": "uuid",
    "amount": 1500.00,
    "currency": "PHP",
    "method": "bank_transfer",
    "status": "pending",
    "payment_category": "dues",
    "verification_status": "pending",
    ...
  },
  "proof": {
    "id": "uuid",
    "file_url": "https://..."
  },
  "queue_id": "uuid"
}
```

#### `PUT /api/payments/:paymentId/proof`

Re-upload proof for a rejected payment.

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| proof | File | Yes | New proof file |

**Response**: `200 OK`

```json
{
  "message": "Proof uploaded successfully",
  "file_url": "https://..."
}
```

#### `GET /api/payments/my-pending/verifications`

Get current user's pending verification requests.

**Response**: `200 OK`

```json
{
  "verifications": [
    {
      "id": "queue_id",
      "payment_id": "uuid",
      "payment_type": "dues",
      "amount": 1500.00,
      "status": "pending",
      "household_address": "Block 1, Lot 1",
      "created_at": "2025-02-11T10:00:00Z"
    }
  ]
}
```

---

### Admin Endpoints

#### `GET /api/admin/payments/verify`

Get the verification queue.

**Query Params**:

| Param | Type | Description |
|-------|------|-------------|
| status | string | `pending`, `approved`, `rejected` |

**Response**: `200 OK`

```json
{
  "queue": [
    {
      "id": "queue_id",
      "payment_id": "uuid",
      "user_id": "uuid",
      "payment_type": "vehicle_pass",
      "amount": 500.00,
      "reference_number": "REF123",
      "status": "pending",
      "file_url": "https://...",
      "household_address": "Block 5, Lot 10",
      "created_at": "2025-02-11T10:00:00Z"
    }
  ]
}
```

#### `PUT /api/admin/payments/:paymentId/verify`

Approve or reject a payment verification.

**Request Body**:

```json
{
  "action": "approve", // or "reject"
  "rejection_reason": "string (required if action=reject)"
}
```

**Response**: `200 OK`

```json
{
  "message": "Payment approved successfully"
}
```

**Side Effects**:
- Updates `payments.verification_status` to `verified`
- Updates `payment_verification_queue.status`
- Creates notification for resident
- For `vehicle_pass`: Updates `vehicle_registrations.payment_status`
- For `employee_id`: Updates `household_employees.payment_status`

#### `GET /api/admin/payments/settings`

Get payment settings (bank details, late fee config).

**Response**: `200 OK`

```json
{
  "bank_details": {
    "bank_name": "BPI",
    "account_name": "Laguna Hills HOA",
    "account_number": "1234-5678-90"
  },
  "gcash_details": {
    "name": "Laguna Hills HOA",
    "number": "0917-XXX-XXXX"
  },
  "late_fee_config": {
    "rate_percent": 1.0,
    "grace_period_days": 30,
    "max_months": 12
  }
}
```

#### `PUT /api/admin/payments/settings`

Update payment settings.

**Request Body**:

```json
{
  "bank_details": {
    "bank_name": "string",
    "account_name": "string",
    "account_number": "string"
  },
  "gcash_details": {
    "name": "string",
    "number": "string"
  },
  "late_fee_config": {
    "rate_percent": 1.0,
    "grace_period_days": 30,
    "max_months": 12
  }
}
```

#### `GET /api/admin/payments/export`

Export payments with filters.

**Query Params**:

| Param | Type | Description |
|-------|------|-------------|
| start_date | string | YYYY-MM-DD |
| end_date | string | YYYY-MM-DD |
| payment_type | string | `dues`, `vehicle_pass`, `employee_id` |
| status | string | `pending`, `completed`, `failed` |
| method | string | `bank_transfer`, `gcash`, `paymaya`, `cash` |

**Response**: `200 OK`

```json
{
  "payments": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "household_address": "Block 1, Lot 1",
      "amount": 1500.00,
      "currency": "PHP",
      "method": "bank_transfer",
      "status": "completed",
      "payment_category": "dues",
      ...
    }
  ]
}
```

---

## React Components

### PayNowModal

Modal for residents to initiate payments.

**Location**: `src/components/PayNowModal.tsx`

**Props**:

```typescript
interface PayNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'dues' | 'vehicle_pass' | 'employee_id';
  defaultAmount?: number;
  onSuccess?: () => void;
}
```

**State Flow**:
1. User selects payment type
2. User enters amount and method
3. User uploads proof file
4. Review step shows summary
5. Submit calls `api.payments.initiatePayment()`
6. On success, shows confirmation

### PaymentVerificationQueue

Admin queue for reviewing pending verifications.

**Location**: `src/components/PaymentVerificationQueue.tsx`

**Props**:

```typescript
interface PaymentVerificationQueueProps {
  status: 'pending' | 'approved' | 'rejected';
  onRefresh?: () => void;
}
```

**Features**:
- Tab navigation between statuses
- Proof file viewer (image/PDF)
- Approve/Reject buttons
- Rejection reason modal

### LateFeeConfig

Admin configuration for late fee rules.

**Location**: `src/components/LateFeeConfig.tsx`

**Features**:
- Edit rate percent, grace period, max months
- Live calculation preview
- Displays current bank/GCash details

### PaymentExport

Admin export interface with filters.

**Location**: `src/components/PaymentExport.tsx`

**Features**:
- Date range filter
- Payment type, status, method filters
- Active filter badges
- CSV download with `api.admin.exportPayments()`

---

## Type Definitions

**Location**: `src/types/index.ts`

```typescript
// Payment Method
export type PaymentMethod =
  | "gcash"
  | "paymaya"
  | "instapay"
  | "bank_transfer"
  | "cash";

// Payment Status
export type PaymentStatus = "pending" | "completed" | "failed";

// Payment Category
export type PaymentCategory = "dues" | "vehicle_pass" | "employee_id";

// Verification Status
export type PaymentVerificationStatus = "pending" | "verified" | "not_required";

// Verification Queue Status
export type VerificationQueueStatus = "pending" | "approved" | "rejected";

// Payment Interface
export interface Payment {
  id: string;
  household_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference_number?: string;
  period: string;
  created_at: string;
  paid_at?: string;
  late_fee_amount?: number;
  late_fee_months?: number;
  received_by?: string;
  payment_category?: PaymentCategory;
  verification_status?: PaymentVerificationStatus;
  proof_uploaded_at?: string;
  household_address?: string;
}

// Verification Queue Interface
export interface PaymentVerificationQueue {
  id: string;
  payment_id: string;
  user_id: string;
  household_id?: string;
  payment_type: PaymentCategory;
  amount: number;
  reference_number?: string;
  proof_uploaded_at: string;
  status: VerificationQueueStatus;
  rejection_reason?: string;
  notified_admin: boolean;
  created_at: string;
  updated_at: string;
  file_url?: string;
  household_address?: string;
}

// Payment Settings
export interface PaymentSettings {
  bank_details: {
    bank_name: string;
    account_name: string;
    account_number: string;
  };
  gcash_details: {
    name: string;
    number: string;
  };
  late_fee_config: {
    rate_percent: number;
    grace_period_days: number;
    max_months: number;
  };
}
```

---

## File Upload Flow

### R2 Upload Process

1. **Client**: User selects file in PayNowModal
2. **Client**: Form data sent to `/api/payments/initiate`
3. **Server**: Validates file (type, size)
4. **Server**: Generates payment record in D1
5. **Server**: Uploads file to R2 at `payment-proofs/{paymentId}/{timestamp}-{filename}`
6. **Server**: Creates proof record with R2 URL
7. **Server**: Creates verification queue entry
8. **Server**: Notifies admins
9. **Client**: Receives success response

### R2 URL Pattern

```
https://pub-{paymentId}--{timestamp}-{filename}.r2.dev
```

Replace `/` with `--` for R2 public URL pattern.

---

## Error Handling

### Common Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid input | Validation failed |
| 400 | File size exceeds 5MB limit | Proof file too large |
| 400 | Invalid file type | Only JPG, PNG, PDF allowed |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Not admin, or payment not owned |
| 404 | Payment not found | Invalid payment ID |
| 500 | Failed to initiate payment | Server error |

### File Upload Errors

```typescript
// Client-side validation
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

// Server-side validation
if (proofFile.size > MAX_FILE_SIZE) {
  return c.json({ error: 'File size exceeds 5MB limit' }, 400);
}
if (!ALLOWED_TYPES.includes(proofFile.type)) {
  return c.json({ error: 'Invalid file type. Only JPG, PNG, PDF allowed' }, 400);
}
```

---

## Migration Files

| Migration | Description |
|-----------|-------------|
| `0003_payment_verification.sql` | Adds payment_proofs and payment_verification_queue tables |
| `0004_add_payment_notification_types.sql` | Adds payment notification types |
| `0005_late_fee_config.sql` | Creates late_fee_config table with defaults |

---

## Utilities

### CSV Export (`src/lib/paymentExport.ts`)

```typescript
// Convert payments array to CSV string
paymentsToCSV(payments: Payment[]): string

// Trigger browser download
downloadCSV(csvContent: string, filename: string): void

// Generate timestamped filename
generateExportFilename(prefix: string): string
// Example: "payments_2025-02-11_14-30.csv"
```

---

## Environment Variables

Required for payment system:

```bash
# Cloudflare Workers
JWT_SECRET=your-secret-key
R2=your-r2-binding

# Database (D1)
DB=your-d1-binding
```

---

## Development

### Running Locally

```bash
# Start both frontend and backend
npm run dev:all

# Or use the dev script
./dev.sh
```

### Applying Migrations

```bash
# Local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0003_payment_verification.sql --local

# Production
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0003_payment_verification.sql
```

---

## Support

For technical questions or issues:
- Check this documentation first
- Review the implementation plan: `docs/plans/2025-02-11-unified-payments-dues-management-design.md`
- Contact the development team
