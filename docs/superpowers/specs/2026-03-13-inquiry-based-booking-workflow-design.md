# External Rental Inquiry-Based Booking Workflow Design

> **Status:** Approved
> **Date:** 2026-03-13
> **Author:** Design Session

## Objective

Redesign the external rental booking system to require inquiry approval before requesting payment, providing admins better control over incoming booking requests while maintaining a smooth guest experience.

## Current Workflow

1. Guest checks availability → calendar
2. Guest submits booking request with all details + payment proof
3. Booking created with status `pending_payment`
4. Admin reviews → approves or rejects
5. On approval: status becomes `confirmed`, slot is blocked

**Problem:** Payment is requested immediately, creating unnecessary work for rejected inquiries.

## New Workflow

### Guest Flow

1. **Calendar Check** - Browse amenities and available dates (unchanged)
2. **Inquiry Submission** - Submit inquiry with event details, NO payment yet
3. **Awaiting Review** - Inquiry pending admin approval
4. **Payment Requested** - Admin approved, guest sees payment instructions
5. **Payment Upload** - Guest uploads proof of payment
6. **Verification** - Admin verifies payment
7. **Confirmation** - Booking confirmed, time slot blocked

### Admin Flow

1. **Review Inquiries** - See pending inquiries with guest/event details
2. **Approve/Reject** - Approve to request payment, or reject with reason
3. **Verify Payments** - Review uploaded proof of payment
4. **Confirm Booking** - Final confirmation blocks the time slot

## Status Flow

```
inquiry_submitted → pending_approval → pending_payment → pending_verification → confirmed
                                                        ↓
                                                    rejected
                                                        ↓
                                                    cancelled
```

### Status Definitions

| Status | Description | Next States |
|--------|-------------|-------------|
| `inquiry_submitted` | Initial state after guest submits inquiry | `pending_approval`, `rejected` |
| `pending_approval` | Admin approved, payment not yet requested | `pending_payment` |
| `pending_payment` | Payment instructions shown to guest | `pending_verification` |
| `pending_verification` | Guest uploaded proof, awaiting admin review | `confirmed`, `pending_payment` |
| `confirmed` | Payment verified, slot blocked, booking final | `cancelled` |
| `rejected` | Inquiry or booking rejected | - |
| `cancelled` | Confirmed booking was cancelled | - |

## Key Design Decisions

### 1. Pricing Visibility
**Decision:** Show pricing immediately on inquiry submission
- Guests see estimated cost before submitting
- Transparency improves conversion
- No change to existing pricing calculation

### 2. Slot Blocking
**Decision:** Only block slots on final confirmation
- Inquiries do NOT block slots
- Multiple inquiries can exist for the same slot
- First confirmed booking wins
- Consistent with current behavior

### 3. Approval Process
**Decision:** Manual admin approval required
- All inquiries require explicit approval
- No auto-approval based on rules
- Admin has full control over bookings

### 4. Rejected Inquiries
**Decision:** Allow re-submission
- Guests can submit new inquiries after rejection
- Rejection reason provided
- No blocking of guest email/IP

### 5. Schema Approach
**Decision:** Extend existing `external_rentals` table
- Add new booking_status values
- No new table needed
- Maintains data consistency

## Database Schema Changes

### New booking_status Values

```sql
-- Updated enum/check constraint for booking_status
ALTER TABLE external_rentals
  MODIFY COLUMN booking_status TEXT
  CHECK (booking_status IN (
    'inquiry_submitted',    -- NEW: Guest submitted inquiry
    'pending_approval',      -- NEW: Admin approved, awaiting payment
    'pending_payment',       -- NEW: Guest shown payment instructions
    'pending_verification',  -- Existing: Proof uploaded, awaiting review
    'confirmed',             -- Existing: Payment verified, slot blocked
    'rejected',              -- Existing: Inquiry/booking rejected
    'cancelled'              -- Existing: Booking was cancelled
  ));
```

## API Changes

### New Endpoints

```typescript
// POST /api/public/inquiries
// Submit inquiry (creates booking with status: "inquiry_submitted")
// Body: amenity_type, date, slot, guest_name, guest_email, guest_phone, event_details
// Returns: inquiry_id, reference_number, estimated_amount

// GET /api/public/inquiries/:id/status
// Check inquiry/booking status
// Returns: current status, status_message, next_action

// PUT /api/admin/external-rentals/:id/approve-inquiry
// Approve inquiry → status: "pending_approval"
// Sends approval email to guest with payment link
// Returns: updated inquiry

// PUT /api/admin/external-rentals/:id/reject-inquiry
// Reject inquiry → status: "rejected"
// Body: { reason: string }
// Sends rejection email to guest
// Returns: updated inquiry
```

### Modified Endpoints

```typescript
// POST /api/public/bookings/:id/proof
// Now requires status: "pending_payment" (was "pending_payment" or "pending_verification")
// status: "pending_payment" → "pending_verification"

// PUT /api/admin/external-rentals/:id/approve
// Now requires status: "pending_verification" (was "pending_payment" or "pending_verification")
// status: "pending_verification" → "confirmed"
// Creates booking_blocked_dates entry
```

## Frontend Changes

### New Pages

1. **Inquiry Pending Page** (`/external-rentals/inquiry/:id/pending`)
   - Shows inquiry is under review
   - Displays submitted details
   - Estimated pricing shown
   - Message: "We'll email you when approved"

2. **Payment Page** (`/external-rentals/inquiry/:id/payment`)
   - Accessible only after approval
   - Shows approval message
   - Payment instructions (GCash, bank transfer)
   - Proof upload form
   - Submit: "Upload Proof & Confirm Booking"

### Modified Pages

1. **Booking Page** → Rename to **Inquiry Page**
   - Submit button: "Submit Inquiry" (not "Submit Booking")
   - Pricing shown prominently
   - No payment instructions shown
   - After submit: redirect to Inquiry Pending page

2. **Confirmation Page**
   - Handle all statuses appropriately
   - Show relevant messaging per status
   - Provide next steps per status

3. **Admin: External Rentals Tab**
   - Add "Pending Inquiries" sub-tab
   - Show inquiry details without payment info
   - Approve/Reject actions
   - Move "Pending Verification" to separate view

## Email Notifications

### Inquiry Approved
```
Subject: Your Amenity Inquiry was Approved!

Hello [guest_name],

Great news! Your inquiry for [amenity_name] on [date] has been approved.

**Booking Details:**
- Amenity: [amenity_name]
- Date: [date]
- Time Slot: [slot]
- Amount: ₱[amount]

Please proceed with payment to confirm your booking:
[Link to payment page]

Payment Methods:
- GCash: [number] ([name])
- Bank Transfer: [bank] [account_number] ([account_name])

Reference Number Format: Your Name - Amenity - Date
```

### Inquiry Rejected
```
Subject: Update on your Amenity Inquiry

Hello [guest_name],

Thank you for your interest in renting [amenity_name] on [date].

Unfortunately, we are unable to approve your inquiry at this time.

**Reason:** [rejection_reason]

Feel free to submit a new inquiry for a different date or time.
```

## Migration Strategy

### Data Migration

```sql
-- Existing bookings keep current workflow
-- No data migration needed - statuses remain compatible

-- New bookings will use the new workflow
```

### Deployment Order

1. Backend changes first (API, schema)
2. Frontend changes second (new pages, modified flows)
3. Admin dashboard updates
4. Email notifications

## Success Criteria

- [ ] All new status transitions work correctly
- [ ] Inquiries do NOT block slots in availability check
- [ ] Admin can approve/reject inquiries
- [ ] Guests receive appropriate email notifications
- [ ] Payment flow works only after approval
- [ ] Confirmation only blocks slot on final verify
- [ ] Rejected guests can submit new inquiries
- [ ] Existing bookings continue to work (backward compatibility)
