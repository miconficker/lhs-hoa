# Public External Booking System - Design Specification

**Date:** 2026-03-12
**Status:** Revised (v2) - Addressing review feedback
**Author:** Claude Code

## Overview

Enable unauthenticated visitors to browse amenities, check real-time availability, and submit external rental booking requests. Booking requests remain **pending** until an admin manually verifies payment and approves the request. Only then are time slots actually blocked.

**Key Features:**
- Public access at `/external-rentals` (no authentication required)
- Standard time slots (AM/PM/Full Day) same as residents
- Dynamic pricing with resident discounts
- Manual payment verification (upload proof, admin confirms)
- **Pending requests don't block availability** - only confirmed bookings do

---

## User Flow

```
Guest visits /external-rentals
  ↓
Browse amenities with real-time availability
  ↓
Select amenity → View calendar with available dates
  ↓
Choose date + time slot (slot shows as available)
  ↓
Fill booking form:
  - Event details (type, attendees, purpose)
  - Contact info (name, email, phone)
  - Show calculated total based on dynamic pricing
  ↓
Submit booking request → Status: PENDING_PAYMENT
  ↓
Redirect to confirmation page with reference number
  ↓
Guest uploads proof of payment (GCash receipt, bank transfer)
  ↓
Admin receives notification, reviews request + payment proof
  ↓
Admin approves → Status: CONFIRMED → Time slot now blocked
Admin rejects → Status: REJECTED → Time slot remains available
  ↓
Guest receives email notification of status change
```

---

## Database Schema Changes

### 1. Extend `external_rentals` Table

**IMPORTANT:** First, we need to remove the existing UNIQUE constraint that prevents multiple pending bookings.

```sql
-- Step 1: Remove existing UNIQUE constraint on (amenity_type, date, slot)
-- This constraint prevents multiple pending requests for the same slot
-- We want to allow multiple pending requests, only block confirmed ones
-- Migration step to recreate table without the constraint:
CREATE TABLE external_rentals_new (
  -- [copy all existing columns from external_rentals table]
  -- [but WITHOUT the UNIQUE(amenity_type, date, slot) constraint]
);

-- Copy data and rename (procedure similar to migration 0014)
-- Then add the new columns below:
```

**New columns for public bookings:**
```sql
ALTER TABLE external_rentals ADD COLUMN guest_name TEXT;
ALTER TABLE external_rentals ADD COLUMN guest_email TEXT;
ALTER TABLE external_rentals ADD COLUMN guest_phone TEXT;
ALTER TABLE external_rentals ADD COLUMN booking_status TEXT DEFAULT 'pending_payment';
ALTER TABLE external_rentals ADD COLUMN rejection_reason TEXT;
ALTER TABLE external_rentals ADD COLUMN created_ip TEXT;
ALTER TABLE external_rentals ADD COLUMN guest_notes TEXT;
ALTER TABLE external_rentals ADD COLUMN admin_notes TEXT;
ALTER TABLE external_rentals ADD COLUMN ip_retained_until TEXT; -- For GDPR compliance

-- Index for looking up pending requests by same slot (to prevent abuse)
CREATE INDEX idx_external_rentals_slot_pending ON external_rentals(amenity_type, date, slot) WHERE booking_status != 'confirmed';

-- Booking status values: pending_payment, pending_verification, confirmed, rejected, cancelled
```

**IP Address Retention Policy:**
- `created_ip` stored for fraud prevention (rate limiting, abuse detection)
- `ip_retained_until` = `created_at + 90 days` (automatic cleanup)
- IPs older than 90 days can be deleted in compliance with data privacy regulations

**Status Flow:**
- `pending_payment` → Initial state, awaiting payment proof upload
- `pending_verification` → Payment proof uploaded, awaiting admin review
- `confirmed` → Admin approved, time slot now blocked
- `rejected` → Admin rejected, time slot remains available
- `cancelled` → Guest cancelled or admin cancelled

### 2. Extend `system_settings` for External Pricing

**Design Decision:** Instead of creating a new `public_pricing` table, extend the existing `system_settings` approach used in migration 0015. This keeps pricing unified.

**New system_settings keys:**
```sql
-- Base rates for external bookings (per hour)
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_clubhouse_hourly', '500'),
  ('external_pricing_pool_hourly', '300'),
  ('external_pricing_basketball-court_hourly', '200'),
  ('external_pricing_tennis-court_hourly', '250');

-- Resident discount for external bookings (default: 50% off)
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_resident_discount_percent', '0.50');

-- Day multipliers (JSON format for flexibility)
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_day_multipliers', '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}');

-- Season multipliers
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_season_multipliers', '{"peak": 1.3, "off_peak": 1.0}');

-- Peak season definition
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_peak_months', '12,1,2,3,4,5'); -- December to May

-- Holiday calendar (stored as comma-separated dates)
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_holidays_2026', '2026-01-01,2026-03-28,2026-03-29,2026-04-09,2026-04-10,2026-05-01,2026-06-12,2026-12-25,2026-12-30');
```

### 3. New `booking_blocked_dates` Table

```sql
-- Track which dates/slots are blocked by CONFIRMED external bookings
CREATE TABLE booking_blocked_dates (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL, -- References external_rentals.id
  amenity_type TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  slot TEXT NOT NULL, -- AM, PM, FULL_DAY
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id) REFERENCES external_rentals(id) ON DELETE CASCADE,
  UNIQUE(amenity_type, booking_date, slot)
);
```

**Key Design Decision:** Only `confirmed` external bookings create entries in `booking_blocked_dates`. Pending requests do NOT block slots, allowing multiple pending requests for the same slot. Admins can approve the first suitable request and reject others.

### 4. Payment Proof Storage (Simplified)

**Design Decision:** Store payment proof URL directly in `external_rentals` table instead of separate table. Simpler for single upload per booking.

```sql
-- payment_proofs table REMOVED from design
-- Use external_rentals.proof_of_payment_url directly (R2 storage URL)
```

---

## Architecture

### Public Routes (Unauthenticated)

```
/external-rentals                        # Browse amenities
/external-rentals/:amenityType           # Amenity detail + calendar
/external-rentals/book/:amenityType       # Booking form
/external-rentals/confirmation/:id        # Status tracker
/external-rentals/success/:id             # After booking submission
```

### Component Structure

```
src/pages/public/
├── ExternalRentalsPage.tsx              # Amenity browsing grid
├── AmenityDetailPage.tsx                # Calendar + price calculator
├── BookingPage.tsx                      # Guest booking form
├── ConfirmationPage.tsx                 # Status tracker
└── SuccessPage.tsx                      # Post-submit confirmation

src/components/public/
├── AmenityCard.tsx                      # Amenity display card
├── PublicCalendar.tsx                    # Availability calendar
├── GuestBookingForm.tsx                  # Extended booking form
├── PaymentProofUpload.tsx                # File upload component
├── PricingBreakdown.tsx                  # Dynamic pricing display
└── BookingStatusTracker.tsx              # Status indicator
```

### Backend Routes

```typescript
// Public endpoints (no auth required)
GET  /api/public/amenities                    # List bookable amenities
GET  /api/public/availability/:amenityType    # Check availability (excludes pending requests)
GET  /api/public/pricing/:amenityType         # Get pricing (with multipliers)
POST /api/public/bookings                     # Create booking request
POST /api/public/bookings/:id/proof           # Upload payment proof
GET  /api/public/bookings/:id/status          # Check booking status
GET  /api/public/payment-details              # Get GCash/bank info for payment

// Admin endpoints (auth required)
GET  /api/admin/external-rentals?status=pending        # Filter by status
PUT  /api/admin/external-rentals/:id/approve          # Approve + block slot
PUT  /api/admin/external-rentals/:id/reject           # Reject + keep slot open
PUT  /api/admin/external-rentals/:id/request-proof     # Request additional proof
```

**API Response Format:** All responses follow existing api.ts pattern:
```typescript
interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}
```

**Example:**
```json
// GET /api/public/amenities
{
  "data": {
    "amenities": [
      { "amenity_type": "clubhouse", "name": "Clubhouse", "hourly_rate": 500 }
    ]
  }
}

// POST /api/public/bookings (success)
{
  "data": {
    "booking": {
      "id": "ext-2026-001",
      "reference_number": "EXT-2026-0312-001",
      "status": "pending_payment"
    }
  }
}

// POST /api/public/bookings (error)
{
  "error": "This time slot is already booked"
}
```

---

## Page Specifications

### Page 1: `/external-rentals` - Browse Amenities

**Purpose:** Public landing for external rentals

**Content:**
- Hero section with headline ("Rent Our Amenities for Your Events")
- Amenities grid with cards showing:
  - Amenity image
  - Name (Clubhouse, Swimming Pool, Basketball Court, Tennis Court)
  - Brief description
  - Capacity (max attendees)
  - "From ₱X/day" pricing hint
  - "Check Availability" button

**Data Source:** `GET /api/public/amenities`

### Page 2: `/external-rentals/:amenityType` - Calendar & Pricing

**Purpose:** Show availability and calculate price

**Content:**
- Amenity header with image and description
- Interactive calendar (current month + 2 months ahead)
- Date click → Show available slots (AM/PM/Full Day)
- Slot selection → Update pricing breakdown
- Pricing breakdown component:
  - Base rate
  - Day multiplier (weekend/holiday)
  - Season multiplier
  - Total calculation
  - "Proceed to Booking" button

**Availability Logic:**
```javascript
// Slot is available if:
1. No CONFIRMED external booking for that date/slot
2. No resident reservation for that date/slot
3. No time block for that date/slot
4. PENDING external bookings are IGNORED (don't block)
```

**API:** `GET /api/public/availability/:amenityType?start=2026-03-01&end=2026-05-31`

### Page 3: `/external-rentals/book` - Booking Form

**Purpose:** Collect guest information and booking details

**Form Fields:**
1. **Booking Summary** (read-only)
   - Amenity type
   - Selected date and time slot
   - Calculated total

2. **Guest Information** (required)
   - Full name *
   - Email address *
   - Phone number *
   - Alternative phone (optional)

3. **Event Details** (required)
   - Event type (wedding, birthday, meeting, sports, other) *
   - Expected number of attendees *
   - Event purpose/description *

4. **Payment Instructions**
   - Display GCash/Bank transfer details
   - Total amount to pay
   - Reference number format reminder

5. **Proof of Payment**
   - File upload (screenshot, receipt)
   - Accept: JPG, PNG, PDF (max 5MB)
   - Required: Submit now OR upload later via confirmation page

6. **Terms & Conditions**
   - Checkbox to agree to terms
   - Link to full terms and conditions

**API:** `POST /api/public/bookings`
```json
{
  "amenity_type": "clubhouse",
  "date": "2026-03-15",
  "slot": "FULL_DAY",
  "guest_name": "Juan Dela Cruz",
  "guest_email": "juan@example.com",
  "guest_phone": "+639123456789",
  "event_type": "wedding",
  "attendees": 50,
  "purpose": "Wedding reception",
  "proof_of_payment_url": null // or R2 URL if uploaded during booking
}
```

### Page 4: `/external-rentals/confirmation/:id` - Status Tracker

**Purpose:** Track booking status and upload payment proof

**Content:**
- Booking reference number (prominent)
- Current status badge:
  - 🟡 Pending Payment - Upload proof of payment
  - 🟠 Under Review - Verifying payment
  - 🟢 Confirmed - Booking approved
  - 🔴 Rejected - Booking declined (show reason)
  - ⚪ Cancelled - Booking cancelled

- Booking details summary
- Payment proof upload section (if still pending)
- Admin notes (if any)
- Option to cancel booking (guest can cancel)

**API:** `GET /api/public/bookings/:id/status`

---

## Pricing Architecture

### Slot Duration

**Standard Time Slots:**
- **AM:** 8:00 AM - 12:00 PM (4 hours)
- **PM:** 1:00 PM - 5:00 PM (4 hours)
- **FULL_DAY:** 8:00 AM - 5:00 PM (9 hours)

**Note:** Residents only have AM/PM options. External rentals get FULL_DAY option for all-day events like weddings.

### Dynamic Pricing Formula

```
final_price = base_rate × duration × day_multiplier × season_multiplier

Where:
- base_rate: From system_settings (external_pricing_{amenity}_hourly)
- duration: 4 hours (AM/PM) or 9 hours (FULL_DAY)
- day_multiplier: 1.0 (weekday), 1.2 (weekend), 1.5 (holiday)
- season_multiplier: 1.3 (peak: Dec-May), 1.0 (off-peak: Jun-Nov)
- resident_discount: 0.5 (50% off for authenticated residents)
```

### Resident vs Public Pricing

- **Public:** Full price (no discount)
- **Residents:** 50% discount (automatic when authenticated via JWT token)
- **Discount applied server-side** in pricing API response

### Example Calculation

```
Clubhouse, Full Day, Weekend, Peak Season:
- Base rate: ₱500/hour (from system_settings)
- Duration: 9 hours (8AM-5PM)
- Day multiplier: 1.2 (weekend)
- Season multiplier: 1.3 (peak season)

Public: 500 × 9 × 1.2 × 1.3 = ₱7,020
Resident: 7,020 × 0.5 = ₱3,510
```

### Holiday Calendar

Holidays are stored in `system_settings` as comma-separated dates:
```
Key: external_pricing_holidays_2026
Value: 2026-01-01,2026-03-28,2026-03-29,2026-04-09,2026-04-10...
```

Admin can update holidays annually through admin settings UI.

---

## Availability Logic

### Critical: Pending Requests Don't Block Slots

**Slot Availability Check:**
```sql
-- A slot is available if ALL of these return 0:
SELECT COUNT(*) FROM reservations
WHERE amenity_type = ?
  AND date = ?
  AND slot = ?
  AND status != 'cancelled';

SELECT COUNT(*) FROM booking_blocked_dates
WHERE amenity_type = ?
  AND booking_date = ?
  AND slot = ?;

-- NOTE: external_rentals with status != 'confirmed' are IGNORED
```

**When Admin Approves:**
```sql
-- 1. Update external_rentals status
UPDATE external_rentals SET booking_status = 'confirmed' WHERE id = ?;

-- 2. Create blocked_dates entry
INSERT INTO booking_blocked_dates (booking_id, amenity_type, booking_date, slot)
VALUES (?, ?, ?, ?);

-- 3. Send notification to guest
```

**When Admin Rejects:**
```sql
-- 1. Update external_rentals status
UPDATE external_rentals SET booking_status = 'rejected', rejection_reason = ? WHERE id = ?;

-- 2. NO entry in booking_blocked_dates (slot remains available)

-- 3. Send notification to guest
```

---

## Security & Validation

### Rate Limiting
- IP-based: 3 booking submissions per hour
- Email-based: 5 submissions per day per email
- Use existing `rate_limits` infrastructure

### Data Validation
- Email: Valid format, MX check if possible
- Phone: PH format validation (+63...)
- File upload: Images/PDF only, 5MB max
- SQL injection: Parameterized queries (existing pattern)

### Fraud Prevention
- CAPTCHA on form submit (Cloudflare Turnstile)
- Email verification before confirmation (optional, can skip)
- Admin review of all bookings before confirmation

### Moderation
- Admin can reject suspicious requests
- Admin notes visible only to admins
- Rejection reason sent to guest

---

## Admin Interface Enhancements

### New: External Rentals Queue

**Location:** `/admin/financials/external-rentals?status=pending_verification`

**Features:**
- Filter by status: pending_payment, pending_verification, confirmed, rejected
- Sort by submission date
- Quick actions:
  - View booking details
  - View proof of payment (opens in new tab)
  - Approve (with optional note)
  - Reject (requires reason)
  - Request additional proof

**Approve Action:**
1. Verify payment proof
2. Click "Approve"
3. System creates `booking_blocked_dates` entry
4. Guest receives confirmation email
5. Slot now shows as unavailable

**Reject Action:**
1. Select rejection reason (dropdown)
2. Add custom note (optional)
3. Click "Reject"
4. NO blocked_dates entry created
5. Guest receives rejection email with reason
6. Slot remains available for others

---

## Email Templates

### Template 1: Booking Request Received (Pending Payment)

**Subject:** `Booking Request Received - {reference_number}`

**Body:**
```
Dear {guest_name},

Thank you for your booking request!

Booking Details:
- Reference Number: {reference_number}
- Amenity: {amenity_name}
- Date: {booking_date}
- Time Slot: {slot}
- Amount Due: ₱{amount}

Next Steps:
1. Pay the total amount using one of the methods below
2. Upload a screenshot/receipt of your payment
3. We'll verify and confirm your booking within 24-48 hours

Payment Methods:
[GCash details from system_settings]
[Bank transfer details from system_settings]

Track your booking status: {confirmation_page_url}

Questions? Reply to this email or contact us at {contact_info}.

---
Laguna Hills Homeowners Association
```

### Template 2: Payment Proof Uploaded (Admin Notification)

**Subject:** `New Payment Proof Uploaded - {reference_number}`

**Body:**
```
Hi Admin,

A new payment proof has been uploaded for review.

Booking: {reference_number}
Guest: {guest_name} ({guest_email})
Amount: ₱{amount}
Amenity: {amenity_type} on {date}
Time Slot: {slot}

View payment proof: {proof_url}

Action Required:
1. Review the payment proof
2. Approve or reject the booking in the admin panel
3. Guest will be notified automatically

Link: {admin_review_url}
```

### Template 3: Booking Confirmed

**Subject:** `Booking Confirmed! - {reference_number}`

**Body:**
```
Dear {guest_name},

Great news! Your booking has been confirmed.

Booking Details:
- Reference Number: {reference_number}
- Amenity: {amenity_name}
- Date: {booking_date}
- Time Slot: {slot}
- Amount Paid: ₱{amount}

Important Reminders:
- Arrive 15 minutes before your time slot
- Present your payment confirmation upon arrival
- Follow HOA rules and regulations
- Clean up after your event

Contact on the day of event: {contact_phone}

Need to cancel? Reply to this email with your reason.
Cancellations within 48 hours get full refund.
After 48 hours: 50% refund.

---
Laguna Hills Homeowners Association
```

### Template 4: Booking Rejected

**Subject:** `Booking Update - {reference_number}`

**Body:**
```
Dear {guest_name},

We're sorry to inform you that your booking request has been declined.

Booking Details:
- Reference Number: {reference_number}
- Amenity: {amenity_name}
- Date: {booking_date}
- Time Slot: {slot}

Reason for Rejection:
{rejection_reason}

Your payment will be refunded within 5-7 business days.

Questions or want to re-book? Reply to this email.

---
Laguna Hills Homeowners Association
```

### Template 5: Booking Cancelled

**Subject:** `Booking Cancelled - {reference_number}`

**Body:**
```
Hi {name},

Booking {reference_number} has been cancelled.

Cancelled By: {cancelled_by}
Reason: {cancellation_reason}

This time slot is now available for other bookings.

Questions? Reply to this email.

---
Laguna Hills Homeowners Association
```

---

## Terms & Conditions (Draft)

**External Amenity Rental Terms and Conditions**

**1. Booking Process**
- All bookings are subject to availability and admin approval
- Booking is not confirmed until payment is verified
- Multiple requests may exist for the same slot; first suitable request gets approved

**2. Payment**
- Full payment required before confirmation
- Accepted payment methods: GCash, Bank Transfer
- Payment must be received within 48 hours of booking
- Refund policy:
  - Full refund if cancelled 48+ hours before
  - 50% refund if cancelled 24-48 hours before
  - No refund if cancelled less than 24 hours before

**3. Usage Rules**
- Maximum attendees must not exceed amenity capacity
- No illegal activities allowed
- Clean up after event
- Any damage will be charged to booker
- Follow all HOA rules and regulations

**4. Liability**
- HOA is not liable for injuries during event
- Booker is responsible for their guests
- HOA reserves right to cancel for rule violations

**5. Contact**
- For inquiries: {contact_email}
- Emergency on event day: {emergency_phone}

---

## Payment Details Configuration

**Stored in `system_settings`:**

```sql
-- GCash Details
INSERT INTO system_settings (key, value) VALUES
  ('payment_gcash_number', '0917-XXX-XXXX'),
  ('payment_gcash_name', 'Laguna Hills HOA');

-- Bank Transfer Details
INSERT INTO system_settings (key, value) VALUES
  ('payment_bank_name', 'BPI'),
  ('payment_account_name', 'Laguna Hills HOA Association'),
  ('payment_account_number', 'XXXX-XXXX-XXXX'),
  ('payment_branch', 'Laguna Hills Branch');
```

**Admin Interface:** Admin settings page at `/admin/financials/payment-settings` allows updating these details.

---

## Database Migration

```sql
-- Migration: 0020_public_external_bookings.sql
-- Date: 2026-03-12
-- Description: Add public external booking system with pending requests that don't block slots

-- ============================================================================
-- STEP 1: Recreate external_rentals table WITHOUT UNIQUE constraint on (amenity_type, date, slot)
-- This allows multiple pending requests for the same slot
-- Only confirmed bookings block slots via booking_blocked_dates table
-- ============================================================================

-- Create new table with updated schema
CREATE TABLE external_rentals_new (
  id TEXT PRIMARY KEY,
  amenity_type TEXT NOT NULL,
  date TEXT NOT NULL,
  slot TEXT NOT NULL,
  renter_name TEXT,
  renter_contact TEXT,
  amount REAL,
  notes TEXT,
  payment_status TEXT DEFAULT 'unpaid',
  created_at TEXT DEFAULT (datetime('now')),

  -- New columns for public bookings
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  proof_of_payment_url TEXT,
  booking_status TEXT DEFAULT 'pending_payment',
  rejection_reason TEXT,
  created_ip TEXT,
  guest_notes TEXT,
  admin_notes TEXT,
  ip_retained_until TEXT
);

-- Copy existing data
INSERT INTO external_rentals_new
SELECT
  id, amenity_type, date, slot, renter_name, renter_contact, amount, notes, payment_status, created_at,
  NULL as guest_name, NULL as guest_email, NULL as guest_phone, NULL as proof_of_payment_url,
  'confirmed' as booking_status, NULL as rejection_reason, NULL as created_ip,
  NULL as guest_notes, NULL as admin_notes, NULL as ip_retained_until
FROM external_rentals;

-- Drop old table and rename
DROP TABLE external_rentals;
ALTER TABLE external_rentals_new RENAME TO external_rentals;

-- Recreate indexes (without unique constraint on slot)
CREATE INDEX idx_external_rentals_lookup ON external_rentals(amenity_type, date, slot);
CREATE INDEX idx_external_rentals_status ON external_rentals(booking_status);
CREATE INDEX idx_external_rentals_email ON external_rentals(guest_email);
CREATE INDEX idx_external_rentals_slot_pending ON external_rentals(amenity_type, date, slot) WHERE booking_status != 'confirmed';

-- ============================================================================
-- STEP 2: Create booking_blocked_dates table for tracking CONFIRMED bookings
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_blocked_dates (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  amenity_type TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  slot TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id) REFERENCES external_rentals(id) ON DELETE CASCADE,
  UNIQUE(amenity_type, booking_date, slot)
);
CREATE INDEX IF NOT EXISTS idx_booking_blocked_dates_lookup ON booking_blocked_dates(amenity_type, booking_date, slot);

-- Migrate existing confirmed bookings to blocked_dates
INSERT INTO booking_blocked_dates (id, booking_id, amenity_type, booking_date, slot, created_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  amenity_type,
  date,
  slot,
  created_at
FROM external_rentals
WHERE payment_status = 'paid';

-- ============================================================================
-- STEP 3: Add external pricing to system_settings
-- ============================================================================

-- Base hourly rates for external bookings
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_clubhouse_hourly', '500'),
  ('external_pricing_pool_hourly', '300'),
  ('external_pricing_basketball-court_hourly', '200'),
  ('external_pricing_tennis-court_hourly', '250');

-- Resident discount (50% off)
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_resident_discount_percent', '0.50');

-- Day multipliers (JSON for flexibility)
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_day_multipliers', '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}');

-- Season multipliers
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_season_multipliers', '{"peak": 1.3, "off_peak": 1.0}');

-- Peak season definition (December to May)
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_peak_months', '12,1,2,3,4,5');

-- Holidays for 2026
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_holidays_2026', '2026-01-01,2026-03-28,2026-03-29,2026-04-09,2026-04-10,2026-05-01,2026-06-12,2026-12-25,2026-12-30');

-- ============================================================================
-- STEP 4: Add payment details to system_settings
-- ============================================================================

-- GCash details
INSERT INTO system_settings (key, value) VALUES
  ('payment_gcash_number', '0917-XXX-XXXX'),
  ('payment_gcash_name', 'Laguna Hills HOA');

-- Bank transfer details
INSERT INTO system_settings (key, value) VALUES
  ('payment_bank_name', 'BPI'),
  ('payment_account_name', 'Laguna Hills HOA Association'),
  ('payment_account_number', 'XXXX-XXXX-XXXX'),
  ('payment_branch', 'Laguna Hills Branch');
```

---

## Implementation Order

1. **Database Schema** (Migration 0020)
2. **Backend API** (Public endpoints + admin enhancements)
3. **Frontend Pages** (Browse, Detail, Booking, Confirmation)
4. **Frontend Components** (Cards, Forms, Upload)
5. **Admin Interface** (External rentals queue)
6. **Email Notifications** (Booking status updates)
7. **Testing** (End-to-end booking flow)
8. **Documentation** (User guide for external renters)

---

## Open Questions for User

**RESOLVED in this revision:**
1. ✅ Pricing system: Uses existing `system_settings` approach (not separate table)
2. ✅ UNIQUE constraint: Removed to allow multiple pending requests
3. ✅ Slot duration: AM (8AM-12PM), PM (1PM-5PM), FULL_DAY (8AM-5PM)
4. ✅ Payment proof storage: Stored directly in `external_rentals` table (R2 URL)
5. ✅ Payment details: Configured in `system_settings`, editable by admin
6. ✅ Terms & Conditions: Draft template provided above
7. ✅ Email templates: Full templates provided above
8. ✅ API response format: Consistent with existing `{ data: {...} | error: "..." }` pattern

**STILL NEEDS CLARIFICATION:**
1. **Captcha:** Should we use Cloudflare Turnstile (free, good UX) or another service?
2. **Email Service:** Using existing email infrastructure, or need different provider for external emails?
3. **Holiday Updates:** Who updates holiday calendar each year? (Admin vs manual migration)
