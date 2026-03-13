# External Rental Inquiry-Based Booking Workflow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an inquiry-based booking workflow for external rentals where guests submit inquiries, admins approve before requesting payment, and slots are only blocked on final confirmation.

**Architecture:** Extend existing `external_rentals` table with new status values, add API endpoints for inquiry management, modify frontend to separate inquiry submission from payment, and add email notifications for status transitions.

**Tech Stack:** Cloudflare Workers, Hono framework, D1 database, React, TypeScript, Tailwind CSS, shadcn/ui

---

## Chunk 1: Database Schema Migration

### Task 1: Create database migration for new booking statuses

**Files:**
- Create: `migrations/0021_inquiry_workflow_statuses.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration: Add inquiry workflow statuses to external_rentals table
-- This adds new statuses for the inquiry-based booking workflow

-- Note: SQLite doesn't support ALTER COLUMN with CHECK constraint modification
-- We need to recreate the table with the new constraint

-- First, create the new external_rentals table with updated status values
CREATE TABLE IF NOT EXISTS external_rentals_new (
  id TEXT PRIMARY KEY,
  amenity_type TEXT NOT NULL,
  date TEXT NOT NULL,
  slot TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  amount_paid REAL NOT NULL DEFAULT 0,
  payment_method TEXT,
  receipt_number TEXT,

  -- Guest information
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  guest_notes TEXT,

  -- Proof of payment
  proof_of_payment_url TEXT,

  -- Status management
  booking_status TEXT NOT NULL DEFAULT 'inquiry_submitted',
  rejection_reason TEXT,
  admin_notes TEXT,

  -- Audit fields
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_ip TEXT,
  ip_retained_until TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,

  -- Foreign key to booking_blocked_dates (only for confirmed bookings)
  -- This is managed by application logic, not a foreign key constraint

  CHECK (booking_status IN (
    'inquiry_submitted',
    'pending_approval',
    'pending_payment',
    'pending_verification',
    'confirmed',
    'rejected',
    'cancelled'
  ))
);

-- Copy existing data from old table to new table
INSERT INTO external_rentals_new
SELECT * FROM external_rentals;

-- Drop old table
DROP TABLE external_rentals;

-- Rename new table to original name
ALTER TABLE external_rentals_new RENAME TO external_rentals;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_external_rentals_booking_status
  ON external_rentals(booking_status);

CREATE INDEX IF NOT EXISTS idx_external_rentals_date_slot
  ON external_rentals(date, slot, amenity_type);

CREATE INDEX IF NOT EXISTS idx_external_rentals_guest_email
  ON external_rentals(guest_email);
```

- [ ] **Step 2: Run migration locally**

```bash
cd /mnt/games/github/lhs-hoa
pnpm wrangler d1 execute laguna_hills_hoa --file=./migrations/0021_inquiry_workflow_statuses.sql --local
```

Expected: Migration succeeds with no errors

- [ ] **Step 3: Verify schema update**

```bash
pnpm wrangler d1 execute laguna_hills_hoa --local --command "PRAGMA table_info(external_rentals);"
```

Expected: Shows booking_status with check constraint including new values

- [ ] **Step 4: Commit migration**

```bash
git add migrations/0021_inquiry_workflow_statuses.sql
git commit -m "feat: add inquiry workflow statuses to external_rentals table"
```

---

## Chunk 2: Backend API - Inquiry Endpoints

### Task 2: Add inquiry submission endpoint

**Files:**
- Modify: `functions/routes/public.ts`

- [ ] **Step 1: Read the current public routes file to understand structure**

```bash
cd /mnt/games/github/lhs-hoa
head -50 functions/routes/public.ts
```

Expected: See Hono router setup with existing booking endpoints

- [ ] **Step 2: Add inquiry submission endpoint after pricing endpoint (around line 215)**

```typescript
// POST /api/public/inquiries - Submit inquiry (creates booking with status: "inquiry_submitted")
publicRouter.post('/inquiries', async (c) => {
  // Rate limit check (max 3 inquiries per hour per IP)
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(c.env.DB, clientIp, { maxRequests: 3, windowSeconds: 3600 });

  if (!rateLimitResult.allowed) {
    return c.json({ error: 'Too many inquiry attempts. Please try again later.' }, 429);
  }

  const body = await c.req.json();
  const result = bookingRequestSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const data = result.data;

  // Calculate pricing (same as booking flow)
  const pricingResponse = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_${data.amenity_type}_hourly'`
  ).first();

  const baseRate = parseFloat(pricingResponse?.setting_value as string) || 500;
  const durations: Record<string, number> = { AM: 4, PM: 4, FULL_DAY: 9 };

  // Get day multipliers for accurate pricing
  const dayMultipliersResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_day_multipliers'`
  ).first();
  const dayMultipliers = JSON.parse(dayMultipliersResult?.setting_value as string || '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}');

  // Get season multipliers
  const seasonMultipliersResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_season_multipliers'`
  ).first();
  const seasonMultipliers = JSON.parse(seasonMultipliersResult?.setting_value as string || '{"peak": 1.3, "off_peak": 1.0}');

  // Get peak months
  const peakMonthsResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_peak_months'`
  ).first();
  const peakMonths = (peakMonthsResult?.setting_value as string || '12,1,2,3,4,5').split(',').map(Number);

  // Get holidays
  const holidaysResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_holidays_2026'`
  ).first();
  const holidays = (holidaysResult?.setting_value as string || '').split(',').map(s => s.trim());

  // Calculate multipliers
  const bookingDate = new Date(data.date);
  const dayOfWeek = bookingDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = holidays.includes(data.date);
  const month = bookingDate.getMonth() + 1;
  const isPeak = peakMonths.includes(month);

  let dayMultiplier = dayMultipliers.weekday;
  if (isHoliday) dayMultiplier = dayMultipliers.holiday;
  else if (isWeekend) dayMultiplier = dayMultipliers.weekend;

  const seasonMultiplier = isPeak ? seasonMultipliers.peak : seasonMultipliers.off_peak;
  const duration = durations[data.slot] || 9;
  const amount = Math.round(baseRate * duration * dayMultiplier * seasonMultiplier);

  // Generate inquiry ID and reference number
  const id = crypto.randomUUID();
  const now = new Date();
  const refNum = `EXT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

  // Get client IP
  const clientIP = getClientIp(c.req.raw);

  // Insert inquiry with status "inquiry_submitted"
  await c.env.DB.prepare(
    `INSERT INTO external_rentals (
      id, amenity_type, date, slot, amount, payment_status,
      guest_name, guest_email, guest_phone, guest_notes,
      booking_status, created_ip, ip_retained_until
    ) VALUES (?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, 'inquiry_submitted', ?, ?)`
  ).bind(
    id, data.amenity_type, data.date, data.slot, amount,
    data.guest_name, data.guest_email, data.guest_phone, data.purpose,
    clientIP,
    getIPRetentionDate()
  ).run();

  // Fetch created inquiry
  const inquiry = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  // TODO: Send inquiry notification email to admin

  return c.json({
    data: {
      inquiry: {
        ...inquiry,
        reference_number: refNum,
        time_of_day: formatTimeOfDay(inquiry.created_at as string),
      }
    }
  }, 201);
});
```

- [ ] **Step 3: Test the endpoint with curl**

```bash
# First start the dev server
pnpm run dev:all

# In another terminal, test the endpoint
curl -X POST http://localhost:8788/api/public/inquiries \
  -H "Content-Type: application/json" \
  -d '{
    "amenity_type": "clubhouse",
    "date": "2026-04-15",
    "slot": "AM",
    "guest_name": "Test Guest",
    "guest_email": "test@example.com",
    "guest_phone": "+63 912 345 6789",
    "event_type": "birthday",
    "attendees": 50,
    "purpose": "Birthday party celebration"
  }'
```

Expected: Returns 201 with inquiry data including `booking_status: "inquiry_submitted"`

- [ ] **Step 4: Commit inquiry endpoint**

```bash
git add functions/routes/public.ts
git commit -m "feat: add inquiry submission endpoint"
```

### Task 3: Add inquiry status check endpoint

**Files:**
- Modify: `functions/routes/public.ts`

- [ ] **Step 1: Add inquiry status check endpoint (after existing status check)**

```typescript
// GET /api/public/inquiries/:id/status - Check inquiry/booking status
publicRouter.get('/inquiries/:id/status', async (c) => {
  const id = c.req.param('id');

  const inquiry = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!inquiry) {
    return c.json({ error: 'Inquiry not found' }, 404);
  }

  // Generate reference number
  const createdDate = new Date(inquiry.created_at as string);
  const refNum = `EXT-${createdDate.getFullYear()}${String(createdDate.getMonth() + 1).padStart(2, '0')}${String(createdDate.getDate()).padStart(2, '0')}-${inquiry.id.slice(-3)}`;

  // Map status to user-friendly message
  const statusMessages: Record<string, string> = {
    inquiry_submitted: 'Your inquiry is being reviewed.',
    pending_approval: 'Your inquiry has been approved! Please proceed with payment.',
    pending_payment: 'Please complete your payment to confirm your booking.',
    pending_verification: 'Payment received. Your booking is being verified.',
    confirmed: 'Your booking is confirmed!',
    rejected: 'Your inquiry has been rejected.',
    cancelled: 'Your booking has been cancelled.',
  };

  // Determine next action based on status
  const nextActions: Record<string, { action: string; link?: string }> = {
    inquiry_submitted: { action: 'Wait for approval' },
    pending_approval: { action: 'Proceed to payment', link: `/external-rentals/inquiry/${id}/payment` },
    pending_payment: { action: 'Complete payment', link: `/external-rentals/inquiry/${id}/payment` },
    pending_verification: { action: 'Wait for verification' },
    confirmed: { action: 'View booking details', link: `/external-rentals/confirmation/${id}` },
    rejected: { action: 'Submit new inquiry', link: '/external-rentals' },
    cancelled: { action: 'Submit new inquiry', link: '/external-rentals' },
  };

  return c.json({
    data: {
      inquiry: {
        ...inquiry,
        reference_number: refNum,
      },
      status_message: statusMessages[inquiry.booking_status as string] || 'Unknown status',
      next_action: nextActions[inquiry.booking_status as string] || { action: 'Contact support' },
    }
  });
});
```

- [ ] **Step 2: Test the status endpoint**

```bash
curl http://localhost:8788/api/public/inquiries/<inquiry-id>/status
```

Expected: Returns status, message, and next action

- [ ] **Step 3: Commit status endpoint**

```bash
git add functions/routes/public.ts
git commit -m "feat: add inquiry status check endpoint"
```

---

## Chunk 3: Backend API - Admin Inquiry Management

### Task 4: Add approve inquiry endpoint

**Files:**
- Modify: `functions/routes/admin/external-rentals.ts`

- [ ] **Step 1: Add approve inquiry endpoint (before existing approve endpoint)**

```typescript
// PUT /:id/approve-inquiry - Approve inquiry and request payment
externalRentalsRouter.put('/:id/approve-inquiry', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');

  // Get inquiry
  const inquiry = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!inquiry) {
    return c.json({ error: 'Inquiry not found' }, 404);
  }

  // Validate current status
  if (inquiry.booking_status !== 'inquiry_submitted') {
    return c.json({
      error: 'Can only approve inquiries with status "inquiry_submitted"',
      current_status: inquiry.booking_status
    }, 400);
  }

  // Update status to pending_approval
  await c.env.DB.prepare(
    `UPDATE external_rentals
     SET booking_status = 'pending_approval',
         updated_at = datetime('now'),
         updated_by = ?
     WHERE id = ?`
  ).bind(authUser.userId, id).run();

  // Fetch updated inquiry
  const updated = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  // TODO: Send approval email to guest with payment link

  return c.json({
    data: {
      inquiry: updated,
      message: 'Inquiry approved. Payment link sent to guest.',
    }
  });
});
```

- [ ] **Step 2: Test approve inquiry endpoint**

```bash
# First get admin JWT token from login
TOKEN="your-admin-jwt-token"

curl -X PUT "http://localhost:8788/api/admin/external-rentals/<inquiry-id>/approve-inquiry" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

Expected: Returns 200 with updated inquiry and status `pending_approval`

- [ ] **Step 3: Commit approve inquiry endpoint**

```bash
git add functions/routes/admin/external-rentals.ts
git commit -m "feat: add approve inquiry endpoint"
```

### Task 5: Add reject inquiry endpoint

**Files:**
- Modify: `functions/routes/admin/external-rentals.ts`

- [ ] **Step 1: Add reject inquiry endpoint (after approve inquiry)**

```typescript
// PUT /:id/reject-inquiry - Reject inquiry with reason
externalRentalsRouter.put('/:id/reject-inquiry', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();

  // Validate reason is provided
  const reason = body.reason;
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return c.json({ error: 'Rejection reason is required' }, 400);
  }

  if (reason.length > 500) {
    return c.json({ error: 'Rejection reason must be 500 characters or less' }, 400);
  }

  // Get inquiry
  const inquiry = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!inquiry) {
    return c.json({ error: 'Inquiry not found' }, 404);
  }

  // Validate current status
  if (inquiry.booking_status !== 'inquiry_submitted') {
    return c.json({
      error: 'Can only reject inquiries with status "inquiry_submitted"',
      current_status: inquiry.booking_status
    }, 400);
  }

  // Update status to rejected
  await c.env.DB.prepare(
    `UPDATE external_rentals
     SET booking_status = 'rejected',
         rejection_reason = ?,
         updated_at = datetime('now'),
         updated_by = ?
     WHERE id = ?`
  ).bind(reason.trim(), authUser.userId, id).run();

  // Fetch updated inquiry
  const updated = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  // TODO: Send rejection email to guest

  return c.json({
    data: {
      inquiry: updated,
      message: 'Inquiry rejected. Notification sent to guest.',
    }
  });
});
```

- [ ] **Step 2: Test reject inquiry endpoint**

```bash
curl -X PUT "http://localhost:8788/api/admin/external-rentals/<inquiry-id>/reject-inquiry" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Date already booked by another event"}'
```

Expected: Returns 200 with rejected inquiry

- [ ] **Step 3: Commit reject inquiry endpoint**

```bash
git add functions/routes/admin/external-rentals.ts
git commit -m "feat: add reject inquiry endpoint"
```

### Task 6: Add pending inquiries list endpoint

**Files:**
- Modify: `functions/routes/admin/external-rentals.ts`

- [ ] **Step 1: Add pending inquiries endpoint (after existing pending endpoint)**

```typescript
// GET /inquiries - Get pending inquiries for admin review
externalRentalsRouter.get('/inquiries', async (c) => {
  const authUser = await requireAdminOrStaff(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const amenityType = c.req.query('amenity_type');
  const date = c.req.query('date');
  const slot = c.req.query('slot');

  let query = 'SELECT * FROM external_rentals WHERE booking_status = ?';
  const params: any[] = ['inquiry_submitted'];

  if (amenityType) {
    query += ' AND amenity_type = ?';
    params.push(amenityType);
  }
  if (date) {
    query += ' AND date = ?';
    params.push(date);
  }
  if (slot) {
    query += ' AND slot = ?';
    params.push(slot);
  }

  query += ' ORDER BY created_at ASC';

  const result = await c.env.DB.prepare(query).bind(...params).all();

  // Add reference numbers and time formatting
  const inquiries = (result.results || []).map((r: any) => ({
    ...r,
    reference_number: `EXT-${new Date(r.created_at).getFullYear()}${String(new Date(r.created_at).getMonth() + 1).padStart(2, '0')}${String(new Date(r.created_at).getDate()).padStart(2, '0')}-${r.id.slice(-3)}`,
    time_of_day: formatTimeOfDay(r.created_at),
  }));

  // Check for conflicts (multiple inquiries for same slot)
  const conflicts = await c.env.DB.prepare(
    `SELECT amenity_type, date, slot, COUNT(*) as count
     FROM external_rentals
     WHERE booking_status = 'inquiry_submitted'
     GROUP BY amenity_type, date, slot
     HAVING count > 1`
  ).all();

  return c.json({
    data: {
      inquiries,
      total: inquiries.length,
      conflicts: conflicts.results || [],
    }
  });
});
```

- [ ] **Step 2: Test pending inquiries endpoint**

```bash
curl "http://localhost:8788/api/admin/external-rentals/inquiries" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Returns list of pending inquiries with conflict info

- [ ] **Step 3: Commit pending inquiries endpoint**

```bash
git add functions/routes/admin/external-rentals.ts
git commit -m "feat: add pending inquiries list endpoint"
```

---

## Chunk 4: Backend API - Modify Existing Endpoints

### Task 7: Update proof upload endpoint status check

**Files:**
- Modify: `functions/routes/public.ts`

- [ ] **Step 1: Find and update proof upload endpoint (around line 349)**

Change from:
```typescript
if (booking.booking_status === 'confirmed') {
  return c.json({ error: 'Booking is already confirmed' }, 400);
}

if (booking.booking_status === 'rejected') {
  return c.json({ error: 'Booking has been rejected' }, 400);
}
```

To:
```typescript
if (booking.booking_status === 'confirmed') {
  return c.json({ error: 'Booking is already confirmed' }, 400);
}

if (booking.booking_status === 'rejected') {
  return c.json({ error: 'Booking has been rejected' }, 400);
}

// Only allow proof upload for pending_payment status
if (booking.booking_status !== 'pending_payment') {
  return c.json({
    error: 'Payment proof can only be uploaded after approval',
    current_status: booking.booking_status
  }, 400);
}
```

And update the status transition from:
```typescript
booking_status = 'pending_verification'
```

To (already correct, just verify):
```typescript
booking_status = 'pending_verification'
```

- [ ] **Step 2: Test proof upload with different statuses**

```bash
# Try uploading proof for inquiry_submitted status (should fail)
curl -X POST "http://localhost:8788/api/public/bookings/<inquiry-id>/proof" \
  -H "Content-Type: application/json" \
  -d '{"proof_url": "https://example.com/proof.jpg"}'
```

Expected: Returns 400 with error about wrong status

- [ ] **Step 3: Commit proof upload update**

```bash
git add functions/routes/public.ts
git commit -m "fix: restrict proof upload to pending_payment status"
```

### Task 8: Update approve endpoint for verification flow

**Files:**
- Modify: `functions/routes/admin/external-rentals.ts`

- [ ] **Step 1: Update approve endpoint to only verify pending_verification (around line 463)**

Change from:
```typescript
if (booking.booking_status === 'confirmed') {
  return c.json({ error: 'Booking is already confirmed' }, 400);
}
```

To:
```typescript
if (booking.booking_status === 'confirmed') {
  return c.json({ error: 'Booking is already confirmed' }, 400);
}

// Only allow approve (verification) for pending_verification status
if (booking.booking_status !== 'pending_verification') {
  return c.json({
    error: 'Can only verify bookings with payment proof',
    current_status: booking.booking_status
  }, 400);
}
```

- [ ] **Step 2: Test approve endpoint with different statuses**

```bash
# Try approving an inquiry_submitted booking (should fail)
curl -X PUT "http://localhost:8788/api/admin/external-rentals/<inquiry-id>/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

Expected: Returns 400 with error about wrong status

- [ ] **Step 3: Commit approve endpoint update**

```bash
git add functions/routes/admin/external-rentals.ts
git commit -m "fix: restrict approve endpoint to pending_verification status"
```

---

## Chunk 5: Frontend - Inquiry Submission Page

### Task 9: Rename BookingPage to InquiryPage and modify submission

**Files:**
- Modify: `src/pages/public/BookingPage.tsx`
- Modify: `src/App.tsx` (route update)

- [ ] **Step 1: Read current BookingPage to understand structure**

```bash
cd /mnt/games/github/lhs-hoa
head -100 src/pages/public/BookingPage.tsx
```

Expected: See existing form with payment instructions

- [ ] **Step 2: Create new InquiryPage.tsx based on BookingPage**

Copy BookingPage.tsx to InquiryPage.tsx and make these changes:

1. Remove payment instructions section (lines 388-432)
2. Remove proof of payment upload section (lines 434-511)
3. Change page title from "Complete Your Booking" to "Submit Your Inquiry"
4. Change submit button text from "Submit Booking Request" to "Submit Inquiry"
5. Change success message from "Booking request submitted!" to "Inquiry submitted!"
6. Update API call from `api.public.createBooking` to new `api.public.createInquiry`
7. Change redirect from success page to inquiry pending page

Key changes to the handleSubmit function (around line 149):

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  if (!formData.terms_agreed) {
    toast.error("Please agree to the terms and conditions");
    return;
  }

  // ... validation remains the same ...

  try {
    setSubmitting(true);

    const inquiryData: PublicInquiryRequest = {
      amenity_type: amenityType,
      date,
      slot,
      guest_name: formData.guest_name,
      guest_email: formData.guest_email,
      guest_phone: formData.guest_phone,
      event_type: formData.event_type,
      attendees: parseInt(formData.attendees) || 0,
      purpose: formData.purpose,
    };

    const result = await api.public.createInquiry(inquiryData);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Inquiry submitted!");
    // Redirect to inquiry pending page instead of success page
    navigate(`/external-rentals/inquiry/${result.data?.inquiry.id}/pending`);
  } catch (error) {
    console.error("Error submitting inquiry:", error);
    toast.error("Failed to submit inquiry");
  } finally {
    setSubmitting(false);
  }
}
```

- [ ] **Step 3: Update types for PublicInquiryRequest**

**Files:**
- Modify: `src/types/index.ts`

Add the inquiry type (after PublicBookingRequest):

```typescript
export interface PublicInquiryRequest {
  amenity_type: AmenityType;
  date: string;
  slot: TimeBlockSlot;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  event_type: 'wedding' | 'birthday' | 'meeting' | 'sports' | 'other';
  attendees: number;
  purpose: string;
}
```

- [ ] **Step 4: Add createInquiry API function**

**Files:**
- Modify: `src/lib/api.ts`

Add the inquiry function:

```typescript
async createInquiry(data: PublicInquiryRequest) {
  return this.request<any>('/public/inquiries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 5: Test inquiry submission flow**

```bash
pnpm run dev:all
# Navigate to /external-rentals/book?amenity=clubhouse&date=2026-04-15&slot=AM
# Fill form and submit
```

Expected: Form submits, redirects to inquiry pending page

- [ ] **Step 6: Commit InquiryPage**

```bash
git add src/pages/public/InquiryPage.tsx src/types/index.ts src/lib/api.ts
git commit -m "feat: add inquiry submission page"
```

### Task 10: Update App.tsx routes for new inquiry flow

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Find and update the external rentals route**

Change from:
```typescript
<Route path="/external-rentals/book" element={<BookingPage />} />
```

To:
```typescript
<Route path="/external-rentals/book" element={<InquiryPage />} />
<Route path="/external-rentals/inquiry/:id/pending" element={<InquiryPendingPage />} />
<Route path="/external-rentals/inquiry/:id/payment" element={<InquiryPaymentPage />} />
```

- [ ] **Step 2: Commit route updates**

```bash
git add src/App.tsx
git commit -m "feat: add routes for inquiry workflow"
```

---

## Chunk 6: Frontend - Inquiry Pending Page

### Task 11: Create InquiryPendingPage component

**Files:**
- Create: `src/pages/public/InquiryPendingPage.tsx`

- [ ] **Step 1: Create InquiryPendingPage component**

```typescript
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Clock, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { PublicLayout } from "@/components/public/PublicLayout";

const amenityLabels: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
};

const slotLabels: Record<string, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

export function InquiryPendingPage() {
  const { id } = useParams<{ id: string }>();
  const [inquiry, setInquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const checkStatus = async () => {
      try {
        const result = await api.public.getInquiryStatus(id);
        if (result.error) {
          setError(result.error);
          return;
        }

        const inquiryData = result.data?.inquiry;
        setInquiry(inquiryData);

        // If status changed, redirect appropriately
        if (inquiryData.booking_status === 'pending_approval') {
          window.location.href = `/external-rentals/inquiry/${id}/payment`;
        } else if (inquiryData.booking_status === 'confirmed') {
          window.location.href = `/external-rentals/confirmation/${id}`;
        } else if (inquiryData.booking_status === 'rejected') {
          // Stay on page but show rejection
        }
      } catch (err) {
        console.error('Error checking inquiry status:', err);
        setError('Failed to check inquiry status');
      } finally {
        setLoading(false);
      }
    };

    checkStatus();

    // Poll for status updates every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      </PublicLayout>
    );
  }

  if (error || !inquiry) {
    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-4">
            {error || 'Inquiry not found'}
          </h1>
          <Link to="/external-rentals">
            <Button variant="link">Back to Amenities</Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const isRejected = inquiry.booking_status === 'rejected';

  return (
    <PublicLayout title="Inquiry Status" showBackButton backTo="/external-rentals">
      <div className="max-w-3xl mx-auto py-8">
        {isRejected ? (
          // Rejected state
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="text-red-900 dark:text-red-100">
                Inquiry Could Not Be Approved
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-red-700 dark:text-red-300">
                Unfortunately, we are unable to approve your inquiry at this time.
              </p>
              {inquiry.rejection_reason && (
                <div className="p-4 bg-background rounded-lg border">
                  <p className="text-sm font-medium mb-1">Reason:</p>
                  <p className="text-sm text-muted-foreground">{inquiry.rejection_reason}</p>
                </div>
              )}
              <Link to="/external-rentals">
                <Button>Submit a New Inquiry</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          // Pending state
          <>
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Inquiry Under Review
                </CardTitle>
                <CardDescription>
                  We're reviewing your inquiry and will email you once it's approved.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inquiry Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Reference Number</p>
                    <p className="font-medium">{inquiry.reference_number || `EXT-${inquiry.id.slice(-8)}`}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Submitted On</p>
                    <p className="font-medium">
                      {new Date(inquiry.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amenity</span>
                    <span className="font-medium">
                      {amenityLabels[inquiry.amenity_type] || inquiry.amenity_type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {new Date(inquiry.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time Slot</span>
                    <span className="font-medium">{slotLabels[inquiry.slot]}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Estimated Amount</span>
                    <span className="font-bold text-lg">
                      ₱{inquiry.amount?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">We'll email you at:</p>
                      <p className="text-muted-foreground">{inquiry.guest_email}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
```

- [ ] **Step 2: Add getInquiryStatus API function**

**Files:**
- Modify: `src/lib/api.ts`

```typescript
async getInquiryStatus(id: string) {
  return this.request<any>(`/public/inquiries/${id}/status`);
}
```

- [ ] **Step 3: Test inquiry pending page**

```bash
# Navigate to /external-rentals/inquiry/<inquiry-id>/pending
# Should show pending state
# After admin approves, should auto-redirect to payment page
```

Expected: Shows inquiry details, polls for status updates, redirects on approval

- [ ] **Step 4: Commit inquiry pending page**

```bash
git add src/pages/public/InquiryPendingPage.tsx src/lib/api.ts
git commit -m "feat: add inquiry pending page with status polling"
```

---

## Chunk 7: Frontend - Inquiry Payment Page

### Task 12: Create InquiryPaymentPage component

**Files:**
- Create: `src/pages/public/InquiryPaymentPage.tsx`

- [ ] **Step 1: Create InquiryPaymentPage component**

```typescript
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { CheckCircle2, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PublicLayout } from "@/components/public/PublicLayout";

const amenityLabels: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
};

const slotLabels: Record<string, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

export function InquiryPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inquiry, setInquiry] = useState<any>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    if (!id) return;

    try {
      setLoading(true);
      const [statusResult, paymentResult] = await Promise.all([
        api.public.getInquiryStatus(id),
        api.public.getPaymentDetails(),
      ]);

      if (statusResult.error) {
        toast.error(statusResult.error);
        navigate('/external-rentals');
        return;
      }

      const inquiryData = statusResult.data?.inquiry;
      setInquiry(inquiryData);

      // Only show payment details if approved
      if (inquiryData.booking_status === 'pending_approval' || inquiryData.booking_status === 'pending_payment') {
        if (paymentResult.data) {
          setPaymentDetails(paymentResult.data);
        }
      }

      // Redirect if already confirmed
      if (inquiryData.booking_status === 'confirmed') {
        navigate(`/external-rentals/confirmation/${id}`);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load payment information");
    } finally {
      setLoading(false);
    }
  }

  async function handleProofUpload(file: File): Promise<string> {
    // TODO: Implement R2 upload
    // For now, return a mock URL
    return `https://r2-storage.example.com/proofs/${Date.now()}-${file.name}`;
  }

  async function handleUploadProof() {
    if (!proofFile) {
      toast.error("Please select a file to upload");
      return;
    }

    if (proofFile.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      setUploadingProof(true);
      const url = await handleProofUpload(proofFile);

      // Upload proof via API
      const result = await api.public.uploadProof(id!, { proof_url: url });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Proof of payment uploaded");
      // Navigate to confirmation page
      navigate(`/external-rentals/confirmation/${id}`);
    } catch (error) {
      console.error("Error uploading proof:", error);
      toast.error("Failed to upload proof of payment");
    } finally {
      setUploadingProof(false);
    }
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      </PublicLayout>
    );
  }

  if (!inquiry) {
    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold text-muted-foreground">
            Inquiry not found
          </h1>
          <Link to="/external-rentals">
            <Button variant="link">Back to Amenities</Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const isApproved = inquiry.booking_status === 'pending_approval' || inquiry.booking_status === 'pending_payment';
  const hasProof = inquiry.booking_status === 'pending_verification';

  return (
    <PublicLayout title="Complete Payment" showBackButton>
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-2">Complete Your Payment</h1>
        <p className="text-muted-foreground mb-8">
          Your inquiry for <strong>{amenityLabels[inquiry.amenity_type]}</strong> has been approved!
        </p>

        {!isApproved && !hasProof && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-medium">Payment Not Yet Available</p>
                  <p className="text-sm text-muted-foreground">
                    Your inquiry is still being reviewed. We'll email you when it's approved.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isApproved && (
          <>
            {/* Booking Summary */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amenity</span>
                  <span className="font-medium">
                    {amenityLabels[inquiry.amenity_type]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {new Date(inquiry.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time Slot</span>
                  <span className="font-medium">{slotLabels[inquiry.slot]}</span>
                </div>
                <div className="pt-2 border-t flex justify-between font-bold text-lg">
                  <span>Total Amount</span>
                  <span>₱{inquiry.amount?.toLocaleString() || '0'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Instructions */}
            {paymentDetails && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 mb-6">
                <CardHeader>
                  <CardTitle>Payment Instructions</CardTitle>
                  <CardDescription>
                    Please pay the total amount to complete your booking
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">GCash</h4>
                    <div className="bg-background p-3 rounded-lg border">
                      <p className="text-sm">
                        <strong>Name:</strong> {paymentDetails.gcash.name}
                      </p>
                      <p className="text-sm">
                        <strong>Number:</strong> {paymentDetails.gcash.number}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Bank Transfer</h4>
                    <div className="bg-background p-3 rounded-lg border">
                      <p className="text-sm">
                        <strong>Bank:</strong> {paymentDetails.bank_transfer.bank_name}
                      </p>
                      <p className="text-sm">
                        <strong>Account Name:</strong> {paymentDetails.bank_transfer.account_name}
                      </p>
                      <p className="text-sm">
                        <strong>Account Number:</strong> {paymentDetails.bank_transfer.account_number}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reference number format: Your Name - {amenityLabels[inquiry.amenity_type]} - {inquiry.date}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Proof of Payment Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Proof of Payment</CardTitle>
                <CardDescription>
                  Upload your payment receipt to confirm your booking
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasProof ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        Payment proof uploaded
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        We'll verify your payment and confirm your booking soon.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/external-rentals/confirmation/${id}`)}
                    >
                      View Status
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="border-2 border-dashed rounded-lg p-6">
                      <div className="flex flex-col items-center text-center">
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Upload screenshot or receipt of your payment
                        </p>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="proof-upload"
                        />
                        <label htmlFor="proof-upload">
                          <Button type="button" variant="outline" asChild>
                            <span>Choose File</span>
                          </Button>
                        </label>
                        {proofFile && (
                          <p className="text-sm mt-2">{proofFile.name}</p>
                        )}
                      </div>
                    </div>
                    {proofFile && (
                      <Button
                        type="button"
                        onClick={handleUploadProof}
                        disabled={uploadingProof}
                        className="w-full"
                      >
                        {uploadingProof ? "Uploading..." : "Upload Proof & Confirm Booking"}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
```

- [ ] **Step 2: Add uploadProof API function**

**Files:**
- Modify: `src/lib/api.ts`

```typescript
async uploadProof(id: string, data: { proof_url: string }) {
  return this.request<any>(`/public/bookings/${id}/proof`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 3: Test payment page flow**

```bash
# Navigate to /external-rentals/inquiry/<inquiry-id>/payment
# Should show payment instructions after approval
# Upload proof should work
# Should redirect to confirmation page after upload
```

Expected: Shows payment details when approved, allows proof upload, redirects after upload

- [ ] **Step 4: Commit payment page**

```bash
git add src/pages/public/InquiryPaymentPage.tsx src/lib/api.ts
git commit -m "feat: add inquiry payment page with proof upload"
```

---

## Chunk 8: Frontend - Admin Dashboard Updates

### Task 13: Create PendingInquiriesTab component

**Files:**
- Create: `src/components/admin/PendingInquiriesTab.tsx`

- [ ] **Step 1: Create PendingInquiriesTab component**

```typescript
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Clock, User, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const amenityLabels: Record<string, string> = {
  clubhouse: 'Clubhouse',
  pool: 'Swimming Pool',
};

const slotLabels: Record<string, string> = {
  AM: 'Morning',
  PM: 'Afternoon',
  FULL_DAY: 'Full Day',
};

export function PendingInquiriesTab() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; inquiryId: string | null }>({
    open: false,
    inquiryId: null,
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInquiries();
  }, []);

  async function loadInquiries() {
    try {
      setLoading(true);
      const result = await api.admin.getPendingInquiries();
      if (result.data?.inquiries) {
        setInquiries(result.data.inquiries);
      }
    } catch (error) {
      console.error('Error loading inquiries:', error);
      toast.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(inquiryId: string) {
    try {
      setSubmitting(true);
      const result = await api.admin.approveInquiry(inquiryId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Inquiry approved. Payment link sent to guest.');
      loadInquiries();
    } catch (error) {
      console.error('Error approving inquiry:', error);
      toast.error('Failed to approve inquiry');
    } finally {
      setSubmitting(false);
    }
  }

  function openRejectDialog(inquiryId: string) {
    setRejectDialog({ open: true, inquiryId: inquiryId });
    setRejectionReason('');
  }

  async function handleReject() {
    if (!rejectDialog.inquiryId || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setSubmitting(true);
      const result = await api.admin.rejectInquiry(rejectDialog.inquiryId, { reason: rejectionReason });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Inquiry rejected. Notification sent to guest.');
      setRejectDialog({ open: false, inquiryId: null });
      setRejectionReason('');
      loadInquiries();
    } catch (error) {
      console.error('Error rejecting inquiry:', error);
      toast.error('Failed to reject inquiry');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (inquiries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No pending inquiries</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Submitted</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inquiries.map((inquiry) => (
              <TableRow key={inquiry.id}>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div>{new Date(inquiry.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(inquiry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{inquiry.guest_name}</div>
                    <div className="text-sm text-muted-foreground">{inquiry.guest_email}</div>
                    <div className="text-xs text-muted-foreground">{inquiry.guest_phone}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{amenityLabels[inquiry.amenity_type]}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(inquiry.date).toLocaleDateString()} · {slotLabels[inquiry.slot]}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {inquiry.guest_notes?.substring(0, 50)}
                      {inquiry.guest_notes?.length > 50 ? '...' : ''}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  ₱{inquiry.amount?.toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleApprove(inquiry.id)}
                      disabled={submitting}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openRejectDialog(inquiry.id)}
                      disabled={submitting}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, inquiryId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Inquiry</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this inquiry. The guest will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Explain why this inquiry is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {rejectionReason.length}/500 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, inquiryId: null })}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting || !rejectionReason.trim()}
            >
              {submitting ? 'Rejecting...' : 'Reject Inquiry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Add admin API functions**

**Files:**
- Modify: `src/lib/api.ts`

```typescript
// Admin functions
async getPendingInquiries() {
  return this.request<any>('/admin/external-rentals/inquiries');
}

async approveInquiry(id: string) {
  return this.request<any>(`/admin/external-rentals/${id}/approve-inquiry`, {
    method: 'PUT',
  });
}

async rejectInquiry(id: string, data: { reason: string }) {
  return this.request<any>(`/admin/external-rentals/${id}/reject-inquiry`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 3: Integrate PendingInquiriesTab into ExternalRentals management**

**Files:**
- Modify: `src/components/admin/ExternalRentalsTab.tsx` (or create if not exists)

Add tab structure:
```typescript
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PendingInquiriesTab } from './PendingInquiriesTab';
// Import existing verification tab component

export function ExternalRentalsTab() {
  const [activeTab, setActiveTab] = useState('inquiries');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="inquiries">
          Pending Inquiries
        </TabsTrigger>
        <TabsTrigger value="verification">
          Payment Verification
        </TabsTrigger>
        <TabsTrigger value="all">
          All Bookings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="inquiries">
        <PendingInquiriesTab />
      </TabsContent>
      <TabsContent value="verification">
        {/* Existing verification flow */}
      </TabsContent>
      <TabsContent value="all">
        {/* All bookings list */}
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 4: Test admin inquiry management**

```bash
# Navigate to Admin Panel → Reservations → External Rentals
# Click "Pending Inquiries" tab
# Should see list of inquiries with approve/reject buttons
# Test approve flow
# Test reject flow with reason
```

Expected: Admin can view inquiries, approve (sends to payment), reject with reason

- [ ] **Step 5: Commit admin inquiry management**

```bash
git add src/components/admin/PendingInquiriesTab.tsx src/components/admin/ExternalRentalsTab.tsx src/lib/api.ts
git commit -m "feat: add pending inquiries management for admin"
```

---

## Chunk 9: Email Notifications (Placeholder)

### Task 14: Create email notification templates

**Files:**
- Create: `functions/email-templates/inquiry-approved.html`
- Create: `functions/email-templates/inquiry-rejected.html`

- [ ] **Step 1: Create inquiry approved email template**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Amenity Inquiry was Approved!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Great News!</h1>
    </div>

    <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0;">
      <h2 style="color: #333; margin-top: 0;">Your Inquiry has been Approved</h2>

      <p>Hello <strong>{{guest_name}}</strong>,</p>

      <p>Your inquiry for <strong>{{amenity_name}}</strong> on <strong>{{date}}</strong> has been approved!</p>

      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #667eea;">Booking Details</h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; color: #666;"><strong>Amenity:</strong></td>
            <td style="padding: 8px 0;">{{amenity_name}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;"><strong>Date:</strong></td>
            <td style="padding: 8px 0;">{{date}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;"><strong>Time Slot:</strong></td>
            <td style="padding: 8px 0;">{{slot}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;"><strong>Amount:</strong></td>
            <td style="padding: 8px 0; font-size: 20px; color: #667eea;"><strong>₱{{amount}}</strong></td>
          </tr>
        </table>
      </div>

      <h3 style="color: #333;">Next Steps</h3>
      <ol style="padding-left: 20px;">
        <li style="margin-bottom: 10px;">Pay the total amount using one of the methods below</li>
        <li style="margin-bottom: 10px;">Upload your proof of payment</li>
        <li style="margin-bottom: 10px;">Wait for verification and confirmation</li>
      </ol>

      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #667eea;">Payment Methods</h3>

        <h4 style="color: #333;">GCash</h4>
        <p style="background: #f0f0f0; padding: 10px; border-radius: 4px; margin: 5px 0;">
          <strong>Name:</strong> {{gcash_name}}<br>
          <strong>Number:</strong> {{gcash_number}}
        </p>

        <h4 style="color: #333;">Bank Transfer</h4>
        <p style="background: #f0f0f0; padding: 10px; border-radius: 4px; margin: 5px 0;">
          <strong>Bank:</strong> {{bank_name}}<br>
          <strong>Account Name:</strong> {{account_name}}<br>
          <strong>Account Number:</strong> {{account_number}}
        </p>

        <p style="font-size: 14px; color: #666; margin-top: 15px;">
          <strong>Reference Number Format:</strong> Your Name - {{amenity_name}} - {{date}}
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="{{payment_link}}" style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Proceed to Payment →
        </a>
      </div>
    </div>

    <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666;">
      <p>This is an automated message from Laguna Hills HOA.</p>
      <p>If you have questions, please contact us at support@lagunahills.com</p>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Create inquiry rejected email template**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Update on your Amenity Inquiry</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #ef4444; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Inquiry Update</h1>
    </div>

    <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0;">
      <h2 style="color: #333; margin-top: 0;">Your inquiry could not be approved</h2>

      <p>Hello <strong>{{guest_name}}</strong>,</p>

      <p>Thank you for your interest in renting <strong>{{amenity_name}}</strong> on <strong>{{date}}</strong>.</p>

      <p>Unfortunately, we are unable to approve your inquiry at this time.</p>

      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
        <h3 style="margin-top: 0; color: #ef4444;">Reason:</h3>
        <p style="color: #666;">{{rejection_reason}}</p>
      </div>

      <p>Feel free to submit a new inquiry for a different date or time.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="{{new_inquiry_link}}" style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Submit New Inquiry
        </a>
      </div>
    </div>

    <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666;">
      <p>This is an automated message from Laguna Hills HOA.</p>
      <p>If you have questions, please contact us at support@lagunahills.com</p>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 3: Add TODO comments in backend for email integration**

The TODO comments are already in place in the backend code. When email service is ready, implement:
- `functions/lib/email.ts` - Email sending utility
- Integrate with Cloudflare Email Workers or external service (SendGrid, Mailgun, etc.)
- Call email functions from approve/reject endpoints

- [ ] **Step 4: Commit email templates**

```bash
git add functions/email-templates/
git commit -m "feat: add email templates for inquiry approval/rejection"
```

---

## Chunk 10: Final Testing & Documentation

### Task 15: End-to-end testing

- [ ] **Step 1: Test complete inquiry workflow**

```bash
# 1. Start dev server
pnpm run dev:all

# 2. Guest submits inquiry
# Navigate to /external-rentals
# Select amenity, date, slot
# Fill inquiry form
# Submit
# Verify: Redirects to pending page, shows "Awaiting Review"

# 3. Admin approves inquiry
# Navigate to Admin Panel → External Rentals → Pending Inquiries
# Click Approve
# Verify: Status changes to "pending_approval", inquiry disappears from list

# 4. Guest sees payment page
# Polling on pending page should redirect to payment page
# Verify: Shows payment instructions (GCash, bank transfer)

# 5. Guest uploads proof
# Select file, upload
# Verify: Redirects to confirmation page, shows "Payment received"

# 6. Admin verifies payment
# Navigate to Admin Panel → External Rentals → Payment Verification
# View proof, approve
# Verify: Status becomes "confirmed", slot is now blocked

# 7. Verify slot is blocked
# Try to submit new inquiry for same date/slot
# Verify: Calendar shows slot as unavailable
```

Expected: All steps work correctly, no errors

- [ ] **Step 2: Test rejection flow**

```bash
# 1. Submit inquiry
# 2. Admin rejects with reason
# 3. Guest sees rejection on pending page
# 4. Guest can submit new inquiry
```

Expected: Rejection works, guest can resubmit

- [ ] **Step 3: Test edge cases**

```bash
# Test: Approve inquiry for already booked slot
# Test: Reject then try to approve (should fail)
# Test: Upload proof before approval (should fail)
# Test: Verify before proof upload (should fail)
# Test: Multiple inquiries for same slot
```

Expected: All edge cases handled correctly

- [ ] **Step 4: Run type check and build**

```bash
cd /mnt/games/github/lhs-hoa
pnpm run tsc --noEmit
pnpm run build
```

Expected: No TypeScript errors, build succeeds

- [ ] **Step 5: Commit final changes**

```bash
git add .
git commit -m "test: complete inquiry-based booking workflow"
```

### Task 16: Update documentation

- [ ] **Step 1: Update ARCHITECTURE.md**

**Files:**
- Modify: `docs/ARCHITECTURE.md`

Add section to "External Rental Booking System":

```markdown
### Inquiry-Based Workflow (v1.12.0)

The external rental system uses an inquiry-based workflow:

1. **Inquiry Submission** (`inquiry_submitted`)
   - Guest submits inquiry with event details
   - No payment requested yet
   - Multiple inquiries allowed per slot

2. **Admin Approval** (`pending_approval`)
   - Admin reviews and approves/rejects
   - Approved inquiries move to payment stage
   - Rejected guests can submit new inquiries

3. **Payment Stage** (`pending_payment`)
   - Guest receives payment instructions
   - Uploads proof of payment

4. **Verification** (`pending_verification`)
   - Admin reviews proof
   - Approves to confirm or rejects for re-upload

5. **Confirmation** (`confirmed`)
   - Payment verified
   - Time slot blocked in booking_blocked_dates
   - Booking final

**Status Flow:**
```
inquiry_submitted → pending_approval → pending_payment → pending_verification → confirmed
                                                        ↓
                                                    rejected
                                                        ↓
                                                    cancelled
```
```

- [ ] **Step 2: Update CLAUDE.md**

**Files:**
- Modify: `CLAUDE.md`

Update "Public External Booking System" section:

```markdown
### Inquiry-Based Workflow

Guests submit inquiries first, admins approve before payment is requested:

1. Submit inquiry → status: `inquiry_submitted`
2. Admin approves → status: `pending_approval`
3. Guest sees payment page → status: `pending_payment`
4. Guest uploads proof → status: `pending_verification`
5. Admin verifies → status: `confirmed` (slot blocked)

**Key Points:**
- Inquiries do NOT block slots (only confirmed bookings)
- Multiple inquiries can exist for the same slot
- Rejected guests can submit new inquiries
- Pricing is shown immediately on inquiry submission
```

- [ ] **Step 3: Commit documentation updates**

```bash
git add docs/ARCHITECTURE.md CLAUDE.md
git commit -m "docs: update architecture for inquiry-based booking workflow"
```

### Task 17: Deploy migration to production

- [ ] **Step 1: Run migration on remote D1 database**

```bash
cd /mnt/games/github/lhs-hoa
pnpm wrangler d1 execute laguna_hills_hoa --file=./migrations/0021_inquiry_workflow_statuses.sql --remote
```

Expected: Migration succeeds on production database

- [ ] **Step 2: Deploy to production**

```bash
pnpm run deploy
```

Expected: Deployment succeeds

- [ ] **Step 3: Verify production deployment**

```bash
# Test inquiry submission on production
# Test admin approval on production
# Verify email notifications (if implemented)
```

Expected: All features work in production

---

## Summary

This implementation plan adds an inquiry-based booking workflow to the external rental system:

**What was built:**
- Database schema with new inquiry workflow statuses
- API endpoints for inquiry submission, approval, and rejection
- Frontend pages for inquiry submission, pending status, and payment
- Admin dashboard for managing pending inquiries
- Email templates for inquiry notifications
- Updated documentation

**Key behaviors:**
- Inquiries don't block slots (only confirmed bookings)
- Admin approval required before payment
- Guests see pricing immediately
- Rejected guests can resubmit
- Existing bookings continue to work (backward compatible)

**Files created:**
- `migrations/0021_inquiry_workflow_statuses.sql`
- `src/pages/public/InquiryPage.tsx`
- `src/pages/public/InquiryPendingPage.tsx`
- `src/pages/public/InquiryPaymentPage.tsx`
- `src/components/admin/PendingInquiriesTab.tsx`
- `functions/email-templates/inquiry-approved.html`
- `functions/email-templates/inquiry-rejected.html`
- `docs/superpowers/specs/2026-03-13-inquiry-based-booking-workflow-design.md`

**Files modified:**
- `functions/routes/public.ts`
- `functions/routes/admin/external-rentals.ts`
- `src/types/index.ts`
- `src/lib/api.ts`
- `src/App.tsx`
- `docs/ARCHITECTURE.md`
- `CLAUDE.md`
