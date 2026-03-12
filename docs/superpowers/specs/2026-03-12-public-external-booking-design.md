# Public External Booking System - Design Specification

**Date:** 2026-03-12
**Status:** Draft
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

```sql
-- Add columns for guest information and status tracking
ALTER TABLE external_rentals ADD COLUMN guest_name TEXT;
ALTER TABLE external_rentals ADD COLUMN guest_email TEXT;
ALTER TABLE external_rentals ADD COLUMN guest_phone TEXT;
ALTER TABLE external_rentals ADD COLUMN proof_of_payment_url TEXT;
ALTER TABLE external_rentals ADD COLUMN booking_status TEXT DEFAULT 'pending_payment';
ALTER TABLE external_rentals ADD COLUMN rejection_reason TEXT;
ALTER TABLE external_rentals ADD COLUMN created_ip TEXT;
ALTER TABLE external_rentals ADD COLUMN guest_notes TEXT;
ALTER TABLE external_rentals ADD COLUMN admin_notes TEXT;

-- Booking status values: pending_payment, pending_verification, confirmed, rejected, cancelled
```

**Status Flow:**
- `pending_payment` → Initial state, awaiting payment proof upload
- `pending_verification` → Payment proof uploaded, awaiting admin review
- `confirmed` → Admin approved, time slot now blocked
- `rejected` → Admin rejected, time slot remains available
- `cancelled` → Guest cancelled or admin cancelled

### 2. New `public_pricing` Table

```sql
CREATE TABLE public_pricing (
  id TEXT PRIMARY KEY,
  amenity_type TEXT NOT NULL, -- clubhouse, pool, basketball-court, tennis-court
  base_rate_per_hour REAL NOT NULL,
  is_resident_discount BOOLEAN DEFAULT 1,
  resident_discount_percent REAL DEFAULT 0.50, -- 50% off for residents
  day_multiplier TEXT NOT NULL DEFAULT '1.0', -- JSON: {"weekday": "1.0", "weekend": "1.2", "holiday": "1.5"}
  season_multiplier TEXT NOT NULL DEFAULT '1.0', -- JSON: {"peak": "1.3", "off_peak": "1.0"}
  min_booking_hours INTEGER DEFAULT 2,
  requires_admin_approval BOOLEAN DEFAULT 1,
  is_active BOOLEAN DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
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

**Key Design Decision:** Only `confirmed` external bookings create entries in `booking_blocked_dates`. Pending requests do NOT block slots.

### 4. New `payment_proofs` Table

```sql
CREATE TABLE payment_proofs (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  file_url TEXT NOT NULL, -- R2 storage URL
  file_name TEXT NOT NULL,
  uploaded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id) REFERENCES external_rentals(id) ON DELETE CASCADE
);
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
POST /api/public/bookings                     # Create booking request
POST /api/public/bookings/:id/proof           # Upload payment proof
GET  /api/public/bookings/:id/status          # Check booking status

// Admin endpoints (auth required)
GET  /api/admin/external-rentals?status=pending        # Filter by status
PUT  /api/admin/external-rentals/:id/approve          # Approve + block slot
PUT  /api/admin/external-rentals/:id/reject           # Reject + keep slot open
PUT  /api/admin/external-rentals/:id/request-proof     # Request additional proof
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

### Dynamic Pricing Formula

```
final_price = base_rate × duration × day_multiplier × season_multiplier

Where:
- base_rate: Per hour rate from public_pricing table
- duration: 4 hours (AM/PM) or 9 hours (FULL_DAY)
- day_multiplier: 1.0 (weekday), 1.2 (weekend), 1.5 (holiday)
- season_multiplier: 1.3 (peak: Dec-May), 1.0 (off-peak: Jun-Nov)
```

### Resident vs Public Pricing

- **Public:** Full price (no discount)
- **Residents:** 50% discount (automatic when authenticated)
- **Discount applied in:** `GET /api/public/pricing/:amenityType` response

### Example Calculation

```
Clubhouse, Full Day, Weekend, Peak Season:
- Base rate: ₱500/hour
- Duration: 9 hours
- Day multiplier: 1.2 (weekend)
- Season multiplier: 1.3 (peak)

Public: 500 × 9 × 1.2 × 1.3 = ₱7,020
Resident: 7,020 × 0.5 = ₱3,510
```

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

## Email Notifications

### Triggers

**1. Booking Created (Pending Payment)**
- To: Guest email
- Template: "Booking Request Received - [Reference #]"
- Content: Reference number, booking details, payment instructions, link to confirmation page

**2. Payment Proof Uploaded**
- To: Admin
- Template: "New Payment Proof Uploaded - [Reference #]"
- Content: Guest info, booking details, link to view proof

**3. Booking Confirmed**
- To: Guest email
- Template: "Booking Confirmed! - [Reference #]"
- Content: Confirmed details, contact info, rules/reminders

**4. Booking Rejected**
- To: Guest email
- Template: "Booking Update - [Reference #]"
- Content: Rejection reason, option to re-book

**5. Booking Cancelled**
- To: Admin + Guest
- Template: "Booking Cancelled - [Reference #]"
- Content: Cancellation reason, slot now available

---

## Database Migration

```sql
-- Migration: 0020_public_external_bookings.sql
-- Date: 2026-03-12

-- Extend external_rentals table for public bookings
ALTER TABLE external_rentals ADD COLUMN guest_name TEXT;
ALTER TABLE external_rentals ADD COLUMN guest_email TEXT;
ALTER TABLE external_rentals ADD COLUMN guest_phone TEXT;
ALTER TABLE external_rentals ADD COLUMN proof_of_payment_url TEXT;
ALTER TABLE external_rentals ADD COLUMN booking_status TEXT DEFAULT 'pending_payment';
ALTER TABLE external_rentals ADD COLUMN rejection_reason TEXT;
ALTER TABLE external_rentals ADD COLUMN created_ip TEXT;
ALTER TABLE external_rentals ADD COLUMN guest_notes TEXT;
ALTER TABLE external_rentals ADD COLUMN admin_notes TEXT;

-- Public pricing table
CREATE TABLE IF NOT EXISTS public_pricing (
  id TEXT PRIMARY KEY,
  amenity_type TEXT NOT NULL,
  base_rate_per_hour REAL NOT NULL,
  is_resident_discount BOOLEAN DEFAULT 1,
  resident_discount_percent REAL DEFAULT 0.50,
  day_multiplier TEXT NOT NULL DEFAULT '{"weekday": "1.0", "weekend": "1.2", "holiday": "1.5"}',
  season_multiplier TEXT NOT NULL DEFAULT '{"peak": "1.3", "off_peak": "1.0"}',
  min_booking_hours INTEGER DEFAULT 2,
  requires_admin_approval BOOLEAN DEFAULT 1,
  is_active BOOLEAN DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Track blocked dates from CONFIRMED external bookings
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

-- Payment proofs table
CREATE TABLE IF NOT EXISTS payment_proofs (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id) REFERENCES external_rentals(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_booking ON payment_proofs(booking_id);

-- Seed default pricing
INSERT INTO public_pricing (id, amenity_type, base_rate_per_hour) VALUES
  (lower(hex(randomblob(16))), 'clubhouse', 500),
  (lower(hex(randomblob(16))), 'pool', 300),
  (lower(hex(randomblob(16))), 'basketball-court', 200),
  (lower(hex(randomblob(16))), 'tennis-court', 250);
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

1. **GCash/Bank Details:** Where should payment details be configured? (Admin settings vs hardcoded)
2. **Terms & Conditions:** Do you have existing terms, or should we create a template?
3. **Captcha:** Should we use Cloudflare Turnstile (free, good UX) or another service?
4. **Email Service:** Using existing email infrastructure, or need different provider for external emails?
5. **Confirmation Email:** Should guests receive a preliminary email immediately, or only after payment proof is uploaded?
