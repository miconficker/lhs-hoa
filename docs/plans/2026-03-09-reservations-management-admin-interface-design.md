# Reservations Management & Admin Interface Reorganization

**Date:** 2026-03-09
**Status:** Approved
**Author:** Claude (with user collaboration)

---

## Executive Summary

This design document outlines a comprehensive reorganization of the admin interface and implementation of new reservations management features for the Laguna Hills HOA system.

**Key Changes:**
1. Navigation refactor for better UX and accessibility
2. Admin panel consolidation to reduce clutter
3. New reservations management with time blocks and external rentals
4. Addition of Tennis Court as an amenity
5. Payment tracking for external rentals

---

## Table of Contents

1. [Navigation Refactor](#navigation-refactor)
2. [Admin Panel Consolidation](#admin-panel-consolidation)
3. [Reservations Management Features](#reservations-management-features)
4. [Database Schema Changes](#database-schema-changes)
5. [API Endpoints](#api-endpoints)
6. [UI/UX Specifications](#uiux-specifications)
7. [Accessibility & Plain English Standards](#accessibility--plain-english-standards)
8. [Implementation Files](#implementation-files)

---

## 1. Navigation Refactor

### 1.1 User Navigation (Horizontal Navbar with Dropdowns)

The user navigation will be reorganized into logical groups with dropdown menus:

```
🏠 Home (Dashboard)
🗺️ Map
📢 Community ▾
    ├── Announcements
    ├── Events
    └── Polls
📄 Resources ▾
    ├── Documents
    └── Help
🗓️ Reservations
    ├── My Bookings (current page)
    └── Book Amenity (current form)
💰 Payments ▾
    ├── My Payments
    └── Make Payment
🚗 Passes & IDs ▾
    ├── Vehicle Passes
    └── Employee IDs
🔧 Services ▾
    ├── Service Requests
    └── Common Areas
⚙️ Account Settings
```

**Implementation Notes:**
- Use shadcn/ui DropdownMenu component
- Preserve deep linking to all pages
- Add mobile-friendly hamburger menu for small screens

### 1.2 Admin Navigation (Vertical Sidebar)

The admin panel will use a vertical sidebar with collapsible sections:

```
📊 Dashboard
👥 Users & Access
  ├── Users
  ├── Whitelist
  └── Employee IDs
🏠 Properties
  ├── Households
  ├── Lots
  └── Common Areas
🗓️ Reservations [NEW]
  ├── Bookings
  ├── Time Blocks
  └── External Rentals
💬 Communications
  ├── Announcements
  ├── Events
  └── Messages
💰 Financials
  ├── Payments
  ├── Dues Config
  └── In-Person Payments
⚙️ System
  ├── Settings
  ├── Stats
  └── Import/Export
```

**Implementation Notes:**
- Build custom sidebar component or use shadcn/ui Sidebar
- Collapsible sections for better organization
- Active state highlighting
- Keyboard navigation support
- Deep linking via URL hash or query params

---

## 2. Admin Panel Consolidation

### 2.1 Pages to Consolidate

| Current Page | Destination Section | Rationale |
|--------------|-------------------|-----------|
| WhitelistManagementPage | Users & Access | User access control |
| PassManagementPage (Employee IDs) | Users & Access | User credential management |
| PassManagementPage (Vehicle Passes) | Properties | Property-related passes |
| InPersonPaymentsPage | Financials | Payment management |
| DuesConfigPage | Financials | Financial configuration |
| AdminLotsPage | Properties | Property management |

### 2.2 Preserved Functionality

All existing functionality will be preserved. The consolidation is a UI reorganization only.

---

## 3. Reservations Management Features

### 3.1 Overview

A new "Reservations" section in the admin panel with three sub-tabs:

| Sub-tab | Purpose | Key Actions |
|---------|---------|-------------|
| **Bookings** | View/manage resident reservations | Approve, decline, cancel, view details |
| **Time Blocks** | Block slots for maintenance/events | Create block, edit, delete, view calendar |
| **External Rentals** | Non-resident bookings + payments | Create rental, track payment, mark paid, generate receipt |

### 3.2 Bookings Sub-tab

**Features:**
- Calendar view (color-coded by status: pending, confirmed, cancelled)
- List view with filters (date, amenity, status, household)
- Quick action buttons: Approve, Decline, Cancel
- Detail modal for full reservation information
- Bulk actions (approve multiple, cancel multiple)

**User Flow:**
1. Admin views pending reservations
2. Clicks "Approve" or "Decline"
3. System sends notification to resident
4. Status updates immediately

### 3.3 Time Blocks Sub-tab

**Features:**
- Calendar view showing blocked slots
- Create block form: date, amenity, slot, reason
- Edit/delete existing blocks
- Reason shows to residents as "Unavailable"

**Use Cases:**
- Scheduled maintenance
- Private events/rentals
- HOA meetings
- Holiday closures

### 3.4 External Rentals Sub-tab

**Features:**
- Create rental form with all required fields
- Payment tracking: unpaid, partial, paid, overdue
- Payment recording form: amount, method, receipt number
- Generate printable receipt
- Export to CSV for accounting
- Payment history per rental

**Payment Tracking:**
- Record partial payments
- Track overdue payments
- Payment method: cash, gcash, paymaya, bank transfer
- Receipt number for accounting

### 3.5 New Amenity: Tennis Court

Tennis Court will be added as the fourth amenity type alongside:
- Clubhouse
- Swimming Pool
- Basketball Court
- **Tennis Court** (new)

---

## 4. Database Schema Changes

### 4.1 Update Reservations Table

Add 'tennis-court' to the amenity_type constraint:

```sql
-- Migration: 0014_reservations_enhancements.sql

-- Step 1: Update amenity_type constraint (SQLite requires recreating table)
CREATE TABLE reservations_new (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'cancelled')),
  purpose TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, amenity_type, date, slot)
);

INSERT INTO reservations_new SELECT * FROM reservations;
DROP TABLE reservations;
ALTER TABLE reservations_new RENAME TO reservations;
```

### 4.2 New Table: Time Blocks

```sql
CREATE TABLE time_blocks (
  id TEXT PRIMARY KEY,
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
  date DATE NOT NULL,
  slot TEXT CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),
  reason TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(amenity_type, date, slot)
);

CREATE INDEX idx_time_blocks_date ON time_blocks(date);
CREATE INDEX idx_time_blocks_amenity_date ON time_blocks(amenity_type, date);
```

### 4.3 New Table: External Rentals

```sql
CREATE TABLE external_rentals (
  id TEXT PRIMARY KEY,
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),
  renter_name TEXT NOT NULL,
  renter_contact TEXT,
  amount REAL NOT NULL,
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partial', 'paid', 'overdue')),
  amount_paid REAL DEFAULT 0,
  payment_method TEXT,
  receipt_number TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(amenity_type, date, slot)
);

CREATE INDEX idx_external_rentals_date ON external_rentals(date);
CREATE INDEX idx_external_rentals_payment_status ON external_rentals(payment_status);
CREATE INDEX idx_external_rentals_amenity_date ON external_rentals(amenity_type, date);
```

---

## 5. API Endpoints

### 5.1 Time Blocks Endpoints

```
GET    /api/admin/time-blocks              # List all blocks (with filters)
POST   /api/admin/time-blocks              # Create new block
GET    /api/admin/time-blocks/:id          # Get single block
PUT    /api/admin/time-blocks/:id          # Update block
DELETE /api/admin/time-blocks/:id          # Delete block
```

**Query Parameters (GET):**
- `amenity_type` - Filter by amenity
- `start_date` - Filter by date range start
- `end_date` - Filter by date range end

### 5.2 External Rentals Endpoints

```
GET    /api/admin/external-rentals         # List all rentals (with filters)
POST   /api/admin/external-rentals         # Create rental
GET    /api/admin/external-rentals/:id     # Get single rental
PUT    /api/admin/external-rentals/:id     # Update rental
DELETE /api/admin/external-rentals/:id     # Delete rental
POST   /api/admin/external-rentals/:id/pay # Record payment
GET    /api/admin/external-rentals/export  # Export CSV
```

**Query Parameters (GET):**
- `amenity_type` - Filter by amenity
- `payment_status` - Filter by payment status
- `start_date` - Filter by date range start
- `end_date` - Filter by date range end

### 5.3 Updated Endpoints

**GET /api/reservations/availability**
- Add check against `time_blocks` table
- Add check against `external_rentals` table
- Return blocked slots with reason from time_blocks

**POST /api/reservations**
- Validate against time_blocks (return error if blocked)
- Validate against external_rentals (return error if booked)

---

## 6. UI/UX Specifications

### 6.1 Accessibility Standards (WCAG 2.1 AA)

**Color Contrast:**
- All text meets 4.5:1 contrast ratio minimum
- Status badges use both color AND icons/text
- Focus states visible on all interactive elements

**Keyboard Navigation:**
- All features fully keyboard navigable
- Tab order follows visual layout
- Escape closes modals/dropdowns
- Enter/Space activates buttons

**Screen Readers:**
- Proper ARIA labels on all icons
- Form inputs have associated labels
- Status updates announced via live regions
- Dropdown menus have proper roles

### 6.2 Component Specifications

**Bookings List:**
- Table with sortable columns
- Color-coded status badges
- Filter controls at top
- Pagination for large datasets

**Calendar View:**
- Month/week/day toggle
- Color-coded slots
- Legend for status colors
- Click slot to view details

**Modals:**
- Overlay with backdrop
- Close button (X) top-right
- Escape key closes
- Focus trap when open

**Forms:**
- Clear labels above inputs
- Inline validation errors
- Required field indicators
- Submit button clearly labeled

---

## 7. Accessibility & Plain English Standards

### 7.1 Plain English Labels

| Old/Terms | New/Preferred |
|-----------|---------------|
| "Make Reservation" | "Book Amenity" |
| "Blackout Period" | "Time Block" |
| "Third-party Booking" | "External Rental" |
| "Submit" | "Create Booking" / "Block Time" |
| "Reject" | "Decline" |

### 7.2 Helpful Error Messages

- "This time is already booked" (not "Slot unavailable")
- "Please select a date in the future" (not "Invalid date")
- "Payment amount cannot exceed total due" (not "Invalid amount")

---

## 8. Implementation Files

### 8.1 New Files to Create

**Frontend Components:**
```
src/components/admin/Sidebar.tsx           # Vertical sidebar component
src/components/admin/UserNav.tsx           # User dropdown navbar
src/pages/admin/reservations/BookingsTab.tsx
src/pages/admin/reservations/TimeBlocksTab.tsx
src/pages/admin/reservations/ExternalRentalsTab.tsx
src/pages/admin/reservations/index.tsx     # Main container
```

**Backend Routes:**
```
functions/routes/admin/time-blocks.ts
functions/routes/admin/external-rentals.ts
```

**Database Migration:**
```
migrations/0014_reservations_enhancements.sql
```

### 8.2 Files to Modify

**Frontend:**
- `src/pages/AdminPanelPage.tsx` - Restructure with sidebar
- `src/components/AppNavbar.tsx` (or equivalent) - User nav refactor
- `src/pages/ReservationsPage.tsx` - Add tennis court option
- `src/lib/api.ts` - Add new API functions
- `src/types/index.ts` - Add new type definitions

**Backend:**
- `functions/routes/reservations.ts` - Update availability logic

---

## 9. Implementation Considerations

### 9.1 Backward Compatibility

- Existing reservations remain valid
- URLs should redirect appropriately
- User preferences preserved

### 9.2 Performance

- Index new database tables for queries
- Use pagination for large lists
- Cache availability calculations

### 9.3 Security

- Admin-only endpoints protected
- Payment data properly validated
- External rental data isolated from resident data

---

## 10. Success Criteria

The implementation is successful when:

1. [ ] Admin panel uses vertical sidebar navigation
2. [ ] User nav uses dropdown menus
3. [ ] Reservations section has three working sub-tabs
4. [ ] Time blocks prevent resident bookings
5. [ ] External rentals block slots and track payments
6. [ ] Tennis Court is bookable by residents
7. [ ] All features are keyboard accessible
8. [ ] All text uses plain English
9. [ ] WCAG 2.1 AA standards met
10. [ ] All existing functionality preserved

---

## Appendix A: Type Definitions

```typescript
// New types to add to src/types/index.ts

type TimeBlockSlot = 'AM' | 'PM' | 'FULL_DAY';

type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

interface TimeBlock {
  id: string;
  amenity_type: AmenityType;
  date: string;
  slot: TimeBlockSlot;
  reason: string;
  created_by: string;
  created_at: string;
}

interface ExternalRental {
  id: string;
  amenity_type: AmenityType;
  date: string;
  slot: TimeBlockSlot;
  renter_name: string;
  renter_contact?: string;
  amount: number;
  payment_status: PaymentStatus;
  amount_paid: number;
  payment_method?: string;
  receipt_number?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

// Update AmenityType to include tennis-court
type AmenityType = 'clubhouse' | 'pool' | 'basketball-court' | 'tennis-court';
```

---

**Document Version:** 1.0
**Last Updated:** 2026-03-09
