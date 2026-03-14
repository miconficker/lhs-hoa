# Booking System Enhancements Design

**Date:** 2026-03-14
**Status:** Design

## Overview

This document describes three interconnected enhancements to the unified booking system:

1. **Admin Direct Booking Creation** - Allow admins to create bookings on behalf of residents/guests (walkins, phone calls, face-to-face, other channels)
2. **Notifications Integration** - Connect booking events to the in-app notification system
3. **Admin Reports & Dashboard** - Analytics and insights for booking management

---

## Part 1: Admin Direct Booking Creation

### Purpose
Enable admins to create bookings directly for:
- Walk-in customers
- Phone call reservations
- Face-to-face bookings
- Bookings from other channels (social media, external sites)

### Architecture

#### Frontend Components

**New Page:** `/admin/bookings/create`

**Components:**
1. `UserSearchAndCreate` - Searchable user dropdown with inline customer creation
2. `AdminBookingForm` - Booking form with admin overrides
3. `WorkflowSelector` - Choice between "Direct Confirm" vs "Submit for Approval"

#### Backend API

**New Endpoint:** `POST /api/admin/bookings/create`

**Request Schema:**
```typescript
interface AdminBookingRequest {
  // Customer selection
  user_type: 'resident' | 'guest' | 'new_resident' | 'new_guest'
  user_id?: string                    // existing resident
  customer_id?: string                 // existing guest

  // New customer fields (if new_guest or new_resident)
  new_customer?: {
    first_name: string
    last_name: string
    email: string
    phone?: string
    household_address?: string     // for new_resident
    resident_notes?: string        // for new_resident
  }

  // Booking details (same as public)
  amenity_type: AmenityType
  date: string                      // YYYY-MM-DD
  slot: 'AM' | 'PM' | 'FULL_DAY'
  event_type?: 'wedding' | 'birthday' | 'meeting' | 'sports' | 'other'
  purpose?: string
  attendee_count?: number

  // Admin overrides
  override_price?: number           // Admin can manually set price
  skip_approval?: boolean           // If true, goes straight to 'confirmed'
  record_payment?: boolean           // If true, include payment fields

  // Payment (if record_payment = true)
  payment_amount?: number
  payment_method?: string
  receipt_number?: string

  // Notes
  admin_notes_internal?: string     // Private admin-only notes
  customer_notes?: string            // Visible to customer
}
```

**Response Schema:**
```typescript
interface AdminBookingResponse {
  booking: BookingWithCustomer
  warning?: string                    // e.g., "Slot already has pending bookings"
}
```

### User Search and Create Component

**File:** `src/components/admin/UserSearchAndCreate.tsx`

**Features:**
- Search input with typeahead (2 character minimum)
- Searches by: name, email, household address
- Results grouped by "Residents" and "Guest Customers"
- Each result shows: name, email, household/phone
- "Create new customer" button at top
- "Create new resident" button for admin-assigned bookings

**State:**
```typescript
interface UserSearchResult {
  id: string
  type: 'resident' | 'guest'
  first_name: string
  last_name: string
  email: string
  phone?: string
  household_address?: string
}
```

### Admin Booking Form Component

**File:** `src/components/admin/AdminBookingForm.tsx`

**Features:**
- All standard booking fields (amenity, date, slot, event type, purpose, attendees)
- Real-time pricing calculation (with resident discount if applicable)
- Admin-only fields:
  - `override_price`: Optional manual price override (checkbox + input)
  - `record_payment_now`: Checkbox to enable payment fields
  - `payment_amount`, `payment_method`, `receipt_number`
  - `admin_notes_internal`: Private notes (admin only)
  - `customer_notes`: Notes visible to customer
- `skip_approval`: Checkbox - if checked, goes straight to "confirmed"
- `auto_confirm`: Checkbox - if checked AND payment recorded, goes to "confirmed"

### Admin Booking Workflow

```
[Select Customer] → [Select Amenity/Date/Slot] → [Enter Details] →
[Payment Section (optional)] → [Admin Notes] → [Confirm]
```

**Status Transitions:**
- `skip_approval = true` AND `auto_confirm = false` → `booking_status = 'confirmed'`
- `skip_approval = false` → `booking_status = 'submitted'`
- `record_payment = true` AND payment covers full amount → `payment_status = 'paid'`
- `override_price` sets custom amount (logs override reason in admin_notes_internal)

### Validation

- All same validation as public bookings
- Additional check: `override_price` must be >= 0
- Admin must explicitly check "Confirm" checkbox for risky actions
- Warning if slot has existing pending bookings

---

## Part 2: Notifications Integration

### Purpose
Connect booking lifecycle events to the existing in-app notification system to keep users informed about their bookings.

### Architecture

#### Extend Notification Types

**File:** `src/types/index.ts`

```typescript
export type NotificationType =
  | "demand_letter"
  | "reminder"
  | "late_notice"
  | "announcement"
  | "alert"
  | "booking_status"      // NEW: Booking status changes
  | "payment_reminder"   // NEW: Payment due reminders
  | "booking_reminder";   // NEW: Upcoming booking reminders
```

#### Notification Triggers

**Location:** `functions/routes/bookings.ts`

**Helper Function:**
```typescript
async function createBookingNotification(
  db: D1Database,
  booking: Booking,
  action: string,
  reason?: string
): Promise<void> {
  const userId = booking.user_id || booking.customer_id;
  if (!userId) return;

  let title = "";
  let content = "";
  let type: NotificationType = "booking_status";
  let link = `/bookings/${booking.id}/details`;

  const amenityLabels = {
    clubhouse: "Clubhouse",
    pool: "Swimming Pool",
    "basketball-court": "Basketball Court",
    "tennis-court": "Tennis Court"
  };

  const amenity = amenityLabels[booking.amenity_type];
  const date = new Date(booking.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const slotLabels = {
    AM: "Morning (8AM - 12PM)",
    PM: "Afternoon (1PM - 5PM)",
    FULL_DAY: "Full Day (8AM - 5PM)"
  };

  switch (action) {
    case "approved_to_payment_due":
      if ((booking.amount || 0) > 0) {
        title = "Payment Required for Booking";
        content = `Your ${amenity} booking for ${date} (${slotLabels[booking.slot]}) has been approved. Please submit payment proof within 48 hours to secure your booking.`;
        link = `/bookings/${booking.id}/payment`;
      } else {
        title = "Booking Confirmed";
        content = `Your ${amenity} booking for ${date} (${slotLabels[booking.slot]}) is confirmed! We look forward to seeing you.`;
      }
      break;

    case "payment_verified_confirmed":
      title = "Payment Verified - Booking Confirmed";
      content = `Your payment has been received and verified. Your ${amenity} booking for ${date} (${slotLabels[booking.slot]}) is now confirmed.`;
      break;

    case "rejected":
      title = "Booking Rejected";
      content = `Your ${amenity} booking request for ${date} (${slotLabels[booking.slot]}) has been rejected.`;
      if (reason) content += ` Reason: ${reason}`;
      break;

    case "cancelled":
      title = "Booking Cancelled";
      content = `Your ${amenity} booking for ${date} (${slotLabels[booking.slot]}) has been cancelled.`;
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
  }

  await createNotification(
    db,
    userId,
    type,
    title,
    content,
    link
  );
}
```

#### Integration Points

**In `functions/routes/bookings.ts` POST /:id/action endpoint:**

After each status transition:
1. Line ~276: After `approve` action
2. Line ~285: After `confirm_payment` action
3. Line ~291: After `reject` action
4. Line ~297: After `request_new_proof` action
5. Line ~303: After `mark_no_show` action

### Reminder Notifications (Cron Jobs)

**New Scheduled Tasks:**

#### Payment Reminders
**Endpoint:** `POST /api/cron/payment-reminders`

**Triggers:**
- 24 hours before payment due
- 7 days overdue
- 14 days overdue (escalation)

**Template:**
```typescript
{
  title: "Payment Due Reminder",
  content: "Payment for your {amenity} booking on {date} is due within 24 hours.",
  link: "/bookings/{id}/payment"
}
```

#### Booking Reminders
**Endpoint:** `POST /api/cron/booking-reminders`

**Triggers:**
- 48 hours before booking
- 24 hours before booking

**Template:**
```typescript
{
  title: "Upcoming Booking Reminder",
  content: "Reminder: You have a {amenity} booking on {date} at {time}.",
  link: "/bookings/{id}/details"
}
```

**Note:** Cron job implementation to be added in future iteration. For now, notifications are only triggered by admin actions.

---

## Part 3: Admin Reports & Dashboard

### Purpose
Provide admins with analytics and insights to:
- Track booking revenue and trends
- Understand customer behavior
- Make data-driven decisions
- Identify popular amenities and time slots

### Architecture

#### Frontend

**New Page:** `/admin/analytics` or integrated into existing admin dashboard sidebar

**File:** `src/pages/admin/analytics/BookingAnalyticsPage.tsx`

**Structure:**
```
<BookingAnalyticsPage>
  <DateRangeSelector />

  <SummaryCards>
    <SummaryCard title="Total Revenue" value="₱45,000" change="+12%" />
    <SummaryCard title="Total Bookings" value="48" />
    <SummaryCard title="Confirmed" value="38" />
    <SummaryCard title="Outstanding Balance" value="₱8,500" />
    <SummaryCard title="Repeat Customers" value="35%" />
  </SummaryCards>

  <ChartsGrid>
    <RevenueChart />
    <BookingsByStatusChart />
    <CustomerTypeChart />
    <PopularAmenitiesChart />
    <PopularSlotsChart />
  </ChartsGrid>

  <DetailedBookingsTable />
</BookingAnalyticsPage>
```

#### Backend API

**New Endpoint:** `GET /api/admin/analytics/bookings`

**Query Params:**
```typescript
interface BookingAnalyticsQuery {
  start_date?: string    // YYYY-MM-DD
  end_date?: string      // YYYY-MM-DD
  period?: '7d' | '30d' | '90d' | 'this_month'
  group_by?: 'amenity' | 'slot' | 'customer_type' | 'status'
}
```

**Response Schema:**
```typescript
interface BookingAnalyticsResponse {
  summary: {
    period: { start: string; end: string }
    total_revenue: number
    total_bookings: number
    confirmed_bookings: number
    cancelled_bookings: number
    outstanding_balance: number
    unique_customers: number
    repeat_customers: number
    repeat_customer_rate: number
    cancellation_rate: number
  }
  revenue_by_amenity: Array<{
    amenity: string
    revenue: number
    bookings: number
  }>
  revenue_by_day: Array<{
    date: string
    revenue: number
    bookings: number
  }>
  bookings_by_status: Array<{
    status: string
    count: number
    percentage: number
  }>
  customer_type_breakdown: Array<{
    type: 'resident' | 'external'
    count: number
    revenue: number
    percentage: number
  }>
  popular_slots: Array<{
    slot: string
    count: number
    percentage: number
  }>
  top_customers: Array<{
    customer_name: string
    customer_type: string
    bookings: number
    total_revenue: number
  }>
}
```

#### Backend Implementation

**New File:** `functions/routes/admin/analytics.ts`

```typescript
export const analyticsRouter = new Hono<{ Bindings: Env }>();

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
      case '7d': start.setDate(start.getDate() - 7); break;
      case '30d': start.setDate(start.getDate() - 30); break;
      case '90d': start.setDate(start.getDate() - 90); break;
      case 'this_month':
        start = new Date(start.getFullYear(), start.getMonth(), 1);
        break;
    }
    start.setHours(0, 0, 0, 0);
  }

  const [revenue, bookings, customers, slots] = await Promise.all([
    getRevenueStats(c.env.DB, start, end),
    getBookingStats(c.env.DB, start, end),
    getCustomerStats(c.env.DB, start, end),
    getPopularSlots(c.env.DB, start, end)
  ]);

  return c.json({
    summary: {
      period: { start: start.toISOString(), end: end.toISOString() },
      total_revenue: revenue.total,
      total_bookings: bookings.total,
      confirmed_bookings: bookings.confirmed,
      cancelled_bookings: bookings.cancelled,
      outstanding_balance: revenue.outstanding,
      unique_customers: customers.unique,
      repeat_customers: customers.repeat,
      repeat_customer_rate: customers.repeat / customers.unique,
      cancellation_rate: bookings.cancelled / bookings.total
    },
    revenue_by_amenity: revenue.byAmenity,
    revenue_by_day: revenue.byDay,
    bookings_by_status: bookings.byStatus,
    customer_type_breakdown: customers.byType,
    popular_slots: slots
  });
});
```

### Summary Cards

**File:** `src/components/admin/analytics/SummaryCard.tsx`

**Props:**
```typescript
interface SummaryCardProps {
  title: string;
  value: string | number;
  change?: number              // percentage change from previous period
  icon?: React.ComponentType<{ className?: string }>
  trend?: 'up' | 'down' | 'neutral'
}
```

**Features:**
- Shows trend indicator (up/down arrow with color)
- Percentage change in green (up) or red (down)
- Icon for visual identification

### Charts

#### 1. Revenue Chart
- **Type:** Bar chart (daily revenue)
- **Y-axis:** Revenue (₱)
- **X-axis:** Dates
- **Color:** Green for positive

#### 2. Bookings by Status
- **Type:** Horizontal bar chart
- **Categories:** Submitted, Confirmed, Cancelled, Rejected, No Show
- **Colors:** Status-based colors

#### 3. Customer Type Breakdown
- **Type:** Pie chart
- **Categories:** Resident vs External
- **Shows:** Count and revenue percentage

#### 4. Popular Amenities
- **Type:** Horizontal bar chart
- **Sorted:** Most popular first

#### 5. Popular Time Slots
- **Type:** Horizontal bar chart
- **Categories:** AM, PM, FULL_DAY

### Date Range Selector

**Presets:**
- Last 7 days
- Last 30 days (default)
- Last 90 days
- This month
- Custom range

---

## Implementation Notes

### Dependencies
- No new external dependencies required
- Uses existing `notifications` system
- Reuses existing `createNotification()` helper
- Uses existing booking data models

### Database Changes
- Add new notification types to `system_settings` or extend enum in code
- No schema migrations required (notifications system is flexible)

### Files to Create
1. `src/components/admin/UserSearchAndCreate.tsx`
2. `src/components/admin/AdminBookingForm.tsx`
3. `src/pages/admin/CreateBookingPage.tsx`
4. `functions/routes/admin/analytics.ts`
5. `src/pages/admin/analytics/BookingAnalyticsPage.tsx`
6. `src/components/admin/analytics/SummaryCard.tsx`
7. `src/components/admin/analytics/*Chart.tsx` (chart components)

### Files to Modify
1. `functions/routes/bookings.ts` - Add admin booking endpoint, integrate notifications
2. `src/types/index.ts` - Extend NotificationType enum
3. Admin layout/navigation - Add links to new pages

### Security Considerations
- Admin booking creation requires `admin` or `staff` role
- Analytics endpoints require `admin` or `staff` role
- Price override logged in audit trail
- Customer notes visible to customer - admin notes internal only

---

## Testing Strategy

### Admin Booking Creation
1. Create resident booking (existing user)
2. Create guest booking (existing customer)
3. Create new resident inline + booking
4. Create new guest inline + booking
5. Override price and verify logging
6. Skip approval vs submit for approval workflows
7. Record payment during booking creation
8. Create booking for occupied slot (verify warning)

### Notifications
1. Approve booking → verify notification sent
2. Reject booking → verify notification includes reason
3. Confirm payment → verify notification sent
4. Cancel booking → verify notification sent
5. Check notification appears in user's notification list
6. Verify link points to correct page

### Analytics
1. View last 7 days → verify correct data
2. Change date range → verify updates
3. Check revenue calculations
4. Verify cancellation rate calculation
5. Verify customer type breakdown
6. Click chart to see detailed bookings

---

## Future Enhancements (Out of Scope)

- Email notification integration
- Automated payment reminder cron jobs
- Automated booking reminder cron jobs
- Export analytics to CSV/PDF
- More granular date range filtering
- Year-over-year comparison reports
- Forecasting and predictions
