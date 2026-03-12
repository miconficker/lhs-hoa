# QR Code and Reference Number System for Visitor Bookings

**Date**: 2026-03-13
**Status**: Design Approved
**Related**: External Rentals System (Public External Booking)

## Overview

Add QR code generation to the external rentals booking flow, allowing guests to scan a QR code to view their booking status on a mobile-optimized page. This improves the guest experience by providing an easy way to check booking status and share booking confirmation.

## Goals

1. Provide guests with a scannable QR code for easy status checking
2. Create a mobile-optimized landing page for QR scans
3. Allow guests to download and save their QR code
4. Maintain existing reference number format

## Requirements

### Functional Requirements

- [ ] Generate QR codes for new external rental bookings
- [ ] Display QR code on success and confirmation pages
- [ ] Allow QR code download as PNG image
- [ ] Create mobile-optimized QR scan landing page
- [ ] Show booking status clearly on scan page
- [ ] Link to full booking details from scan page

### Non-Functional Requirements

- No backend storage for QR codes (generate on-demand)
- Mobile-first design for scan page
- Fast loading (< 2 seconds)
- Rate limiting for status checks (existing)
- GDPR compliance (optional IP logging only)

## Reference Numbers

**Format**: `EXT-YYYYMMDD-XXX`

Keep the existing format already implemented in the system:
- `EXT` prefix for external rentals
- Date prefix for organization (YYYYMMDD)
- Sequential number for uniqueness

**Example**: `EXT-20250313-001`

## QR Code Generation

### Approach: Hybrid (Client-Side Generation)

**Technology**: `qrcode.react` library

**Implementation**:
1. QR code generated in browser when booking is created
2. QR contains URL: `/external-rentals/qr/{bookingId}`
3. QR code displayed on success and confirmation pages
4. Downloadable as PNG for guests to save/share

**Benefits**:
- No backend changes needed for QR generation
- No storage costs (generated on-demand)
- Small QR code (short URL = easier to scan)
- Fast page load

**Package**:
```bash
pnpm add qrcode.react
```

## Frontend Components

### New Components

#### 1. `QRCodeDisplay.tsx`

**Location**: `src/components/public-rentals/QRCodeDisplay.tsx`

**Props**:
```typescript
interface QRCodeDisplayProps {
  bookingId: string;
  referenceNumber: string;
  size?: number; // Optional, default 200
}
```

**Features**:
- Display QR code centered
- Show reference number below QR
- "Download QR Code" button
- Fallback to reference number if QR fails

#### 2. `QRScanPage.tsx`

**Location**: `src/pages/public-rentals/QRScanPage.tsx`

**Route**: `/external-rentals/qr/:id`

**Features**:
- Mobile-optimized layout
- Large status indicator (Approved/Pending/Rejected)
- Color-coded status:
  - Green: Confirmed
  - Yellow: Pending
  - Red: Rejected/Cancelled
- Key info display:
  - Amenity name
  - Date
  - Time slot
  - Guest name
- "View Full Details" button → confirmation page
- "Save to Photos" button
- Minimal branding (logo only)
- No navigation/footer

**Status Display**:
```
┌─────────────────────┐
│   LAGUNA HILLS HOA  │
├─────────────────────┤
│                     │
│   ● CONFIRMED       │
│   (Green Badge)     │
│                     │
│  Clubhouse          │
│  March 15, 2025     │
│  2:00 PM - 4:00 PM  │
│                     │
│  Guest: John Doe    │
│  Ref: EXT-202503... │
│                     │
│ [View Details]      │
│ [Save QR]           │
└─────────────────────┘
```

### Modified Components

#### 1. `SuccessPage.tsx`

**Location**: `src/pages/public-rentals/SuccessPage.tsx`

**Changes**:
- Add `QRCodeDisplay` component
- Show QR code prominently with reference number
- Add "Download QR Code" button
- Auto-redirect to confirmation page (existing behavior)

#### 2. `ConfirmationPage.tsx`

**Location**: `src/pages/public-rentals/ConfirmationPage.tsx`

**Changes**:
- Add `QRCodeDisplay` component in sidebar/aside
- Allow re-download anytime
- Show reference number prominently

## API Endpoints

**No new endpoints required** - reuse existing:

- `GET /api/public/bookings/:id/status` - Already returns booking info including reference number
- `GET /api/public/amenities` - For amenity details

**Optional Enhancement** (future):
- `POST /api/public/bookings/:id/scan` - Log QR scans for analytics
  - Add `scan_count` and `last_scanned_at` columns to `external_rentals` table

## Data Flow

```
Booking Created (POST /api/public/bookings)
    ↓
Success Page (/external-rentals/success/:id)
    ↓
Fetch booking status (GET /api/public/bookings/:id/status)
    ↓
Generate QR code client-side (qrcode.react)
    ↓
Display: QR code + Reference Number + Download button
    ↓
User downloads QR code (optional)
    ↓
User scans QR code with phone camera
    ↓
QRScanPage (/external-rentals/qr/:id)
    ↓
Fetch booking status again
    ↓
Show mobile-optimized status view
    ↓
User clicks "View Full Details"
    ↓
ConfirmationPage (/external-rentals/confirmation/:id)
```

## Error Handling

### QR Code Generation
- Fallback to reference number in plain text if QR fails
- Log error to console (non-blocking)
- Show user-friendly message: "QR code unavailable. Reference: {ref}"

### QR Scan Page
- **Invalid booking ID**: Show "Booking not found" with home button
- **Network error**: Show retry button
- **Rate limited**: Show "Please try again later"

### Download Functionality
- Check browser support before offering download
- Fallback message: "Take a screenshot to save your QR code"

## Security Considerations

1. **No sensitive data in QR** - Only contains booking ID URL
2. **Existing rate limiting** - QR scan page uses same rate limits (3 requests/hour per IP)
3. **No authentication bypass** - Public bookings are already public
4. **GDPR compliance** - IP logging only if implementing scan analytics (with retention policy)

## UI/UX Guidelines

### Mobile-Optimized Scan Page
- **Above the fold**: Status indicator (no scrolling needed)
- **Large touch targets**: Minimum 44px for buttons
- **High contrast**: WCAG AA compliant colors
- **Fast load**: < 2 seconds on 3G
- **No clutter**: Remove non-essential elements

### QR Code Display
- **Minimum size**: 200x200px for reliable scanning
- **Quiet zone**: 4 module padding around QR
- **High contrast**: Black on white for best scanability
- **Reference visible**: Always show reference number below QR

## Implementation Checklist

- [ ] Install `qrcode.react` package
- [ ] Create `QRCodeDisplay.tsx` component
- [ ] Create `QRScanPage.tsx` component
- [ ] Add QR display to `SuccessPage.tsx`
- [ ] Add QR display to `ConfirmationPage.tsx`
- [ ] Add `/external-rentals/qr/:id` route
- [ ] Implement download functionality
- [ ] Add error handling and fallbacks
- [ ] Test on mobile devices
- [ ] Test QR scanning with different camera apps
- [ ] Update documentation

## Future Enhancements

1. **Scan Analytics**: Track how many times each QR is scanned
2. **Email QR**: Send QR code as attachment in confirmation email
3. **Print QR**: Option to generate print-ready PDF with QR
4. **Dynamic QR**: Update QR target if booking changes (requires backend storage)
5. **Batch QR**: Generate QR codes for multiple bookings (admin feature)

## Related Documents

- [Public External Booking Design](./2026-03-12-public-external-booking-design.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [CLAUDE.md](../../CLAUDE.md)
