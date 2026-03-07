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

1. **User Management**: Authentication, roles, Google OAuth SSO
2. **Household & Lot Management**: Property records, lot mapping
3. **Service Requests**: Maintenance request tracking
4. **Reservations**: Amenity booking system
5. **Payments**: Dues management, payment tracking, verification queue
6. **Communications**: Announcements, events, notifications
7. **Polling**: Community voting system
8. **Document Repository**: HOA rules, forms, minutes
9. **Pass Management**: Employee and vehicle pass system
10. **Admin Tools**: System configuration, bulk operations

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
│   │   └── auth.ts               # JWT, password hashing, Google OAuth
│   ├── routes/                   # API endpoint handlers
│   │   ├── auth.ts               # /api/auth/*
│   │   ├── announcements.ts      # /api/announcements/*
│   │   ├── dashboard.ts          # /api/dashboard/*
│   │   ├── documents.ts          # /api/documents/*
│   │   ├── events.ts             # /api/events/*
│   │   ├── households.ts         # /api/households/*
│   │   ├── notifications.ts      # /api/notifications/*
│   │   ├── pass-management.ts    # /api/pass-requests/*
│   │   ├── payments.ts           # /api/payments/*
│   │   ├── polls.ts              # /api/polls/*
│   │   ├── reservations.ts       # /api/reservations/*
│   │   ├── service-requests.ts   # /api/service-requests/*
│   │   └── admin.ts              # /api/admin/* (admin-only)
│   └── types/
│       └── index.ts              # Shared TypeScript types
│
├── src/                          # Frontend Source
│   ├── components/
│   │   ├── ui/                   # shadcn/ui base components
│   │   ├── auth/                 # Authentication components
│   │   ├── layout/               # Layout components (Header, Sidebar, Nav)
│   │   ├── theme/                # Theme provider & toggle
│   │   ├── search/               # Command palette
│   │   ├── charts/               # Recharts wrappers
│   │   └── skeletons/            # Loading skeletons
│   ├── hooks/                    # Custom React hooks
│   │   └── useAuth.ts            # Authentication state (Zustand)
│   ├── lib/
│   │   ├── api.ts                # API client & request helpers
│   │   ├── utils.ts              # Utility functions (cn())
│   │   ├── logger.ts             # Client-side logging
│   │   ├── content/              # i18n labels & messages
│   │   └── paymentExport.ts      # CSV export utilities
│   ├── pages/                    # Page components
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── MapPage.tsx
│   │   ├── ServiceRequestsPage.tsx
│   │   ├── ReservationsPage.tsx
│   │   ├── PaymentsPage.tsx
│   │   ├── AnnouncementsPage.tsx
│   │   ├── EventsPage.tsx
│   │   ├── PollsPage.tsx
│   │   ├── DocumentsPage.tsx
│   │   ├── NotificationsPage.tsx
│   │   ├── PassesPage.tsx
│   │   ├── MyLotsPage.tsx
│   │   ├── CommonAreasPage.tsx
│   │   ├── DebugPage.tsx
│   │   ├── AdminPanelPage.tsx
│   │   ├── AdminLotsPage.tsx
│   │   ├── DuesConfigPage.tsx
│   │   ├── InPersonPaymentsPage.tsx
│   │   ├── PassManagementPage.tsx
│   │   └── WhitelistManagementPage.tsx
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
│   └── 0008_seed_data.sql
│
├── scripts/                      # Utility scripts
│   ├── svg-to-geojson.ts         # Convert SVG map to GeoJSON
│   └── lot-mapping.json          # Lot annotation mapping
│
├── docs/                         # Documentation
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
├── /login (public)
└── / (protected - MainLayout)
    ├── /dashboard
    ├── /map
    ├── /service-requests
    ├── /reservations
    ├── /my-lots
    ├── /passes
    ├── /payments
    ├── /documents
    ├── /announcements
    ├── /events
    ├── /polls
    ├── /notifications (admin, resident, staff)
    ├── /debug
    └── /admin/* (admin-only)
        ├── /admin/lots
        ├── /admin/dues
        ├── /admin/payments/in-person
        ├── /admin/common-areas
        ├── /admin/pass-management
        └── /admin/whitelist
```

### Component Hierarchy

```
App
└── BrowserRouter
    └── Routes
        ├── LoginPage (unprotected)
        └── ProtectedRoute
            └── MainLayout
                ├── Sidebar
                ├── Header
                ├── BottomNav (mobile)
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
    SELECT h.id, h.block, h.lot, h.owner_id, u.email
    FROM households h
    LEFT JOIN users u ON h.owner_id = u.id
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
  address TEXT NOT NULL,
  street TEXT,
  block TEXT,
  lot TEXT,
  latitude REAL,
  longitude REAL,
  map_marker_x REAL,
  map_marker_y REAL,
  owner_id TEXT REFERENCES users(id),
  lot_status TEXT DEFAULT 'vacant_lot',
  lot_type TEXT DEFAULT 'residential',
  lot_size_sqm REAL,
  lot_label TEXT,
  lot_description TEXT,
  household_group_id TEXT,         -- For merged lots
  is_primary_lot BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
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

#### `reservations`
```sql
CREATE TABLE reservations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  amenity_type TEXT NOT NULL CHECK(amenity_type IN ('clubhouse', 'pool', 'basketball-court')),
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('AM', 'PM')),
  status TEXT DEFAULT 'pending',
  purpose TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, amenity_type, date, slot)
);
```

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

### Security Status (as of 2026-03-05)

**Overall Security Score: 8/10 🟢**

#### ✅ Security Strengths

1. **Strong Authentication**
   - JWT with 7-day expiration using `jose` library (Workers-compatible)
   - Password hashing with bcryptjs (10 salt rounds)
   - Google OAuth SSO with pre-approved email whitelist
   - Role-Based Access Control (RBAC) properly implemented

2. **Input Validation**
   - Zod schemas for runtime type validation on all API endpoints
   - TypeScript strict mode prevents type confusion at compile time
   - SQL injection protection via parameterized queries (`.bind()`)
   - File upload validation (type and size checks)

3. **Data Protection**
   - Passwords never logged or returned in API responses
   - Sensitive fields omitted from public GeoJSON endpoint
   - CORS allowlist for cross-origin request protection
   - Foreign key constraints enforced in database

#### 🔴 Critical Security Gaps (Identified 2026-03-05)

1. **Missing Rate Limiting** (CVSS 7.5)
   - API endpoints lack rate limiting protection
   - Vulnerable to brute force attacks on `/api/auth/login`
   - Vulnerable to DoS attacks through resource exhaustion
   - **Recommendation:** Implement Cloudflare Workers KV-based rate limiting

2. **Missing Security Headers** (CVSS 7.2)
   - No Content Security Policy (CSP) headers
   - Vulnerable to XSS attacks and data injection
   - **Recommendation:** Implement CSP, X-Frame-Options, X-Content-Type-Options headers

3. **OAuth State Parameter Not Validated** (CVSS 8.1)
   - Google OAuth callback does not validate `state` parameter
   - Vulnerable to CSRF attacks during OAuth flow
   - **Recommendation:** Implement state parameter generation and validation

#### 🟠 High-Priority Security Gaps

4. **Weak Password Policy**
   - Current: 6 characters minimum, no complexity requirements
   - **Recommendation:** 12+ characters with uppercase, lowercase, number, special char

5. **No Session Invalidation on Password Change**
   - JWT tokens remain valid for up to 7 days after password change
   - **Recommendation:** Implement token versioning

6. **Missing Audit Logging**
   - No audit trail for admin actions, authentication events, or sensitive operations
   - **Recommendation:** Add audit_logs table with user_id, action, resource_type, ip_address

7. **Insufficient File Upload Validation**
   - Lacks comprehensive file type validation beyond MIME checks
   - **Recommendation:** Add magic number validation, file extension whitelisting

8. **Error Messages Expose Internal Information**
   - Detailed error messages may leak implementation details
   - **Recommendation:** Implement sanitized error responses for production

#### 🟡 Medium-Priority Security Gaps

9. **CORS Configuration Too Permissive**
   - Allows any localhost port without restriction
   - **Recommendation:** Restrict to specific development ports only

10. **JWT Token Expiration Too Long**
    - 7-day expiration increases exposure if token is stolen
    - **Recommendation:** Implement 15-minute access tokens with 7-day refresh tokens

11. **Debug Page Accessible to Authenticated Users**
    - `/debug` page exposes localStorage and internal state
    - **Recommendation:** Restrict to admin-only or remove in production

12. **localStorage Token Storage**
    - JWT tokens in localStorage vulnerable to XSS theft
    - **Recommendation:** Consider httpOnly cookies for production

#### Compliance Status

| Standard | Status | Notes |
|----------|--------|-------|
| OWASP Top 10 | 🟡 Partial | Critical gaps: rate limiting, CSP, CSRF protection |
| GDPR | 🟡 Partial | Audit logging needed for compliance |
| SOC 2 | 🔴 No | Requires significant additional controls |
| HIPAA | N/A | Not applicable (not healthcare data) |

#### Security Hardening Roadmap

**Phase 1: Critical (Week 1)**
1. Implement rate limiting on all endpoints
2. Add security headers (CSP, HSTS, X-Frame-Options)
3. Fix OAuth state parameter validation

**Phase 2: High Priority (Week 2-4)**
4. Strengthen password policy
5. Implement token versioning
6. Add comprehensive audit logging
7. Improve file upload validation
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

#### Payments
```
GET    /api/payments/my/:householdId
POST   /api/payments
PUT    /api/payments/:id/status
POST   /api/payments/initiate          # Upload proof
GET    /api/payments/my-pending/verifications
```

#### Admin (Role-Protected)
```
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/households
POST   /api/admin/households/import
GET    /api/admin/lots/ownership
PUT    /api/admin/lots/:id/owner
POST   /api/admin/payments/in-person
PUT    /api/admin/payments/:id/verify
GET    /api/admin/payment-demands
POST   /api/admin/payment-demands/create
```

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

4. **Household Access Control**:
   ```sql
   -- Check owner
   SELECT id FROM households WHERE id = ? AND owner_id = ?
   -- Check resident
   SELECT id FROM residents WHERE household_id = ? AND user_id = ?
   ```

5. **Common Areas (HOA-owned)**:
   - `owner_user_id = 'developer-owner'`
   - `lot_type IN ('community', 'utility', 'open_space')`
   - These don't pay dues or vote

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

**Last Updated**: 2026-03-05
**Version**: 1.1.0
**Status**: Production System (Audit Complete)
**Maintained By**: Development Team

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
