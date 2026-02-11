# Unified Payments & Dues Management System - Implementation Plan

> **Status:** Partially Complete (see Implementation Status below)
>
> **Last Updated:** 2025-02-11

**Goal:** Build a unified payment management system supporting resident-initiated payments, admin verification, and streamlined dues collection for vehicle passes and employee IDs.

**Architecture:** Single payment system for all payment types (dues, vehicle_pass, employee_id) with resident self-service "Pay Now" flows and admin verification of uploaded proof. Admin-first workflow with configurable late fees and manual demand triggers.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Cloudflare Workers, D1 Database, R2 Storage, Hono framework

---

## Implementation Status

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | Database Migration (payment verification) | ✅ Complete | migrations/0003_payment_verification.sql |
| 2 | R2 Upload Configuration | ✅ Complete | File upload working in worker |
| 3 | Admin "Verify Proof" Tab | ✅ Complete | PaymentVerificationQueue component |
| 4 | Resident "Pay Now" Modal | ✅ Complete | PayNowModal component |
| 5 | Notification System Integration | ✅ Complete | Payment notification types added |
| 6 | Late Fee Rules Management | ✅ Complete | LateFeeConfig component |
| 7 | Vehicle Pass "Pay Now" Integration | ✅ Complete | Integrated in PassesPage |
| 8 | Employee ID "Pay Now" Integration | ✅ Complete | Integrated in PassesPage |
| 9 | Partial Payment Support | ❌ Deferred | D1/SQLite limitations with ALTER TABLE |
| 10 | Payment History & Export | ✅ Complete | CSV export with filters |

**Documentation:**
- User Guide: `docs/payment-management-guide.md`
- API Reference: `docs/payment-api-reference.md`

---

## Overview

This document outlines the complete implementation of a unified payment and dues management system for the Laguna Hills HOA platform. The system enables:

1. **Resident-initiated payments** - Users can pay dues, vehicle passes, and employee IDs online
2. **Admin verification workflow** - Admins review uploaded proofs and approve/reject payments
3. **Unified payment tracking** - Single system for all payment types with searchable history
4. **Configurable late fees** - Admin sets rules, system auto-calculates
5. **Notification system** - Admin alerts for verifications, residents receive status updates

## Current State

**Already Implemented (before this project):**
- Dues rate configuration (`DuesConfigPage.tsx`)
- Payment demand generation (API exists)
- In-person payment recording with late fee calculation (`InPersonPaymentsPage.tsx`)
- Vehicle registration tracking
- Pass fees management (sticker/RFID)
- Employee pass tracking
- Payment history table with `payment_category` (dues, vehicle_pass, employee_id)

**Completed (this project):**
- ✅ Resident self-service payment interface (`PayNowModal.tsx`)
- ✅ Payment proof upload and verification (R2 storage, `payment_proofs` table)
- ✅ Admin notification for pending verifications
- ✅ Admin verification queue (`PaymentVerificationQueue.tsx`)
- ✅ Late fee configuration system (`LateFeeConfig.tsx`, `late_fee_config` table)
- ✅ Vehicle pass "Pay Now" integration
- ✅ Employee ID "Pay Now" integration
- ✅ CSV export with filters (`PaymentExport.tsx`)
- ✅ Payment documentation (user guide + API reference)

**Not Implemented (deferred):**
- ❌ Partial payment support (complex schema changes required, D1/SQLite limitations)
- ❌ Real online payment integration (GCash/PayMaya APIs - out of scope)

**Out of Scope (future enhancements):**
- Real GCash/PayMaya API integration
- Automated payment reminders (email/SMS)
- PDF invoice generation
- Installment plan management UI
- Payment analytics dashboard
- Recurring payment setup
- Refund processing workflow

## Database Schema Changes

### New Tables

**1. payment_proofs** - Stores uploaded proof files
```sql
CREATE TABLE payment_proofs (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,  -- R2 storage URL
  file_name TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified BOOLEAN DEFAULT 0,
  verified_by TEXT REFERENCES users(id),
  verified_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_payment_id ON payment_proofs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_verified ON payment_proofs(verified);
```

**2. payment_verification_queue** - Tracks pending verifications
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

CREATE INDEX IF NOT EXISTS idx_payment_verification_queue_payment_id ON payment_verification_queue(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_verification_queue_status ON payment_verification_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_verification_queue_admin_notified ON payment_verification_queue(notified_admin, status);
```

### Modify Existing Tables

**payments table** - Add verification status:
```sql
ALTER TABLE payments ADD COLUMN verification_status TEXT DEFAULT 'not_required' CHECK(verification_status IN ('pending', 'verified', 'not_required'));
ALTER TABLE payments ADD COLUMN proof_uploaded_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_payments_verification_status ON payments(verification_status);
```

**notifications table** - Add new notification types:
```sql
-- Insert new notification types if not exists
INSERT OR IGNORE INTO notification_types (type) VALUES ('payment_verification_requested');
INSERT OR IGNORE INTO notification_types (type) VALUES ('payment_verified');
INSERT OR IGNORE INTO notification_types (type) VALUES ('payment_rejected');
```

## API Endpoints

### New Endpoints

**Resident-Facing:**
- `POST /api/payments/initiate` - Initiate payment, upload proof
- `GET /api/payments/my-pending` - Get user's pending verifications
- `GET /api/payments/balance` - Get outstanding balance
- `PUT /api/payments/:paymentId/proof` - Re-upload proof for rejected payment

**Admin:**
- `GET /api/admin/payments/verify` - Get pending verification queue
- `PUT /api/admin/payments/:paymentId/verify` - Approve/reject proof
- `GET /api/admin/payments/settings` - Get bank details, late fee rules
- `PUT /api/admin/payments/settings` - Update configuration

### Modified Endpoints

**Extend existing payment responses:**
- All payment responses include `verification_status` field
- `GET /api/payments/my/:householdId` - Includes proof upload status
- `POST /api/admin/payments/in-person` - Optional proof upload parameter

## Implementation Tasks

### Phase 1: Foundation (Week 1-2)

#### Task 1: Database Migration

**Files:**
- Create: `migrations/0003_payment_verification.sql`

**Step 1: Create migration file**

Write migration SQL for new tables and indexes.

**Step 2: Run migration locally**

```bash
npx wrangler d1 migrations apply laguna_hoes_hoa --local --command
```

**Step 3: Run migration on production**

```bash
npx wrangler d1 migrations apply laguna_hoes_hoa --remote --command
```

**Step 4: Verify schema**

```bash
npx wrangler d1 execute laguna_hoes_hoa --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

---

#### Task 2: R2 Upload Configuration

**Files:**
- Modify: `worker/src/index.ts` - Add R2 upload helper

**Step 1: Create R2 upload helper function**

Add helper function to handle file uploads to R2 bucket.

**Step 2: Add multipart form handling to payments endpoint**

Enable file upload parsing in payment initiation endpoint.

**Step 3: Test file upload**

Upload small test file, verify R2 URL returned.

---

#### Task 3: Admin "Verify Proof" Tab

**Files:**
- Modify: `src/pages/AdminPaymentsPage.tsx` - Add verification queue tab
- Create: `src/components/PaymentVerificationQueue.tsx`

**Step 1: Create verification queue component**

Create table component showing pending verifications with proof thumbnails.

**Step 2: Add approve/reject handlers**

```typescript
async function handleApprove(queueId: string, paymentId: string) {
  await api.admin.verifyPayment(paymentId, { status: 'approved' });
  // Refresh queue
}

async function handleReject(queueId: string, paymentId: string, reason: string) {
  await api.admin.verifyPayment(paymentId, { status: 'rejected', rejection_reason: reason });
  // Refresh queue
}
```

**Step 3: Add notification badge**

Show count of pending verifications in tab label.

---

#### Task 4: Resident "Pay Now" Modal

**Files:**
- Create: `src/components/PayNowModal.tsx`
- Modify: `src/pages/PaymentsPage.tsx` - Add "Pay Now" button

**Step 1: Create payment initiation form**

```typescript
interface PaymentFormData {
  payment_type: 'dues' | 'vehicle_pass' | 'employee_id';
  amount: number;
  method: 'bank_transfer' | 'gcash' | 'paymaya' | 'cash';
  reference_number?: string;
  proof: File;
}
```

**Step 2: Add file upload component**

Use shadcn/ui upload component or build custom file input with preview.

**Step 3: Handle form submission**

```typescript
async function handleSubmit(data: PaymentFormData) {
  const formData = new FormData();
  formData.append('payment_type', data.payment_type);
  formData.append('amount', data.amount.toString());
  formData.append('method', data.method);
  formData.append('reference_number', data.reference_number || '');
  formData.append('proof', data.proof);

  await api.payments.initiate(formData);
  // Show success message
}
```

---

#### Task 5: Notification System Integration

**Files:**
- Modify: `worker/src/routes/payments.ts` - Add notification triggers
- Modify: `worker/src/routes/notifications.ts` - Add new notification types

**Step 1: Add notification to admin on proof upload**

```typescript
await c.env.DB.prepare(`
  INSERT INTO notifications (user_id, type, title, content, link)
  SELECT DISTINCT owner_id FROM households WHERE id = ?
`).bind(householdId).run();
```

**Step 2: Add notification to resident on verification**

```typescript
await c.env.DB.prepare(`
  INSERT INTO notifications (user_id, type, title, content, link)
  VALUES (?, ?, ?, ?, ?)
`).bind(userId, 'payment_verified', 'Payment Verified', 'Your payment has been approved.', `/payments`).run();
```

**Step 3: Test notification flow**

Initiate payment as user → Verify as admin → Check notifications received.

---

### Phase 2: Late Fee Configuration (Week 2)

#### Task 6: Late Fee Rules Management

**Files:**
- Create: `src/components/LateFeeConfig.tsx`
- Modify: `src/pages/AdminPaymentsPage.tsx` - Add settings tab
- Modify: `worker/src/routes/admin.ts` - Add settings endpoints

**Step 1: Create late fee configuration schema**

```typescript
interface LateFeeConfig {
  rate_percent: number;  // e.g., 1 for 1%
  grace_period_days: number;  // e.g., 30 days
  max_months: number;  // e.g., 12 months max
}
```

**Step 2: Add settings endpoint**

```typescript
adminRouter.get('/payments/settings', async (c) => {
  const settings = await c.env.DB.prepare(`
    SELECT * FROM late_fee_config WHERE id = 'default'
  `).first();

  return c.json({ settings });
});

adminRouter.put('/payments/settings', async (c) => {
  const { rate_percent, grace_period_days, max_months } = await c.req.json();
  // Upsert configuration
});
```

**Step 3: Add late fee calculation to payment recording**

```typescript
function calculateLateFee(baseAmount: number, dueDate: string, config: LateFeeConfig): number {
  const daysLate = Math.floor((Date.now() - new Date(dueDate).getTime()) / (30 * 24 * 60 * 60 * 1000));
  const monthsLate = Math.max(0, Math.min(daysLate / 30, config.max_months));
  return baseAmount * (config.rate_percent / 100) * monthsLate;
}
```

---

### Phase 3: Vehicle & Employee Pass Integration (Week 3)

#### Task 7: Vehicle Pass "Pay Now" Integration

**Files:**
- Modify: `src/pages/PassRequestsPage.tsx` - Add pay now button
- Modify: `worker/src/routes/pass-management.ts` - Auto-update status on verification

**Step 1: Add "Pay Now" button to vehicle registration**

Show button when `payment_status === 'unpaid'`.

**Step 2: Link to unified payment modal**

Pre-fill payment_type='vehicle_pass', amount=pass_fee.

**Step 3: Auto-update vehicle status when verified**

```typescript
if (payment.verification_status === 'verified' && payment.payment_category === 'vehicle_pass') {
  await c.env.DB.prepare(`
    UPDATE vehicle_registrations
    SET payment_status = 'paid', status = 'pending_approval'
    WHERE household_id = ? AND payment_id = ?
  `).bind(householdId, paymentId).run();
}
```

---

#### Task 8: Employee ID "Pay Now" Integration

**Files:**
- Modify: `src/pages/PassRequestsPage.tsx` - Add pay now for employees
- Modify: `worker/src/routes/pass-management.ts` - Update employee status

**Step 1: Add "Pay Now" for employee ID requests**

Similar to vehicle pass integration.

**Step 2: Auto-update employee status when verified**

```typescript
if (payment.verification_status === 'verified' && payment.payment_category === 'employee_id') {
  await c.env.DB.prepare(`
    UPDATE household_employees
    SET status = 'active', issued_date = DATE('now')
    WHERE id = ?
  `).bind(employeeId).run();
}
```

---

### Phase 4: Advanced Features (Week 4-5)

#### Task 9: Partial Payment Support

**Files:**
- Modify: `worker/src/routes/payments.ts` - Handle partial payments
- Modify: `src/pages/PaymentsPage.tsx` - Show remaining balance

**Step 1: Add partial_amount field to payments table**

```sql
ALTER TABLE payments ADD COLUMN partial_amount REAL;
ALTER TABLE payments ADD COLUMN remaining_balance REAL;
```

**Step 2: Update demand status calculation**

```typescript
const totalPaid = await getPaymentsForDemand(demandId);
const demand = await getDemand(demandId);

if (totalPaid >= demand.amount_due) {
  status = 'paid';
} else if (totalPaid > 0) {
  status = 'partial';
}
```

---

#### Task 10: Payment History & Export

**Files:**
- Modify: `src/pages/AdminPaymentsPage.tsx` - Add export functionality
- Create: `src/lib/paymentExport.ts` - CSV export utility

**Step 1: Create export utility**

```typescript
export function exportPaymentsToCSV(payments: Payment[]): string {
  const headers = ['Date', 'User', 'Type', 'Amount', 'Method', 'Status', 'Reference #'];
  const rows = payments.map(p => [
    p.created_at, p.user_email, p.payment_category, p.amount, p.method, p.status, p.reference_number
  ]);
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}
```

**Step 2: Add export button to admin page**

```typescript
async function handleExport() {
  const result = await api.admin.getAllPayments({ /* filters */ });
  const csv = exportPaymentsToCSV(result.data.payments);
  // Trigger download
}
```

---

## Testing Strategy

### Unit Tests

**File Upload:**
- Test valid file types (jpg, png, pdf)
- Test file size limits (5MB max)
- Test R2 upload success/failure scenarios

**Verification Queue:**
- Test approve payment → demand status updates
- Test reject payment → notification sent
- Test duplicate proof handling

**Late Fees:**
- Test grace period (no late fee within X days)
- Test max late fee cap
- Test configurable rate calculation

### Integration Tests

**Payment Flow:**
1. User initiates payment with proof upload
2. Admin receives notification
3. Admin approves payment
4. User receives verification notification
5. Check demand status updated

**Vehicle Pass Integration:**
1. Register vehicle (status: pending_payment)
2. Pay for pass with proof upload
3. Admin verifies
4. Vehicle status updates to pending_approval

### Manual Testing Checklist

- [ ] Resident can initiate dues payment
- [ ] Resident can initiate vehicle pass payment
- [ ] Resident can upload payment proof
- [ ] Admin receives notification for verification
- [ ] Admin can approve/reject with notes
- [ ] Resident receives approval/rejection notification
- [ ] Partial payments show remaining balance
- [ ] Late fees calculate correctly
- [ ] Bank details display correctly
- [ ] Payment history exports to CSV
- [ ] Multiple co-owners can all pay for same household

---

## Rollout Plan

**Week 1:**
- Deploy database migration
- Deploy R2 upload configuration
- Internal testing with admin team

**Week 2:**
- Enable resident "Pay Now" for dues only
- Monitor verification queue
- Collect feedback

**Week 3:**
- Enable vehicle pass payments
- Enable employee ID payments
- Refine UI based on feedback

**Week 4:**
- Add late fee configuration
- Add partial payment support
- Export functionality

**Week 5:**
- Polishing and bug fixes
- Documentation
- Full rollout to all residents

---

## Success Metrics

- Payment recording time: < 30 seconds (admin), < 2 minutes (resident)
- Zero data loss during proof upload
- Payment history 100% auditable
- Average verification time < 24 hours
- Resident satisfaction score > 4/5

---

## Future Enhancements (Out of Scope)

- Real GCash/PayMaya API integration
- Automated payment reminders (email/SMS)
- PDF invoice generation
- Installment plan management UI
- Payment analytics dashboard
- Recurring payment setup
- Refund processing workflow
