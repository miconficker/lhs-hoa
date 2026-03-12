# QR Code and Reference Number System for Visitor Bookings

**Date**: 2026-03-13
**Status**: Design (Draft)
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

**Download Implementation**:
```typescript
// Using canvas.toDataURL() for download
const downloadQR = () => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return;

  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `qr-${referenceNumber}.png`;
  link.href = url;
  link.click();
};
```

## Frontend Components

### New Components

#### 1. `QRCodeDisplay.tsx`

**Location**: `src/components/public/QRCodeDisplay.tsx`

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
- Accessible with proper ARIA attributes
- Memoized for performance (React.memo)

**TypeScript Interface** (add to `src/types/index.ts`):
```typescript
export interface QRCodeDisplayProps {
  bookingId: string;
  referenceNumber: string;
  size?: number;
  className?: string;
}
```

#### 2. `QRScanPage.tsx`

**Location**: `src/pages/public/QRScanPage.tsx`

**Route**: `/external-rentals/qr/:id`

**Features**:
- Mobile-optimized layout
- Large status indicator (Approved/Pending/Rejected)
- Color-coded status:
  - Green: Confirmed
  - Yellow: Pending
  - Red: Rejected/Cancelled
- Reuses existing `statusConfig` from `ConfirmationPage.tsx` for consistency
- Key info display:
  - Amenity name
  - Date
  - Time slot
  - Guest name
- "View Full Details" button → confirmation page
- "Download QR" button for saving QR code image
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
│ [Download QR]       │
└─────────────────────┘
```

### Modified Components

#### 1. `SuccessPage.tsx`

**Location**: `src/pages/public/SuccessPage.tsx`

**Changes**:
- Add `QRCodeDisplay` component
- Show QR code prominently with reference number
- Add "Download QR Code" button
- Auto-redirect to confirmation page (existing behavior)

#### 2. `ConfirmationPage.tsx`

**Location**: `src/pages/public/ConfirmationPage.tsx`

**Changes**:
- Add `QRCodeDisplay` component in sidebar/aside
- Allow re-download anytime
- Show reference number prominently

## API Endpoints

**No new endpoints required** - reuse existing:

- `GET /api/public/bookings/:id/status` - Already returns booking info including reference number
- `GET /api/public/amenities` - For amenity details

## Route Registration

Add new route to `App.tsx`:

```typescript
// Around line 246-249 in App.tsx
const QRScanPage = lazy(() => import('./pages/public/QRScanPage'));

// In routes configuration:
<Route path="/external-rentals/qr/:id" element={<QRScanPage />} />
```

**Optional Enhancement** (future):

- `POST /api/public/bookings/:id/scan` - Log QR scans for analytics
  - Add columns to `external_rentals` table:

```sql
-- Migration for scan analytics (future)
ALTER TABLE external_rentals ADD COLUMN scan_count INTEGER DEFAULT 0;
ALTER TABLE external_rentals ADD COLUMN last_scanned_at TEXT;
```

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

## Accessibility

**QR Code Component**:
- `role="img"` attribute on canvas wrapper
- `aria-label="QR code for booking {referenceNumber}"`
- Alt text fallback: "QR code - Scan to view booking status"
- Reference number in plain text for screen readers

**Status Indicators**:
- Use `status` role for booking status badge
- Color + text (never color alone)
- ARIA live regions for status updates

**Keyboard Navigation**:
- Download button focusable with visible focus state
- "View Details" button focusable
- Minimum 44px touch targets

**Screen Reader Support**:
```tsx
<div role="img" aria-label={`QR code for booking ${referenceNumber}`}>
  <QRCodeCanvas value={qrUrl} size={size} />
</div>
<p className="sr-only">Scan this QR code to view your booking status</p>
```

## Implementation Checklist

### Dependencies
- [ ] Install `qrcode.react` package

### New Components
- [ ] Create `src/components/public/QRCodeDisplay.tsx`
- [ ] Create `src/pages/public/QRScanPage.tsx`
- [ ] Add TypeScript interfaces to `src/types/index.ts`

### Modified Components
- [ ] Update `src/pages/public/SuccessPage.tsx` with QR display
- [ ] Update `src/pages/public/ConfirmationPage.tsx` with QR display
- [ ] Update `src/App.tsx` to add `/external-rentals/qr/:id` route

### Testing
- [ ] Test QR generation in browser
- [ ] Test download functionality
- [ ] Test QR scanning with iOS Camera
- [ ] Test QR scanning with Android Google Lens
- [ ] Test mobile responsiveness
- [ ] Test accessibility with screen reader
- [ ] Test error states (invalid booking, network error)

### Documentation
- [ ] Update CLAUDE.md with new components
- [ ] Update ARCHITECTURE.md if needed

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
