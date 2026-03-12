# Public External Booking System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable unauthenticated visitors to browse amenities, check availability, and submit external rental booking requests that remain pending until admin approves them after manual payment verification.

**Architecture:** Public routes at `/external-rentals` without authentication, shared components between resident/admin/public UIs, pending requests that don't block time slots until confirmed.

**Tech Stack:** Cloudflare Workers + Hono (backend), React 18 + TypeScript + shadcn/ui (frontend), D1 database with migration 0020.

---

## File Structure

### Database Layer
- `migrations/0020_public_external_bookings.sql` - Migration for new schema

### Backend Routes
- `functions/routes/public.ts` - NEW: Public routes (no auth required)
- `functions/routes/admin/external-rentals.ts` - MODIFY: Add approve/reject endpoints

### Frontend Pages (Public)
- `src/pages/public/ExternalRentalsPage.tsx` - NEW: Browse amenities grid
- `src/pages/public/AmenityDetailPage.tsx` - NEW: Calendar + pricing
- `src/pages/public/BookingPage.tsx` - NEW: Guest booking form
- `src/pages/public/ConfirmationPage.tsx` - NEW: Status tracker

### Frontend Components
- `src/components/public/AmenityCard.tsx` - NEW: Amenity display
- `src/components/public/PublicCalendar.tsx` - NEW: Availability calendar
- `src/components/public/GuestBookingForm.tsx` - NEW: Extended form
- `src/components/public/PaymentProofUpload.tsx` - NEW: File upload
- `src/components/public/PricingBreakdown.tsx` - NEW: Dynamic pricing
- `src/components/public/BookingStatusTracker.tsx` - NEW: Status indicator

### Types & API
- `src/types/index.ts` - MODIFY: Add public booking types
- `src/lib/api.ts` - MODIFY: Add public API client methods

### Admin Enhancement
- `src/pages/admin/reservations/ExternalRentalsTab.tsx` - MODIFY: Add pending queue with timestamping

---

## Chunk 1: Database Migration

### Task 1: Create migration file

**Files:**
- Create: `migrations/0020_public_external_bookings.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration: 0020_public_external_bookings.sql
-- Date: 2026-03-12
-- Description: Add public external booking system with pending requests that don't block slots

-- ============================================================================
-- STEP 1: Recreate external_rentals table WITHOUT UNIQUE constraint
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
  amount_paid REAL DEFAULT 0,
  payment_method TEXT,
  receipt_number TEXT,
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
  ip_retained_until TEXT,
  created_by TEXT
);

-- Copy existing data
INSERT INTO external_rentals_new
SELECT
  id, amenity_type, date, slot, renter_name, renter_contact, amount, notes, payment_status,
  COALESCE(amount_paid, 0) as amount_paid, payment_method, receipt_number, created_at,
  NULL as guest_name, NULL as guest_email, NULL as guest_phone, NULL as proof_of_payment_url,
  'confirmed' as booking_status, NULL as rejection_reason, NULL as created_ip,
  NULL as guest_notes, NULL as admin_notes, NULL as ip_retained_until,
  created_by
FROM external_rentals;

-- Drop old table and rename
DROP TABLE external_rentals;
ALTER TABLE external_rentals_new RENAME TO external_rentals;

-- Recreate indexes (without unique constraint on slot)
CREATE INDEX idx_external_rentals_lookup ON external_rentals(amenity_type, date, slot);
CREATE INDEX idx_external_rentals_status ON external_rentals(booking_status);
CREATE INDEX idx_external_rentals_email ON external_rentals(guest_email);
CREATE INDEX idx_external_rentals_created_at ON external_rentals(created_at);

-- ============================================================================
-- STEP 2: Create booking_blocked_dates table for CONFIRMED bookings only
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

-- Migrate existing paid bookings to blocked_dates
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

-- Base hourly rates
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_clubhouse_hourly', '500'),
  ('external_pricing_pool_hourly', '300'),
  ('external_pricing_basketball-court_hourly', '200'),
  ('external_pricing_tennis-court_hourly', '250')
ON CONFLICT(key) DO NOTHING;

-- Resident discount (50% off)
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_resident_discount_percent', '0.50')
ON CONFLICT(key) DO NOTHING;

-- Day multipliers
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_day_multipliers', '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}')
ON CONFLICT(key) DO NOTHING;

-- Season multipliers
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_season_multipliers', '{"peak": 1.3, "off_peak": 1.0}')
ON CONFLICT(key) DO NOTHING;

-- Peak season definition
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_peak_months', '12,1,2,3,4,5')
ON CONFLICT(key) DO NOTHING;

-- Holidays 2026
INSERT INTO system_settings (key, value) VALUES
  ('external_pricing_holidays_2026', '2026-01-01,2026-03-28,2026-03-29,2026-04-09,2026-04-10,2026-05-01,2026-06-12,2026-12-25,2026-12-30')
ON CONFLICT(key) DO NOTHING;

-- ============================================================================
-- STEP 4: Add payment details to system_settings
-- ============================================================================

-- GCash details
INSERT INTO system_settings (key, value) VALUES
  ('payment_gcash_number', '0917-XXX-XXXX'),
  ('payment_gcash_name', 'Laguna Hills HOA')
ON CONFLICT(key) DO NOTHING;

-- Bank transfer details
INSERT INTO system_settings (key, value) VALUES
  ('payment_bank_name', 'BPI'),
  ('payment_account_name', 'Laguna Hills HOA Association'),
  ('payment_account_number', 'XXXX-XXXX-XXXX'),
  ('payment_branch', 'Laguna Hills Branch')
ON CONFLICT(key) DO NOTHING;
```

- [ ] **Step 2: Run migration locally (dry-run check)**

Run: `npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0020_public_external_bookings.sql --local --dry-run`
Expected: SQL preview output, no errors

- [ ] **Step 3: Commit migration**

```bash
git add migrations/0020_public_external_bookings.sql
git commit -m "feat(external-rentals): add public booking system schema"
```

---

## Chunk 2: Backend - Public Routes

### Task 2: Create public routes file

**Files:**
- Create: `functions/routes/public.ts`

- [ ] **Step 1: Write public routes**

```typescript
import { Hono } from 'hono';
import { z } from 'zod';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
};

const publicRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const bookingRequestSchema = z.object({
  amenity_type: z.enum(['clubhouse', 'pool', 'basketball-court', 'tennis-court']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(['AM', 'PM', 'FULL_DAY']),
  guest_name: z.string().min(1),
  guest_email: z.string().email(),
  guest_phone: z.string().min(10),
  event_type: z.enum(['wedding', 'birthday', 'meeting', 'sports', 'other']),
  attendees: z.number().int().positive().max(500),
  purpose: z.string().min(10),
  proof_of_payment_url: z.string().optional(),
});

const proofUploadSchema = z.object({
  proof_url: z.string().url(),
});

// Helper: Calculate IP retention date (90 days from now)
function getIPRetentionDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return date.toISOString().split('T')[0];
}

// Helper: Format time as "8:23 AM" or "2:15 PM"
function formatTimeOfDay(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Helper: Get client IP safely
function getClientIP(c: any): string {
  return c.req.header('CF-Connecting-IP') ||
         c.req.header('X-Forwarded-For')?.split(',')[0] ||
         'unknown';
}

// Helper: Check rate limit by IP
async function checkRateLimit(c: any, env: Env): Promise<boolean> {
  const ip = getClientIP(c);
  const now = Math.floor(Date.now() / 1000);
  const hourAgo = now - 3600;

  const result = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM rate_limits
     WHERE identifier = ? AND action = 'public_booking'
     AND created_at > ?`
  ).bind(ip, hourAgo).first();

  const count = (result?.count as number) || 0;
  return count < 3; // Max 3 bookings per hour per IP
}

// Helper: Record rate limit hit
async function recordRateLimit(c: any, env: Env): Promise<void> {
  const ip = getClientIP(c);
  await env.DB.prepare(
    `INSERT INTO rate_limits (identifier, action, created_at)
     VALUES (?, 'public_booking', ?)`
  ).bind(ip, Math.floor(Date.now() / 1000)).run();
}

// GET /api/public/amenities - List bookable amenities
publicRouter.get('/amenities', async (c) => {
  const amenities = [
    { amenity_type: 'clubhouse', name: 'Clubhouse', description: 'Perfect for weddings, parties, and meetings', capacity: 100, image: '/images/clubhouse.jpg' },
    { amenity_type: 'pool', name: 'Swimming Pool', description: 'Olympic-sized pool with kiddie area', capacity: 50, image: '/images/pool.jpg' },
    { amenity_type: 'basketball-court', name: 'Basketball Court', description: 'Full-size court with lighting', capacity: 20, image: '/images/basketball.jpg' },
    { amenity_type: 'tennis-court', name: 'Tennis Court', description: 'Professional clay court', capacity: 4, image: '/images/tennis.jpg' },
  ];

  return c.json({ data: { amenities } });
});

// GET /api/public/availability/:amenityType - Check availability
publicRouter.get('/availability/:amenityType', async (c) => {
  const amenityType = c.req.param('amenityType');
  const startDate = c.req.query('start') || new Date().toISOString().split('T')[0];
  const endDate = c.req.query('end') || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get blocked dates (confirmed bookings only)
  const blockedDates = await c.env.DB.prepare(
    `SELECT booking_date, slot FROM booking_blocked_dates
     WHERE amenity_type = ? AND booking_date BETWEEN ? AND ?`
  ).bind(amenityType, startDate, endDate).all();

  const blockedSet = new Set(
    (blockedDates.results || []).map((d: any) => `${d.booking_date}-${d.slot}`)
  );

  // Check resident reservations
  const residentBlocked = await c.env.DB.prepare(
    `SELECT date, slot FROM reservations
     WHERE amenity_type = ? AND date BETWEEN ? AND ?
     AND status != 'cancelled'`
  ).bind(amenityType, startDate, endDate).all();

  for (const r of (residentBlocked.results || [])) {
    blockedSet.add(`${r.date}-${r.slot}`);
  }

  // Check time blocks
  const timeBlocked = await c.env.DB.prepare(
    `SELECT date, slot FROM time_blocks
     WHERE amenity_type = ? AND date BETWEEN ? AND ?`
  ).bind(amenityType, startDate, endDate).all();

  for (const t of (timeBlocked.results || [])) {
    blockedSet.add(`${t.date}-${t.slot}`);
  }

  // Generate available dates
  const available: any[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const slots = ['AM', 'PM', 'FULL_DAY'].filter(slot => !blockedSet.has(`${dateStr}-${slot}`));

    if (slots.length > 0) {
      available.push({ date: dateStr, available_slots: slots });
    }

    current.setDate(current.getDate() + 1);
  }

  return c.json({ data: { available } });
});

// GET /api/public/pricing/:amenityType - Get pricing with multipliers
publicRouter.get('/pricing/:amenityType', async (c) => {
  const amenityType = c.req.param('amenityType');
  const date = c.req.query('date');
  const slot = c.req.query('slot') || 'FULL_DAY';
  const isResident = c.req.query('resident') === 'true';

  if (!date) {
    return c.json({ error: 'Date parameter required' }, 400);
  }

  // Get base rate
  const baseRateResult = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = ?`
  ).bind(`external_pricing_${amenityType}_hourly`).first();

  const baseRate = parseFloat(baseRateResult?.value as string) || 500;

  // Get day multipliers
  const dayMultipliersResult = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'external_pricing_day_multipliers'`
  ).first();

  const dayMultipliers = JSON.parse(dayMultipliersResult?.value as string || '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}');

  // Get season multipliers
  const seasonMultipliersResult = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'external_pricing_season_multipliers'`
  ).first();

  const seasonMultipliers = JSON.parse(seasonMultipliersResult?.value as string || '{"peak": 1.3, "off_peak": 1.0}');

  // Get peak months
  const peakMonthsResult = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'external_pricing_peak_months'`
  ).first();

  const peakMonths = (peakMonthsResult?.value as string || '12,1,2,3,4,5').split(',').map(Number);

  // Get holidays
  const holidaysResult = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'external_pricing_holidays_2026'`
  ).first();

  const holidays = (holidaysResult?.value as string || '').split(',').map(s => s.trim());

  // Calculate multipliers
  const bookingDate = new Date(date);
  const dayOfWeek = bookingDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = holidays.includes(date);
  const month = bookingDate.getMonth() + 1;
  const isPeak = peakMonths.includes(month);

  let dayMultiplier = dayMultipliers.weekday;
  if (isHoliday) dayMultiplier = dayMultipliers.holiday;
  else if (isWeekend) dayMultiplier = dayMultipliers.weekend;

  const seasonMultiplier = isPeak ? seasonMultipliers.peak : seasonMultipliers.off_peak;

  // Calculate duration
  const durations: Record<string, number> = { AM: 4, PM: 4, FULL_DAY: 9 };
  const duration = durations[slot] || 9;

  // Calculate total
  const total = baseRate * duration * dayMultiplier * seasonMultiplier;

  // Apply resident discount if applicable
  const discountResult = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'external_pricing_resident_discount_percent'`
  ).first();

  const discountPercent = parseFloat(discountResult?.value as string || '0.50');
  const finalPrice = isResident ? total * (1 - discountPercent) : total;

  return c.json({
    data: {
      base_rate: baseRate,
      duration,
      day_type: isHoliday ? 'holiday' : isWeekend ? 'weekend' : 'weekday',
      day_multiplier: dayMultiplier,
      season_type: isPeak ? 'peak' : 'off_peak',
      season_multiplier: seasonMultiplier,
      subtotal: total,
      resident_discount: isResident ? discountPercent : 0,
      final_price: Math.round(finalPrice),
    }
  });
});

// GET /api/public/payment-details - Get payment info
publicRouter.get('/payment-details', async (c) => {
  const gcashNumber = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'payment_gcash_number'`
  ).first();

  const gcashName = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'payment_gcash_name'`
  ).first();

  const bankName = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'payment_bank_name'`
  ).first();

  const accountName = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'payment_account_name'`
  ).first();

  const accountNumber = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'payment_account_number'`
  ).first();

  return c.json({
    data: {
      gcash: {
        number: gcashNumber?.value || '0917-XXX-XXXX',
        name: gcashName?.value || 'Laguna Hills HOA',
      },
      bank_transfer: {
        bank_name: bankName?.value || 'BPI',
        account_name: accountName?.value || 'Laguna Hills HOA Association',
        account_number: accountNumber?.value || 'XXXX-XXXX-XXXX',
      }
    }
  });
});

// POST /api/public/bookings - Create booking request
publicRouter.post('/bookings', async (c) => {
  // Rate limit check
  const withinLimit = await checkRateLimit(c, c.env);
  if (!withinLimit) {
    return c.json({ error: 'Too many booking attempts. Please try again later.' }, 429);
  }

  const body = await c.req.json();
  const result = bookingRequestSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const data = result.data;

  // Check if slot is actually available (confirmed bookings only)
  const blocked = await c.env.DB.prepare(
    `SELECT id FROM booking_blocked_dates
     WHERE amenity_type = ? AND booking_date = ? AND slot = ?`
  ).bind(data.amenity_type, data.date, data.slot).first();

  if (blocked) {
    return c.json({ error: 'This time slot is already booked.' }, 409);
  }

  // Check resident reservations
  const reserved = await c.env.DB.prepare(
    `SELECT id FROM reservations
     WHERE amenity_type = ? AND date = ? AND slot = ? AND status != 'cancelled'`
  ).bind(data.amenity_type, data.date, data.slot).first();

  if (reserved) {
    return c.json({ error: 'This time slot is already reserved.' }, 409);
  }

  // Check time blocks
  const timeBlocked = await c.env.DB.prepare(
    `SELECT id FROM time_blocks
     WHERE amenity_type = ? AND date = ? AND slot = ?`
  ).bind(data.amenity_type, data.date, data.slot).first();

  if (timeBlocked) {
    return c.json({ error: 'This time slot is blocked.' }, 409);
  }

  // Calculate pricing
  const pricingResponse = await c.env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'external_pricing_${data.amenity_type}_hourly'`
  ).first();

  const baseRate = parseFloat(pricingResponse?.value as string) || 500;
  const durations: Record<string, number> = { AM: 4, PM: 4, FULL_DAY: 9 };
  const amount = baseRate * durations[data.slot]; // Simplified (no multipliers for now)

  // Generate booking ID and reference number
  const id = crypto.randomUUID();
  const now = new Date();
  const refNum = `EXT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

  // Get client IP
  const clientIP = getClientIP(c);

  // Insert booking
  await c.env.DB.prepare(
    `INSERT INTO external_rentals (
      id, amenity_type, date, slot, amount, payment_status,
      guest_name, guest_email, guest_phone, guest_notes,
      proof_of_payment_url, booking_status, created_ip, ip_retained_until
    ) VALUES (?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, 'pending_payment', ?, ?)`
  ).bind(
    id, data.amenity_type, data.date, data.slot, amount,
    data.guest_name, data.guest_email, data.guest_phone, data.purpose,
    data.proof_of_payment_url || null,
    clientIP,
    getIPRetentionDate()
  ).run();

  // Record rate limit
  await recordRateLimit(c, c.env);

  // Fetch created booking
  const booking = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  return c.json({
    data: {
      booking: {
        ...booking,
        reference_number: refNum,
        time_of_day: formatTimeOfDay(booking.created_at as string),
      }
    }
  }, 201);
});

// POST /api/public/bookings/:id/proof - Upload payment proof
publicRouter.post('/bookings/:id/proof', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = proofUploadSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  // Check if booking exists and belongs to this email
  const booking = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  if (booking.booking_status === 'confirmed') {
    return c.json({ error: 'Booking is already confirmed' }, 400);
  }

  if (booking.booking_status === 'rejected') {
    return c.json({ error: 'Booking has been rejected' }, 400);
  }

  // Update booking
  await c.env.DB.prepare(
    `UPDATE external_rentals
     SET proof_of_payment_url = ?, booking_status = 'pending_verification'
     WHERE id = ?`
  ).bind(result.data.proof_url, id).run();

  // TODO: Send email notification to admin

  const updated = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  return c.json({ data: { booking: updated } });
});

// GET /api/public/bookings/:id/status - Check booking status
publicRouter.get('/bookings/:id/status', async (c) => {
  const id = c.req.param('id');

  const booking = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  return c.json({
    data: {
      booking: {
        id: booking.id,
        reference_number: `EXT-${new Date(booking.created_at as string).getFullYear()}${String(new Date(booking.created_at as string).getMonth() + 1).padStart(2, '0')}${String(new Date(booking.created_at as string).getDate()).padStart(2, '0')}-${id.slice(-3)}`,
        status: booking.booking_status,
        amenity_type: booking.amenity_type,
        date: booking.date,
        slot: booking.slot,
        amount: booking.amount,
        rejection_reason: booking.rejection_reason,
        admin_notes: booking.admin_notes,
        time_of_day: formatTimeOfDay(booking.created_at as string),
      }
    }
  });
});

export default publicRouter;
```

- [ ] **Step 2: Register public routes in main app**

**File:** `functions/routes/admin.ts` - Add after existing imports:

```typescript
import publicRoutes from './public';

// Public routes (no auth required)
api.route('/public', publicRoutes);
```

- [ ] **Step 3: TypeScript type-check**

Run: `rtk tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add functions/routes/public.ts functions/routes/admin.ts
git commit -m "feat(public): add public booking routes"
```

---

## Chunk 3: Backend - Admin Enhancements

### Task 3: Add approve/reject endpoints to admin external rentals

**Files:**
- Modify: `functions/routes/admin/external-rentals.ts`

- [ ] **Step 1: Add approve endpoint**

Add after DELETE route:

```typescript
// PUT /:id/approve - Approve booking and block slot
externalRentalsRouter.put('/:id/approve', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const autoReject = body.auto_reject === true;

  // Get booking
  const booking = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  if (booking.booking_status === 'confirmed') {
    return c.json({ error: 'Booking is already confirmed' }, 400);
  }

  // Check for conflicts with confirmed bookings
  const conflict = await c.env.DB.prepare(
    `SELECT id FROM booking_blocked_dates
     WHERE amenity_type = ? AND booking_date = ? AND slot = ?`
  ).bind(booking.amenity_type, booking.date, booking.slot).first();

  if (conflict) {
    return c.json({ error: 'This time slot is no longer available' }, 409);
  }

  // Update booking status
  await c.env.DB.prepare(
    `UPDATE external_rentals
     SET booking_status = 'confirmed', payment_status = 'paid'
     WHERE id = ?`
  ).bind(id).run();

  // Create blocked_dates entry
  const blockedId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO booking_blocked_dates (id, booking_id, amenity_type, booking_date, slot)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(blockedId, id, booking.amenity_type, booking.date, booking.slot).run();

  // Auto-reject other pending requests for same slot if requested
  if (autoReject) {
    await c.env.DB.prepare(
      `UPDATE external_rentals
       SET booking_status = 'rejected',
           rejection_reason = 'First come, first served - another booking was confirmed.'
       WHERE amenity_type = ? AND date = ? AND slot = ?
       AND booking_status IN ('pending_payment', 'pending_verification')
       AND id != ?`
    ).bind(booking.amenity_type, booking.date, booking.slot, id).run();
  }

  // Get other pending requests for warning
  const otherPending = await c.env.DB.prepare(
    `SELECT id, guest_name, created_at FROM external_rentals
     WHERE amenity_type = ? AND date = ? AND slot = ?
     AND booking_status IN ('pending_payment', 'pending_verification')
     AND id != ?
     ORDER BY created_at ASC`
  ).bind(booking.amenity_type, booking.date, booking.slot, id).all();

  const updated = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  // TODO: Send confirmation email to guest

  return c.json({
    data: {
      booking: updated,
      other_pending: otherPending.results || [],
    }
  });
});

// PUT /:id/reject - Reject booking
externalRentalsRouter.put('/:id/reject', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const reason = body.reason || 'Booking declined';

  // Get booking
  const booking = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  if (booking.booking_status === 'confirmed') {
    // Remove from blocked_dates if exists
    await c.env.DB.prepare(
      `DELETE FROM booking_blocked_dates WHERE booking_id = ?`
    ).bind(id).run();
  }

  // Update booking status
  await c.env.DB.prepare(
    `UPDATE external_rentals
     SET booking_status = 'rejected', rejection_reason = ?
     WHERE id = ?`
  ).bind(reason, id).run();

  const updated = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  // TODO: Send rejection email to guest

  return c.json({ data: { booking: updated } });
});

// GET /pending - Get pending requests with timestamp info
externalRentalsRouter.get('/pending', async (c) => {
  const authUser = await requireAdminOrStaff(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const amenityType = c.req.query('amenity_type');
  const date = c.req.query('date');
  const slot = c.req.query('slot');
  const status = c.req.query('status') || 'pending_verification';

  let query = 'SELECT * FROM external_rentals WHERE booking_status = ?';
  const params: any[] = [status];

  if (amenityType) {
    query += ' AND amenity_type = ?';
    params.push(amenityType);
  }
  if (date) {
    query += ' AND date = ?';
    params.push(date);
  }
  if (slot) {
    query += ' AND slot = ?';
    params.push(slot);
  }

  query += ' ORDER BY created_at ASC';

  const result = await c.env.DB.prepare(query).bind(...params).all();

  // Add is_first flag and time_of_day formatting
  const requests = (result.results || []).map((r: any, idx: number) => ({
    ...r,
    reference_number: `EXT-${new Date(r.created_at).getFullYear()}${String(new Date(r.created_at).getMonth() + 1).padStart(2, '0')}${String(new Date(r.created_at).getDate()).padStart(2, '0')}-${r.id.slice(-3)}`,
    time_of_day: formatTimeOfDay(r.created_at),
    is_first: idx === 0,
  }));

  // Check for conflicts
  let conflicts = null;
  if (amenityType && date && slot) {
    const conflictCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM external_rentals
       WHERE amenity_type = ? AND date = ? AND slot = ?
       AND booking_status IN ('pending_payment', 'pending_verification')`
    ).bind(amenityType, date, slot).first();

    conflicts = {
      amenity_type: amenityType,
      date: date,
      slot: slot,
      pending_count: (conflictCount?.count as number) || 0,
    };
  }

  return c.json({
    data: {
      requests,
      total: requests.length,
      conflicts,
    }
  });
});
```

- [ ] **Step 2: TypeScript type-check**

Run: `rtk tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add functions/routes/admin/external-rentals.ts
git commit -m "feat(admin): add approve/reject endpoints for public bookings"
```

---

## Chunk 4: Types & API Client

### Task 4: Add types for public bookings

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add types before export**

```typescript
// Add after ExternalRental type

// Public booking types
export interface PublicAmenity {
  amenity_type: AmenityType;
  name: string;
  description: string;
  capacity: number;
  image: string;
}

export interface AvailabilitySlot {
  date: string;
  available_slots: TimeBlockSlot[];
}

export interface PricingCalculation {
  base_rate: number;
  duration: number;
  day_type: 'weekday' | 'weekend' | 'holiday';
  day_multiplier: number;
  season_type: 'peak' | 'off_peak';
  season_multiplier: number;
  subtotal: number;
  resident_discount: number;
  final_price: number;
}

export interface PaymentDetails {
  gcash: {
    number: string;
    name: string;
  };
  bank_transfer: {
    bank_name: string;
    account_name: string;
    account_number: string;
  };
}

export interface PublicBookingRequest {
  amenity_type: AmenityType;
  date: string;
  slot: TimeBlockSlot;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  event_type: 'wedding' | 'birthday' | 'meeting' | 'sports' | 'other';
  attendees: number;
  purpose: string;
  proof_of_payment_url?: string;
}

export interface PublicBookingResponse {
  id: string;
  reference_number: string;
  status: 'pending_payment' | 'pending_verification' | 'confirmed' | 'rejected' | 'cancelled';
  amenity_type: AmenityType;
  date: string;
  slot: TimeBlockSlot;
  amount: number;
  time_of_day?: string;
  rejection_reason?: string;
  admin_notes?: string;
}

export interface BookingBlockedDate {
  id: string;
  booking_id: string;
  amenity_type: AmenityType;
  booking_date: string;
  slot: TimeBlockSlot;
  created_at: string;
}

// Extended ExternalRental with public booking fields
export interface ExtendedExternalRental extends ExternalRental {
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  proof_of_payment_url?: string;
  booking_status?: 'pending_payment' | 'pending_verification' | 'confirmed' | 'rejected' | 'cancelled';
  rejection_reason?: string;
  created_ip?: string;
  guest_notes?: string;
  admin_notes?: string;
  ip_retained_until?: string;
  time_of_day?: string;
  is_first?: boolean;
}
```

- [ ] **Step 2: TypeScript type-check**

Run: `rtk tsc --noEmit`
Expected: No errors

### Task 5: Add public API client methods

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add public API methods**

Add after externalRentals property in the api object:

```typescript
// In src/lib/api.ts, add after the existing api object definition:

// Public API (no auth required)
public: {
  getAmenities: async () => {
    const response = await fetch(`${API_BASE}/public/amenities`);
    const data = await response.json();
    if (data.error) return { error: data.error };
    return { data: data.data.amenities };
  },

  getAvailability: async (amenityType: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    const response = await fetch(`${API_BASE}/public/availability/${amenityType}?${params}`);
    const data = await response.json();
    if (data.error) return { error: data.error };
    return { data: data.data.available };
  },

  getPricing: async (amenityType: string, date: string, slot: string, isResident?: boolean) => {
    const params = new URLSearchParams({ date, slot });
    if (isResident) params.set('resident', 'true');
    const response = await fetch(`${API_BASE}/public/pricing/${amenityType}?${params}`);
    const data = await response.json();
    if (data.error) return { error: data.error };
    return { data: data.data };
  },

  getPaymentDetails: async () => {
    const response = await fetch(`${API_BASE}/public/payment-details`);
    const data = await response.json();
    if (data.error) return { error: data.error };
    return { data: data.data };
  },

  createBooking: async (bookingData: any) => {
    const response = await fetch(`${API_BASE}/public/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData),
    });
    const data = await response.json();
    if (data.error) return { error: data.error };
    return { data: data.data.booking };
  },

  uploadPaymentProof: async (bookingId: string, proofUrl: string) => {
    const response = await fetch(`${API_BASE}/public/bookings/${bookingId}/proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof_url: proofUrl }),
    });
    const data = await response.json();
    if (data.error) return { error: data.error };
    return { data: data.data.booking };
  },

  getBookingStatus: async (bookingId: string) => {
    const response = await fetch(`${API_BASE}/public/bookings/${bookingId}/status`);
    const data = await response.json();
    if (data.error) return { error: data.error };
    return { data: data.data.booking };
  },
},

// Admin API for public bookings
adminPublicBookings: {
  getPending: async (filters?: { status?: string; amenity_type?: string; date?: string; slot?: string }) => {
    const hoa_token = localStorage.getItem('hoa_token');
    const params = new URLSearchParams(filters || {});
    const response = await fetch(`${API_BASE}/admin/external-rentals/pending?${params}`, {
      headers: { Authorization: `Bearer ${hoa_token}` },
    });
    const data = await response.json();
    if (data.error) return { error: data.error };
    return { data: data.data };
  },

  approveBooking: async (bookingId: string, autoReject?: boolean) => {
    const hoa_token = localStorage.getItem('hoa_token');
    const response = await fetch(`${API_BASE}/admin/external-rentals/${bookingId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hoa_token}`,
      },
      body: JSON.stringify({ auto_reject: autoReject || false }),
    });
    const data = await response.json();
    if (data.error) return { error: data.error };
    return { data: data.data.booking };
  },

  rejectBooking: async (bookingId: string, reason: string) => {
    const hoa_token = localStorage.getItem('hoa_token');
    const response = await fetch(`${API_BASE}/admin/external-rentals/${bookingId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hoa_token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await response.json();
    if (data.error) return { error: data.error };
    return { data: data.data.booking };
  },
},
```

- [ ] **Step 2: TypeScript type-check**

Run: `rtk tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/lib/api.ts
git commit -m "feat(types): add public booking types and API methods"
```

---

## Chunk 5: Public Pages - Browse & Detail

### Task 6: Create ExternalRentalsPage (browse amenities)

**Files:**
- Create: `src/pages/public/ExternalRentalsPage.tsx`

- [ ] **Step 1: Write the page component**

```typescript
// src/pages/public/ExternalRentalsPage.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { PublicAmenity } from '@/types';
import { Calendar, Users, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const amenityImages: Record<string, string> = {
  clubhouse: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
  pool: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800',
  'basketball-court': 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
  'tennis-court': 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800',
};

export function ExternalRentalsPage() {
  const [amenities, setAmenities] = useState<PublicAmenity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAmenities();
  }, []);

  async function loadAmenities() {
    try {
      const result = await api.public.getAmenities();
      if (result.data) {
        setAmenities(result.data as PublicAmenity[]);
      }
    } catch (error) {
      console.error('Error loading amenities:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <div className="bg-primary text-primary-foreground py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Rent Our Amenities for Your Events
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            Celebrate at Laguna Hills! Book our clubhouse, pool, or sports courts
            for your special occasions.
          </p>
        </div>
      </div>

      {/* Amenities Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8 text-center">Available Amenities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {amenities.map((amenity) => (
            <Card key={amenity.amenity_type} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 overflow-hidden">
                <img
                  src={amenityImages[amenity.amenity_type] || amenity.image}
                  alt={amenity.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <CardTitle>{amenity.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {amenity.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>Up to {amenity.capacity} guests</span>
                </div>
              </CardContent>
              <CardFooter>
                <Link to={`/external-rentals/${amenity.amenity_type}`} className="w-full">
                  <Button className="w-full">Check Availability</Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Info Section */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Browse our amenities and check availability for your preferred date</li>
              <li>Select your time slot and see the pricing breakdown</li>
              <li>Fill out the booking form with your event details</li>
              <li>Pay via GCash or bank transfer</li>
              <li>Upload proof of payment</li>
              <li>We'll verify and confirm your booking within 24-48 hours</li>
            </ol>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium">Residents get 50% off!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Log in to your account to avail the resident discount.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript type-check**

Run: `rtk tsc --noEmit`
Expected: No errors

### Task 7: Create AmenityDetailPage (calendar + pricing)

**Files:**
- Create: `src/pages/public/AmenityDetailPage.tsx`

- [ ] **Step 1: Write the page component**

```typescript
// src/pages/public/AmenityDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { AmenityType, TimeBlockSlot, AvailabilitySlot, PricingCalculation } from '@/types';
import { Calendar as CalendarIcon, Clock, DollarSign, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

const amenityInfo: Record<AmenityType, { name: string; image: string; description: string }> = {
  clubhouse: {
    name: 'Clubhouse',
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200',
    description: 'Perfect for weddings, debuts, parties, and meetings. Fully air-conditioned with kitchen access.',
  },
  pool: {
    name: 'Swimming Pool',
    image: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=1200',
    description: 'Olympic-sized pool with kiddie area. Great for summer parties and swimming events.',
  },
  'basketball-court': {
    name: 'Basketball Court',
    image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200',
    description: 'Full-size court with lighting. Perfect for tournaments and friendly games.',
  },
  'tennis-court': {
    name: 'Tennis Court',
    image: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1200',
    description: 'Professional clay court. Great for private lessons and matches.',
  },
};

const slotLabels: Record<TimeBlockSlot, string> = {
  AM: 'Morning (8AM - 12PM)',
  PM: 'Afternoon (1PM - 5PM)',
  FULL_DAY: 'Full Day (8AM - 5PM)',
};

export function AmenityDetailPage() {
  const { amenityType } = useParams<{ amenityType: AmenityType }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [pricing, setPricing] = useState<PricingCalculation | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<TimeBlockSlot | ''>('');
  const [loading, setLoading] = useState(true);
  const [loadingPricing, setLoadingPricing] = useState(false);

  const info = amenityType ? amenityInfo[amenityType] : null;

  useEffect(() => {
    if (amenityType) {
      loadAvailability();
    }
  }, [amenityType]);

  useEffect(() => {
    if (selectedDate && selectedSlot && amenityType) {
      loadPricing();
    } else {
      setPricing(null);
    }
  }, [selectedDate, selectedSlot, amenityType]);

  async function loadAvailability() {
    if (!amenityType) return;

    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const result = await api.public.getAvailability(amenityType, today, threeMonthsLater);
      if (result.data) {
        setAvailability(result.data as AvailabilitySlot[]);
      }
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPricing() {
    if (!amenityType || !selectedDate || !selectedSlot) return;

    try {
      setLoadingPricing(true);
      const result = await api.public.getPricing(amenityType, selectedDate, selectedSlot, !!user);
      if (result.data) {
        setPricing(result.data as PricingCalculation);
      }
    } catch (error) {
      console.error('Error loading pricing:', error);
    } finally {
      setLoadingPricing(false);
    }
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot('');
  }

  function handleSlotSelect(slot: TimeBlockSlot) {
    setSelectedSlot(slot);
  }

  function handleProceed() {
    navigate(`/external-rentals/book?amenity=${amenityType}&date=${selectedDate}&slot=${selectedSlot}`);
  }

  if (!info) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-muted-foreground">Amenity not found</h1>
        <Link to="/external-rentals">
          <Button variant="link">Back to Amenities</Button>
        </Link>
      </div>
    );
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

  // Group availability by month
  const byMonth: Record<string, AvailabilitySlot[]> = {};
  availability.forEach(slot => {
    const month = new Date(slot.date).getMonth();
    const year = new Date(slot.date).getFullYear();
    const key = `${year}-${month}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(slot);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="relative h-64 md:h-80">
        <img src={info.image} alt={info.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="max-w-6xl mx-auto">
            <Link to="/external-rentals" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Amenities
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold">{info.name}</h1>
            <p className="text-white/90 mt-2">{info.description}</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Select a Date
                </CardTitle>
                <CardDescription>
                  Click on an available date to see time slots
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="md" />
                  </div>
                ) : availability.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">
                    No available dates in the next 3 months
                  </p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(byMonth).map(([key, slots]) => {
                      const [year, month] = key.split('-').map(Number);
                      return (
                        <div key={key}>
                          <h3 className="font-semibold text-lg mb-3">
                            {monthNames[month]} {year}
                          </h3>
                          <div className="grid grid-cols-7 gap-2">
                            {slots.map((slot) => {
                              const date = new Date(slot.date);
                              const day = date.getDate();
                              const isSelected = selectedDate === slot.date;
                              const isToday = slot.date === new Date().toISOString().split('T')[0];

                              return (
                                <button
                                  key={slot.date}
                                  onClick={() => handleDateSelect(slot.date)}
                                  className={cn(
                                    "p-3 text-sm rounded-lg border transition-colors",
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : isToday
                                        ? "bg-blue-100 border-blue-300 hover:bg-blue-200"
                                        : "bg-white border-gray-200 hover:bg-gray-50"
                                  )}
                                >
                                  <div className="font-medium">{day}</div>
                                  <div className="text-xs opacity-70">
                                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                  </div>
                                  {isSelected && (
                                    <div className="mt-1 text-xs">
                                      {slot.available_slots.length} slot{slot.available_slots.length !== 1 ? 's' : ''}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Slot Selection & Pricing */}
          <div className="space-y-6">
            {/* Time Slots */}
            {selectedDate && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Available Slots
                  </CardTitle>
                  <CardDescription>
                    {new Date(selectedDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {availability.find(a => a.date === selectedDate)?.available_slots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => handleSlotSelect(slot as TimeBlockSlot)}
                      className={cn(
                        "w-full p-4 text-left rounded-lg border transition-colors",
                        selectedSlot === slot
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-white border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <div className="font-medium">{slotLabels[slot as TimeBlockSlot]}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Pricing */}
            {pricing && (
              <Card className={cn("border-2", user ? "border-green-200" : "")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Pricing Breakdown
                  </CardTitle>
                  {user && (
                    <Badge variant="default" className="w-fit">Resident Discount Applied</Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base Rate</span>
                    <span>₱{pricing.base_rate}/hour</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{pricing.duration} hours</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Day Type</span>
                    <span className="capitalize">{pricing.day_type}</span>
                  </div>
                  {pricing.day_multiplier !== 1 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Day Multiplier</span>
                      <span>x{pricing.day_multiplier}</span>
                    </div>
                  )}
                  {pricing.season_multiplier !== 1 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Season</span>
                      <span className="capitalize">{pricing.season_type} (x{pricing.season_multiplier})</span>
                    </div>
                  )}
                  {pricing.resident_discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Resident Discount</span>
                      <span>-{pricing.resident_discount * 100}%</span>
                    </div>
                  )}
                  <div className="pt-3 border-t flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>₱{pricing.final_price.toLocaleString()}</span>
                  </div>
                  <Button
                    onClick={handleProceed}
                    className="w-full"
                    size="lg"
                    disabled={loadingPricing}
                  >
                    Proceed to Booking
                  </Button>
                  {!user && (
                    <p className="text-xs text-center text-muted-foreground">
                      Log in to get 50% resident discount
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript type-check**

Run: `rtk tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/public/ExternalRentalsPage.tsx src/pages/public/AmenityDetailPage.tsx
git commit -m "feat(public): add amenities browse and detail pages"
```

---

## Chunk 6: Public Pages - Booking & Confirmation

### Task 8: Create BookingPage (guest booking form)

**Files:**
- Create: `src/pages/public/BookingPage.tsx`

- [ ] **Step 1: Write the page component**

```typescript
// src/pages/public/BookingPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { AmenityType, TimeBlockSlot, PricingCalculation, PaymentDetails, PublicBookingRequest } from '@/types';
import { ArrowLeft, Upload, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const amenityLabels: Record<AmenityType, string> = {
  clubhouse: 'Clubhouse',
  pool: 'Swimming Pool',
  'basketball-court': 'Basketball Court',
  'tennis-court': 'Tennis Court',
};

const slotLabels: Record<TimeBlockSlot, string> = {
  AM: 'Morning (8AM - 12PM)',
  PM: 'Afternoon (1PM - 5PM)',
  FULL_DAY: 'Full Day (8AM - 5PM)',
};

const eventTypes = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'birthday', label: 'Birthday Party' },
  { value: 'meeting', label: 'Meeting/Conference' },
  { value: 'sports', label: 'Sports Event' },
  { value: 'other', label: 'Other' },
];

export function BookingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const amenityType = searchParams.get('amenity') as AmenityType;
  const date = searchParams.get('date') || '';
  const slot = searchParams.get('slot') as TimeBlockSlot;

  const [pricing, setPricing] = useState<PricingCalculation | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    guest_name: user?.name || '',
    guest_email: user?.email || '',
    guest_phone: '',
    event_type: '' as any,
    attendees: '',
    purpose: '',
    terms_agreed: false,
  });

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadedProofUrl, setUploadedProofUrl] = useState('');

  useEffect(() => {
    if (!amenityType || !date || !slot) {
      navigate('/external-rentals');
      return;
    }

    loadData();
  }, [amenityType, date, slot]);

  async function loadData() {
    try {
      setLoading(true);
      const [pricingResult, paymentResult] = await Promise.all([
        api.public.getPricing(amenityType, date, slot, !!user),
        api.public.getPaymentDetails(),
      ]);

      if (pricingResult.data) {
        setPricing(pricingResult.data as PricingCalculation);
      }
      if (paymentResult.data) {
        setPaymentDetails(paymentResult.data as PaymentDetails);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load booking information');
    } finally {
      setLoading(false);
    }
  }

  async function handleProofUpload(file: File) {
    // TODO: Implement R2 upload
    // For now, return a mock URL
    return `https://r2-storage.example.com/proofs/${Date.now()}-${file.name}`;
  }

  async function handleUploadProof() {
    if (!proofFile) {
      toast.error('Please select a file to upload');
      return;
    }

    if (proofFile.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      setUploadingProof(true);
      const url = await handleProofUpload(proofFile);
      setUploadedProofUrl(url);
      toast.success('Proof of payment uploaded');
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error('Failed to upload proof of payment');
    } finally {
      setUploadingProof(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.terms_agreed) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    if (formData.attendees && (parseInt(formData.attendees) < 1 || parseInt(formData.attendees) > 500)) {
      toast.error('Number of attendees must be between 1 and 500');
      return;
    }

    try {
      setSubmitting(true);

      const bookingData: PublicBookingRequest = {
        amenity_type: amenityType,
        date,
        slot,
        guest_name: formData.guest_name,
        guest_email: formData.guest_email,
        guest_phone: formData.guest_phone,
        event_type: formData.event_type,
        attendees: parseInt(formData.attendees) || 0,
        purpose: formData.purpose,
        proof_of_payment_url: uploadedProofUrl || undefined,
      };

      const result = await api.public.createBooking(bookingData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success('Booking request submitted!');
      navigate(`/external-rentals/success/${result.data.id}`);
    } catch (error) {
      console.error('Error submitting booking:', error);
      toast.error('Failed to submit booking request');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!pricing) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-muted-foreground">Unable to load pricing</h1>
        <Link to="/external-rentals">
          <Button variant="link">Back to Amenities</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Link
          to={`/external-rentals/${amenityType}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {amenityLabels[amenityType]}
        </Link>

        <h1 className="text-3xl font-bold mb-8">Complete Your Booking</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Booking Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amenity</span>
                <span className="font-medium">{amenityLabels[amenityType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {new Date(date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time Slot</span>
                <span className="font-medium">{slotLabels[slot]}</span>
              </div>
              <div className="pt-2 border-t flex justify-between font-bold text-lg">
                <span>Total Amount</span>
                <span>₱{pricing.final_price.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Guest Information */}
          <Card>
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
              <CardDescription>Please provide your contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guest_name">Full Name *</Label>
                <Input
                  id="guest_name"
                  value={formData.guest_name}
                  onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                  placeholder="Juan Dela Cruz"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_email">Email Address *</Label>
                <Input
                  id="guest_email"
                  type="email"
                  value={formData.guest_email}
                  onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                  placeholder="juan@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_phone">Phone Number *</Label>
                <Input
                  id="guest_phone"
                  type="tel"
                  value={formData.guest_phone}
                  onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                  placeholder="+63 912 345 6789"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Event Details */}
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
              <CardDescription>Tell us about your event</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event_type">Event Type *</Label>
                <Select
                  value={formData.event_type}
                  onValueChange={(v) => setFormData({ ...formData, event_type: v })}
                  required
                >
                  <SelectTrigger id="event_type">
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendees">Expected Number of Attendees *</Label>
                <Input
                  id="attendees"
                  type="number"
                  min="1"
                  max="500"
                  value={formData.attendees}
                  onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                  placeholder="50"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purpose">Event Purpose/Description *</Label>
                <Textarea
                  id="purpose"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  placeholder="Describe your event..."
                  rows={3}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Instructions */}
          {paymentDetails && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle>Payment Instructions</CardTitle>
                <CardDescription>Please pay the total amount to complete your booking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">GCash</h4>
                  <div className="bg-white p-3 rounded-lg border">
                    <p className="text-sm"><strong>Name:</strong> {paymentDetails.gcash.name}</p>
                    <p className="text-sm"><strong>Number:</strong> {paymentDetails.gcash.number}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Bank Transfer</h4>
                  <div className="bg-white p-3 rounded-lg border">
                    <p className="text-sm"><strong>Bank:</strong> {paymentDetails.bank_transfer.bank_name}</p>
                    <p className="text-sm"><strong>Account Name:</strong> {paymentDetails.bank_transfer.account_name}</p>
                    <p className="text-sm"><strong>Account Number:</strong> {paymentDetails.bank_transfer.account_number}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reference number format: Your Name - {amenityLabels[amenityType]} - {date}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Proof of Payment Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Proof of Payment</CardTitle>
              <CardDescription>Upload your payment receipt (optional for now, required for confirmation)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!uploadedProofUrl ? (
                <>
                  <div className="border-2 border-dashed rounded-lg p-6">
                    <div className="flex flex-col items-center text-center">
                      <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload screenshot or receipt of your payment
                      </p>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="proof-upload"
                      />
                      <label htmlFor="proof-upload">
                        <Button type="button" variant="outline" asChild>
                          <span>Choose File</span>
                        </Button>
                      </label>
                      {proofFile && (
                        <p className="text-sm mt-2">{proofFile.name}</p>
                      )}
                    </div>
                  </div>
                  {proofFile && (
                    <Button
                      type="button"
                      onClick={handleUploadProof}
                      disabled={uploadingProof}
                      className="w-full"
                    >
                      {uploadingProof ? 'Uploading...' : 'Upload Proof'}
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900">Proof uploaded</p>
                    <p className="text-xs text-green-700">You can upload again if needed</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUploadedProofUrl('');
                      setProofFile(null);
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                You can also upload your proof later through the confirmation page.
              </p>
            </CardContent>
          </Card>

          {/* Terms & Conditions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={formData.terms_agreed}
                  onCheckedChange={(v) => setFormData({ ...formData, terms_agreed: !!v })}
                />
                <label htmlFor="terms" className="text-sm cursor-pointer">
                  I agree to the{' '}
                  <Link to="/external-rentals/terms" target="_blank" className="text-primary underline">
                    Terms and Conditions
                  </Link>
                  {' '}for external amenity rentals *
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1"
              disabled={submitting}
            >
              Go Back
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Booking Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript type-check**

Run: `rtk tsc --noEmit`
Expected: No errors (may have errors for missing Textarea and Checkbox components)

- [ ] **Step 3: Add missing UI components if needed**

**File:** `src/components/ui/textarea.tsx` (if not exists)

```typescript
import * as React from "react"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
```

**File:** `src/components/ui/checkbox.tsx` (if not exists)

```typescript
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
```

- [ ] **Step 4: TypeScript type-check**

Run: `rtk tsc --noEmit`
Expected: No errors

### Task 9: Create ConfirmationPage (status tracker)

**Files:**
- Create: `src/pages/public/ConfirmationPage.tsx`

- [ ] **Step 1: Write the page component**

```typescript
// src/pages/public/ConfirmationPage.tsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { PublicBookingResponse } from '@/types';
import { CheckCircle2, Clock, XCircle, AlertCircle, Upload, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';

const statusConfig = {
  pending_payment: {
    icon: Clock,
    label: 'Pending Payment',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    description: 'Please upload your proof of payment to proceed',
  },
  pending_verification: {
    icon: Clock,
    label: 'Under Review',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    description: 'We are verifying your payment. You will receive an update within 24-48 hours.',
  },
  confirmed: {
    icon: CheckCircle2,
    label: 'Confirmed',
    color: 'bg-green-100 text-green-800 border-green-200',
    description: 'Your booking has been confirmed! See details below.',
  },
  rejected: {
    icon: XCircle,
    label: 'Rejected',
    color: 'bg-red-100 text-red-800 border-red-200',
    description: 'Your booking request has been declined.',
  },
  cancelled: {
    icon: AlertCircle,
    label: 'Cancelled',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    description: 'This booking has been cancelled.',
  },
};

export function ConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<PublicBookingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (id) {
      loadBooking();
    }
  }, [id]);

  async function loadBooking() {
    if (!id) return;

    try {
      setLoading(true);
      const result = await api.public.getBookingStatus(id);
      if (result.data) {
        setBooking(result.data as PublicBookingResponse);
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      toast.error('Failed to load booking status');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    await loadBooking();
  }

  async function handleUploadProof() {
    if (!proofFile || !id) return;

    if (proofFile.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      // TODO: Implement R2 upload
      const url = `https://r2-storage.example.com/proofs/${Date.now()}-${proofFile.name}`;

      await api.public.uploadPaymentProof(id, url);
      toast.success('Proof of payment uploaded');
      await loadBooking();
      setProofFile(null);
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error('Failed to upload proof of payment');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-muted-foreground mb-2">Booking Not Found</h1>
        <p className="text-muted-foreground mb-6">The booking you're looking for doesn't exist.</p>
        <Link to="/external-rentals">
          <Button>Browse Amenities</Button>
        </Link>
      </div>
    );
  }

  const status = statusConfig[booking.status as keyof typeof statusConfig] || statusConfig.pending_payment;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <Link to="/external-rentals" className="text-muted-foreground hover:text-foreground">
            ← Back to Amenities
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Status Banner */}
        <Card className={`border-2 ${status.color} mb-6`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <StatusIcon className="w-8 h-8 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1">{status.label}</h2>
                <p className="text-sm opacity-80">{status.description}</p>
                {booking.rejection_reason && (
                  <div className="mt-3 p-3 bg-white/50 rounded-lg">
                    <p className="text-sm font-medium">Reason:</p>
                    <p className="text-sm">{booking.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>Reference Number: {booking.reference_number}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Amenity</p>
                <p className="font-medium">{booking.amenity_type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Time Slot</p>
                <p className="font-medium">{booking.slot === 'AM' ? 'Morning (8AM-12PM)' : booking.slot === 'PM' ? 'Afternoon (1PM-5PM)' : 'Full Day (8AM-5PM)'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {new Date(booking.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-bold text-lg">₱{booking.amount.toLocaleString()}</p>
              </div>
            </div>
            {booking.time_of_day && (
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">Request received at {booking.time_of_day}</p>
              </div>
            )}
            {booking.admin_notes && (
              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground mb-1">Admin Notes:</p>
                <p className="text-sm">{booking.admin_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Proof of Payment Upload (for pending_payment) */}
        {booking.status === 'pending_payment' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Proof of Payment</CardTitle>
              <CardDescription>Upload your payment receipt to proceed with your booking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6">
                <div className="flex flex-col items-center text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload screenshot or receipt of your payment
                  </p>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="max-w-xs"
                  />
                  {proofFile && (
                    <p className="text-sm mt-2">{proofFile.name}</p>
                  )}
                </div>
              </div>
              {proofFile && (
                <Button
                  onClick={handleUploadProof}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? 'Uploading...' : 'Upload Proof'}
                </Button>
              )}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Payment Details:</p>
                <p className="text-sm">GCash: 0917-XXX-XXXX (Laguna Hills HOA)</p>
                <p className="text-sm">BPI: XXXX-XXXX-XXXX (Laguna Hills HOA Association)</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirmed State Info */}
        {booking.status === 'confirmed' && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-green-900 mb-2">What's Next?</h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• Arrive 15 minutes before your scheduled time</li>
                <li>• Present your booking confirmation upon arrival</li>
                <li>• Follow all HOA rules and regulations</li>
                <li>• Clean up after your event</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mt-6">
          <Link to="/external-rentals" className="flex-1">
            <Button variant="outline" className="w-full">
              Make Another Booking
            </Button>
          </Link>
          {booking.status === 'pending_payment' && (
            <Link to={`/external-rentals/book?amenity=${booking.amenity_type}&date=${booking.date}&slot=${booking.slot}`} className="flex-1">
              <Button variant="default" className="w-full">
                Modify Booking
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SuccessPage**

**File:** `src/pages/public/SuccessPage.tsx`

```typescript
// src/pages/public/SuccessPage.tsx
import { useParams, Link, useEffect } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function SuccessPage() {
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    // Auto-redirect to confirmation page after 3 seconds
    const timer = setTimeout(() => {
      window.location.href = `/external-rentals/confirmation/${id}`;
    }, 3000);

    return () => clearTimeout(timer);
  }, [id]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-12 pb-8 text-center">
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">Booking Request Submitted!</h1>
          <p className="text-muted-foreground mb-8">
            Your booking request has been received. Please upload your proof of payment to proceed with confirmation.
          </p>

          <div className="bg-muted p-4 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground">Booking Reference</p>
            <p className="text-lg font-mono font-bold">{id?.slice(0, 8).toUpperCase()}</p>
          </div>

          <Link to={`/external-rentals/confirmation/${id}`}>
            <Button className="w-full">
              View Booking Status
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>

          <p className="text-xs text-muted-foreground mt-4">
            Redirecting automatically...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript type-check**

Run: `rtk tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/public/BookingPage.tsx src/pages/public/ConfirmationPage.tsx src/pages/public/SuccessPage.tsx
git commit -m "feat(public): add booking form and confirmation pages"
```

---

## Chunk 7: Register Public Routes

### Task 10: Register public routes in App

**Files:**
- Modify: `src/main.tsx` or wherever routes are defined

- [ ] **Step 1: Add public routes**

Find the routes configuration and add:

```typescript
import { ExternalRentalsPage } from '@/pages/public/ExternalRentalsPage';
import { AmenityDetailPage } from '@/pages/public/AmenityDetailPage';
import { BookingPage } from '@/pages/public/BookingPage';
import { ConfirmationPage } from '@/pages/public/ConfirmationPage';
import { SuccessPage } from '@/pages/public/SuccessPage';

// Add routes (unauthenticated - accessible to everyone):
<Route path="/external-rentals" element={<ExternalRentalsPage />} />
<Route path="/external-rentals/:amenityType" element={<AmenityDetailPage />} />
<Route path="/external-rentals/book" element={<BookingPage />} />
<Route path="/external-rentals/confirmation/:id" element={<ConfirmationPage />} />
<Route path="/external-rentals/success/:id" element={<SuccessPage />} />
```

- [ ] **Step 2: TypeScript type-check**

Run: `rtk tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx  # or appropriate file
git commit -m "feat(routes): register public booking routes"
```

---

## Chunk 8: Admin Enhancement - Pending Queue

### Task 11: Update ExternalRentalsTab with pending queue

**Files:**
- Modify: `src/pages/admin/reservations/ExternalRentalsTab.tsx`

- [ ] **Step 1: Add pending queue functionality**

Add after the existing state:

```typescript
// Add new state for pending queue
const [pendingRequests, setPendingRequests] = useState<ExtendedExternalRental[]>([]);
const [showPendingQueue, setShowPendingQueue] = useState(false);
const [selectedRequest, setSelectedRequest] = useState<ExtendedExternalRental | null>(null);
const [rejectReason, setRejectReason] = useState('');
const [isApproving, setIsApproving] = useState(false);
const [isRejecting, setIsRejecting] = useState(false);
const [autoRejectOthers, setAutoRejectOthers] = useState(false);

// Add function to load pending requests
const loadPendingRequests = async () => {
  try {
    const hoa_token = localStorage.getItem("hoa_token");
    const response = await fetch("/api/admin/external-rentals/pending", {
      headers: { Authorization: `Bearer ${hoa_token}` },
    });

    if (!response.ok) throw new Error("Failed to load pending requests");

    const data = await response.json();
    setPendingRequests(data.data.requests || []);
  } catch (error) {
    console.error("Error loading pending requests:", error);
    toast.error("Failed to load pending requests");
  }
};

// Add approve handler
const handleApprove = async (request: ExtendedExternalRental) => {
  if (!confirm(`Approve booking from ${request.guest_name}?`)) return;

  try {
    setIsApproving(true);
    const hoa_token = localStorage.getItem("hoa_token");

    const response = await fetch(`/api/admin/external-rentals/${request.id}/approve`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hoa_token}`,
      },
      body: JSON.stringify({ auto_reject: autoRejectOthers }),
    });

    if (!response.ok) throw new Error("Failed to approve booking");

    await loadPendingRequests();
    await loadRentals();
    toast.success("Booking approved successfully");
    setSelectedRequest(null);
  } catch (error) {
    console.error("Error approving booking:", error);
    toast.error("Failed to approve booking");
  } finally {
    setIsApproving(false);
  }
};

// Add reject handler
const handleReject = async () => {
  if (!selectedRequest) return;
  if (!rejectReason.trim()) {
    toast.error("Please provide a rejection reason");
    return;
  }

  try {
    setIsRejecting(true);
    const hoa_token = localStorage.getItem("hoa_token");

    const response = await fetch(`/api/admin/external-rentals/${selectedRequest.id}/reject`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hoa_token}`,
      },
      body: JSON.stringify({ reason: rejectReason }),
    });

    if (!response.ok) throw new Error("Failed to reject booking");

    await loadPendingRequests();
    await loadRentals();
    toast.success("Booking rejected");
    setSelectedRequest(null);
    setRejectReason("");
  } catch (error) {
    console.error("Error rejecting booking:", error);
    toast.error("Failed to reject booking");
  } finally {
    setIsRejecting(false);
  }
};

// Add useEffect to load pending requests when tab is active
useEffect(() => {
  if (showPendingQueue) {
    loadPendingRequests();
  }
}, [showPendingQueue]);
```

- [ ] **Step 2: Add pending queue UI**

Add after the stats section:

```tsx
{/* Pending Queue Toggle */}
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
    <h3 className="text-lg font-semibold">All Bookings</h3>
    {pendingRequests.length > 0 && (
      <Badge variant="destructive" className="ml-2">
        {pendingRequests.length} pending
      </Badge>
    )}
  </div>
  <Button
    variant={showPendingQueue ? "default" : "outline"}
    onClick={() => setShowPendingQueue(!showPendingQueue)}
  >
    {showPendingQueue ? "Show All" : "Show Pending Queue"}
  </Button>
</div>

{/* Pending Queue */}
{showPendingQueue && pendingRequests.length > 0 && (
  <Card className="mb-6 border-orange-200 bg-orange-50">
    <CardHeader className="pb-3">
      <CardTitle className="text-lg flex items-center gap-2">
        <Clock className="w-5 h-5 text-orange-600" />
        Pending Approval Queue
      </CardTitle>
      <CardDescription>
        Sorted by request time (oldest first)
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {pendingRequests.map((request) => (
          <div
            key={request.id}
            className={`p-4 rounded-lg border-2 transition-all ${
              request.is_first
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white"
            }`}
          >
            {request.is_first && (
              <Badge className="mb-2" variant="default">
                First Request
              </Badge>
            )}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="font-semibold">{request.guest_name}</p>
                  <Badge variant="outline">{request.amenity_type}</Badge>
                  <Badge variant="secondary">{request.slot}</Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Date: {new Date(request.date).toLocaleDateString()}</p>
                  <p>Requested: {request.time_of_day}</p>
                  <p>Email: {request.guest_email}</p>
                  <p>Phone: {request.guest_phone}</p>
                  <p className="font-medium">Amount: ₱{request.amount?.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedRequest(request)}
                >
                  View
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(request)}
                  disabled={isApproving}
                >
                  Approve
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 3: Add approval/rejection dialog**

Add before the closing tag:

```tsx
{/* Approval/Rejection Dialog */}
{selectedRequest && (
  <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Review Booking Request</DialogTitle>
        <DialogDescription>
          {selectedRequest.guest_name} - {amenityLabels[selectedRequest.amenity_type]} on{" "}
          {new Date(selectedRequest.date).toLocaleDateString()}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Time Slot</p>
            <p className="font-medium">{slotLabels[selectedRequest.slot]}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Amount</p>
            <p className="font-medium">₱{selectedRequest.amount?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{selectedRequest.guest_email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p className="font-medium">{selectedRequest.guest_phone}</p>
          </div>
        </div>

        {selectedRequest.proof_of_payment_url && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Proof of Payment</p>
            <a
              href={selectedRequest.proof_of_payment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              View proof →
            </a>
          </div>
        )}

        {selectedRequest.is_first && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              This is the first request for this time slot.
            </p>
          </div>
        )}
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setSelectedRequest(null);
            setRejectReason("");
          }}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            setSelectedRequest(null);
            setRejectReason("");
          }}
          disabled={isApproving}
        >
          Reject
        </Button>
        <Button
          onClick={() => {
            handleApprove(selectedRequest);
          }}
          disabled={isApproving}
        >
          {isApproving ? "Approving..." : "Approve Booking"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)}

{selectedRequest && !selectedRequest.proof_of_payment_url && (
  <Dialog open={!!rejectReason} onOpenChange={() => setRejectReason("")}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Reject Booking</DialogTitle>
        <DialogDescription>
          Please provide a reason for rejecting this booking
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="reason">Rejection Reason *</Label>
          <textarea
            id="reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why this booking is being rejected..."
            rows={3}
            required
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="autoReject"
            checked={autoRejectOthers}
            onCheckedChange={(v) => setAutoRejectOthers(!!v)}
          />
          <label htmlFor="autoReject" className="text-sm cursor-pointer">
            Also auto-reject {pendingRequests.length - 1} other pending request(s) for this slot
          </label>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => {
            setRejectReason("");
            setSelectedRequest(null);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleReject}
          disabled={isRejecting || !rejectReason.trim()}
        >
          {isRejecting ? "Rejecting..." : "Reject Booking"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)}
```

- [ ] **Step 4: Add imports**

Add to imports:

```typescript
import { Clock, Eye } from "lucide-react";
import type { ExtendedExternalRental } from "@/types";
```

- [ ] **Step 5: TypeScript type-check**

Run: `rtk tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/reservations/ExternalRentalsTab.tsx
git commit -m "feat(admin): add pending queue with timestamping for fair approvals"
```

---

## Chunk 9: Build & Verify

### Task 12: Run build and verify

- [ ] **Step 1: Install dependencies**

Run: `npm install`
Expected: All packages installed successfully

- [ ] **Step 2: Type-check**

Run: `rtk tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Lint**

Run: `rtk lint`
Expected: No errors

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build completes without errors

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(public-external-booking): complete implementation"
```

---

## Summary

This plan implements the complete Public External Booking System with:

1. **Database Schema**: Migration 0020 with updated external_rentals table (no UNIQUE constraint), new booking_blocked_dates table, pricing in system_settings
2. **Backend**: Public routes (no auth), admin approve/reject endpoints, availability checking (confirmed only), pricing calculation
3. **Frontend**: Browse page, detail page with calendar, booking form, confirmation/status tracker
4. **Admin**: Pending queue with timestamping, first-request highlighting, auto-reject option
5. **Request Timestamping**: created_at display, time_of_day formatting, oldest-first sorting, conflict warnings

**Key Design Decisions:**
- Pending requests don't block slots (only confirmed bookings do via booking_blocked_dates)
- Residents get 50% discount automatically when authenticated
- IP addresses retained for 90 days (GDPR compliance)
- Multiple pending requests allowed; admin decides based on timestamp
- Fair "first come, first served" with visual indicators
