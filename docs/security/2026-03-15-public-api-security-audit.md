# Public API Security Audit
**Date**: 2026-03-15
**Auditor**: Claude Code
**Scope**: `/api/public/*` endpoints and public booking system

## Executive Summary

The public API exposes extensive database structure information through raw SQL data in API responses. A determined attacker can reconstruct the complete database schema, understand internal business logic, and identify potential attack vectors by analyzing the public endpoints.

**Severity Level**: HIGH
**Recommendation**: Implement API abstraction layer to hide internal database structure.

---

## Critical Findings

### 1. Raw Database Column Exposure (CRITICAL)

**Affected Endpoints**: All public endpoints

**Issue**: API responses return raw database column names, allowing attackers to map the entire database schema.

**Examples from `/api/public/bookings/:id/status`**:
```json
{
  "data": {
    "booking": {
      "id": "uuid",                    // → bookings.id (UUID, primary key)
      "amenity_type": "clubhouse",     // → bookings.amenity_type (ENUM)
      "date": "2026-03-15",            // → bookings.date (DATE)
      "slot": "AM",                    // → bookings.slot (ENUM: AM/PM/FULL_DAY)
      "amount": 5000,                  // → bookings.amount (DECIMAL)
      "booking_status": "confirmed",   // → bookings.booking_status (ENUM/VARCHAR)
      "rejection_reason": "...",       // → bookings.rejection_reason
      "admin_notes": "...",            // → bookings.admin_notes
      "created_at": "2026-03-15T..."   // → bookings.created_at (TIMESTAMP)
      // Plus customer table fields...
    }
  }
}
```

**Database Schema Exposed**:
- `bookings` table structure (20+ columns)
- `customers` table structure (10+ columns)
- `system_settings` table structure (key-value pattern)
- `amenity_closures` table structure
- `notifications` table structure
- `verification_tokens` table structure

**Attack Vector**: An attacker can:
1. Map all table relationships through foreign key patterns (customer_id, user_id)
2. Identify soft-delete patterns (`deleted_at IS NULL`)
3. Discover business logic fields (workflow, payment_status)
4. Understand internal status flows (submitted → payment_due → payment_review → confirmed)

---

### 2. System Settings Enumeration (HIGH)

**Endpoint**: `GET /api/public/pricing/:amenityType`

**Issue**: Settings keys reveal internal naming conventions and configuration structure.

**Exposed Keys**:
```
- external_pricing_[type]_hourly
- external_pricing_day_multipliers
- external_pricing_season_multipliers
- external_pricing_peak_months
- external_pricing_holidays_2026
- external_pricing_resident_discount_percent
- payment_gcash_number
- payment_gcash_name
- payment_bank_name
- payment_account_name
- payment_account_number
```

**Risk**: Attacker can probe `/api/public/payment-details` to see actual payment configuration and infer backend configuration management approach.

---

### 3. Reference Number Pattern Disclosure (MEDIUM)

**Endpoints**: Status check endpoints

**Issue**: Reference number format reveals internal ID generation logic.

**Pattern**: `EXT-YYYYMMDD-{last_3_chars_of_uuid}`

```javascript
// From public.ts:440
const refNum = `EXT-${createdDate.getFullYear()}${String(createdDate.getMonth() + 1).padStart(2, '0')}${String(createdDate.getDate()).padStart(2, '0')}-${booking.id.slice(-3)}`;
```

**Risk**:
- Enumerates booking IDs by date range
- The 3-character suffix reduces UUID entropy from 36 chars to 3
- Allows brute-force of booking IDs for a given date (62^3 = 238,328 combinations)

---

### 4. Status Flow Enumeration (MEDIUM)

**Endpoint**: All status endpoints

**Issue**: Complete status workflow exposed through phase mapping.

**Discovered Statuses**:
```
- submitted (Phase 1)
- payment_due (Phase 2)
- payment_review (Phase 3)
- confirmed (Phase 4)
- rejected (Phase 0)
- cancelled (Phase 0)
```

**Risk**: Attacker understands complete business logic flow and can craft attacks targeting specific transitions (e.g., race conditions between payment_review → confirmed).

---

### 5. SQL Query Pattern Disclosure (LOW)

**Endpoint**: Various endpoints

**Issue**: Error messages and query patterns reveal table structure.

**Example from availability endpoint**:
```typescript
// Lines 71-76
const confirmedBookings = await c.env.DB.prepare(
  `SELECT date, slot FROM bookings
   WHERE amenity_type = ? AND date BETWEEN ? AND ?
   AND booking_status = 'confirmed'
   AND deleted_at IS NULL`
).bind(amenityType, startDate, endDate).all();
```

**Risk**: Attacker learns:
- `bookings` table has soft deletes
- Status-based filtering pattern
- Date range query patterns

---

## Detailed Endpoint Analysis

### `/api/public/amenities`
- **Exposure**: Amenity types enum values
- **Risk**: LOW - Limited scope

### `/api/public/availability/:amenityType`
- **Exposure**: Booking table structure, closure logic
- **Risk**: MEDIUM - Reveals availability check algorithm

### `/api/public/pricing/:amenityType`
- **Exposure**: Complete pricing algorithm, settings keys
- **Risk**: HIGH - Business logic fully reversible

### `/api/public/payment-details`
- **Exposure**: Payment configuration structure
- **Risk**: MEDIUM - Internal config management

### `/api/public/inquiries` (POST)
- **Exposure**: Customer/booking insertion logic
- **Risk**: MEDIUM - Creates records, returns full structure

### `/api/public/inquiries/:id/status` (GET)
- **Exposure**: Complete booking/customer record structure
- **Risk**: HIGH - Full data access via ID

### `/api/public/bookings` (POST)
- **Exposure**: Same as inquiries
- **Risk**: MEDIUM

### `/api/public/bookings/:id/status` (GET)
- **Exposure**: Complete record structure
- **Risk**: HIGH

### `/api/public/status/:identifier` (GET)
- **Exposure**: Reference number → UUID mapping
- **Risk**: MEDIUM - Enumerates bookings by date

### `/api/public/bookings/:id/verify` (POST)
- **Exposure**: Verification token system
- **Risk**: LOW - Time-limited tokens

### `/api/public/bookings/:id/notifications` (GET)
- **Exposure**: Notification table structure
- **Risk**: MEDIUM - Access to related notifications

---

## Recommendations

### 1. Implement API Response Abstraction Layer (CRITICAL)

**Current Pattern** (BAD):
```typescript
return c.json({
  data: { booking: booking }  // Raw DB rows
});
```

**Recommended Pattern**:
```typescript
// Create DTOs (Data Transfer Objects)
interface PublicBookingDTO {
  referenceNumber: string;
  amenity: string;        // Not amenity_type
  bookingDate: string;    // Not date
  timeSlot: string;       // Not slot
  amount: number;
  status: BookingStatusDTO;
  createdAt: string;
}

// Map before returning
const dto = mapToPublicBooking(booking);
return c.json({ data: { booking: dto } });
```

**Benefits**:
- Hides internal column names
- Decouples API from DB schema
- Version-safe API evolution
- Can filter sensitive fields

---

### 2. Implement Response Field Filtering

**Approach**: Whitelist fields that can be public

```typescript
const PUBLIC_BOOKING_FIELDS = [
  'id', 'referenceNumber', 'amenity', 'bookingDate',
  'timeSlot', 'amount', 'status', 'createdAt'
] as const;

function toPublicBooking(booking: BookingRecord): PublicBookingDTO {
  return pick(booking, PUBLIC_BOOKING_FIELDS);
}
```

**Never expose**:
- `created_ip` (even if retained)
- `customer_id` / `user_id` (use references only)
- `admin_notes` (admin-only)
- `internal_status` (if different from user-facing)
- `pricing_calculated_at` (implementation detail)

---

### 3. Sanitize Error Messages

**Current** (lines 82, 96):
```typescript
} catch (e) {
  console.warn('bookings table not available:', e);
}
```

**Recommended**:
```typescript
} catch (e) {
  console.error('[PUBLIC_API] Availability check failed', e);
  return c.json({ error: 'Service temporarily unavailable' }, 503);
}
```

**Never expose**:
- Table names in errors
- SQL query text
- Stack traces
- Internal field names

---

### 4. Obfuscate Reference Numbers

**Current**: `EXT-20260315-abc`

**Recommended**: Use a random, non-enumerable format

```typescript
function generatePublicReference(bookingId: string): string {
  const randomPart = crypto.randomBytes(4).toString('base64')
    .replace(/[+/=]/g, '').slice(0, 6);
  return `LH-${randomPart}`; // LH-xYzAb1
}
```

**Store mapping** in database for internal lookup, never expose UUIDs.

---

### 5. Implement Field-Level Access Control

**For status endpoints**:
```typescript
interface PublicStatusResponse {
  referenceNumber: string;
  amenity: string;
  date: string;
  slot: string;
  amount: number;
  status: string;
  statusMessage: string;
  nextAction: string;
}

interface InternalBookingResponse extends PublicStatusResponse {
  customerId: string;      // Admin-only
  rejectionReason: string; // Admin-only
  adminNotes: string;      // Admin-only
  createdAt: string;
}
```

---

### 6. Add API Versioning

**Current**: `/api/public/*`

**Recommended**: `/api/v1/public/*`

This allows:
- Breaking changes without affecting public clients
- Gradual migration to new response formats
- Deprecation of old endpoints

---

### 7. Implement Rate Limiting Per Endpoint

**Current**: Only on booking creation (3/hour)

**Recommended**:
- Status check: 30/minute per IP
- Availability: 60/minute per IP
- Pricing: 30/minute per IP
- Proof upload: 10/hour per IP

---

## Priority Implementation Plan

### Phase 1: Critical (Do Immediately)
1. Create DTO layer for all public responses
2. Remove `admin_notes`, `rejection_reason` from public endpoints
3. Sanitize all error messages

### Phase 2: High (Within Sprint)
1. Obfuscate reference numbers
2. Implement field whitelisting
3. Add endpoint-specific rate limits

### Phase 3: Medium (Next Sprint)
1. Add API versioning
2. Implement response caching for static data
3. Add request ID tracking for debugging

---

## Testing Recommendations

### 1. Schema Reconstruction Test
Attempt to reconstruct the database schema using only public API responses.

### 2. Enumeration Test
Try to enumerate all booking IDs using reference number patterns.

### 3. Field Disclosure Test
Check if any internal field names leak through error messages or responses.

### 4. Status Flow Test
Map the complete status workflow and check for unhandled transitions.

---

## Compliance Considerations

### GDPR
- IP retention is properly handled (90 days)
- Email/phone masking is present (`maskEmail`, `maskPhone` functions)
- **Issue**: Full PII exposed in booking status responses

### Data Privacy
- Booking details contain guest PII (name, email, phone)
- Anyone with booking ID can access this data
- **Recommendation**: Add authentication/verification for status checks

---

## Conclusion

The public API currently provides **zero abstraction** over the database layer. An attacker can:

1. ✅ Reconstruct the complete database schema
2. ✅ Understand internal business logic
3. ✅ Enumerate booking IDs via reference numbers
4. ✅ Access booking PII without authentication
5. ✅ Identify potential attack vectors (race conditions, status transitions)

**Implementation of the DTO abstraction layer is critical** to protect internal architecture and prevent information disclosure attacks.

---

**Audit Completed**: 2026-03-15
**Next Review**: After Phase 1 implementation
