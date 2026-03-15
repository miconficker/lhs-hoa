# Laguna Hills HOA - System Architecture

This document describes the complete architecture of the Laguna Hills Homeowners Association (HOA) Information and Service Management System.

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema](#database-schema)
7. [Authentication & Authorization](#authentication--authorization)
8. [API Design](#api-design)
9. [State Management](#state-management)
10. [Component Architecture](#component-architecture)
11. [Deployment Architecture](#deployment-architecture)
12. [Development Workflow](#development-workflow)

---

## System Overview

The Laguna Hills HOA system is a **serverless, full-stack web application** designed to manage HOA operations, resident services, and community engagement with integrated 2D mapping capabilities.

### Key Characteristics

- **Serverless Architecture**: No server management required
- **Edge Computing**: Global CDN distribution via Cloudflare Pages
- **JAMstack**: JavaScript APIs and Markup
- **Type-Safe**: Full TypeScript coverage
- **Responsive**: Mobile-first design with Tailwind CSS
- **Real-time Map Integration**: Interactive Leaflet maps with GeoJSON

### Core Functional Areas

1. **Public Landing Page**: Entry point with resident (login) and visitor (book) paths
2. **User Management**: Authentication, roles, Google OAuth SSO
3. **Household & Lot Management**: Property records, lot mapping
4. **Service Requests**: Maintenance request tracking
5. **Reservations**: Amenity booking system
   - **Internal**: Resident bookings with instant confirmation
   - **External (Public)**: Non-resident bookings with approval workflow
6. **Payments**: Dues management, payment tracking, verification queue
7. **Communications**: Announcements, events, notifications, messaging threads
8. **Polling**: Community voting system
9. **Document Repository**: HOA rules, forms, minutes
10. **Pass Management**: Employee and vehicle pass system
11. **Admin Tools**: System configuration, bulk operations
12. **Theme Support**: Dark mode toggle on public pages with `next-themes` integration

---

## Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI Framework | 18.3.1 |
| **TypeScript** | Type Safety | 5.6.3 |
| **Vite** | Build Tool | 5.4.10 |
| **Tailwind CSS** | Styling | 3.4.14 |
| **React Router v6** | Client-side Routing | 6.26.2 |
| **Zustand** | State Management | 5.0.1 |
| **TanStack Query** | Server State | 5.56.2 |
| **shadcn/ui** | UI Components | Radix-based |
| **Lucide React** | Icons | 0.563.0 |
| **Leaflet** | 2D Maps | 1.9.4 |
| **React Leaflet** | React Map Integration | 4.2.1 |
| **Recharts** | Data Visualization | 3.7.0 |
| **Sonner** | Toast Notifications | 2.0.7 |

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| **Cloudflare Workers** | Serverless Runtime | - |
| **Hono** | Web Framework | 4.6.7 |
| **Cloudflare D1** | SQLite Database | - |
| **Cloudflare R2** | Object Storage | - |
| **Cloudflare Pages** | Static Hosting | - |
| **Jose** | JWT Authentication | 6.1.3 |
| **bcryptjs** | Password Hashing | 3.0.3 |
| **Zod** | Schema Validation | 3.23.8 |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Wrangler** | Cloudflare CLI |
| **Vitest** | Unit Testing |
| **ESLint** | Linting |
| **Prettier** | Code Formatting |
| **TypeScript** | Type Checking |
| **PostCSS + Autoprefixer** | CSS Processing |

---

## Project Structure

```
lhs-hoa/
├── functions/                    # Cloudflare Pages Functions (Backend)
│   ├── _middleware.ts            # API router & CORS configuration
│   ├── lib/
│   │   ├── auth.ts              # JWT, password hashing, Google OAuth
│   │   ├── csrf.ts              # CSRF token generation and verification
│   │   ├── rate-limit.ts        # Rate limiting using D1 database
│   │   ├── public-api-dtos.ts   # Public API response DTOs (security layer)
│   │   ├── reference-numbers.ts # Reference number format validation
│   │   └── turnstile.ts         # Cloudflare Turnstile CAPTCHA verification
│   ├── routes/                   # API endpoint handlers
│   │   ├── auth.ts               # /api/auth/*
│   │   ├── announcements.ts      # /api/announcements/*
│   │   ├── dashboard.ts          # /api/dashboard/*
│   │   ├── documents.ts          # /api/documents/*
│   │   ├── events.ts             # /api/events/*
│   │   ├── households.ts         # /api/households/*
│   │   ├── messages.ts           # /api/messages/*
│   │   ├── notifications.ts      # /api/notifications/*
│   │   ├── pass-management.ts    # /api/pass-requests/*
│   │   ├── payments.ts           # /api/payments/*
│   │   ├── bookings.ts           # /api/bookings/* (unified booking system)
│   │   ├── polls.ts              # /api/polls/*
│   │   ├── service-requests.ts   # /api/service-requests/*
│   │   ├── delinquency.ts        # /api/admin/delinquency/*
│   │   ├── public.ts             # /api/public/* (no authentication - external bookings)
│   │   ├── public-v1.ts          # Legacy public API isolation (version-specific fixes)
│   │   └── admin.ts              # /api/admin/* (admin-only)
│   └── types/
│       └── index.ts              # Shared TypeScript types
│
├── src/                          # Frontend Source
│   ├── components/
│   │   ├── ui/                   # shadcn/ui base components
│   │   ├── admin/                # Admin-specific components
│   │   │   ├── test/              # Admin test components
│   │   │   │   └── NotificationBadgeTest.tsx  # Badge count testing
│   │   ├── booking/              # Booking system components (unified)
│   │   │   ├── BookingCalendar.tsx       # Calendar view with availability
│   │   │   ├── BookingHistory.tsx        # User booking history
│   │   │   ├── BookingStatusPage.tsx     # Status tracking page
│   │   │   ├── CalendarDayCell.tsx       # Individual calendar day cell
│   │   │   ├── CalendarLegend.tsx        # Calendar color legend
│   │   │   ├── PricingCard.tsx           # Pricing information card
│   │   │   ├── UnifiedBookingCalendar.tsx # Unified calendar component
│   │   │   ├── UnifiedBookingForm.tsx    # Unified booking form
│   │   │   └── useCalendarAvailability.ts # Calendar availability hook
│   │   │   └── lots/             # Lot management components
│   │   │       ├── LotsManagementPage.tsx
│   │   │       ├── AssignMemberDialog.tsx
│   │   │       ├── EditLotDialog.tsx
│   │   │       └── types.ts
│   │   ├── auth/                 # Authentication components
│   │   ├── layout/               # Layout components (Header, Sidebar, Nav)
│   │   ├── my-lots/              # My Lots page components (resident-facing)
│   │   │   ├── HouseholdMembersPanel.tsx
│   │   │   └── AddMemberDialog.tsx
│   │   ├── theme/                # Theme provider & toggle
│   │   ├── search/               # Command palette
│   │   ├── charts/               # Recharts wrappers
│   │   └── skeletons/            # Loading skeletons
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts            # Authentication state (Zustand)
│   │   ├── useAdminNotificationCounts.ts  # Admin sidebar notification badges
│   │   └── useUserNotificationCounts.ts   # User/homeowner navigation badges
│   ├── lib/
│   │   ├── api.ts                # API client & request helpers
│   │   ├── booking-status.ts     # Unified booking status config
│   │   ├── utils.ts              # Utility functions (cn())
│   │   ├── logger.ts             # Client-side logging
│   │   ├── sanitize.ts           # XSS prevention utilities (DOMPurify)
│   │   ├── content/              # i18n labels & messages
│   │   └── paymentExport.ts      # CSV export utilities
│   ├── public/                   # Public-facing components
│   │   ├── PublicPageHeader.tsx  # Shared header with dark mode toggle
│   │   ├── PublicLayout.tsx      # Layout wrapper for public pages
│   │   ├── QRCodeDisplay.tsx     # QR code for status tracking
│   │   └── StatusPhaseIndicator.tsx  # Booking status phase indicator
│   ├── pages/                    # Page components
│   │   ├── admin/                # Admin-specific pages
│   │   │   ├── AdminLayout.tsx   # Admin layout wrapper with persistent sidebar
│   │   │   ├── users/            # User management pages
│   │   │   │   ├── index.tsx     # Users section with tabs (users/board-members)
│   │   │   │   ├── UsersTab.tsx   # Users list and management
│   │   │   │   └── BoardMembersTab.tsx
│   │   │   ├── MemberApprovalsPage.tsx
│   │   │   ├── test/             # Admin test pages
│   │   │   │   └── NotificationBadgeTestPage.tsx  # Badge count testing page
│   │   │   └── reservations/     # Reservation management
│   │   │       └── UnifiedBookingsTab.tsx  # Unified bookings with status workflow
│   │   ├── bookings/             # Unified booking pages (residents + customers)
│   │   │   ├── BookingDetailsPage.tsx  # View booking details with status
│   │   │   └── BookingPaymentPage.tsx  # Upload payment proof
│   │   ├── public/              # Public pages (no authentication)
│   │   │   ├── LandingPage.tsx             # Landing page with resident/visitor options
│   │   │   ├── ExternalRentalsPage.tsx     # Browse amenities (with dark mode)
│   │   │   ├── AmenityDetailPage.tsx      # Calendar & pricing
│   │   │   ├── BookingPage.tsx             # Guest booking form
│   │   │   ├── ConfirmationPage.tsx        # Status tracking
│   │   │   ├── SuccessPage.tsx             # Booking success with auto-redirect
│   │   │   ├── InquiryPage.tsx             # Initial inquiry form
│   │   │   ├── InquiryPaymentPage.tsx      # Payment after inquiry approval
│   │   │   ├── InquiryPendingPage.tsx      # Pending inquiry status
│   │   │   └── StatusCheckPage.tsx         # Check status by reference number
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx     # Resident dashboard (user-centric)
│   │   ├── MapPage.tsx
│   │   ├── ServiceRequestsPage.tsx
│   │   ├── ReservationsPage.tsx
│   │   ├── PaymentsPage.tsx
│   │   ├── AnnouncementsPage.tsx
│   │   ├── EventsPage.tsx
│   │   ├── PollsPage.tsx
│   │   ├── DocumentsPage.tsx
│   │   ├── MessagesPage.tsx
│   │   ├── NotificationsPage.tsx
│   │   ├── PassesPage.tsx
│   │   ├── MyLotsPage.tsx
│   │   ├── CommonAreasPage.tsx
│   │   ├── DebugPage.tsx
│   │   ├── AdminPanelPage.tsx    # Admin dashboard (stats, charts, quick actions)
│   │   ├── AdminLotsPage.tsx
│   │   ├── DuesConfigPage.tsx
│   │   ├── InPersonPaymentsPage.tsx
│   │   ├── PassManagementPage.tsx
│   │   ├── AccountSettingsPage.tsx
│   │   ├── WhitelistManagementPage.tsx
│   │   └── HelpPage.tsx
│   ├── types/
│   │   └── index.ts              # Frontend TypeScript types
│   ├── App.tsx                   # Root component & routing
│   ├── main.tsx                  # Application entry point
│   └── vite-env.d.ts             # Vite environment types
│
├── public/                       # Static assets
│   └── data/
│       └── lots.geojson          # Base map geometries
│
├── migrations/                   # D1 Database migrations
│   ├── 0001_base_schema.sql      # Core tables
│   ├── 0002_add_lot_coordinates.sql
│   ├── 0003_payment_verification.sql
│   ├── 0004_add_payment_notification_types.sql
│   ├── 0005_late_fee_config.sql
│   ├── 0006_poll_votes_indexes.sql
│   ├── 0007_system_settings.sql
│   ├── 0008_seed_data.sql
│   ├── 0019_manual_delinquencies.sql  # Manual delinquency tracking
│   ├── 0020_delinquency_reason_codes.sql  # Structured reason codes (bylaw grounds)
│   └── 0032_reference_number_mappings.sql  # Reference number format validation
│
├── scripts/                      # Utility scripts
│   ├── svg-to-geojson.ts         # Convert SVG map to GeoJSON
│   └── lot-mapping.json          # Lot annotation mapping
│
├── docs/                         # Documentation
│   ├── security/                 # Security documentation
│   │   ├── 2026-03-15-public-api-security-audit.md
│   │   └── 2026-03-15-security-fixes-implementation.md
│   └── payment-api-reference.md
│
├── .dev.vars                     # Local development secrets
├── wrangler.jsonc                # Cloudflare config
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript config
├── tailwind.config.js            # Tailwind configuration
├── package.json                  # Dependencies & scripts
├── dev.sh                        # Start dev script (frontend + backend)
├── ARCHITECTURE.md               # This file
├── CLAUDE.md                     # Claude Code project instructions
└── README.md                     # Project overview
```

---

## Frontend Architecture

### Application Entry Point

```typescript
// src/main.tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Routing Structure

The app uses **React Router v6** with nested routes:

```
/ (public)
├── / (public)                                          # Landing page - choose resident/visitor
├── /login (public)
├── /external-rentals (public)                         # Browse amenities (non-residents)
├── /external-rentals/:amenityType (public)            # Amenity details with calendar
├── /external-rentals/book (public)                    # Guest booking form
├── /external-rentals/confirmation/:id (public)       # Booking status tracker
├── /external-rentals/success/:id (public)             # Booking success page
├── /inquiry (public)                                   # Initial inquiry form
├── /inquiry/:amenityType (public)                     # Amenity-specific inquiry
├── /inquiry/payment/:id (public)                      # Payment after approval
├── /inquiry/pending/:id (public)                      # Pending inquiry status
├── /status/check (public)                             # Check status by reference
└── / (protected - MainLayout)
    ├── /dashboard              # Resident dashboard (user-centric)
    ├── /bookings               # Unified booking management
    ├── /bookings/:id           # Booking details
    ├── /bookings/:id/payment   # Upload payment proof
    ├── /map
    ├── /service-requests
    ├── /reservations
    ├── /my-lots               # Resident's properties with member management
    ├── /passes
    ├── /payments
    ├── /documents
    ├── /messages
    ├── /announcements
    ├── /events
    ├── /polls
    ├── /notifications (admin, resident, staff)
    ├── /account
    ├── /debug
    ├── /help
    └── /admin/* (admin-only - AdminLayout)
        ├── /admin              # Admin dashboard (stats, charts, quick actions)
        ├── /admin/users        # User management with tabs
        ├── /admin/lots         # Map-based lot management
        ├── /admin/lot-members  # Lot membership management
        ├── /admin/dues         # Dues configuration
        ├── /admin/payments     # Payment management
        ├── /admin/payments/in-person
        ├── /admin/common-areas # Common area management
        ├── /admin/pass-management
        ├── /admin/whitelist    # Email whitelist management
        ├── /admin/pre-approved
        ├── /admin/member-approvals
        ├── /admin/announcements
        ├── /admin/notifications
        ├── /admin/messages
        ├── /admin/dues-settings
        ├── /admin/verification-queue
        ├── /admin/settings
        └── /admin/reservations/:tab
```

### Component Hierarchy

```
App
└── BrowserRouter
    └── Routes
        ├── LoginPage (unprotected)
        └── ProtectedRoute
            └── MainLayout (resident pages)
                ├── Sidebar
                ├── Header
                ├── BottomNav (mobile)
                └── Page Content
            └── AdminLayout (admin pages)
                ├── Sidebar (admin navigation)
                └── Page Content
```

### State Management

**Zustand** is used for client-side state:

```typescript
// src/hooks/useAuth.ts
interface AuthState {
  user: User | null;
  token: string | null;
  initialized: boolean;
  setAuth: (auth: AuthResponse) => void;
  clearAuth: () => void;
  init: () => void;
}
```

- **Auth State**: User session, JWT token
- **Server State**: TanStack Query for API data caching
- **Form State**: Controlled components with React state

### API Client

Centralized API client in `src/lib/api.ts`:

```typescript
const API_BASE = "/api";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>>
```

**Key Features**:
- Automatic JWT injection via `Authorization: Bearer ${token}`
- Error handling & parsing
- File upload support via `apiUpload()`
- Organized by domain: `api.auth.*`, `api.payments.*`, etc.

**Important**: Do NOT include `/api` prefix in endpoint paths — it's already prepended.

---

## Backend Architecture

### Cloudflare Pages Functions

The backend runs on **Cloudflare Pages Functions** using the **Hono** framework.

### Middleware

`functions/_middleware.ts` is the entry point:

```typescript
const app = new Hono<{ Bindings: Env }>();

// CORS configuration
app.use('/*', cors({
  origin: (origin) => {
    // Allowlist: localhost + production domain
  },
  credentials: true,
}));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Route mounting
app.route('/api/auth', authRouter);
app.route('/api/dashboard', dashboardRouter);
// ... other routes
```

### Route Handlers

Each domain has its own router file:

```typescript
// functions/routes/payments.ts
const paymentsRouter = new Hono<{ Bindings: Env }>();

paymentsRouter.get('/', async (c) => {
  // List payments with filters
});

paymentsRouter.post('/', async (c) => {
  // Create payment
});
```

### Environment Bindings

```typescript
type Env = {
  DB: D1Database;              // D1 database binding
  R2: R2Bucket;                // R2 storage binding
  JWT_SECRET: string;          // JWT signing secret
  ALLOWED_ORIGINS?: string;    // CORS allowlist
};
```

### Authentication Middleware

JWT verification on protected routes:

```typescript
async function requireAuth(c: Context, next: Next) {
  const auth = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', auth);
  await next();
}
```

### Public GeoJSON Endpoint

Dynamic map data generation:

```typescript
app.get('/api/data/lots.geojson', async (c) => {
  // Merge database lot ownership with static GeoJSON geometries
  const lots = await c.env.DB.prepare(`
    SELECT h.id, h.block, h.lot,
           lm.user_id as owner_user_id,
           u.email as owner_email
    FROM households h
    LEFT JOIN lot_members lm ON lm.household_id = h.id
      AND lm.member_type = 'primary_owner'
      AND lm.verified = 1
    LEFT JOIN users u ON lm.user_id = u.id
  `).all();

  // Combine with GeoJSON from /data/lots.geojson
  return c.json(mergedGeoJSON);
});
```

---

## Database Schema

### D1 (SQLite) Database

**Migration Files**: `migrations/0001_base_schema.sql` through `0008_seed_data.sql`

### Core Tables

#### `users`
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,              -- Nullable for SSO
  role TEXT NOT NULL CHECK(role IN ('admin', 'resident', 'staff', 'guest')),
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `households`
```sql
CREATE TABLE households (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,           -- Auto-generated from street, block, lot
  street TEXT,                     -- Street name (e.g., "Mahogany Street")
  block TEXT,                      -- Block number
  lot TEXT,                        -- Lot number
  latitude REAL,
  longitude REAL,
  map_marker_x REAL,
  map_marker_y REAL,
  owner_id TEXT REFERENCES users(id),     -- DEPRECATED: Use lot_members for ownership
  lot_status TEXT DEFAULT 'vacant_lot',
  lot_type TEXT DEFAULT 'residential',
  lot_size_sqm REAL,
  lot_label TEXT,
  lot_description TEXT,
  household_group_id TEXT,               -- For merged lots (still active)
  is_primary_lot BOOLEAN DEFAULT 1,      -- For merged lots (still active)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Address Format**: Auto-generated as `{street}, Block {block}, Lot {lot}` (e.g., "Mahogany Street, Block 15, Lot 12")

**Ownership Model**:
- `owner_id` column is **deprecated** - kept for backward compatibility only
- Use `lot_members` table (see below) for all ownership and access control logic
- `household_group_id` and `is_primary_lot` are **still active** for merged lots functionality

#### `lot_members` (Ownership & Access Control)
```sql
CREATE TABLE lot_members (
  id            TEXT     PRIMARY KEY,
  household_id  TEXT     NOT NULL REFERENCES households(id),
  user_id       TEXT     NOT NULL REFERENCES users(id),
  member_type   TEXT     NOT NULL CHECK(member_type IN ('primary_owner','secondary')),
  can_vote      BOOLEAN  NOT NULL DEFAULT 0,
  verified      BOOLEAN  NOT NULL DEFAULT 0,
  verified_at   DATETIME,
  verified_by   TEXT     REFERENCES users(id),
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, user_id)
);

CREATE INDEX idx_lot_members_household ON lot_members(household_id);
CREATE INDEX idx_lot_members_user       ON lot_members(user_id);
CREATE INDEX idx_lot_members_verified   ON lot_members(verified, member_type);
```

**Purpose**: This is the **source of truth** for:
- Who owns which lots (households)
- Who has access to which households
- Who can vote (for HOA elections)
- Primary owners vs secondary members

**Member Types**:
- `primary_owner`: The lot owner with full rights
- `secondary`: Family members, helpers, etc. with limited rights

**Access Control Pattern**:
```sql
-- Check if user can access a household
SELECT * FROM lot_members
WHERE user_id = ? AND household_id = ?
  AND member_type = 'primary_owner' AND verified = 1;

-- Get user's lots
SELECT h.* FROM households h
JOIN lot_members lm ON lm.household_id = h.id
WHERE lm.user_id = ? AND lm.member_type = 'primary_owner' AND lm.verified = 1;
```

#### `service_requests`
```sql
CREATE TABLE service_requests (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  assigned_to TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

#### `payments`
```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'PHP',
  method TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reference_number TEXT,
  period TEXT NOT NULL,
  payment_category TEXT DEFAULT 'dues',
  late_fee_amount REAL DEFAULT 0,
  late_fee_months INTEGER DEFAULT 0,
  received_by TEXT REFERENCES users(id),
  proof_file_url TEXT,
  verification_status TEXT DEFAULT 'pending',
  verification_notes TEXT,
  verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME
);
```

#### `customers` (External Guest Records)
```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  guest_notes TEXT,
  created_ip TEXT,
  ip_retained_until DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Stores external guest information separate from bookings. Guests can make multiple bookings without re-entering information.

#### `bookings` (Unified Booking System)
```sql
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,

  -- Exactly one of these must be set (CHECK constraint enforced)
  user_id TEXT REFERENCES users(id),         -- for residents
  customer_id TEXT REFERENCES customers(id), -- for external guests

  household_id TEXT REFERENCES households(id), -- for resident bookings

  -- Explicit workflow (kept even though user_id/customer_id implies it)
  workflow TEXT NOT NULL CHECK(workflow IN ('resident', 'external')),

  -- Booking details
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),

  -- Pricing breakdown
  base_rate REAL NOT NULL,
  duration_hours INTEGER NOT NULL,
  day_multiplier REAL NOT NULL DEFAULT 1.0,
  season_multiplier REAL NOT NULL DEFAULT 1.0,
  resident_discount REAL DEFAULT 0,  -- 0 = no discount, 0.5 = 50% off
  amount REAL NOT NULL,
  pricing_calculated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Payment tracking
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partial', 'paid', 'overdue', 'waived')),
  amount_paid REAL DEFAULT 0,
  payment_method TEXT,
  receipt_number TEXT,
  proof_of_payment_url TEXT,

  -- Unified status workflow (simplified)
  booking_status TEXT NOT NULL DEFAULT 'submitted' CHECK(booking_status IN (
    'submitted',        -- awaiting admin approval
    'payment_due',      -- approved; awaiting payment/proof
    'payment_review',   -- proof uploaded; admin reviewing
    'confirmed',
    'rejected',
    'cancelled',
    'no_show'
  )),

  -- Event details
  event_type TEXT CHECK(event_type IN ('wedding', 'birthday', 'meeting', 'sports', 'other', NULL)),
  purpose TEXT,
  attendee_count INTEGER,

  -- Admin notes
  admin_notes TEXT,
  rejection_reason TEXT,

  -- Admin approval metadata
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id),

  -- Audit
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES users(id),
  created_by_customer_id TEXT REFERENCES customers(id),
  created_ip TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES users(id),

  -- Soft delete
  deleted_at TEXT,
  deleted_by TEXT REFERENCES users(id),

  -- Ensure exactly one of user_id or customer_id is set
  CHECK (
    (user_id IS NOT NULL AND customer_id IS NULL) OR
    (user_id IS NULL AND customer_id IS NOT NULL)
  )
);
```

**Purpose**: Single unified table for all bookings (resident and external) with consistent status workflow.

**Status Workflow**:
1. `submitted` - Initial state, awaiting admin review
2. `payment_due` - Admin approved, awaiting payment/proof upload
3. `payment_review` - Payment proof uploaded, admin verifying
4. `confirmed` - Payment verified, booking confirmed
5. `rejected` - Booking rejected (with reason)
6. `cancelled` - Booking cancelled by user or admin
7. `no_show` - Marked as no-show by admin

**Design Difference - Resident vs External Bookings**:

| Aspect | Resident (`user_id`) | External (`customer_id`) |
|--------|---------------------|--------------------------|
| **Who** | Authenticated residents | Non-residents/public |
| **Auth Required** | Yes | No |
| **Confirmation** | Admin approval | Admin approval |
| **Slot Blocking** | Only when confirmed | Only when confirmed |
| **Multiple Pending** | Allowed with timestamp sorting | Allowed with timestamp sorting |
| **Payment Flow** | Upload proof before confirmation | Upload proof before confirmation |
| **Discount** | Automatic 50% resident discount | Full price |
| **Reference Number** | `RES-YYYYMMDD-XXX` | `EXT-YYYYMMDD-XXX` |

**Indexes**:
```sql
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_household ON bookings(household_id);
CREATE INDEX idx_bookings_workflow ON bookings(workflow);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_date ON bookings(date);
CREATE INDEX idx_bookings_slot_lookup ON bookings(amenity_type, date, slot) WHERE deleted_at IS NULL;
```

**Compatibility Views** (for backward compatibility):
```sql
-- Legacy reservations view (resident bookings only)
CREATE VIEW reservations_legacy AS
  SELECT
    b.id, b.household_id, b.amenity_type, b.date, b.slot,
    b.amount, b.payment_status, b.amount_paid, b.payment_method, b.receipt_number,
    CASE b.booking_status
      WHEN 'confirmed' THEN 'confirmed'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'pending'
    END AS status,
    b.purpose, b.created_at, b.created_by
  FROM bookings b
  WHERE b.workflow = 'resident' AND b.deleted_at IS NULL;

-- Legacy external_rentals view (external bookings only)
CREATE VIEW external_rentals_legacy AS
  SELECT
    b.id, b.amenity_type, b.date, b.slot,
    b.amount, b.payment_status, b.amount_paid, b.payment_method, b.receipt_number,
    CASE b.booking_status
      WHEN 'submitted' THEN 'inquiry_submitted'
      WHEN 'payment_due' THEN 'pending_payment'
      WHEN 'payment_review' THEN 'pending_verification'
      ELSE b.booking_status
    END AS booking_status,
    c.first_name || ' ' || c.last_name AS guest_name,
    c.first_name AS guest_first_name, c.last_name AS guest_last_name,
    c.email AS guest_email, c.phone AS guest_phone,
    b.proof_of_payment_url, b.admin_notes, b.rejection_reason,
    b.created_at, b.created_by, b.created_ip,
    b.approved_at, b.approved_by, c.guest_notes, b.purpose
  FROM bookings b
  JOIN customers c ON b.customer_id = c.id
  WHERE b.workflow = 'external' AND b.deleted_at IS NULL;
```

#### `booking_blocked_dates` (Confirmed Bookings Only)
```sql
CREATE TABLE booking_blocked_dates (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court', 'tennis-court')),
  booking_date DATE NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM', 'FULL_DAY')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  UNIQUE(amenity_type, booking_date, slot)
);
```

**Purpose**: Tracks confirmed bookings that block specific slots. Only confirmed bookings create records here, preventing double-booking.

**Behavior**:
- Created when booking status changes to `confirmed`
- Automatically deleted when booking is cancelled or deleted (CASCADE)
- UNIQUE constraint ensures only one confirmed booking per slot

#### `verification_tokens` (Booking Verification Tokens)
```sql
CREATE TABLE verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  booking_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
```

**Purpose**: Stores verification tokens for public booking status tracking (QR codes, reference numbers).

**Behavior**:
- Generated when booking is created for external workflow
- Used for status check without authentication
- Automatically deleted when booking is deleted (CASCADE)

#### `polls` & `poll_votes`
```sql
CREATE TABLE polls (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  options TEXT NOT NULL,              -- JSON array
  ends_at DATETIME NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE poll_votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES polls(id),
  household_id TEXT NOT NULL REFERENCES households(id),
  selected_option TEXT NOT NULL,
  lot_count INTEGER DEFAULT 1,
  voting_method TEXT DEFAULT 'online',
  recorded_by TEXT REFERENCES users(id),
  voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(poll_id, household_id)
);
```

#### `notifications`
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `manual_delinquencies`
```sql
CREATE TABLE manual_delinquencies (
  id TEXT PRIMARY KEY,
  lot_member_id TEXT NOT NULL REFERENCES lot_members(id),
  is_active BOOLEAN NOT NULL DEFAULT 1,
  reason TEXT,                         -- Human-readable reason (backward compat)
  reason_code TEXT CHECK(reason_code IN (  -- Bylaw grounds (structured)
    'failure_to_pay',                  -- Failure to pay dues despite repeated demands
    'repeated_violation',              -- Repeated violation or noncompliance
    'detrimental_conduct',             -- Commission of detrimental conduct
    'failure_to_attend'                -- Failure to attend 3 consecutive general memberships
  )),
  reason_detail TEXT,                 -- Supplementary detail (e.g., rule citation for repeated_violation)
  marked_by TEXT NOT NULL REFERENCES users(id),
  marked_at TEXT NOT NULL,
  waived_by TEXT REFERENCES users(id),
  waived_at TEXT,
  waiver_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lot_member_id) REFERENCES lot_members(id) ON DELETE CASCADE
);
```

**Purpose**: Track manual delinquency overrides with full audit trail.

**Bylaw Grounds** (`reason_code` values):
1. **failure_to_pay**: Failure to pay dues despite repeated demands
2. **repeated_violation**: Repeated violation or noncompliance (requires `reason_detail` with rule citation)
3. **detrimental_conduct**: Commission of detrimental conduct
4. **failure_to_attend**: Failure to attend 3 consecutive general memberships without justifiable reasons

**Key Behaviors**:
- When a member is marked delinquent, `lot_members.can_vote` is set to `0`
- When waived, voting eligibility is recalculated based on payment status
- `reason` field stores human-readable text for display (legacy compatibility)
- `reason_code` + `reason_detail` provide structured, queryable data

**API Endpoints**:
- `GET /api/admin/delinquency/members` - List all delinquents (manual + automatic)
- `GET /api/admin/delinquency/member-search?q=` - Search members for flagging
- `POST /api/admin/delinquency/mark` - Flag member as delinquent (requires `reason_code` + optional `reason_detail`)
- `POST /api/admin/delinquency/waive/:id` - Waive manual delinquency

#### `pass_employees` & `pass_vehicles`
```sql
CREATE TABLE pass_employees (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  full_name TEXT NOT NULL,
  employee_type TEXT NOT NULL,
  photo_url TEXT,
  rfid TEXT,
  status TEXT DEFAULT 'pending',
  expiry_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pass_vehicles (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  plate_number TEXT NOT NULL UNIQUE,
  make TEXT,
  model TEXT,
  color TEXT,
  year INTEGER,
  sticker_id TEXT,
  rfid TEXT,
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'unpaid',
  expiry_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Pass Management System (Unified Architecture)

The pass management system was redesigned to separate **pass records** from **payment records** with a unified, extensible architecture supporting independent pass tracking and detailed payment history.

#### Design Principles

1. **Separation of Concerns**: Pass records are separate from payment records
2. **Unified Payments**: Single `payments` table for all pass types
3. **Extensibility**: Add new pass types by inserting into `pass_types` table
4. **Clear Relationships**: Foreign key relationships maintain data integrity
5. **Payment History**: Complete audit trail across all pass types

#### Tables

##### Pass Type Registry
```sql
CREATE TABLE pass_types (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,        -- 'sticker', 'rfid', 'employee_id', 'vip', 'valet'
  name TEXT NOT NULL,               -- Display name
  category TEXT NOT NULL,          -- 'vehicle', 'employee', 'resident', 'visitor'
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Defines all pass types in the system. New pass types can be added without schema changes.

**Seed Data**:
- `pt-sticker` - Gate Pass Sticker (vehicle)
- `pt-rfid` - RFID Card (vehicle)
- `pt-employee` - Employee ID (employee)
- `pt-vip` - VIP Pass (resident)
- `pt-valet` - Valet Pass (visitor)

##### Vehicle Registrations (Base Table)
```sql
CREATE TABLE vehicle_registrations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  plate_number TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT NOT NULL,
  pass_type TEXT NOT NULL CHECK(pass_type IN ('sticker', 'rfid', 'both')),
  rfid_code TEXT UNIQUE,
  sticker_number TEXT UNIQUE,
  status TEXT DEFAULT 'pending_payment' CHECK(status IN ('pending_payment', 'pending_approval', 'active', 'cancelled')),
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid')),
  issued_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, plate_number)
);
```

**Purpose**: Base vehicle information. The `pass_type` field is kept for backward compatibility but the actual pass records are in `vehicle_passes`.

##### Vehicle Passes (Independent Pass Records)
```sql
CREATE TABLE vehicle_passes (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicle_registrations(id) ON DELETE CASCADE,
  pass_type_id TEXT NOT NULL REFERENCES pass_types(id),
  identifier TEXT NOT NULL,           -- sticker_number or rfid_code
  amount_due REAL NOT NULL DEFAULT 0,
  amount_paid REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'partial')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'replaced')),
  issued_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vehicle_id, pass_type_id),     -- One pass of each type per vehicle
  UNIQUE(pass_type_id, identifier)      -- Unique identifier per pass type
);
```

**Purpose**: Independent tracking of each pass type per vehicle. A vehicle can have:
- Sticker pass only
- Sticker passes expire at end of year (expiry_date set to Dec 31)
- RFID pass only
- RFID passes don't expire but can be replaced if damaged
- Both passes (two separate records)

**Status Values**:
- `active` - Pass is currently in use
- `inactive` - Pass is temporarily inactive
- `replaced` - Pass was replaced with a new one (e.g., damaged RFID)

##### Household Employees (Employee Passes)
```sql
CREATE TABLE household_employees (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  full_name TEXT NOT NULL,
  employee_type TEXT CHECK(employee_type IN ('driver', 'housekeeper', 'caretaker', 'other')),
  id_number TEXT NOT NULL UNIQUE,    -- Generated EMP-XXX-XXX
  photo_url TEXT,
  pass_type_id TEXT REFERENCES pass_types(id),
  amount_due REAL DEFAULT 0,
  amount_paid REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'partial')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'revoked', 'expired')),
  issued_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Employee passes with payment tracking. Each employee has one pass record linked to a pass type.

##### Pass Fees (Configurable Fees)
```sql
CREATE TABLE pass_fees (
  id TEXT PRIMARY KEY,
  pass_type_id TEXT NOT NULL REFERENCES pass_types(id),
  amount REAL NOT NULL,
  effective_date DATE NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pass_type_id, effective_date)
);
```

**Purpose**: Configurable fees per pass type. Multiple fees can exist with different effective dates, allowing for historical tracking and fee changes.

##### Unified Payments Table (Pass Support)
```sql
-- The payments table includes pass tracking fields:
pass_type_id TEXT REFERENCES pass_types(id),
vehicle_pass_id TEXT REFERENCES vehicle_passes(id),
employee_pass_id TEXT REFERENCES household_employees(id),
```

**Purpose**: Unified payment tracking for all pass types. The `pass_type_id`, `vehicle_pass_id`, and `employee_pass_id` fields allow linking payments to specific passes while maintaining the general `payment_category` for backward compatibility.

#### Views

##### vehicles_with_passes_view
```sql
CREATE VIEW vehicles_with_passes_view AS
SELECT
  v.id,
  v.household_id,
  h.address as household_address,
  v.plate_number,
  v.make,
  v.model,
  v.color,
  v.status,
  -- Sticker pass details
  sticker.id as sticker_pass_id,
  sticker.identifier as sticker_number,
  sticker.amount_due as sticker_amount_due,
  sticker.amount_paid as sticker_amount_paid,
  sticker.payment_status as sticker_payment_status,
  -- RFID pass details
  rfid.id as rfid_pass_id,
  rfid.identifier as rfid_code,
  rfid.amount_due as rfid_amount_due,
  rfid.amount_paid as rfid_amount_paid,
  rfid.payment_status as rfid_payment_status,
  -- Computed
  COALESCE(sticker.amount_due, 0) + COALESCE(rfid.amount_due, 0) as total_amount_due,
  COALESCE(sticker.amount_paid, 0) + COALESCE(rfid.amount_paid, 0) as total_amount_paid
FROM vehicle_registrations v
JOIN households h ON h.id = v.household_id
LEFT JOIN vehicle_passes sticker ON sticker.vehicle_id = v.id AND sticker.pass_type_id = 'pt-sticker'
LEFT JOIN vehicle_passes rfid ON rfid.vehicle_id = v.id AND rfid.pass_type_id = 'pt-rfid';
```

**Purpose**: Simplified queries for vehicles with all their passes in one row.

#### API Endpoints

##### Pass Types
- `GET /api/admin/pass-management/pass-types` - List all pass types

##### Vehicle Management
- `GET /api/admin/pass-management/vehicles` - List vehicles (uses `vehicles_with_passes_view`)
- `GET /api/admin/pass-management/vehicles/:id` - Get vehicle details
- `POST /api/admin/pass-management/vehicles` - Create vehicle with checkbox selection (has_sticker, has_rfid)
- `PUT /api/admin/pass-management/vehicles/:id/assign-rfid` - Assign RFID code
- `PUT /api/admin/pass-management/vehicles/:id/assign-sticker` - Assign sticker number
- `POST /api/admin/pass-management/vehicles/:id/replace-rfid` - Replace damaged RFID (old one set to 'replaced', new one created)
- `POST /api/admin/pass-management/vehicles/:id/record-payment` - Record payment for vehicle passes
- `PUT /api/admin/pass-management/vehicles/:id/status` - Update vehicle status
- `DELETE /api/admin/pass-management/vehicles/:id` - Delete vehicle

##### Employee Management
- `GET /api/admin/pass-management/employees` - List employees (uses `employees_with_pass_type_view`)
- `GET /api/admin/pass-management/employees/:id` - Get employee details
- `POST /api/admin/pass-management/employees` - Create employee pass
- `POST /api/admin/pass-management/employees/:id/record-payment` - Record payment for employee pass
- `PUT /api/admin/pass-management/employees/:id/status` - Update employee status
- `DELETE /api/admin/pass-management/employees/:id` - Delete employee

##### Pass Fees
- `GET /api/admin/pass-management/fees` - Get current fees
- `PUT /api/admin/pass-management/fees` - Update fees (sticker_fee, rfid_fee, employee_fee)

#### Frontend Components

##### PassManagementPage.tsx (Admin)
- **Vehicle Form**: Uses checkboxes for pass selection instead of dropdown
- **Vehicle List**: Shows badges for Sticker/RFID passes
- **Payment Recording**: Per-pass payment support with pass_type selection
- **RFID Replacement**: "Replace RFID" button (🔄) for active vehicles with RFID passes
  - Old RFID is marked as 'replaced' status
  - New RFID is created with unpaid status
  - User prompted for replacement reason (e.g., "Damaged - needs replacement")

##### PassesPage.tsx (User)
- **Vehicle List**: Shows badges for Sticker/RFID passes
- **Payment Flow**: Users can view and pay for their passes

#### Extensibility

##### Adding a New Pass Type (e.g., VIP Pass)

1. **Database**: Insert into `pass_types` table
```sql
INSERT INTO pass_types (id, code, name, category, description)
VALUES ('pt-vip', 'vip', 'VIP Access Pass', 'resident', 'Priority access for VIP residents');
```

2. **Set Fee**: Insert into `pass_fees` table
```sql
INSERT INTO pass_fees (id, pass_type_id, amount, effective_date)
VALUES ('fee-vip-001', 'pt-vip', 2000, DATE('now'));
```

3. **Create Table** (if needed):
```sql
CREATE TABLE resident_passes (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  pass_type_id TEXT NOT NULL REFERENCES pass_types(id),
  identifier TEXT NOT NULL,
  amount_due REAL NOT NULL,
  amount_paid REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  -- ... other fields
);
```

4. **Payment Integration**: The `payments` table already supports the new pass type via `pass_type_id` field

#### Key Design Decisions

1. **Backward Compatibility**: The `vehicle_registrations.pass_type` field is maintained for gradual migration
2. **Cascading Deletes**: `vehicle_passes` uses `ON DELETE CASCADE` to clean up passes when vehicles are deleted
3. **Unique Constraints**: Ensure one pass of each type per vehicle and unique identifiers per pass type
4. **Views for Simplification**: Complex joins are abstracted into views for cleaner API queries
5. **Flexible Fees**: Fees are time-stamped, allowing for historical tracking and future changes

#### Future Enhancements

1. **Valet Pass System**: Already seeded in `pass_types`, ready for implementation
2. **Visitor Pass Tracking**: Extend system for temporary visitor passes
3. **Pass Expiry Management**: Add automated expiry notifications
4. **Pass Renewals**: Support for pass renewals with new fee structures
5. **Bulk Pass Operations**: Admin tools for bulk pass updates

### Indexes

Key indexes for performance:

```sql
CREATE INDEX idx_households_owner ON households(owner_id);
CREATE INDEX idx_households_block_lot ON households(block, lot);
CREATE INDEX idx_household_group ON households(household_group_id);
CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_payments_household_status ON payments(household_id, status);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
```

---

## Authentication & Authorization

### Authentication Flow

#### 1. Email/Password Login
```
Client → POST /api/auth/login
Backend → Verify password hash
Backend → Generate JWT (jose)
Backend → Return { token, user }
Client → Store in localStorage
```

#### 2. Google OAuth SSO
```
Client → GET /api/auth/google/url
Backend → Return Google auth URL
User → Authenticate with Google
Google → Redirect to /api/auth/google/callback?code=xxx
Backend → Exchange code for access token
Backend → Get user info from Google
Backend → Check pre_approved_emails whitelist
Backend → Create/update user account
Backend → Generate JWT
Backend → Redirect to frontend with token
```

### JWT Structure

```typescript
{
  userId: string,
  role: UserRole,
  exp: number      // 7 days expiration
}
```

### Authorization

**Role-Based Access Control (RBAC)**:

| Role | Permissions |
|------|-------------|
| `admin` | Full system access, all CRUD operations, bulk actions |
| `staff` | Service requests, reservations, payments (read/write), notifications |
| `resident` | Own household data, service requests, reservations, payments, polls |
| `guest` | View-only access to public info |

### Protected Route Pattern

```typescript
// Frontend: src/components/auth/ProtectedRoute.tsx
export function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }
  return children;
}

// Backend: functions/routes/admin.ts
adminRouter.get('*', requireAuth, requireRole('admin'), async (c) => {
  // Admin-only logic
});
```

### Whitelist for SSO

**`pre_approved_emails`** table controls who can sign up via Google OAuth:

```sql
CREATE TABLE pre_approved_emails (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  household_id TEXT REFERENCES households(id),
  invited_by TEXT REFERENCES users(id),
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME,
  is_active BOOLEAN DEFAULT 1
);
```

### Security Status (as of 2026-03-13)

**Overall Security Score: 9/10 🟢** (improved from 8/10)

#### ✅ Security Strengths (Enhanced)

1. **Strong Authentication**
   - JWT with 7-day expiration using `jose` library (Workers-compatible)
   - Password hashing with bcryptjs (10 salt rounds)
   - Google OAuth SSO with pre-approved email whitelist
   - Role-Based Access Control (RBAC) properly implemented

2. **Input Validation** ✨ ENHANCED
   - Zod schemas for runtime type validation on all API endpoints
   - TypeScript strict mode prevents type confusion at compile time
   - SQL injection protection via parameterized queries (`.bind()`)
   - File upload validation (type and size checks)
   - **NEW**: Enhanced email validation with domain checks
   - **NEW**: Max length constraints on all text inputs
   - **NEW**: URL whitelist validation for proof uploads

3. **Data Protection**
   - Passwords never logged or returned in API responses
   - Sensitive fields omitted from public GeoJSON endpoint
   - CORS allowlist for cross-origin request protection
   - Foreign key constraints enforced in database
   - **NEW**: DOMPurify sanitization for XSS prevention

4. **Rate Limiting** ✨ NEW
   - D1-based rate limiting implementation
   - 8 rate limit tiers protecting different endpoint types
   - IP-based throttling with rolling windows
   - Applied to all public endpoints

5. **Security Headers** ✨ NEW
   - Content-Security-Policy (CSP) headers
   - X-Frame-Options: DENY (clickjacking protection)
   - X-Content-Type-Options: nosniff (MIME sniffing protection)
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy (feature restrictions)

6. **CSRF Protection** ✨ NEW
   - HMAC-signed CSRF tokens with timestamp expiration
   - Token generation endpoint for public forms
   - Automatic token inclusion in frontend API requests
   - Verification on all state-changing operations

7. **Bot Protection** ✨ NEW
   - Cloudflare Turnstile integration (optional, requires setup)
   - Invisible CAPTCHA for legitimate users
   - Challenge-only for suspicious traffic
   - Residents bypass via authenticated flow

#### 🟡 Remaining Security Gaps (Reduced Severity)

1. **OAuth State Parameter Not Validated** (CVSS 8.1)
   - Google OAuth callback does not validate `state` parameter
   - Vulnerable to CSRF attacks during OAuth flow
   - **Recommendation**: Implement state parameter generation and validation

2. **Weak Password Policy**
   - Current: 6 characters minimum, no complexity requirements
   - **Recommendation**: 12+ characters with uppercase, lowercase, number, special char

3. **No Session Invalidation on Password Change**
   - JWT tokens remain valid for up to 7 days after password change
   - **Recommendation**: Implement token versioning

4. **Missing Audit Logging**
   - No audit trail for admin actions, authentication events, or sensitive operations
   - **Recommendation**: Add audit_logs table with user_id, action, resource_type, ip_address

5. **Error Messages Expose Internal Information**
   - Detailed error messages may leak implementation details
   - **Recommendation**: Implement sanitized error responses for production

#### 🟢 Lower-Priority Security Gaps

6. **CORS Configuration**
   - Allows any localhost port without restriction
   - **Mitigated**: Security headers provide additional protection

7. **JWT Token Expiration**
   - 7-day expiration increases exposure if token is stolen
   - **Mitigated**: CSRF protection reduces token theft risk

8. **Debug Page Accessible to Authenticated Users**
   - `/debug` page exposes localStorage and internal state
   - **Recommendation**: Restrict to admin-only or remove in production

9. **localStorage Token Storage**
   - JWT tokens in localStorage vulnerable to XSS theft
   - **Mitigated**: CSP headers and output sanitization reduce XSS risk

#### Compliance Status

| Standard | Status | Notes |
|----------|--------|-------|
| OWASP Top 10 | 🟢 Good | Rate limiting, CSP, CSRF protection implemented |
| GDPR | 🟡 Partial | Audit logging needed for compliance |
| SOC 2 | 🔴 No | Requires significant additional controls |
| HIPAA | N/A | Not applicable (not healthcare data) |

#### Security Hardening Roadmap

**Phase 1: Critical ✅ COMPLETED (2026-03-13)**
1. ✅ Implement rate limiting on all endpoints
   - D1-based rate limiting with 8 tiers
   - Applied to all public endpoints
   - IP-based throttling with rolling windows
2. ✅ Add security headers (CSP, HSTS, X-Frame-Options)
   - Content-Security-Policy implemented
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Referrer-Policy, Permissions-Policy
3. ⏳ Fix OAuth state parameter validation (PENDING)

**Phase 2: High Priority (Next Sprint)**
4. Strengthen password policy
   - 12 characters minimum
   - Require uppercase, lowercase, number, special character
   - Check against common password lists
5. Implement token versioning
   - Add token_version column to users table
   - Include version in JWT payload
   - Increment version on password change
6. Add comprehensive audit logging
   - Log admin actions, authentication events, sensitive operations
   - Store user_id, action, resource_type, ip_address, timestamp
   - Queryable audit log interface
7. ⏳ Improve file upload validation (ENHANCED)
   - Type whitelist (JPG, PNG, WebP, PDF)
   - Max file size: 5MB
   - Filename validation (path traversal prevention)
8. Sanitize error messages

**Phase 3: Medium Priority (Month 2)**
9. Tighten CORS configuration
10. Implement refresh token pattern
11. Restrict debug page access
12. Consider httpOnly cookies for tokens

---

## Testing Architecture

### Current Status (2026-03-05)

**Test Coverage: 0% 🔴** - Critical Gap Identified

```yaml
Test Framework: Vitest 2.1.4 ✅ (Installed and configured)
Test Files: 0 ❌
Unit Tests: 0 ❌
Integration Tests: 0 ❌
E2E Tests: 0 ❌
Test Coverage: 0% ❌
```

**Risk Assessment:**
- High risk of regressions during refactoring
- No automated verification of bug fixes
- Unsafe to make changes without manual testing
- Difficult to onboard new developers without test safety net

### Testing Gaps

1. **No Unit Tests**
   - Utility functions (cn(), logger, paymentExport) untested
   - Custom hooks (useAuth) untested
   - React components untested
   - Authentication utilities (JWT, password hashing) untested

2. **No Integration Tests**
   - API endpoints untested
   - Database queries untested
   - Authentication flow untested
   - Payment logic untested

3. **No E2E Tests**
   - Critical user flows untested (login, payment, service requests)
   - Cross-page interactions untested
   - Admin workflows untested

### Testing Roadmap (8-Week Phased Approach)

**Phase 1: Critical Path Coverage (Week 1-2)**
```bash
# Target: 30% coverage of business logic
vitest src/lib/utils.ts                    # Utility functions
vitest src/lib/paymentExport.ts            # Payment calculations
vitest functions/lib/auth.ts               # JWT, password hashing
vitest src/hooks/useAuth.ts                # Auth store
```

**Phase 2: Component Testing (Week 3-4)**
```bash
# Target: 40% coverage of UI components
vitest src/components/auth/ProtectedRoute.tsx
vitest src/components/ui/                  # shadcn/ui components
vitest src/pages/LoginPage.tsx
vitest src/pages/DashboardPage.tsx
```

**Phase 3: API Integration Tests (Week 5-6)**
```bash
# Target: 50% coverage of API endpoints
vitest functions/routes/auth.ts            # Authentication endpoints
vitest functions/routes/payments.ts        # Payment logic
vitest functions/routes/service-requests.ts
```

**Phase 4: E2E Testing (Week 7-8)**
```bash
# Target: Critical user flows
playwright tests/auth.spec.ts              # Login flow
playwright tests/payments.spec.ts          # Payment flow
playwright tests/service-requests.spec.ts  # CRUD flow
```

### Technical Debt Summary

| Issue | Severity | Effort | Risk | Priority |
|-------|----------|--------|------|----------|
| Zero test coverage | 🔴 Critical | 3 weeks | Regressions, unsafe refactoring | Week 1-8 |
| No rate limiting | 🔴 Critical | 1 week | Brute force, DoS attacks | Week 1 |
| Missing security headers | 🔴 Critical | 1 day | XSS, data injection | Week 1 |
| OAuth state not validated | 🔴 Critical | 2 days | CSRF attacks | Week 1 |
| Console logging in prod | 🟠 High | 2 days | Info leakage, performance | Week 1 |
| No CSRF protection | 🟠 High | 1 week | CSRF attacks | Week 2 |
| Weak password policy | 🟠 High | 1 day | Account compromise | Week 2 |
| No token invalidation | 🟠 High | 3 days | Session hijacking | Week 2 |
| Missing audit logging | 🟠 High | 1 week | Compliance gap | Week 3 |
| Large files (1000+ lines) | 🟠 Medium | 1 week | Maintainability | Week 4 |
| No pagination | 🟡 Low | 1 week | Performance at scale | Month 2 |
| Underutilized React Query | 🟡 Low | 2 weeks | Code complexity | Month 2 |

---

## API Design

### RESTful Conventions

```
GET    /api/resource           → List
GET    /api/resource/:id       → Get one
POST   /api/resource           → Create
PUT    /api/resource/:id       → Update
DELETE /api/resource/:id       → Delete
```

### Response Format

**Success**:
```json
{
  "data": { ... }
}
```

**Error**:
```json
{
  "error": "Error message"
}
```

### Key API Endpoints

#### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
GET    /api/auth/google/url
GET    /api/auth/google/callback
```

#### Households & Lots
```
GET    /api/households
GET    /api/households/my-lots
GET    /api/households/:id
GET    /api/data/lots.geojson          # Public, live data
```

#### Service Requests
```
GET    /api/service-requests?status=pending&category=plumbing
POST   /api/service-requests
PUT    /api/service-requests/:id
DELETE /api/service-requests/:id
```

#### Messages
```
GET    /api/messages/threads        # List message threads
GET    /api/messages/threads/:id    # Get thread with messages
POST   /api/messages/threads        # Create new thread
POST   /api/messages/threads/:id    # Reply to thread
```

#### Payments
```
GET    /api/payments/my/:householdId
POST   /api/payments
PUT    /api/payments/:id/status
POST   /api/payments/initiate          # Upload proof
GET    /api/payments/my-pending/verifications
```

#### Lot Members (Household Management)
```
GET    /api/lot-members/my                    # Get current user's lot memberships
GET    /api/lot-members/household/:id         # Get household members
POST   /api/admin/lot-members                 # Assign member to household
PUT    /api/admin/lot-members/:id/verify      # Verify household member
DELETE /api/admin/lot-members/:id             # Remove household member
GET    /api/admin/lot-members/lots/unassigned # Get lots without members
GET    /api/admin/lot-members/pending          # Get pending (unverified) members
```

#### Delinquency Management
```
# Public (member-facing)
GET    /api/my-lots/delinquency-status        # Get current user's delinquency status

# Admin endpoints
GET    /api/admin/delinquency/members           # List all delinquents (manual + automatic)
GET    /api/admin/delinquency/members?type=manual&year=2025  # Filter by type/year
GET    /api/admin/delinquency/member-search?q=john   # Search members for flagging
POST   /api/admin/delinquency/mark             # Flag member as delinquent (requires reason_code + reason_detail)
POST   /api/admin/delinquency/waive/:id         # Waive manual delinquency
POST   /api/admin/delinquency/demands          # Generate payment demands for a year
```

**Delinquency Reason Codes** (`reason_code`):
- `failure_to_pay` - Failure to pay dues despite repeated demands
- `repeated_violation` - Repeated violation or noncompliance (requires `reason_detail`)
- `detrimental_conduct` - Commission of detrimental conduct
- `failure_to_attend` - Failure to attend 3 consecutive general memberships without justifiable reasons

**Mark Delinquent Request**:
```json
{
  "lot_member_id": "uuid",
  "reason_code": "repeated_violation",
  "reason_detail": "Section 5.3 - Noise ordinance violation"  // Required for repeated_violation
}
```

#### Admin (Role-Protected)
```
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/lots/ownership
POST   /api/admin/payments/in-person
PUT    /api/admin/payments/:id/verify
GET    /api/admin/payment-demands
POST   /api/admin/payment-demands/create
```

**Note**: The `/api/admin/households` endpoints are deprecated. Use lot_members API for household management.

---

## State Management

### Client State (Zustand)

**`useAuth`** store:
```typescript
const { user, token, setAuth, clearAuth, initialized } = useAuth();
```

### Server State (TanStack Query)

Although TanStack Query is installed, the current implementation uses direct API calls. Future refactoring could leverage:

```typescript
// Potential pattern for future use
const { data: payments } = useQuery({
  queryKey: ['payments', householdId],
  queryFn: () => api.payments.getMyPayments(householdId)
});
```

### Local Storage

Persistence:
- `hoa_token`: JWT token
- `hoa_user`: User object (JSON)

---

## Component Architecture

### UI Component Library (shadcn/ui)

Based on **Radix UI** primitives with Tailwind styling:

**Available Components**:
- `Button` - Primary, secondary, ghost, destructive variants
- `Card` - Card, CardHeader, CardContent, CardFooter
- `Input` - Text, email, password inputs
- `Label` - Form labels
- `Select` - Dropdown selects
- `Dialog` - Modal dialogs
- `Tabs` - Tabbed content
- `RadioGroup` - Radio button groups
- `Badge` - Status badges
- `Skeleton` - Loading skeletons
- `Sheet` - Side sheets

**Semantic Status Components**:
- `StatusBadge` - Semantic status badges with variants (success, warning, error, info, neutral)
- `Callout` - Info/warning/error/success callout boxes with icons and ARIA roles
- `IconContainer` - Standardized colored icon containers for consistent visual hierarchy
- `LoadingSpinner` - Unified loading spinner with size variants (sm, md, lg)

**Design System - Semantic Status Colors**:
```css
/* Light mode values */
--status-success-bg: 142 100% 90%;    --status-success-fg: 142 76% 26%;
--status-warning-bg: 48 100% 90%;     --status-warning-fg: 48 90% 26%;
--status-error-bg: 0 100% 90%;        --status-error-fg: 0 84% 50%;
--status-info-bg: 217 100% 94%;       --status-info-fg: 217 90% 40%;
--status-neutral-bg: 220 15% 90%;     --status-neutral-fg: 220 15% 30%;
```

**Dark Mode Support**:
- All user-facing pages now use semantic color classes instead of hardcoded values
- Chart components dynamically detect theme changes using MutationObserver
- Consistent color patterns: `bg-background`, `text-muted-foreground`, `border-input`, `bg-primary text-primary-foreground`
- Status colors use CSS variables for automatic theme adaptation: `bg-[hsl(var(--status-success-bg))]`
- Public pages (LandingPage, ExternalRentalsPage) include dark mode toggle in top-right corner
- Theme toggle uses `next-themes` library with `useTheme()` hook for consistent theme management
- Dark mode gradients: `dark:from-gray-900 dark:to-gray-950` for public page backgrounds

**StatusBadge Usage**:
```typescript
<StatusBadge variant="success">Paid</StatusBadge>
<StatusBadge variant="warning">Pending</StatusBadge>
<StatusBadge variant="error">Overdue</StatusBadge>
<StatusBadge variant="info">In Progress</StatusBadge>
<StatusBadge variant="neutral">Vacant</StatusBadge>
```

**Callout Usage**:
```typescript
<Callout variant="error" title="Error Loading Data">
  Failed to load your lots. Please try again.
</Callout>

<Callout variant="success" title="Success" action={<Button>View</Button>}>
  Your payment was processed successfully.
</Callout>
```

**IconContainer Usage**:
```typescript
<IconContainer icon={Home} variant="primary" size="md" />
<IconContainer icon={CheckCircle} variant="success" size="sm" />
```

### Admin Sidebar Notification Badges

**Purpose**: Display real-time notification counts on admin sidebar navigation items.

**Hook**: `useAdminNotificationCounts` (`src/hooks/useAdminNotificationCounts.ts`)

**Implementation**:
- Fetches counts from multiple API endpoints in parallel using `Promise.allSettled()`
- Auto-refreshes every 30 seconds
- Gracefully handles API failures (individual failures don't break the entire feature)

**Badge Locations**:
| Navigation Item | Badge Key | API Endpoint | Count Source |
|-----------------|-----------|--------------|--------------|
| All Bookings | `pendingBookings` | `GET /api/admin/external-rentals/pending` | Pending external rental bookings |
| Notifications | `unreadNotifications` | `GET /api/notifications?read=false` | Unread notifications for admin |
| Messages | `unreadMessages` | `GET /api/messages/threads` | Threads with unread messages |
| Household Approvals | `pendingHouseholdApprovals` | `GET /api/admin/lot-members/pending` | Pending (unverified) lot members |

**Usage Pattern**:
```typescript
// Sidebar component
import { useAdminNotificationCounts } from "@/hooks/useAdminNotificationCounts";

const { counts } = useAdminNotificationCounts();
// counts = { pendingBookings, unreadNotifications, unreadMessages, pendingHouseholdApprovals }
```

**Badge Configuration** (`src/components/admin/Sidebar.tsx`):
```typescript
const baseNavItems: NavItem[] = [
  {
    title: "Reservations",
    children: [
      {
        title: "All Bookings",
        badgeKey: "pendingBookings",  // Maps to counts.pendingBookings
      },
    ],
  },
  // ...
];
```

**UI Rendering**:
- Badges appear as red circular indicators (`bg-primary`) with white text
- Only shown when count > 0
- Positioned with `ml-auto` to align right
- Styled with `rounded-full px-2 py-0.5 text-xs font-medium`

**Type Safety**:
```typescript
interface AdminNotificationCounts {
  pendingBookings: number;
  unreadNotifications: number;
  unreadMessages: number;
  pendingHouseholdApprovals: number;
}

// Badge key is type-checked against counts object
badgeKey?: keyof ReturnType<typeof useAdminNotificationCounts>["counts"];
```

### User/Homeowner Navigation Badges

**Purpose**: Display real-time notification counts on user-facing navigation items.

**Hook**: `useUserNotificationCounts` (`src/hooks/useUserNotificationCounts.ts`)

**Implementation**:
- Fetches counts from multiple API endpoints in parallel using `Promise.allSettled()`
- Auto-refreshes every 30 seconds
- Gracefully handles API failures (individual failures don't break the entire feature)
- Works in both horizontal bar navigation (xl+) and sheet navigation (mobile)

**Badge Locations**:
| Navigation Item | Badge Key | API Endpoint | Count Source |
|-----------------|-----------|--------------|--------------|
| Messages | `unreadMessages` | `GET /api/messages/threads` | Threads with unread messages |
| Notifications | `unreadNotifications` | `GET /api/notifications?read=false` | Unread notifications for user |

**Usage Pattern**:
```typescript
// AppNav component
import { useUserNotificationCounts, type UserNotificationCounts } from "@/hooks/useUserNotificationCounts";

const { counts } = useUserNotificationCounts();
// counts = { unreadNotifications, unreadMessages }
```

**Badge Configuration** (`src/components/layout/nav-items.ts`):
```typescript
export interface NavItem {
  label: string;
  to?: string;
  icon?: LucideIcon;
  roles: Role[];
  children?: NavItem[];
  badgeKey?: keyof UserNotificationCounts;  // Maps to counts object
}

export const navItems: NavItem[] = [
  {
    label: "Communications",
    children: [
      {
        to: "/messages",
        label: "Messages",
        badgeKey: "unreadMessages",  // Maps to counts.unreadMessages
      },
      {
        to: "/notifications",
        label: "Notifications",
        badgeKey: "unreadNotifications",  // Maps to counts.unreadNotifications
      },
    ],
  },
  // ...
];
```

**UI Rendering**:
- Badges appear as primary-colored circular indicators (`bg-primary`) with white text
- Only shown when count > 0
- Positioned with `ml-auto` to align right in navigation items
- Styled with `rounded-full px-2 py-0.5 text-xs font-medium`
- Displays in both desktop horizontal menu and mobile sheet navigation

**Type Safety**:
```typescript
export interface UserNotificationCounts {
  unreadNotifications: number;
  unreadMessages: number;
}

// Badge key is type-checked against counts object
badgeKey?: keyof UserNotificationCounts;
```

### My Lots Components (Resident-Facing)

**Purpose**: Allow primary owners to manage household members directly from the My Lots page.

**Components**:
- **`HouseholdMembersPanel`** (`src/components/my-lots/HouseholdMembersPanel.tsx`)
  - Displays list of household members for a given lot
  - Shows verification status (green checkmark for verified, yellow alert for pending)
  - Shows member type (Primary Owner vs Secondary Member)
  - Allows primary owners to remove members
  - Includes callback for data refresh after changes

- **`AddMemberDialog`** (`src/components/my-lots/AddMemberDialog.tsx`)
  - Modal dialog for adding new household members
  - Email input with fuzzy search suggestions from existing users
  - Radio buttons for member type selection (Primary Owner vs Secondary)
  - Optional notes field for recording relationship context
  - Uses `api.lotMembers.assignMember()` endpoint

**Usage in MyLotsPage**:
```typescript
// My Lots page uses expandable rows
{lots.map((lot) => (
  <React.Fragment key={lot.lot_id}>
    {/* Main lot row with "Members" button */}
    <tr>
      ...
      <button onClick={() => toggleLotExpanded(lot.lot_id)}>
        <Users /> View Members
      </button>
    </tr>
    {/* Expandable member management row */}
    {expandedLots.has(lot.lot_id) && (
      <tr>
        <td colSpan={9}>
          <HouseholdMembersPanel
            householdId={lot.lot_id}
            lotAddress={lot.address}
            isPrimaryOwner={true}
            onMemberChange={handleMemberAdded}
          />
          <AddMemberDialog
            open={showAddMemberDialog}
            onOpenChange={setShowAddMemberDialog}
            householdId={lot.lot_id}
            onSuccess={handleMemberAdded}
          />
        </td>
      </tr>
    )}
  </React.Fragment>
))}
```

### Admin Lot Management Components

**Purpose**: Allow admins to manage lot ownership and household members.

**Components**:
- **`LotsManagementPage`** (`src/components/admin/lots/LotsManagementPage.tsx`)
  - Admin interface for managing all lots
  - Tabs: Unassigned, Assigned, All Lots
  - Lot cards with Edit, Assign Owner, View Members actions
  - Sliding sheet for household member management
  - Uses `api.lotMembers.*` endpoints for member operations

- **`AssignMemberDialog`** (`src/components/admin/lots/AssignMemberDialog.tsx`)
  - Admin version of member assignment dialog
  - Email search with user suggestions
  - Member type and notes fields
  - Supports both existing users and new member invitations

### NavigationMenu Component (Custom Implementation)

**Background**: The Radix UI NavigationMenu primitive uses a complex "viewport" system with CSS variables (`--radix-navigation-menu-viewport-left`, `--radix-navigation-menu-viewport-width`) to position dropdown content. This system proved unreliable in this project's setup, causing dropdowns to appear misaligned (centered or under the first item) regardless of configuration attempts.

**Solution**: Bypassed the viewport system entirely and implemented direct absolute positioning:

1. **Removed Viewport Component**: Eliminated `NavigationMenuViewport` wrapper div from the Root component
2. **NavigationMenuItem as Positioning Context**: Made `NavigationMenuItem` a `forwardRef` component with `relative` class to provide positioning context for content
3. **Direct Absolute Positioning**: `NavigationMenuContent` uses `absolute top-full left-0` to position directly under each trigger
4. **Header Overflow**: Added `overflow-visible` to header to prevent dropdowns from being clipped

**File**: `src/components/ui/navigation-menu.tsx`

```tsx
const NavigationMenuItem = React.forwardRef<...>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Item
    ref={ref}
    className={cn("relative", className)}  // ← Provides positioning context
    {...props}
  />
));

const NavigationMenuContent = React.forwardRef<...>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      "absolute top-full left-0 mt-1.5 z-50",  // ← Direct positioning
      "min-w-[180px] rounded-md border bg-popover text-popover-foreground shadow-lg",
      "data-[state=closed]:hidden",
      className
    )}
    {...props}
  />
));
```

**Benefits**:
- Dropdowns position correctly under each trigger
- No CSS variable dependencies or complex viewport calculations
- Maintains all Radix keyboard navigation and accessibility features
- Simpler, more predictable behavior

### ESLint Configuration

**TypeScript Parser Setup**: The project uses ESLint 9+ with flat config format for TypeScript support.

**File**: `eslint.config.js`

```javascript
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-unused-vars': 'off', // TypeScript version is used instead
    },
  },
];
```

**Key Configuration**:
- Uses `@typescript-eslint/parser` for parsing TypeScript and JSX
- Flat config object format (required for ESLint 9+)
- TypeScript-specific rules with proper unused variable handling
- `ignoreRestSiblings: true` allows ignoring rest parameters in destructuring

### Utility Functions

**`cn()`** - className merging:
```typescript
import { cn } from "@/lib/utils";
cn("base-class", isActive && "active-class", "another-class");
```

### Layout Components

**MainLayout** (`src/components/layout/MainLayout.tsx`):
```
┌─────────────────────────────────────┐
│ Header (Logo, User Menu, Theme)    │
├──────────┬──────────────────────────┤
│          │                          │
│ Sidebar  │  Page Content            │
│ (Nav)    │  (Outlet)                │
│          │                          │
└──────────┴──────────────────────────┘
```

**Responsive Breakpoints**:
- Desktop: Sidebar visible
- Mobile: Bottom navigation bar

---

## Deployment Architecture

### Cloudflare Pages (Frontend)

**Build Configuration**:
```yaml
Build command: npm run build
Build output: dist/
Root directory: /
```

**Environment Variables** (via Wrangler):
- `JWT_SECRET`: JWT signing secret
- `ALLOWED_ORIGINS`: CORS allowlist
- `GOOGLE_CLIENT_ID`: OAuth client ID
- `GOOGLE_CLIENT_SECRET`: OAuth client secret
- `GOOGLE_REDIRECT_URI`: Callback URL

### Cloudflare D1 (Database)

**Database**: `laguna_hills_hoa`

**Migrations**:
```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0001_base_schema.sql --local
npx wrangler d1 migrations apply laguna_hills_hoa --remote
```

### Cloudflare R2 (Storage)

**Bucket**: `lhs-hoa-documents`

Used for:
- Uploaded documents (PDFs, forms)
- Payment proof images
- Employee photos

### Deployment Workflow

```bash
# 1. Deploy frontend
npm run build
npx wrangler pages deploy dist

# 2. Deploy functions (auto-deployed with pages)

# 3. Run database migrations
npx wrangler d1 migrations apply laguna_hills_hoa --remote
```

### Local Development

```bash
# Start both frontend and backend
./dev.sh

# Or separately:
npm run dev              # Frontend on :5173
npx wrangler pages dev dist --port 8787  # Backend on :8787
```

**Proxy Configuration** (vite.config.ts):
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:8787',
    changeOrigin: true,
  },
}
```

---

## Development Workflow

### Git Workflow

**Feature Branches with Worktrees**:
```bash
# Create isolated worktree for feature
git worktree add .worktrees/feature-name -b feature/feature-name

# Work in isolated directory
cd .worktrees/feature-name

# After merge, cleanup
git worktree remove --force .worktrees/feature-name
git branch -d feature/feature-name
```

### Code Quality

**TypeScript**:
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`
- No unused locals/parameters

**Linting & Formatting**:
```bash
npm run lint       # ESLint
npm run format     # Prettier
```

**Build Verification**:
```bash
npm run build      # TypeScript compilation + Vite build
```

### Testing

**Note**: The project currently has **0 tests configured**. Verification is done via:
- TypeScript compilation
- Manual testing with `npm run dev:all`
- Build validation

### Gotchas & Common Pitfalls

1. **API Endpoint Prefix**:
   - ❌ Wrong: `apiRequest('/api/auth/login')`
   - ✅ Correct: `apiRequest('/auth/login')` (prefix is auto-added)

2. **Cloudflare Workers JWT**:
   - Use `jose` library, NOT `jsonwebtoken`
   - `jsonwebtoken` requires Node.js crypto (unavailable in Workers)

3. **SQL Injection Safety**:
   - ✅ Safe: `.bind(param1, param2)`
   - ❌ Unsafe: String interpolation in queries

4. **Household Access Control** (use `lot_members` table):
   ```sql
   -- Check if user can access household (verified primary owner)
   SELECT h.id FROM households h
   JOIN lot_members lm ON lm.household_id = h.id
   WHERE h.id = ? AND lm.user_id = ?
     AND lm.member_type = 'primary_owner' AND lm.verified = 1
   ```
   Or use the `canAccessHousehold` helper from `functions/lib/lot-access.ts`

5. **Common Areas (HOA-owned)**:
   - `owner_user_id = 'developer-owner'`
   - `lot_type IN ('community', 'utility', 'open_space')`
   - These don't pay dues or vote

6. **Nullish Coalescing for Optional Fields**:
   - When updating optional text fields (street, block, lot), use `??` not `||`
   - `||` converts empty strings to null (loses user input)
   - `??` only converts `null`/`undefined` to null (preserves empty strings)
   - Example: `values.push(street ?? null)` not `values.push(street || null)`

7. **SQLite Boolean Handling**:
   - SQLite stores booleans as `0` or `1` (integers)
   - When loading from database, convert to proper boolean: `Boolean(dbValue)`
   - When saving, Zod expects actual boolean, not number

---

## Architecture Decision Records

### Why Cloudflare Workers/Pages?

**Decision**: Serverless edge computing over traditional VPS

**Rationale**:
- Zero cold starts (global edge network)
- Automatic HTTPS
- Pay-per-use pricing
- No server maintenance
- D1 database for serverless SQL

### Why Hono over Express?

**Decision**: Hono framework for Workers

**Rationale**:
- Native Workers compatibility
- Smaller bundle size
- Faster startup
- Similar API to Express

### Why Zustand over Redux?

**Decision**: Zustand for state management

**Rationale**:
- Simpler API (no providers/actions/reducers)
- Less boilerplate
- TypeScript-friendly
- Sufficient for app's complexity

### Why shadcn/ui over Material-UI?

**Decision**: shadcn/ui (Radix + Tailwind)

**Rationale**:
- Full customization control
- No component library lock-in
- Smaller bundle (copy-paste what you use)
- Accessible by default (Radix primitives)

### Why Leaflet over Google Maps?

**Decision**: Leaflet for mapping

**Rationale**:
- No API key required
- Open-source
- Custom GeoJSON support
- Lightweight (< 50KB)

---

## Future Considerations

### Immediate Priorities (Week 1-4)

#### Security Hardening (Critical)
1. **Rate Limiting** - Implement Cloudflare Workers KV-based rate limiting
   - 100 requests/15min general endpoints
   - 5 requests/5min authentication endpoints
   - IP-based throttling with sliding window

2. **Security Headers** - Add comprehensive security headers
   - Content Security Policy (CSP)
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Strict-Transport-Security (HSTS)

3. **OAuth State Validation** - Fix CSRF vulnerability in Google OAuth
   - Generate cryptographically secure state tokens
   - Store in KV with 10-minute expiration
   - Validate on callback before processing

4. **CSRF Protection** - Add CSRF tokens for form mutations
   - Generate tokens on page load
   - Validate on POST/PUT/DELETE requests
   - SameSite cookie configuration

5. **Password Policy** - Strengthen password requirements
   - 12 characters minimum
   - Require uppercase, lowercase, number, special character
   - Check against common password lists

6. **Token Versioning** - Invalidate sessions on password change
   - Add token_version column to users table
   - Include version in JWT payload
   - Increment version on password change

7. **Audit Logging** - Implement comprehensive audit trail
   - Log admin actions, authentication events, sensitive operations
   - Store user_id, action, resource_type, ip_address, timestamp
   - Queryable audit log interface

8. **Error Handling** - Sanitize error messages
   - Implement ApiError class for consistent error responses
   - Log full errors internally
   - Return user-friendly messages externally

#### Code Quality (High)
9. **Remove Console Logging** - Replace with proper logging library
   - Environment-aware logger (dev vs production)
   - Structured logging with levels
   - Performance and security event logging

10. **React Error Boundaries** - Add graceful error handling
    - Wrap application routes in error boundaries
    - Implement error fallback UI
    - Log errors to monitoring service

### Scalability

- **D1 Limits**: Current 5GB database limit (sufficient for 500-1000 households)
- **R2 Storage**: Unlimited object storage
- **Workers**: 100ms CPU time limit per request (monitoring needed for complex queries)
- **Monitoring**: Implement query performance tracking

### Performance Optimization

- **Response Caching** - Add Cache-Control headers for static data
  - Announcements: 5 minutes
  - Documents: 1 hour
  - GeoJSON: 5 minutes with revalidation

- **Database Query Caching** - Cache expensive operations
  - Dashboard statistics (5 min cache)
  - Payment calculations (1 min cache)
  - User permission checks (15 min cache)

- **GeoJSON Optimization** - Pre-compute and cache
  - Generate on schedule (every 5 minutes)
  - Store in R2 for fast retrieval
  - Invalidate on household/lot changes

- **Pagination** - Implement for large datasets
  - Users: 50 per page
  - Payments: 100 per page
  - Service requests: 50 per page
  - Include total count for UI

- **Bundle Optimization** - Reduce JavaScript bundle size
  - Implement code splitting for admin routes
  - Lazy load heavy components
  - Analyze with vite-bundle-visualizer

- **TanStack Query Integration** - Leverage for server state
  - Replace direct API calls in components
  - Implement caching and revalidation
  - Add optimistic updates for mutations

### Testing Strategy (8-Week Roadmap)

**Phase 1: Critical Path (Week 1-2)**
- Unit tests for utilities (cn, logger, paymentExport)
- Unit tests for auth functions (JWT, password hashing)
- Unit tests for payment calculations

**Phase 2: Component Tests (Week 3-4)**
- ProtectedRoute component tests
- LoginPage tests
- DashboardPage tests
- Payment form tests

**Phase 3: Integration Tests (Week 5-6)**
- Authentication flow tests
- Payment processing tests
- Service request CRUD tests
- Admin operations tests

**Phase 4: E2E Tests (Week 7-8)**
- Login → Dashboard → Make Payment flow
- Admin → Create User → Assign Lot flow
- Service Request → Submit → Track → Complete flow
- Cross-browser testing (Chrome, Firefox, Safari)

### CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
on: [push, pull_request]
jobs:
  test:
    - Run linter (ESLint)
    - Run TypeScript compiler check
    - Run unit tests (Vitest)
    - Run integration tests
    - Build production bundle

  deploy-preview:
    - Deploy to Cloudflare Pages preview
    - Run E2E tests against preview
    - Comment results on PR

  deploy-production:
    - On merge to main
    - Run full test suite
    - Deploy to production
    - Run smoke tests
```

### Monitoring & Observability

- **Error Tracking** - Integrate Sentry or similar
  - Capture client-side errors
  - Capture server-side errors
  - Aggregate and alert on critical issues

- **Performance Monitoring** - Track key metrics
  - API response times (p50, p95, p99)
  - Database query performance
  - Bundle load times
  - Core Web Vitals (LCP, FID, CLS)

- **Security Monitoring** - Track security events
  - Failed login attempts (per IP, per user)
  - Rate limit violations
  - Suspicious API patterns
  - Audit log alerts

### Developer Experience

- **Component Storybook** - Document UI components
  - Visual documentation of all components
  - Interactive component playground
  - Accessibility testing integration

- **API Documentation** - Auto-generate from OpenAPI spec
  - Document all endpoints with examples
  - Type definitions from TypeScript
  - Interactive API explorer

- **Development Tools** - Improve local development
  - Hot module reload for backend changes
  - Database seeding script for test data
  - Debug page with auth state viewer (admin-only)

---

## Document Metadata

**Last Updated**: 2026-03-15
**Version**: 1.13.0
**Status**: Production System (Unified Booking System)
**Maintained By**: Development Team

**Recent Updates (v1.13.0)**:
- Public API security fixes (DTO layer, reference number validation)
  - Created `functions/lib/public-api-dtos.ts` with Zod schemas for all public API responses
  - Created `functions/lib/reference-numbers.ts` for reference number format validation
  - Added migration 0032: `reference_number_mappings` table for type-based reference number validation
  - Created legacy API isolation in `functions/routes/public-v1.ts` for version-specific fixes
  - Prevents database structure disclosure through enum value exposure
  - All public API responses now use DTO layer with type-safe transformations
  - Reference number validation ensures `RES-YYYYMMDD-XXX` and `EXT-YYYYMMDD-XXX` formats
- User/Homeowner notification badges
  - Added `useUserNotificationCounts` hook (`src/hooks/useUserNotificationCounts.ts`)
  - Real-time badge counts for Messages and Notifications in user navigation
  - Auto-refreshes every 30 seconds using parallel API requests
  - Graceful error handling - individual API failures don't break the feature
  - Type-safe badge key configuration mapped to counts object
  - Displays in both desktop horizontal menu and mobile sheet navigation
  - Added `src/pages/admin/test/NotificationBadgeTestPage.tsx` for badge testing
- Timeline phase indicator for booking details
  - Added `StatusPhaseIndicator` to `BookingDetailsPage.tsx` (resident bookings)
  - Added `StatusPhaseIndicator` to `ConfirmationPage.tsx` (external bookings)
  - Visual 4-phase timeline: Submitted → Payment → Verified → Confirmed
  - Special terminal state handling for Rejected, Cancelled, No Show statuses
  - Clear visual feedback for booking workflow progress
- External booking availability optimization
  - Optimized `useCalendarAvailability.ts` to use single range query instead of parallel requests
  - Reduced API calls from ~30 requests/month to 1 request/month for external bookings
  - Fixed slot blocking display bug - all fetched dates are now cached, not just requested ones
  - Improved calendar performance and data completeness for external users
- Security documentation additions
  - Added `docs/security/2026-03-15-public-api-security-audit.md` - security audit findings
  - Added `docs/security/2026-03-15-security-fixes-implementation.md` - implementation details

**Recent Updates (v1.12.2)**:
- Admin sidebar notification badges
  - Added `useAdminNotificationCounts` hook for real-time badge counts
  - Badges auto-refresh every 30 seconds using parallel API requests
  - Displays counts for: pending bookings, unread notifications, unread messages, pending household approvals
  - Graceful error handling - individual API failures don't break the feature
  - Type-safe badge key configuration mapped to counts object

**Recent Updates (v1.12.1)**:
- Fixed foreign key constraints for unified booking system
  - Migration 0029: Fix booking_blocked_dates FK to reference bookings(id)
  - Migration 0030: Fix verification_tokens FK to reference bookings(id)
  - Preserves existing data while fixing constraint violations
- Enhanced booking status configuration
  - Added `next_status` for workflow transitions
  - Added `action_button_text` for status-specific actions
  - Added `can_approve`, `can_reject`, `can_cancel` flags
  - Improved admin workflow with clear action buttons
- Updated all booking components to use enhanced status config
  - UnifiedBookingForm uses next_status for workflow
  - BookingHistory uses action_button_text for actions
  - BookingStatusPage shows appropriate actions per status
  - UnifiedBookingsTab uses new status config for admin actions
- Updated useCalendarAvailability for unified bookings
- Updated useAuth for guest authentication support

**Recent Updates (v1.12.0)**:
- Unified booking system with single `bookings` table (migration 0028)
  - Replaced separate `reservations` and `external_rentals` tables
  - Simplified status workflow: submitted → payment_due → payment_review → confirmed
  - Shared terminal states: confirmed, rejected, cancelled, no_show
  - Explicit `workflow` column for clear customer type separation (resident/external)
  - Compatibility views for backward compatibility with existing code
- New `customers` table for external guest management
  - Guest information stored separately from bookings
  - Guests can make multiple bookings without re-entering data
  - IP retention tracking for GDPR compliance
- Centralized booking status configuration (`src/lib/booking-status.ts`)
  - Status labels, colors, icons for all booking states
  - Valid transitions by customer type (resident/external)
  - Helper functions: `isTerminalStatus()`, `allowsPayment()`, `allowsCancellation()`
  - `getStatusColorClasses()` returns dark mode compatible color classes
- New booking pages (`src/pages/bookings/`)
  - `BookingDetailsPage` - view booking details with status badge
  - `BookingPaymentPage` - upload payment proof for pending bookings
- New booking components (`src/components/booking/`)
  - `CalendarDayCell` - individual day cell with booking indicators
  - `CalendarLegend` - color legend for calendar states
  - `UnifiedBookingCalendar` - unified calendar for all bookings
  - `useCalendarAvailability` - custom hook for availability data
- New public inquiry workflow pages (`src/pages/public/`)
  - `InquiryPage` - initial inquiry form for external guests
  - `InquiryPaymentPage` - payment after inquiry approval
  - `InquiryPendingPage` - pending inquiry status tracker
  - `StatusCheckPage` - check status by reference number
- Guest authentication support via `useAuth` hook
  - Optional customer authentication for external guests
  - Separate from user authentication flow
- Updated API routes for unified booking system
  - `/api/bookings/*` - unified booking endpoints (replaces separate routes)
  - `functions/routes/bookings.ts` - handles both resident and external bookings
  - `functions/routes/public.ts` - public inquiry and status endpoints
- Updated types to support unified bookings and customers table
  - `BookingWithCustomer` type includes customer data for external bookings
  - `Customer` type for guest records

**Recent Updates (v1.11.0)**:
- Public layout wrapper for consistent browsing experience
  - Created `PublicLayout.tsx` component that wraps `PublicPageHeader` with consistent container
  - All public booking pages now use `PublicLayout` for uniform spacing, max-width, and navigation
  - Hero sections on amenity pages use negative margins to extend beyond container (`-mx-4 sm:-mx-8 mt-[-2rem]`)
  - Centered amenity cards grid (2 columns instead of 4) for better visual balance
  - Prominent "Book Now" buttons with Calendar icon and larger size (`size="lg"`)
- Enhanced dark mode support for all public booking pages
  - Updated status colors in `ConfirmationPage` with proper dark mode variants
  - Fixed all colored cards (green, blue, yellow, orange, red) with dark theme support
  - Replaced hardcoded colors with semantic CSS variables (`bg-background`, `bg-card`, `border-border`)
  - `SuccessPage` gradient now respects dark mode (`dark:from-green-950/20 dark:to-background`)
- Fixed double data wrapper bug in payment-details endpoint
  - Backend now returns `{ gcash: {...}, bank_transfer: {...} }` instead of `{ data: {...} }`
  - Prevents `TypeError: can't access property "name", d.gcash is undefined`

**Recent Updates (v1.9.0)**:
- Public landing page with resident/visitor path selection
  - Created `LandingPage.tsx` as new root route (/) with dual-path entry
  - Residents can click "Resident Login" to access the member portal
  - Visitors can click "Book Amenity" to browse and book amenities without authentication
  - Added dark mode toggle button to landing page (top-right corner)
  - Responsive two-card layout with feature lists for each user type
- Dark mode support for external bookings
  - Added theme toggle to `ExternalRentalsPage.tsx` with sun/moon icon animation
  - Added "Back to Home" button for navigation from external rentals to landing page
  - Dark mode gradients: `dark:from-gray-900 dark:to-gray-950` for page backgrounds
  - Fixed "How It Works" card with proper dark mode colors (`dark:bg-gray-800 dark:text-gray-100`)
- Updated navigation flow
  - Root path (/) now redirects to landing page instead of dashboard
  - LoginPage includes "Book Amenity as Visitor" button for non-resident bookings
  - Clear separation between resident portal and public booking system
  - All public pages support dark mode via `next-themes` integration

**Recent Updates (v1.8.0)**:
- Structured delinquency flagging with bylaw-compliant reason codes
  - Added `reason_code` and `reason_detail` columns to `manual_delinquencies` table (migration 0020)
  - Implemented four bylaw grounds: failure_to_pay, repeated_violation, detrimental_conduct, failure_to_attend
  - Added member search endpoint for admin flagging workflow
  - Created FlagMemberDialog component with 3-step wizard (search → reason → confirm)
  - Updated mark endpoint to validate structured reasons (repeated_violation requires rule citation)
  - Added "Flag Member" button to DelinquencyPage with destructive variant styling

**Recent Updates (v1.7.0)**:
- Comprehensive dark mode consistency improvements
  - Fixed hardcoded colors in MainLayout, LateFeeConfig, and multiple page components
  - Made chart components (PaymentChart, RequestStatusChart) theme-aware with dynamic theme detection
  - Replaced hardcoded Tailwind colors with semantic CSS variables throughout user-facing pages
  - Fixed WhitelistManagementPage, PassesPage, PassManagementPage, DuesConfigPage, CommonAreasPage
  - Established consistent use of status color variables (hsl(var(--status-*-bg/fg)))
  - Charts now use MutationObserver to detect theme changes and update colors dynamically
  - Overall consistency improved between light and dark modes across the application

**Recent Updates (v1.6.0)**:
- Consolidated architecture documentation
  - Merged comprehensive Pass Management System documentation from deprecated architecture.md
  - Documented unified pass management architecture with pass_types, vehicle_passes, household_employees tables
  - Added API endpoints, frontend components, and extensibility guides for pass system
  - Added ESLint configuration documentation (TypeScript parser setup)
  - Documented NavigationMenu custom implementation (direct absolute positioning)
  - Removed deprecated architecture.md file to eliminate confusion
- ESLint TypeScript parser configuration
  - Configured @typescript-eslint/parser for TypeScript/JSX parsing
  - Fixed CI/CD pipeline errors related to TypeScript syntax parsing
  - Added proper unused variable handling with ignore patterns

**Recent Updates (v1.5.0)**:
- Unified site design with semantic status components
  - Created `StatusBadge` component with semantic variants (success, warning, error, info, neutral)
  - Created `Callout` component for info/warning/error/success boxes with ARIA roles
  - Created `IconContainer` component for standardized colored icon containers
  - Created `LoadingSpinner` component for unified loading indicators
  - Added CSS variables for semantic status colors with light/dark mode support
  - Updated all pages to use new components for consistent status indicators
  - Replaced custom Tailwind color classes with CSS variable-based components
  - Improved accessibility with proper ARIA attributes on status components
- Pages updated with new components:
  - HouseholdMembersPanel - Use StatusBadge for verification status
  - DashboardPage - Use StatusBadge, Callout, LoadingSpinner
  - MyLotsPage - Replace custom badges and callouts with semantic components
  - LoginPage - Use Callout for errors, Button/Input components
  - AdminLotsPage/AdminPanelPage - Use Callout for errors, LoadingSpinner
  - ServiceRequestsPage - Use StatusBadge for request status/priority
  - PaymentsPage - Use StatusBadge, Callout, Dialog components

**Recent Updates (v1.4.0)**:
- Implemented proper admin layout structure with AdminLayout component
  - Created `src/pages/admin/AdminLayout.tsx` with persistent sidebar
  - Updated `src/App.tsx` to wrap admin routes with AdminLayout
  - Refactored `src/pages/AdminPanelPage.tsx` to remove duplicate sidebar rendering
  - Moved charts (PaymentChart, RequestStatusChart) to admin dashboard
- Created dedicated user management pages
  - Added `/admin/users` route with UsersSection component
  - Separated users functionality into dedicated pages from admin dashboard
- Refactored dashboards for clear separation of concerns
  - Resident dashboard (`DashboardPage.tsx`) - User-centric with My Properties, Quick Actions, Announcements
  - Admin dashboard (`AdminPanelPage.tsx`) - Admin-centric with system stats, charts, and quick actions
  - Removed system-wide stats from resident dashboard
- Admin sidebar improvements
  - Added right margin (`mr-1`) to chevron icons and badges for better spacing
- Fixed resident dashboard property display
  - Changed from `api.dashboard.getStats()` to `api.households.getMyLots()` for fetching user's lots
  - Fixed "No Properties Linked" issue for users with lots

**Recent Updates (v1.3.0)**:
- Added resident-facing household member management to My Lots page
  - Created `src/components/my-lots/HouseholdMembersPanel.tsx` for member display/management
  - Created `src/components/my-lots/AddMemberDialog.tsx` for adding household members
  - Updated `MyLotsPage.tsx` with expandable rows for inline member management
- Removed obsolete Households tab from Admin Panel Page
  - Address management moved to AdminLotsPage (map-based)
  - Member management moved to LotsManagementPage (admin) or My Lots (resident)
- Updated lot_members table documentation as source of truth for ownership
  - Deprecated `households.owner_id` column (use lot_members instead)
  - Added lot_members API endpoints documentation
- Updated project structure to include `src/components/my-lots/` and `src/components/admin/lots/`

**Recent Updates (v1.2.0)**:
- Added `messages.ts` route to functions directory (was missing, causing 404s)
- Removed obsolete `worker/` directory (duplicate/conflicting codebase)
- Fixed household street field save bug (nullish coalescing `??` instead of `||`)
- Updated household schema to use `street` field with auto-generated `address`
- Fixed `is_primary` boolean conversion from SQLite's 0/1 numbers
- Updated project structure to reflect single codebase (functions/ only)

**Recent Updates (v1.1.0)**:
- Added comprehensive Security Status section with current gaps and roadmap
- Added Testing Architecture section documenting 0% coverage gap
- Added Technical Debt Summary with prioritized remediation plan
- Updated Future Considerations with audit-based priorities
- Documented security hardening roadmap (8-week phased approach)
- Added compliance status (OWASP Top 10, GDPR, SOC 2)
- Added CI/CD pipeline specification
- Added monitoring and observability recommendations

**Related Documents**:
- `AUDIT_REPORT.md` - Comprehensive codebase audit (health score: 8.5/10)
- `SECURITY_AUDIT_REPORT.md` - Security vulnerability assessment (20 findings)
- `CLAUDE.md` - Implementation guide for AI assistants
- `README.md` - Project overview and setup guide

---

**For implementation details, see**: `CLAUDE.md`
**For deployment guide, see**: `DEPLOYMENT.md`
**For project overview, see**: `README.md`
