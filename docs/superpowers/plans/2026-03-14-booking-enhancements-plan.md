# Booking System Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three interconnected features to the unified booking system: (1) Admin direct booking creation for walkins/phone/other channels, (2) In-app notifications integration for booking lifecycle events, (3) Admin analytics dashboard with revenue and booking statistics.

**Architecture:** Extend existing unified bookings system with admin-only API endpoints, integrate with existing notifications system, and add new analytics aggregation endpoints with dedicated frontend components.

**Tech Stack:** Cloudflare Workers + Hono (backend), React + TypeScript + shadcn/ui (frontend), D1 SQLite (database), existing notifications helper functions.

---

## File Structure Overview

### New Files to Create

**Backend (7 files):**
1. `functions/routes/admin/bookings.ts` - Admin booking creation endpoint
2. `functions/routes/admin/analytics.ts` - Analytics data endpoints
3. `functions/lib/admin-booking-helpers.ts` - Shared helpers for admin bookings

**Frontend (10 files):**
4. `src/components/admin/UserSearchAndCreate.tsx` - User lookup with inline creation
5. `src/components/admin/AdminBookingForm.tsx` - Admin booking form with overrides
6. `src/pages/admin/CreateBookingPage.tsx` - Admin booking creation page
7. `src/pages/admin/analytics/BookingAnalyticsPage.tsx` - Analytics dashboard
8. `src/components/admin/analytics/SummaryCard.tsx` - Summary metric card
9. `src/components/admin/analytics/RevenueChart.tsx` - Daily revenue bar chart
10. `src/components/admin/analytics/BookingsByStatusChart.tsx` - Status breakdown chart
11. `src/components/admin/analytics/CustomerTypeChart.tsx` - Resident vs guest pie chart
12. `src/components/admin/analytics/PopularAmenitiesChart.tsx` - Amenity popularity chart
13. `src/components/admin/analytics/PopularSlotsChart.tsx` - Time slot popularity chart

### Files to Modify

1. `functions/routes/bookings.ts` - Integrate notification triggers on status changes
2. `src/types/index.ts` - Add new notification types and analytics interfaces
3. `src/components/admin/Sidebar.tsx` - Add navigation links for new pages
4. `functions/routes/notifications.ts` - Add new notification type values
5. `src/App.tsx` - Add routes for new admin pages
6. `src/lib/api.ts` - Add API client methods for new endpoints

---

## Chunk 1: Notifications Integration

This is the foundational chunk - notifications are needed by both admin booking and analytics features.

### Task 1: Extend Notification Types

**Files:**
- Modify: `src/types/index.ts` (around line 1030)
- Modify: `functions/routes/notifications.ts` (line 12, line 29)

- [ ] **Step 1: Add new notification types to TypeScript enum**

Edit `src/types/index.ts`, find the `NotificationType` export (around line 1030) and add the three new types:

```typescript
export type NotificationType =
  | "demand_letter"
  | "reminder"
  | "late_notice"
  | "announcement"
  | "alert"
  | "payment_verification_requested"
  | "payment_verified"
  | "payment_rejected"
  | "booking_status"      // NEW: Booking status changes
  | "payment_reminder"   // NEW: Payment due reminders
  | "booking_reminder";   // NEW: Upcoming booking reminders
```

- [ ] **Step 2: Update Zod schemas in notifications route**

Edit `functions/routes/notifications.ts`, line 12, update the notificationSchema enum:

```typescript
const notificationSchema = z.object({
  user_id: z.string().optional(),
  type: z.enum([
    "demand_letter",
    "reminder",
    "late_notice",
    "announcement",
    "alert",
    "booking_status",      // NEW
    "payment_reminder",    // NEW
    "booking_reminder",    // NEW
  ]),
  title: z.string().min(1),
  content: z.string().min(1),
  link: z.string().optional(),
});
```

Also update bulkNotificationSchema on line 29 with the same enum values.

- [ ] **Step 3: Update createNotification helper type signature**

Edit `functions/routes/notifications.ts`, find the `createNotification` function export (around line 215), update the type parameter:

```typescript
export async function createNotification(
  db: D1Database,
  userId: string,
  type: "demand_letter" | "reminder" | "late_notice" | "announcement" | "alert" | "booking_status" | "payment_reminder" | "booking_reminder",
  title: string,
  content: string,
  link?: string
): Promise<any> {
```

Also update `createBulkNotifications` helper similarly.

- [ ] **Step 4: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts functions/routes/notifications.ts
git commit -m "feat(types): add booking notification types"
```

### Task 2: Create Booking Notification Helper

**Files:**
- Create: `functions/lib/booking-notifications.ts`

- [ ] **Step 1: Create the notification helper file**

Create `functions/lib/booking-notifications.ts`:

```typescript
import type { Booking, BookingWithCustomer } from '../../types';
import type { NotificationType } from '../../types';

/**
 * Amenity labels for notification content
 */
const AMENITY_LABELS: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court"
};

/**
 * Slot labels for notification content
 */
const SLOT_LABELS: Record<string, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)"
};

/**
 * Create a notification for a booking lifecycle event
 *
 * @param db - D1 database instance
 * @param booking - Booking object (must have user_id or customer_id)
 * @param action - Type of booking event
 * @param reason - Optional reason (for rejections)
 * @returns Promise that resolves when notification is created
 */
export async function createBookingNotification(
  db: D1Database,
  booking: Booking | BookingWithCustomer,
  action: string,
  reason?: string
): Promise<void> {
  // Get the user ID (residents use user_id, guests use customer_id)
  const userId = booking.user_id || booking.customer_id;
  if (!userId) return;

  let title = "";
  let content = "";
  let type: NotificationType = "booking_status";
  let link = `/bookings/${booking.id}/details`;

  const amenity = AMENITY_LABELS[booking.amenity_type] || booking.amenity_type;
  const date = new Date(booking.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const slot = SLOT_LABELS[booking.slot] || booking.slot;

  // Generate notification content based on action
  switch (action) {
    case "approved_to_payment_due":
      if ((booking.amount || 0) > 0) {
        title = "Payment Required for Booking";
        content = `Your ${amenity} booking for ${date} (${slot}) has been approved. Please submit payment proof within 48 hours to secure your booking.`;
        link = `/bookings/${booking.id}/payment`;
      } else {
        title = "Booking Confirmed";
        content = `Your ${amenity} booking for ${date} (${slot}) is confirmed! We look forward to seeing you.`;
      }
      break;

    case "payment_verified_confirmed":
      title = "Payment Verified - Booking Confirmed";
      content = `Your payment has been received and verified. Your ${amenity} booking for ${date} (${slot}) is now confirmed.`;
      break;

    case "rejected":
      title = "Booking Rejected";
      content = `Your ${amenity} booking request for ${date} (${slot}) has been rejected.`;
      if (reason) {
        content += ` Reason: ${reason}`;
      }
      break;

    case "cancelled":
      title = "Booking Cancelled";
      content = `Your ${amenity} booking for ${date} (${slot}) has been cancelled.`;
      break;

    case "payment_review_failed":
      title = "Payment Proof Unclear";
      content = `The payment proof submitted for your ${amenity} booking is unclear. Please resubmit a clear photo/screenshot of your payment receipt.`;
      link = `/bookings/${booking.id}/payment`;
      break;

    case "cancelled_payment_reminder":
      title = "Payment Overdue";
      content = `Payment for your ${amenity} booking on ${date} is now overdue. Please pay or contact us to avoid cancellation.`;
      link = `/bookings/${booking.id}/payment`;
      break;

    case "booking_created_admin":
      title = "Booking Created";
      content = `A ${amenity} booking for ${date} (${slot}) has been created on your behalf.`;
      break;

    default:
      // Generic booking update
      title = "Booking Update";
      content = `Your ${amenity} booking for ${date} (${slot}) has been updated.`;
  }

  // Import and call the notification helper
  const { createNotification } = await import('../routes/notifications');
  await createNotification(db, userId, type, title, content, link);
}
```

- [ ] **Step 2: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add functions/lib/booking-notifications.ts
git commit -m "feat(bookings): add booking notification helper"
```

### Task 3: Integrate Notifications into Booking Actions

**Files:**
- Modify: `functions/routes/bookings.ts` (around lines 276, 285, 291, 297, 303)

- [ ] **Step 1: Add import for notification helper**

At the top of `functions/routes/bookings.ts`, add the import:

```typescript
import { createBookingNotification } from '../lib/booking-notifications';
```

- [ ] **Step 2: Integrate notification after approve action**

Find the approve action handler (around line 276), after the status update, add:

```typescript
// Send notification
await createBookingNotification(c.env.DB, booking, "approved_to_payment_due");
```

- [ ] **Step 3: Integrate notification after confirm_payment action**

Find the confirm_payment action handler (around line 285), after confirming the booking, add:

```typescript
// Send notification
await createBookingNotification(c.env.DB, booking, "payment_verified_confirmed");
```

- [ ] **Step 4: Integrate notification after reject action**

Find the reject action handler (around line 291), after updating status, add:

```typescript
// Send notification
await createBookingNotification(
  c.env.DB,
  booking,
  "rejected",
  rejectionReason
);
```

- [ ] **Step 5: Integrate notification after request_new_proof action**

Find the request_new_proof action handler (around line 297), after the status update, add:

```typescript
// Send notification
await createBookingNotification(c.env.DB, booking, "payment_review_failed");
```

- [ ] **Step 6: Integrate notification after mark_no_show action**

Find the mark_no_show action handler (around line 303), after the status update, add:

```typescript
// Send notification
await createBookingNotification(c.env.DB, booking, "cancelled");
```

- [ ] **Step 7: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add functions/routes/bookings.ts
git commit -m "feat(bookings): integrate notifications on status changes"
```

---

## Chunk 2: Admin Booking Creation

### Task 4: Add Types for Admin Booking

**Files:**
- Modify: `src/types/index.ts` (add after BookingWithReference interface)

- [ ] **Step 1: Add admin booking request/response types**

Add to `src/types/index.ts` after the BookingWithReference interface:

```typescript
// =============================================================================
// Admin Booking Creation
// =============================================================================

export interface AdminBookingRequest {
  // Customer selection
  user_type: 'resident' | 'guest' | 'new_resident' | 'new_guest';
  user_id?: string;                    // existing resident
  customer_id?: string;                 // existing guest

  // New customer fields (if new_guest or new_resident)
  new_customer?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    household_address?: string;     // for new_resident
    resident_notes?: string;        // for new_resident
  };

  // Booking details (same as public)
  amenity_type: AmenityType;
  date: string;                      // YYYY-MM-DD
  slot: TimeBlockSlot;
  event_type?: 'wedding' | 'birthday' | 'meeting' | 'sports' | 'other';
  purpose?: string;
  attendee_count?: number;

  // Admin overrides
  override_price?: number;           // Admin can manually set price
  skip_approval?: boolean;           // If true, goes straight to 'confirmed'
  record_payment?: boolean;          // If true, include payment fields

  // Payment (if record_payment = true)
  payment_amount?: number;
  payment_method?: string;
  receipt_number?: string;

  // Notes
  admin_notes_internal?: string;     // Private admin-only notes
  customer_notes?: string;            // Visible to customer
}

export interface AdminBookingResponse {
  booking: BookingWithCustomer;
  warning?: string;                    // e.g., "Slot already has pending bookings"
}

export interface UserSearchResult {
  id: string;
  type: 'resident' | 'guest';
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  household_address?: string;
}

export interface UserSearchResponse {
  results: UserSearchResult[];
}
```

- [ ] **Step 2: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add admin booking types"
```

### Task 5: Create Backend Admin Booking Helpers

**Files:**
- Create: `functions/lib/admin-booking-helpers.ts`

- [ ] **Step 1: Create admin booking helper library**

Create `functions/lib/admin-booking-helpers.ts`:

```typescript
import type { AdminBookingRequest, Booking } from '../../types';

/**
 * Validate admin booking request
 */
export function validateAdminBookingRequest(data: any): { valid: boolean; error?: string } {
  // Check customer selection
  const userType = data.user_type;
  if (!['resident', 'guest', 'new_resident', 'new_guest'].includes(userType)) {
    return { valid: false, error: 'Invalid user_type' };
  }

  if (userType === 'resident' && !data.user_id) {
    return { valid: false, error: 'user_id required for resident bookings' };
  }

  if (userType === 'guest' && !data.customer_id) {
    return { valid: false, error: 'customer_id required for guest bookings' };
  }

  if (userType === 'new_resident' || userType === 'new_guest') {
    if (!data.new_customer) {
      return { valid: false, error: 'new_customer data required' };
    }
    const { first_name, last_name, email } = data.new_customer;
    if (!first_name || !last_name || !email) {
      return { valid: false, error: 'first_name, last_name, and email required for new customers' };
    }
  }

  // Check booking details
  if (!data.amenity_type || !data.date || !data.slot) {
    return { valid: false, error: 'amenity_type, date, and slot required' };
  }

  // Check price override
  if (data.override_price !== undefined && data.override_price < 0) {
    return { valid: false, error: 'override_price must be non-negative' };
  }

  return { valid: true };
}

/**
 * Determine initial booking status based on admin options
 */
export function determineInitialStatus(request: AdminBookingRequest): UnifiedBookingStatus {
  if (request.skip_approval) {
    // If skipping approval and recording full payment, go straight to confirmed
    if (request.record_payment && request.payment_amount && request.override_price !== undefined) {
      return request.payment_amount >= request.override_price ? 'confirmed' : 'payment_due';
    }
    return 'confirmed';
  }
  return 'submitted';
}

/**
 * Determine payment status based on admin options
 */
export function determinePaymentStatus(request: AdminBookingRequest, amount: number): BookingPaymentStatus {
  if (request.record_payment && request.payment_amount) {
    if (request.payment_amount >= amount) {
      return 'paid';
    }
    return 'partial';
  }
  return 'unpaid';
}

/**
 * Generate admin notes with price override information
 */
export function generateAdminNotes(request: AdminBookingRequest, baseNotes?: string): string | undefined {
  const parts: string[] = [];

  if (baseNotes) {
    parts.push(baseNotes);
  }

  if (request.override_price !== undefined) {
    parts.push(`Price overridden to ₱${request.override_price} by admin`);
  }

  if (request.admin_notes_internal) {
    parts.push(request.admin_notes_internal);
  }

  return parts.length > 0 ? parts.join('\n') : undefined;
}

/**
 * Create new customer (guest or resident) in database
 */
export async function createNewCustomer(
  db: D1Database,
  request: AdminBookingRequest,
  createdBy: string
): Promise<{ customerId?: string; userId?: string; householdId?: string; error?: string }> {
  const { new_customer } = request;
  if (!new_customer) {
    return { error: 'No new customer data provided' };
  }

  try {
    if (request.user_type === 'new_guest') {
      // Create external guest customer
      const customerId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO customers (id, first_name, last_name, email, phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(customerId, new_customer.first_name, new_customer.last_name, new_customer.email, new_customer.phone || null).run();

      return { customerId };
    } else {
      // Create new resident (requires creating user and household)
      // This is more complex - for now, require admin to create via user management
      return { error: 'Please create new residents via User Management first' };
    }
  } catch (error) {
    return { error: `Failed to create customer: ${error}` };
  }
}
```

- [ ] **Step 2: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add functions/lib/admin-booking-helpers.ts
git commit -m "feat(admin): add booking creation helpers"
```

### Task 6: Create Admin Booking API Endpoint

**Files:**
- Create: `functions/routes/admin/bookings.ts`

- [ ] **Step 1: Create admin bookings router**

Create `functions/routes/admin/bookings.ts`:

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';
import { calculatePricing } from '../lib/pricing';
import { createBookingNotification } from '../lib/booking-notifications';
import {
  validateAdminBookingRequest,
  determineInitialStatus,
  determinePaymentStatus,
  generateAdminNotes,
  createNewCustomer,
} from '../lib/admin-booking-helpers';
import type { AdminBookingRequest } from '../../types';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
};

const adminBookingsRouter = new Hono<{ Bindings: Env }>();

// Validation schema
const adminBookingSchema = z.object({
  user_type: z.enum(['resident', 'guest', 'new_resident', 'new_guest']),
  user_id: z.string().optional(),
  customer_id: z.string().optional(),
  new_customer: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    household_address: z.string().optional(),
    resident_notes: z.string().optional(),
  }).optional(),
  amenity_type: z.enum(['clubhouse', 'pool', 'basketball-court', 'tennis-court']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(['AM', 'PM', 'FULL_DAY']),
  event_type: z.enum(['wedding', 'birthday', 'meeting', 'sports', 'other']).optional(),
  purpose: z.string().optional(),
  attendee_count: z.number().int().optional(),
  override_price: z.number().nonnegative().optional(),
  skip_approval: z.boolean().optional(),
  record_payment: z.boolean().optional(),
  payment_amount: z.number().nonnegative().optional(),
  payment_method: z.string().optional(),
  receipt_number: z.string().optional(),
  admin_notes_internal: z.string().optional(),
  customer_notes: z.string().optional(),
});

// POST /api/admin/bookings/create - Create booking as admin
adminBookingsRouter.post('/create', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = adminBookingSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: 'Invalid input', details: result.error.flatten() },
      400
    );
  }

  const request: AdminBookingRequest = result.data;

  // Validate request
  const validation = validateAdminBookingRequest(request);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  let userId: string | undefined;
  let customerId: string | undefined;
  let householdId: string | undefined;
  let warning: string | undefined;

  try {
    // Handle customer selection
    if (request.user_type === 'new_guest' || request.user_type === 'new_resident') {
      const newCustomer = await createNewCustomer(c.env.DB, request, authUser.userId);
      if (newCustomer.error) {
        return c.json({ error: newCustomer.error }, 400);
      }
      customerId = newCustomer.customerId;
      userId = newCustomer.userId;
      householdId = newCustomer.householdId;
    } else if (request.user_type === 'resident') {
      userId = request.user_id;
      // Get household_id
      const household = await c.env.DB.prepare(
        'SELECT id FROM households WHERE owner_user_id = ? LIMIT 1'
      ).bind(userId).first();
      householdId = household?.id as string | undefined;
    } else {
      customerId = request.customer_id;
    }

    // Calculate pricing
    const pricing = await calculatePricing(
      c.env.DB,
      request.amenity_type,
      request.date,
      request.slot,
      request.user_type === 'resident' ? 0.5 : 0 // 50% resident discount
    );

    const finalAmount = request.override_price ?? pricing.finalAmount;

    // Determine statuses
    const bookingStatus = determineInitialStatus(request);
    const paymentStatus = determinePaymentStatus(request, finalAmount);

    // Generate booking ID
    const bookingId = crypto.randomUUID();
    const referenceNumber = `BK-${Date.now().toString(36).toUpperCase()}`;

    // Create booking
    await c.env.DB.prepare(`
      INSERT INTO bookings (
        id, user_id, customer_id, household_id,
        amenity_type, date, slot,
        base_rate, duration_hours, day_multiplier, season_multiplier, resident_discount,
        amount, pricing_calculated_at,
        payment_status, amount_paid, payment_method, receipt_number,
        booking_status,
        event_type, purpose, attendee_count,
        admin_notes, rejection_reason,
        created_at, created_by, updated_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, datetime('now'),
        ?, ?, ?, ?,
        ?,
        ?, ?, ?,
        ?, NULL,
        datetime('now'), ?, datetime('now')
      )
    `).bind(
      bookingId,
      userId || null,
      customerId || null,
      householdId || null,
      request.amenity_type,
      request.date,
      request.slot,
      pricing.baseRate,
      pricing.durationHours,
      pricing.dayMultiplier,
      pricing.seasonMultiplier,
      pricing.residentDiscount,
      finalAmount,
      paymentStatus,
      request.record_payment ? request.payment_amount || 0 : 0,
      request.payment_method || null,
      request.receipt_number || null,
      bookingStatus,
      request.event_type || null,
      request.purpose || null,
      request.attendee_count || null,
      generateAdminNotes(request)
      authUser.userId
    ).run();

    // Add customer notes if provided
    if (request.customer_notes) {
      await c.env.DB.prepare(`
        UPDATE bookings SET admin_notes = CASE
          WHEN admin_notes IS NULL THEN ?
          ELSE admin_notes || '\n\nCustomer Notes: ' || ?
        END
        WHERE id = ?
      `).bind(request.customer_notes, request.customer_notes, bookingId).run();
    }

    // If confirmed, add to booking_blocked_dates
    if (bookingStatus === 'confirmed') {
      await c.env.DB.prepare(`
        INSERT INTO booking_blocked_dates (id, booking_id, amenity_type, booking_date, slot, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).bind(crypto.randomUUID(), bookingId, request.amenity_type, request.date, request.slot).run();
    }

    // Get the full booking with customer details
    const booking = await c.env.DB.prepare(`
      SELECT
        b.*,
        CASE
          WHEN b.user_id IS NOT NULL THEN 'resident'
          ELSE 'external'
        END as customer_type,
        COALESCE(u.first_name, c.first_name) as first_name,
        COALESCE(u.last_name, c.last_name) as last_name,
        COALESCE(u.email, c.email) as email,
        COALESCE(u.phone, c.phone) as phone,
        h.address as household_address,
        ? as reference_number
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN households h ON b.household_id = h.id
      WHERE b.id = ?
    `).bind(referenceNumber, bookingId).first();

    // Send notification
    await createBookingNotification(c.env.DB, booking, 'booking_created_admin');

    return c.json({
      booking,
      warning,
    } as AdminBookingResponse, 201);

  } catch (error) {
    console.error('Error creating admin booking:', error);
    return c.json({ error: 'Failed to create booking' }, 500);
  }
});

export { adminBookingsRouter };
```

- [ ] **Step 2: Register the router in main admin routes**

Edit `functions/routes/admin.ts`, find where other admin sub-routers are registered, add:

```typescript
import { adminBookingsRouter } from './admin/bookings';

// Add to the admin router
app.route('/admin/bookings', adminBookingsRouter);
```

- [ ] **Step 3: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add functions/routes/admin/bookings.ts functions/routes/admin.ts
git commit -m "feat(api): add admin booking creation endpoint"
```

### Task 7: Create User Search and Create Component

**Files:**
- Create: `src/components/admin/UserSearchAndCreate.tsx`

- [ ] **Step 1: Create the UserSearchAndCreate component**

Create `src/components/admin/UserSearchAndCreate.tsx`:

```typescript
import { useState, useEffect } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { UserSearchResult } from "@/types";

interface UserSearchAndCreateProps {
  value: {
    type: 'resident' | 'guest' | 'new_resident' | 'new_guest';
    user_id?: string;
    customer_id?: string;
    new_customer?: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
    };
  } | null;
  onChange: (value: UserSearchAndCreateProps["value"]) => void;
  onError?: (error: string) => void;
}

export function UserSearchAndCreate({
  value,
  onChange,
  onError
}: UserSearchAndCreateProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewGuestDialog, setShowNewGuestDialog] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Search for users when query changes (debounced)
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await api.admin.searchUsers(searchQuery);
        if (result.error) {
          onError?.(result.error);
        } else {
          setSearchResults(result.data?.results || []);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    setSearchTimeout(timeout);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleSelectUser = (result: UserSearchResult) => {
    setSearchQuery("");
    setSearchResults([]);
    onChange({
      type: result.type,
      user_id: result.type === 'resident' ? result.id : undefined,
      customer_id: result.type === 'guest' ? result.id : undefined,
    });
  };

  const handleCreateNewGuest = () => {
    setShowNewGuestDialog(true);
  };

  const selectedDisplay = value ? (
    value.user_type === 'new_guest' || value.user_type === 'new_resident' ? (
      <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border">
        <UserPlus className="w-4 h-4 text-primary" />
        <span className="font-medium">
          New {value.user_type === 'new_guest' ? 'Guest' : 'Resident'}: {value.new_customer?.first_name} {value.new_customer?.last_name}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => onChange(null)}
        >
          Change
        </Button>
      </div>
    ) : (
      <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
        <Users className="w-4 h-4" />
        <span className="font-medium">
          {value.user_type === 'resident' ? 'Resident' : 'Guest'} ID: {value.user_id || value.customer_id?.slice(0, 8)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => onChange(null)}
        >
          Change
        </Button>
      </div>
    )
  ) : null;

  return (
    <div className="space-y-3">
      <Label>Customer</Label>

      {!value ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="border rounded-md bg-background max-h-64 overflow-y-auto">
              {/* Residents Group */}
              {searchResults.filter(r => r.type === 'resident').length > 0 && (
                <div className="p-2">
                  <p className="text-xs font-medium text-muted-foreground px-2 mb-1">
                    Residents
                  </p>
                  {searchResults.filter(r => r.type === 'resident').map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelectUser(result)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                    >
                      <p className="font-medium">{result.first_name} {result.last_name}</p>
                      <p className="text-sm text-muted-foreground">{result.email}</p>
                      {result.household_address && (
                        <p className="text-xs text-muted-foreground">{result.household_address}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Guests Group */}
              {searchResults.filter(r => r.type === 'guest').length > 0 && (
                <div className="p-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground px-2 mb-1">
                    Guest Customers
                  </p>
                  {searchResults.filter(r => r.type === 'guest').map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelectUser(result)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                    >
                      <p className="font-medium">{result.first_name} {result.last_name}</p>
                      <p className="text-sm text-muted-foreground">{result.email}</p>
                      {result.phone && (
                        <p className="text-xs text-muted-foreground">{result.phone}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleCreateNewGuest}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              New Guest
            </Button>
          </div>

          {/* New Guest Dialog */}
          <NewGuestDialog
            open={showNewGuestDialog}
            onOpenChange={setShowNewGuestDialog}
            onSelect={(guestData) => {
              onChange({
                type: 'new_guest',
                new_customer: guestData,
              });
              setShowNewGuestDialog(false);
            }}
          />
        </>
      ) : (
        selectedDisplay
      )}
    </div>
  );
}

interface NewGuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (guest: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  }) => void;
}

function NewGuestDialog({ open, onOpenChange, onSelect }: NewGuestDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email) return;
    onSelect({ first_name: firstName, last_name: lastName, email, phone });
    // Reset form
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Guest Customer</DialogTitle>
          <DialogDescription>
            Add a new external guest customer. They will be able to view their booking status.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create Guest</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: Missing `api.admin.searchUsers` method - we'll add this next

- [ ] **Step 3: Add search users API method to api.ts**

Edit `src/lib/api.ts`, add the searchUsers method:

```typescript
async searchUsers(query: string): ApiResponse<{ results: UserSearchResult[] }> {
  return this.get<{ results: UserSearchResult[] }>(`/admin/users/search?q=${encodeURIComponent(query)}`);
}
```

- [ ] **Step 4: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors (assuming UserSearchResult is exported from types)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/UserSearchAndCreate.tsx src/lib/api.ts
git commit -m "feat(admin): add user search and create component"
```

### Task 8: Create Admin Booking Form Component

**Files:**
- Create: `src/components/admin/AdminBookingForm.tsx`

- [ ] **Step 1: Create the AdminBookingForm component**

Create `src/components/admin/AdminBookingForm.tsx`:

```typescript
import { useState, useEffect } from "react";
import { Calendar, Clock, DollarSign, FileText, Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserSearchAndCreate } from "./UserSearchAndCreate";
import type { AdminBookingRequest, AmenityType, TimeBlockSlot } from "@/types";

const amenityOptions: { value: AmenityType; label: string; capacity: number }[] = [
  { value: "clubhouse", label: "Clubhouse", capacity: 100 },
  { value: "pool", label: "Swimming Pool", capacity: 50 },
  { value: "basketball-court", label: "Basketball Court", capacity: 20 },
  { value: "tennis-court", label: "Tennis Court", capacity: 4 },
];

const slotOptions: { value: TimeBlockSlot; label: string }[] = [
  { value: "AM", label: "Morning (8AM - 12PM)" },
  { value: "PM", label: "Afternoon (1PM - 5PM)" },
  { value: "FULL_DAY", label: "Full Day (8AM - 5PM)" },
];

const eventTypeOptions = [
  { value: "wedding", label: "Wedding" },
  { value: "birthday", label: "Birthday" },
  { value: "meeting", label: "Meeting" },
  { value: "sports", label: "Sports" },
  { value: "other", label: "Other" },
];

interface AdminBookingFormProps {
  onSubmit: (data: AdminBookingRequest) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function AdminBookingForm({ onSubmit, onCancel, isSubmitting }: AdminBookingFormProps) {
  // Customer selection
  const [customer, setCustomer] = useState<AdminBookingFormProps["value"]>(null);

  // Booking details
  const [amenityType, setAmenityType] = useState<AmenityType>("clubhouse");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<TimeBlockSlot>("AM");
  const [eventType, setEventType] = useState<string>("");
  const [purpose, setPurpose] = useState("");
  const [attendeeCount, setAttendeeCount] = useState<number | undefined>();

  // Admin options
  const [overridePrice, setOverridePrice] = useState<boolean>(false);
  const [customPrice, setCustomPrice] = useState<number | undefined>();
  const [skipApproval, setSkipApproval] = useState<boolean>(false);
  const [autoConfirm, setAutoConfirm] = useState<boolean>(false);
  const [recordPayment, setRecordPayment] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<number | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [receiptNumber, setReceiptNumber] = useState<string>("");

  // Notes
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [customerNotes, setCustomerNotes] = useState<string>("");

  // Calculated pricing
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // Error handling
  const [error, setError] = useState<string>("");

  // Calculate pricing when date/slot/amenity changes
  useEffect(() => {
    if (!date || !slot || !amenityType) {
      setCalculatedPrice(null);
      return;
    }

    const calculatePrice = async () => {
      setIsCalculating(true);
      try {
        const result = await api.public.getPricing(amenityType, date, slot);
        if (result.data && !result.error) {
          // Apply resident discount if applicable
          const isResident = customer?.user_type === 'resident';
          const price = isResident
            ? result.data.final_price * 0.5 // 50% discount
            : result.data.final_price;
          setCalculatedPrice(price);
        }
      } catch (err) {
        console.error("Price calculation error:", err);
      } finally {
        setIsCalculating(false);
      }
    };

    calculatePrice();
  }, [date, slot, amenityType, customer]);

  const displayPrice = overridePrice ? customPrice : calculatedPrice;
  const remainingBalance = displayPrice && paymentAmount ? displayPrice - paymentAmount : displayPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!customer) {
      setError("Please select a customer");
      return;
    }

    if (!date || !slot || !amenityType) {
      setError("Please select amenity, date, and time slot");
      return;
    }

    const requestData: AdminBookingRequest = {
      ...customer,
      amenity_type: amenityType,
      date,
      slot,
      event_type: eventType as any,
      purpose: purpose || undefined,
      attendee_count: attendeeCount,
      override_price: overridePrice ? customPrice : undefined,
      skip_approval: skipApproval,
      record_payment: recordPayment,
      payment_amount: paymentAmount,
      payment_method: paymentMethod || undefined,
      receipt_number: receiptNumber || undefined,
      admin_notes_internal: adminNotes || undefined,
      customer_notes: customerNotes || undefined,
    };

    try {
      await onSubmit(requestData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create booking");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Customer Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Customer Selection
          </CardTitle>
          <CardDescription>
            Search for an existing resident or guest, or create a new guest customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserSearchAndCreate
            value={customer}
            onChange={setCustomer}
            onError={setError}
          />
        </CardContent>
      </Card>

      {/* Booking Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Booking Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amenity">Amenity *</Label>
              <Select value={amenityType} onValueChange={(v: AmenityType) => setAmenityType(v)}>
                <SelectTrigger id="amenity">
                  <SelectValue placeholder="Select amenity" />
                </SelectTrigger>
                <SelectContent>
                  {amenityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} (max {option.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slot">Time Slot *</Label>
              <Select value={slot} onValueChange={(v: TimeBlockSlot) => setSlot(v)}>
                <SelectTrigger id="slot">
                  <SelectValue placeholder="Select slot" />
                </SelectTrigger>
                <SelectContent>
                  {slotOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventType">Event Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger id="eventType">
                  <SelectValue placeholder="Select event type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendees">Number of Attendees</Label>
              <Input
                id="attendees"
                type="number"
                min="1"
                value={attendeeCount || ""}
                onChange={(e) => setAttendeeCount(e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose / Description</Label>
            <Textarea
              id="purpose"
              placeholder="Describe the purpose of this booking..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Pricing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCalculating ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Calculating price...
            </div>
          ) : displayPrice !== null ? (
            <div className="text-2xl font-bold">
              ₱{displayPrice.toLocaleString()}
              {customer?.user_type === 'resident' && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (50% resident discount applied)
                </span>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Select date and slot to see pricing</p>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="overridePrice"
              checked={overridePrice}
              onCheckedChange={(checked) => setOverridePrice(checked === true)}
            />
            <Label htmlFor="overridePrice" className="cursor-pointer">
              Override price
            </Label>
          </div>

          {overridePrice && (
            <div className="space-y-2">
              <Label htmlFor="customPrice">Custom Price</Label>
              <Input
                id="customPrice"
                type="number"
                min="0"
                step="0.01"
                value={customPrice || ""}
                onChange={(e) => setCustomPrice(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Enter custom price"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Options */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Options</CardTitle>
          <CardDescription>
            Configure booking workflow and payment recording
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="skipApproval"
              checked={skipApproval}
              onCheckedChange={(checked) => setSkipApproval(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="skipApproval" className="cursor-pointer font-medium">
                Skip approval process
              </Label>
              <p className="text-xs text-muted-foreground">
                Booking will go directly to confirmed status
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="recordPayment"
              checked={recordPayment}
              onCheckedChange={(checked) => setRecordPayment(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="recordPayment" className="cursor-pointer font-medium">
                Record payment now
              </Label>
              <p className="text-xs text-muted-foreground">
                Record payment received at time of booking
              </p>
            </div>
          </div>

          {recordPayment && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Payment Amount *</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="Enter amount received"
                    required={recordPayment}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Input
                    id="paymentMethod"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="e.g., Cash, GCash, Bank Transfer"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiptNumber">Receipt Number</Label>
                <Input
                  id="receiptNumber"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="Official receipt number"
                />
              </div>
              {remainingBalance !== undefined && remainingBalance > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Remaining balance: ₱{remainingBalance.toLocaleString()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customerNotes">Customer Notes</Label>
            <p className="text-xs text-muted-foreground">
              Visible to the customer
            </p>
            <Textarea
              id="customerNotes"
              placeholder="Any notes the customer should see..."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminNotes">Internal Admin Notes</Label>
            <p className="text-xs text-muted-foreground">
              Private notes, only visible to admins
            </p>
            <Textarea
              id="adminNotes"
              placeholder="Internal notes for admin reference..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !customer}>
          {isSubmitting ? "Creating..." : "Create Booking"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: Missing `api.public.getPricing` method - we'll add this next

- [ ] **Step 3: Add pricing API method to api.ts**

Edit `src/lib/api.ts`, add the getPricing method to the public API object:

```typescript
async getPricing(amenityType: string, date: string, slot: string): ApiResponse<PublicPricingCalculation> {
  return this.get<PublicPricingCalculation>(`/public/pricing/${amenityType}?date=${date}&slot=${slot}`);
}
```

- [ ] **Step 4: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminBookingForm.tsx src/lib/api.ts
git commit -m "feat(admin): add booking form component with pricing"
```

### Task 9: Create Admin Booking Page

**Files:**
- Create: `src/pages/admin/CreateBookingPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: Create the CreateBookingPage component**

Create `src/pages/admin/CreateBookingPage.tsx`:

```typescript
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { AdminBookingForm } from "@/components/admin/AdminBookingForm";
import { api } from "@/lib/api";
import type { AdminBookingRequest } from "@/types";

export function CreateBookingPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: AdminBookingRequest) => {
    setIsSubmitting(true);
    try {
      const result = await api.admin.createBooking(data);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Booking created successfully");
      if (result.data?.warning) {
        toast.warning(result.data.warning);
      }

      // Navigate to booking details
      const bookingId = result.data?.booking?.id;
      if (bookingId) {
        navigate(`/admin/reservations/all-bookings`);
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      toast.error("Failed to create booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Create Booking</h1>
            <p className="text-muted-foreground">
              Create a booking on behalf of a resident or guest
            </p>
          </div>
        </div>

        <AdminBookingForm
          onSubmit={handleSubmit}
          onCancel={() => navigate("/admin/reservations/all-bookings")}
          isSubmitting={isSubmitting}
        />
      </div>
    </AdminLayout>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

Edit `src/App.tsx`, add lazy load and route:

```typescript
// Add to lazy imports:
const CreateBookingPage = lazy(() =>
  import("./pages/admin/CreateBookingPage").then((m) => ({
    default: m.CreateBookingPage,
  })),
);

// Add inside admin routes section:
<Route
  path="admin/bookings/create"
  element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminLayout>
        <CreateBookingPage />
      </AdminLayout>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 3: Add navigation link to Sidebar**

Edit `src/components/admin/Sidebar.tsx`, add to the Reservations children:

```typescript
{
  title: "Create Booking",
  href: "/admin/bookings/create",
  icon: Plus,
  badgeKey: undefined,
},
```

Add this after the "All Bookings" item in the Reservations section.

- [ ] **Step 4: Add API methods**

Edit `src/lib/api.ts`, add admin booking methods:

```typescript
// Add to admin API object:
async createBooking(data: AdminBookingRequest): ApiResponse<AdminBookingResponse> {
  return this.post<AdminBookingResponse>('/admin/bookings/create', data);
}

async searchUsers(query: string): ApiResponse<{ results: UserSearchResult[] }> {
  return this.get<{ results: UserSearchResult[] }>(`/admin/users/search?q=${encodeURIComponent(query)}`);
}
```

- [ ] **Step 5: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/CreateBookingPage.tsx src/App.tsx src/components/admin/Sidebar.tsx src/lib/api.ts
git commit -m "feat(admin): add booking creation page with navigation"
```

### Task 10: Add User Search Backend Endpoint

**Files:**
- Modify: `functions/routes/admin.ts` or create `functions/routes/admin/users.ts`

- [ ] **Step 1: Add user search endpoint**

Add to `functions/routes/admin/users.ts` or create it:

```typescript
// GET /api/admin/users/search - Search for users and customers
usersRouter.get('/search', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const query = c.req.query('q');
  if (!query || query.length < 2) {
    return c.json({ results: [] });
  }

  const searchPattern = `%${query}%`;

  try {
    // Search residents (users)
    const residents = await c.env.DB.prepare(`
      SELECT
        u.id,
        'resident' as type,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        h.address as household_address
      FROM users u
      LEFT JOIN households h ON h.owner_user_id = u.id
      WHERE u.role IN ('admin', 'resident', 'staff')
      AND (
        u.first_name LIKE ? COLLATE NOCASE
        OR u.last_name LIKE ? COLLATE NOCASE
        OR u.email LIKE ? COLLATE NOCASE
        OR h.address LIKE ? COLLATE NOCASE
      )
      ORDER BY u.last_name, u.first_name
      LIMIT 20
    `).bind(searchPattern, searchPattern, searchPattern, searchPattern).all();

    // Search customers (external guests)
    const guests = await c.env.DB.prepare(`
      SELECT
        id,
        'guest' as type,
        first_name,
        last_name,
        email,
        phone,
        NULL as household_address
      FROM customers
      WHERE
        first_name LIKE ? COLLATE NOCASE
        OR last_name LIKE ? COLLATE NOCASE
        OR email LIKE ? COLLATE NOCASE
        OR phone LIKE ? COLLATE NOCASE
      ORDER BY last_name, first_name
      LIMIT 20
    `).bind(searchPattern, searchPattern, searchPattern, searchPattern).all();

    const results = [...(residents.results || []), ...(guests.results || [])];

    return c.json({ results });
  } catch (error) {
    console.error('User search error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});
```

- [ ] **Step 2: Ensure router is registered**

Make sure the users router is registered in `functions/routes/admin.ts`:

```typescript
app.route('/admin/users', usersRouter);
```

- [ ] **Step 3: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add functions/routes/admin/users.ts
git commit -m "feat(api): add user search endpoint for admin booking"
```

---

## Chunk 3: Admin Analytics Dashboard

### Task 11: Add Analytics Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add analytics interfaces**

Add to `src/types/index.ts` after admin booking types:

```typescript
// =============================================================================
// Admin Analytics
// =============================================================================

export interface BookingAnalyticsQuery {
  start_date?: string;    // YYYY-MM-DD
  end_date?: string;      // YYYY-MM-DD
  period?: '7d' | '30d' | '90d' | 'this_month';
  group_by?: 'amenity' | 'slot' | 'customer_type' | 'status';
}

export interface BookingAnalyticsResponse {
  summary: {
    period: { start: string; end: string };
    total_revenue: number;
    total_bookings: number;
    confirmed_bookings: number;
    cancelled_bookings: number;
    outstanding_balance: number;
    unique_customers: number;
    repeat_customers: number;
    repeat_customer_rate: number;
    cancellation_rate: number;
  };
  revenue_by_amenity: Array<{
    amenity: string;
    revenue: number;
    bookings: number;
  }>;
  revenue_by_day: Array<{
    date: string;
    revenue: number;
    bookings: number;
  }>;
  bookings_by_status: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  customer_type_breakdown: Array<{
    type: 'resident' | 'external';
    count: number;
    revenue: number;
    percentage: number;
  }>;
  popular_slots: Array<{
    slot: string;
    count: number;
    percentage: number;
  }>;
  top_customers: Array<{
    customer_name: string;
    customer_type: string;
    bookings: number;
    total_revenue: number;
  }>;
}
```

- [ ] **Step 2: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add analytics interfaces"
```

### Task 12: Create Analytics Backend Endpoint

**Files:**
- Create: `functions/routes/admin/analytics.ts`

- [ ] **Step 1: Create analytics router**

Create `functions/routes/admin/analytics.ts`:

```typescript
import { Hono } from 'hono';
import { getUserFromRequest } from '../lib/auth';
import type { Env } from '../index';

const analyticsRouter = new Hono<{ Bindings: Env }>();

/**
 * Get booking analytics with revenue and statistics
 * GET /api/admin/analytics/bookings
 */
analyticsRouter.get('/bookings', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const startDate = c.req.query('start_date') as string;
  const endDate = c.req.query('end_date') as string;
  const period = c.req.query('period') || '30d';

  let start: Date, end: Date;

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    end = new Date();
    end.setHours(23, 59, 59, 999);
    start = new Date();

    switch (period) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case 'this_month':
        start = new Date(start.getFullYear(), start.getMonth(), 1);
        break;
    }

    start.setHours(0, 0, 0, 0);
  }

  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  try {
    // Get summary stats
    const summary = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total_bookings,
        SUM(CASE WHEN booking_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_bookings,
        SUM(CASE WHEN booking_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings,
        SUM(CASE WHEN booking_status = 'confirmed' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN payment_status != 'paid' THEN amount - amount_paid ELSE 0 END) as outstanding_balance
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
    `).bind(startStr, endStr).first();

    // Get unique and repeat customers
    const customers = await c.env.DB.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id ELSE customer_id END) as unique_customers,
        COUNT(*) - COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id ELSE customer_id END) as total_bookings_minus_unique
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
    `).bind(startStr, endStr).first();

    // Revenue by amenity
    const revenueByAmenity = await c.env.DB.prepare(`
      SELECT
        amenity_type as amenity,
        SUM(CASE WHEN booking_status = 'confirmed' THEN amount ELSE 0 END) as revenue,
        COUNT(*) as bookings
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
      GROUP BY amenity_type
      ORDER BY revenue DESC
    `).bind(startStr, endStr).all();

    // Revenue by day
    const revenueByDay = await c.env.DB.prepare(`
      SELECT
        date,
        SUM(CASE WHEN booking_status = 'confirmed' THEN amount ELSE 0 END) as revenue,
        COUNT(*) as bookings
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
      GROUP BY date
      ORDER BY date
    `).bind(startStr, endStr).all();

    // Bookings by status
    const bookingsByStatus = await c.env.DB.prepare(`
      SELECT
        booking_status as status,
        COUNT(*) as count,
        CAST(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS INTEGER) as percentage
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
      GROUP BY booking_status
      ORDER BY count DESC
    `).bind(startStr, endStr).all();

    // Customer type breakdown
    const customerTypeBreakdown = await c.env.DB.prepare(`
      SELECT
        CASE WHEN user_id IS NOT NULL THEN 'resident' ELSE 'external' END as type,
        COUNT(*) as count,
        SUM(CASE WHEN booking_status = 'confirmed' THEN amount ELSE 0 END) as revenue,
        CAST(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS INTEGER) as percentage
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
      GROUP BY type
    `).bind(startStr, endStr).all();

    // Popular slots
    const popularSlots = await c.env.DB.prepare(`
      SELECT
        slot,
        COUNT(*) as count,
        CAST(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS INTEGER) as percentage
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
      GROUP BY slot
      ORDER BY count DESC
    `).bind(startStr, endStr).all();

    // Top customers
    const topCustomers = await c.env.DB.prepare(`
      SELECT
        COALESCE(u.first_name || ' ' || u.last_name, c.first_name || ' ' || c.last_name) as customer_name,
        CASE WHEN b.user_id IS NOT NULL THEN 'Resident' ELSE 'Guest' END as customer_type,
        COUNT(*) as bookings,
        SUM(CASE WHEN b.booking_status = 'confirmed' THEN b.amount ELSE 0 END) as total_revenue
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.date >= ? AND b.date <= ?
      AND b.deleted_at IS NULL
      GROUP BY customer_name, customer_type
      ORDER BY total_revenue DESC
      LIMIT 10
    `).bind(startStr, endStr).all();

    const summaryData = summary as any;
    const customersData = customers as any;

    return c.json({
      summary: {
        period: { start: start.toISOString(), end: end.toISOString() },
        total_revenue: summaryData.total_revenue || 0,
        total_bookings: summaryData.total_bookings || 0,
        confirmed_bookings: summaryData.confirmed_bookings || 0,
        cancelled_bookings: summaryData.cancelled_bookings || 0,
        outstanding_balance: summaryData.outstanding_balance || 0,
        unique_customers: customersData.unique_customers || 0,
        repeat_customers: customersData.total_bookings_minus_unique || 0,
        repeat_customer_rate: customersData.unique_customers > 0
          ? (customersData.total_bookings_minus_unique / customersData.unique_customers)
          : 0,
        cancellation_rate: summaryData.total_bookings > 0
          ? (summaryData.cancelled_bookings / summaryData.total_bookings)
          : 0,
      },
      revenue_by_amenity: revenueByAmenity.results || [],
      revenue_by_day: revenueByDay.results || [],
      bookings_by_status: bookingsByStatus.results || [],
      customer_type_breakdown: customerTypeBreakdown.results || [],
      popular_slots: popularSlots.results || [],
      top_customers: topCustomers.results || [],
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
});

export { analyticsRouter };
```

- [ ] **Step 2: Register the router in admin routes**

Edit `functions/routes/admin.ts`, add:

```typescript
import { analyticsRouter } from './admin/analytics';

// Register the router
app.route('/admin/analytics', analyticsRouter);
```

- [ ] **Step 3: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add functions/routes/admin/analytics.ts functions/routes/admin.ts
git commit -m "feat(api): add booking analytics endpoint"
```

### Task 13: Create Analytics API Client Methods

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add analytics API methods**

Edit `src/lib/api.ts`, add to admin API object:

```typescript
async getBookingAnalytics(params: BookingAnalyticsQuery): ApiResponse<BookingAnalyticsResponse> {
  const queryParams = new URLSearchParams();
  if (params.start_date) queryParams.set('start_date', params.start_date);
  if (params.end_date) queryParams.set('end_date', params.end_date);
  if (params.period) queryParams.set('period', params.period);
  if (params.group_by) queryParams.set('group_by', params.group_by);

  return this.get<BookingAnalyticsResponse>(`/admin/analytics/bookings?${queryParams}`);
}
```

- [ ] **Step 2: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): add analytics client methods"
```

### Task 14: Create Summary Card Component

**Files:**
- Create: `src/components/admin/analytics/SummaryCard.tsx`

- [ ] **Step 1: Create the SummaryCard component**

Create `src/components/admin/analytics/SummaryCard.tsx`:

```typescript
import { type ReactComponent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'currency' | 'number' | 'percent';
}

export function SummaryCard({
  title,
  value,
  change,
  icon: Icon,
  trend,
  format = 'number'
}: SummaryCardProps) {
  const formatValue = (val: string | number) => {
    switch (format) {
      case 'currency':
        return `₱${Number(val).toLocaleString()}`;
      case 'percent':
        return `${Number(val).toFixed(1)}%`;
      default:
        return String(val);
    }
  };

  const getTrendIcon = () => {
    if (trend === 'up') return <ArrowUp className="w-4 h-4" />;
    if (trend === 'down') return <ArrowDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600 dark:text-green-400';
    if (trend === 'down') return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{formatValue(value)}</p>
          {change !== undefined && (
            <p className={cn('text-xs flex items-center gap-1', getTrendColor())}>
              {getTrendIcon()}
              {change > 0 ? '+' : ''}{change.toFixed(1)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-lg bg-primary/10">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/analytics/SummaryCard.tsx
git commit -m "feat(analytics): add summary card component"
```

### Task 15: Create Analytics Chart Components

**Files:**
- Create: `src/components/admin/analytics/RevenueChart.tsx`
- Create: `src/components/admin/analytics/BookingsByStatusChart.tsx`
- Create: `src/components/admin/analytics/CustomerTypeChart.tsx`
- Create: `src/components/admin/analytics/PopularAmenitiesChart.tsx`
- Create: `src/components/admin/analytics/PopularSlotsChart.tsx`

- [ ] **Step 1: Create RevenueChart component**

Create `src/components/admin/analytics/RevenueChart.tsx`:

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RevenueChartProps {
  data: Array<{ date: string; revenue: number; bookings: number }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
  // Format data for display
  const chartData = data.map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Revenue Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              formatter={(value: number) => [`₱${value.toLocaleString()}`, 'Revenue']}
              labelStyle={{ color: 'hsl(var(--background))' }}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            />
            <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create BookingsByStatusChart component**

Create `src/components/admin/analytics/BookingsByStatusChart.tsx`:

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BookingsByStatusChartProps {
  data: Array<{ status: string; count: number; percentage: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'hsl(142, 76%, 36%)',
  submitted: 'hsl(38, 92%, 50%)',
  cancelled: 'hsl(0, 84%, 60%)',
  rejected: 'hsl(0, 84%, 60%)',
  payment_due: 'hsl(38, 92%, 50%)',
  payment_review: 'hsl(43, 96%, 56%)',
};

export function BookingsByStatusChart({ data }: BookingsByStatusChartProps) {
  const chartData = data.map(d => ({
    ...d,
    status: d.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Bookings by Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" />
            <YAxis dataKey="status" type="category" width={120} className="text-xs" />
            <Tooltip
              formatter={(value: number, name: string) => [value, 'Bookings']}
              labelStyle={{ color: 'hsl(var(--background))' }}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create CustomerTypeChart component**

Create `src/components/admin/analytics/CustomerTypeChart.tsx`:

```typescript
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CustomerTypeChartProps {
  data: Array<{ type: 'resident' | 'external'; count: number; revenue: number; percentage: number }>;
}

const COLORS = {
  resident: 'hsl(142, 76%, 36%)',
  external: 'hsl(199, 89%, 48%)',
};

export function CustomerTypeChart({ data }: CustomerTypeChartProps) {
  const chartData = data.map(d => ({
    name: d.type === 'resident' ? 'Residents' : 'External Guests',
    value: d.count,
    revenue: d.revenue,
    percentage: d.percentage
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Customer Type Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name}: ${percentage}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.name.includes('Resident') ? COLORS.resident : COLORS.external} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string, props: any) => [
                `${value} bookings`,
                props.payload.revenue ? `Revenue: ₱${props.payload.revenue.toLocaleString()}` : name
              ]}
              labelStyle={{ color: 'hsl(var(--background))' }}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create PopularAmenitiesChart component**

Create `src/components/admin/analytics/PopularAmenitiesChart.tsx`:

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PopularAmenitiesChartProps {
  data: Array<{ amenity: string; revenue: number; bookings: number }>;
}

const AMENITY_LABELS: Record<string, string> = {
  clubhouse: 'Clubhouse',
  pool: 'Swimming Pool',
  'basketball-court': 'Basketball Court',
  'tennis-court': 'Tennis Court',
};

export function PopularAmenitiesChart({ data }: PopularAmenitiesChartProps) {
  const chartData = data.map(d => ({
    name: AMENITY_LABELS[d.amenity] || d.amenity,
    bookings: d.bookings,
    revenue: d.revenue
  })).sort((a, b) => b.bookings - a.bookings);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="w-5 h-5" />
          Popular Amenities
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" />
            <YAxis dataKey="name" type="category" width={120} className="text-xs" />
            <Tooltip
              formatter={(value: number, name: string, props: any) => [
                value,
                name === 'revenue' ? `Revenue: ₱${props.payload.revenue.toLocaleString()}` : 'Bookings'
              ]}
              labelStyle={{ color: 'hsl(var(--background))' }}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            />
            <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create PopularSlotsChart component**

Create `src/components/admin/analytics/PopularSlotsChart.tsx`:

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PopularSlotsChartProps {
  data: Array<{ slot: string; count: number; percentage: number }>;
}

const SLOT_LABELS: Record<string, string> = {
  AM: 'Morning',
  PM: 'Afternoon',
  FULL_DAY: 'Full Day',
};

export function PopularSlotsChart({ data }: PopularSlotsChartProps) {
  const chartData = data.map(d => ({
    name: SLOT_LABELS[d.slot] || d.slot,
    count: d.count,
    percentage: d.percentage
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Popular Time Slots
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" />
            <YAxis dataKey="name" type="category" width={80} className="text-xs" />
            <Tooltip
              formatter={(value: number) => [`${value} bookings`, 'Count']}
              labelStyle={{ color: 'hsl(var(--background))' }}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: Missing recharts dependency

- [ ] **Step 7: Install recharts dependency**

Run: `pnpm add recharts`

- [ ] **Step 8: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/analytics package.json pnpm-lock.yaml
git commit -m "feat(analytics): add chart components"
```

### Task 16: Create Analytics Dashboard Page

**Files:**
- Create: `src/pages/admin/analytics/BookingAnalyticsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: Create the BookingAnalyticsPage component**

Create `src/pages/admin/analytics/BookingAnalyticsPage.tsx`:

```typescript
import { useState, useEffect } from "react";
import { Calendar, TrendingUp } from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { SummaryCard } from "@/components/admin/analytics/SummaryCard";
import { RevenueChart } from "@/components/admin/analytics/RevenueChart";
import { BookingsByStatusChart } from "@/components/admin/analytics/BookingsByStatusChart";
import { CustomerTypeChart } from "@/components/admin/analytics/CustomerTypeChart";
import { PopularAmenitiesChart } from "@/components/admin/analytics/PopularAmenitiesChart";
import { PopularSlotsChart } from "@/components/admin/analytics/PopularSlotsChart";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookingAnalyticsResponse, BookingAnalyticsQuery } from "@/types";

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
];

export function BookingAnalyticsPage() {
  const [period, setPeriod] = useState<BookingAnalyticsQuery['period']>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [analytics, setAnalytics] = useState<BookingAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadAnalytics();
  }, [period, startDate, endDate]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    setError('');

    try {
      const params: BookingAnalyticsQuery = isCustomRange
        ? { start_date: startDate, end_date: endDate }
        : { period };

      const result = await api.admin.getBookingAnalytics(params);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setAnalytics(result.data);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePeriodChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomRange(true);
    } else {
      setIsCustomRange(false);
      setPeriod(value as BookingAnalyticsQuery['period']);
      setStartDate('');
      setEndDate('');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !analytics) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Booking Analytics</h1>
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            {error || 'No analytics data available'}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Booking Analytics</h1>
            <p className="text-muted-foreground">
              Revenue, bookings, and customer insights
            </p>
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <Select value={isCustomRange ? 'custom' : period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>

            {isCustomRange && (
              <>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[140px]"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[140px]"
                />
              </>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard
            title="Total Revenue"
            value={analytics.summary.total_revenue}
            format="currency"
          />
          <SummaryCard
            title="Total Bookings"
            value={analytics.summary.total_bookings}
          />
          <SummaryCard
            title="Confirmed"
            value={analytics.summary.confirmed_bookings}
          />
          <SummaryCard
            title="Outstanding"
            value={analytics.summary.outstanding_balance}
            format="currency"
          />
          <SummaryCard
            title="Repeat Rate"
            value={analytics.summary.repeat_customer_rate * 100}
            format="percent"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart data={analytics.revenue_by_day} />
          <BookingsByStatusChart data={analytics.bookings_by_status} />
          <CustomerTypeChart data={analytics.customer_type_breakdown} />
          <PopularAmenitiesChart data={analytics.revenue_by_amenity} />
        </div>

        <PopularSlotsChart data={analytics.popular_slots} />

        {/* Top Customers Table */}
        {analytics.top_customers.length > 0 && (
          <div className="rounded-lg border bg-card">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Top Customers</h2>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Customer</th>
                      <th className="text-left py-2 px-4">Type</th>
                      <th className="text-right py-2 px-4">Bookings</th>
                      <th className="text-right py-2 px-4">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.top_customers.map((customer, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-3 px-4 font-medium">{customer.customer_name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            customer.customer_type === 'Resident'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {customer.customer_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">{customer.bookings}</td>
                        <td className="py-3 px-4 text-right">₱{customer.total_revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

Edit `src/App.tsx`, add lazy load and route:

```typescript
// Add to lazy imports:
const BookingAnalyticsPage = lazy(() =>
  import("./pages/admin/analytics/BookingAnalyticsPage").then((m) => ({
    default: m.BookingAnalyticsPage,
  })),
);

// Add inside admin routes section:
<Route
  path="admin/analytics"
  element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminLayout>
        <BookingAnalyticsPage />
      </AdminLayout>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 3: Add navigation link to Sidebar**

Edit `src/components/admin/Sidebar.tsx`, add new item:

```typescript
{
  title: "Analytics",
  href: "/admin/analytics",
  icon: TrendingUp,
}
```

Add this before the "System" section in the baseNavItems array.

- [ ] **Step 4: Add Input import for custom date range**

Edit the analytics page, add Input import:

```typescript
import { Input } from "@/components/ui/input";
```

- [ ] **Step 5: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/analytics/BookingAnalyticsPage.tsx src/App.tsx src/components/admin/Sidebar.tsx
git commit -m "feat(analytics): add booking analytics dashboard page"
```

---

## Final Verification

### Task 17: Build and Type Check

- [ ] **Step 1: Run TypeScript type check**

Run: `rtk tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Run build**

Run: `rtk pnpm run build`
Expected: Build completes successfully

- [ ] **Step 3: Run lint**

Run: `rtk pnpm run lint`
Expected: No lint errors (or only auto-fixable formatting)

- [ ] **Step 4: Commit any fixes**

```bash
git add .
git commit -m "fix: resolve type and lint issues"
```

### Task 18: Testing Checklist

Manual testing steps to verify all features work:

**Notifications Integration:**
- [ ] Create a booking as a guest
- [ ] Approve the booking as admin → verify notification appears
- [ ] Reject a booking with reason → verify notification includes reason
- [ ] Confirm payment on a booking → verify notification sent
- [ ] Check user's notification list shows all booking events

**Admin Booking Creation:**
- [ ] Navigate to Admin → Reservations → Create Booking
- [ ] Search for existing resident and select
- [ ] Fill in booking details and verify price calculation
- [ ] Test price override functionality
- [ ] Test skip approval checkbox
- [ ] Test record payment now
- [ ] Create new guest inline and create booking
- [ ] Verify booking appears in bookings list with correct status

**Analytics Dashboard:**
- [ ] Navigate to Admin → Analytics
- [ ] Verify summary cards show correct data
- [ ] Change time period selector
- [ ] Verify charts update with new data
- [ ] Check revenue chart displays correctly
- [ ] Check bookings by status chart
- [ ] Check customer type breakdown pie chart
- [ ] Check popular amenities and slots charts
- [ ] Verify top customers table displays

---

## Summary

This implementation plan adds three interconnected features to the booking system:

1. **Notifications Integration** - Booking lifecycle events now trigger in-app notifications
2. **Admin Booking Creation** - Admins can create bookings for walkins, phone calls, and other channels
3. **Analytics Dashboard** - Comprehensive booking analytics with revenue tracking and insights

The plan follows TDD principles, uses bite-sized tasks, and includes verification steps throughout.
