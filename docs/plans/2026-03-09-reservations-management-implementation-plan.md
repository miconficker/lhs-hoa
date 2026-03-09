# Reservations Management & Admin Interface Reorganization - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add reservations management (time blocks, external rentals), add Tennis Court amenity, and reorganize admin interface with vertical sidebar navigation.

**Architecture:**
- Database: Add `time_blocks` and `external_rentals` tables, update `reservations.amenity_type` constraint
- Backend API: New admin routes for time blocks and external rentals, update availability logic
- Frontend: Vertical sidebar for admin nav, user dropdown navbar, three-tab reservations management UI

**Tech Stack:**
- Frontend: React 18 + TypeScript + Tailwind CSS + shadcn/ui + lucide-react icons
- Backend: Cloudflare Workers + Hono framework + D1 (SQLite)
- Migration: SQL migrations via wrangler

---

## Phase 1: Database Schema Changes

### Task 1: Create Database Migration

**Files:**
- Create: `migrations/0014_reservations_enhancements.sql`

**Step 1: Write migration file**

```sql
-- Migration: 0014_reservations_enhancements.sql
-- Description: Add tennis court amenity, time blocks table, external rentals table
-- Date: 2026-03-09

-- ============================================================================
-- UPDATE reservations table to include tennis-court
-- SQLite doesn't support ALTER CONSTRAINT, so recreate table
-- ============================================================================
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

-- Recreate indexes for reservations
CREATE INDEX IF NOT EXISTS idx_reservations_household ON reservations(household_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_amenity_date ON reservations(amenity_type, date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- ============================================================================
-- CREATE time_blocks table
-- ============================================================================
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

-- ============================================================================
-- CREATE external_rentals table
-- ============================================================================
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

**Step 2: Run migration locally**

```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0014_reservations_enhancements.sql --local
```

Expected: Table created successfully messages

**Step 3: Verify migration**

```bash
npx wrangler d1 execute laguna_hills_hoa --local --command "PRAGMA table_info(time_blocks);"
npx wrangler d1 execute laguna_hills_hoa --local --command "PRAGMA table_info(external_rentals);"
```

Expected: Shows table schemas with all columns

**Step 4: Commit**

```bash
git add migrations/0014_reservations_enhancements.sql
git commit -m "feat(db): add time blocks and external rentals tables, add tennis court amenity"
```

---

## Phase 2: Type Definitions

### Task 2: Update Types for New Features

**Files:**
- Modify: `src/types/index.ts:136-156`

**Step 1: Read current types around line 136**

Read lines 135-160 of `src/types/index.ts` to see current AmenityType and Reservation types.

**Step 2: Add new type definitions**

After line 156 (after AmenityAvailability interface), add:

```typescript
// New types for reservations management
export type TimeBlockSlot = "AM" | "PM" | "FULL_DAY";
export type RentalPaymentStatus = "unpaid" | "partial" | "paid" | "overdue";

export interface TimeBlock {
  id: string;
  amenity_type: AmenityType;
  date: string;
  slot: TimeBlockSlot;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface ExternalRental {
  id: string;
  amenity_type: AmenityType;
  date: string;
  slot: TimeBlockSlot;
  renter_name: string;
  renter_contact?: string;
  amount: number;
  payment_status: RentalPaymentStatus;
  amount_paid: number;
  payment_method?: string;
  receipt_number?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface TimeBlocksResponse {
  time_blocks: TimeBlock[];
}

export interface ExternalRentalsResponse {
  rentals: ExternalRental[];
}

export interface CreateTimeBlockInput {
  amenity_type: AmenityType;
  date: string; // YYYY-MM-DD format
  slot: TimeBlockSlot;
  reason: string;
}

export interface CreateExternalRentalInput {
  amenity_type: AmenityType;
  date: string; // YYYY-MM-DD format
  slot: TimeBlockSlot;
  renter_name: string;
  renter_contact?: string;
  amount: number;
  notes?: string;
}

export interface RecordPaymentInput {
  amount: number;
  payment_method?: string;
  receipt_number?: string;
}
```

**Step 3: Update AmenityType to include tennis-court**

Find line 136 and change:
```typescript
// OLD:
export type AmenityType = "clubhouse" | "pool" | "basketball-court";

// NEW:
export type AmenityType = "clubhouse" | "pool" | "basketball-court" | "tennis-court";
```

**Step 4: Update AmenityAvailability to include blocked reason**

Find the `AmenityAvailability` interface (around line 151) and update:

```typescript
// OLD:
export interface AmenityAvailability {
  date: string;
  amenity_type: AmenityType;
  am_available: boolean;
  pm_available: boolean;
}

// NEW:
export interface AmenityAvailability {
  date: string;
  amenity_type: AmenityType;
  am_available: boolean;
  pm_available: boolean;
  am_blocked?: boolean; // true if blocked by time block
  pm_blocked?: boolean; // true if blocked by time block
  block_reason?: string; // reason if blocked
}
```

**Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 6: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add TimeBlock, ExternalRental types, update AmenityType for tennis court"
```

---

## Phase 3: Backend API - Time Blocks

### Task 3: Create Time Blocks API Routes

**Files:**
- Create: `functions/routes/admin/time-blocks.ts`

**Step 1: Create time blocks router file**

Create `functions/routes/admin/time-blocks.ts`:

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const timeBlockSchema = z.object({
  amenity_type: z.enum(['clubhouse', 'pool', 'basketball-court', 'tennis-court']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
  slot: z.enum(['AM', 'PM', 'FULL_DAY']),
  reason: z.string().min(1, 'Reason is required'),
});

export const timeBlocksRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Get all time blocks (with optional filters)
timeBlocksRouter.get('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const amenityType = c.req.query('amenity_type');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');

  let query = 'SELECT * FROM time_blocks WHERE 1=1';
  const params: any[] = [];

  if (amenityType) {
    query += ' AND amenity_type = ?';
    params.push(amenityType);
  }
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY date ASC, slot ASC';

  const result = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ time_blocks: result.results || [] });
});

// Get single time block
timeBlocksRouter.get('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  const result = await c.env.DB.prepare(
    'SELECT * FROM time_blocks WHERE id = ?'
  ).bind(id).first();

  if (!result) {
    return c.json({ error: 'Time block not found' }, 404);
  }

  return c.json({ time_block: result });
});

// Create time block
timeBlocksRouter.post('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = timeBlockSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { amenity_type, date, slot, reason } = result.data;

  // Check for conflicts
  const existing = await c.env.DB.prepare(
    `SELECT id FROM time_blocks
     WHERE amenity_type = ? AND date = ? AND slot = ?`
  ).bind(amenity_type, date, slot).first();

  if (existing) {
    return c.json({
      error: 'This time slot is already blocked.'
    }, 409);
  }

  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO time_blocks (id, amenity_type, date, slot, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, amenity_type, date, slot, reason, authUser.id).run();

  const block = await c.env.DB.prepare(
    'SELECT * FROM time_blocks WHERE id = ?'
  ).bind(id).first();

  return c.json({ time_block: block }, 201);
});

// Update time block
timeBlocksRouter.put('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const result = timeBlockSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { amenity_type, date, slot, reason } = result.data;

  // Check if exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM time_blocks WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'Time block not found' }, 404);
  }

  // Check for conflicts (excluding self)
  const conflict = await c.env.DB.prepare(
    `SELECT id FROM time_blocks
     WHERE amenity_type = ? AND date = ? AND slot = ? AND id != ?`
  ).bind(amenity_type, date, slot, id).first();

  if (conflict) {
    return c.json({
      error: 'This time slot is already blocked.'
    }, 409);
  }

  await c.env.DB.prepare(
    `UPDATE time_blocks
     SET amenity_type = ?, date = ?, slot = ?, reason = ?
     WHERE id = ?`
  ).bind(amenity_type, date, slot, reason, id).run();

  const block = await c.env.DB.prepare(
    'SELECT * FROM time_blocks WHERE id = ?'
  ).bind(id).first();

  return c.json({ time_block: block });
});

// Delete time block
timeBlocksRouter.delete('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  await c.env.DB.prepare('DELETE FROM time_blocks WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});
```

**Step 2: Register time blocks router in main admin routes**

Find the file that registers admin routers. Look for `functions/routes/admin.ts` or similar.

Check existing routes file structure:

```bash
ls -la functions/routes/
```

If `functions/routes/admin.ts` exists, read it and add:

```typescript
import { timeBlocksRouter } from './admin/time-blocks';

// Add to admin router:
app.route('/admin/time-blocks', timeBlocksRouter);
```

If no admin.ts file, create it or add to the main router in `functions/worker.ts` or similar.

**Step 3: Test API endpoints**

Start dev server and test:

```bash
curl -X POST http://localhost:8788/api/admin/time-blocks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"amenity_type":"pool","date":"2026-03-15","slot":"AM","reason":"Maintenance"}'
```

Expected: Returns created time block with id

**Step 4: Commit**

```bash
git add functions/routes/admin/time-blocks.ts
git add functions/routes/admin.ts # or whichever file you modified
git commit -m "feat(api): add time blocks CRUD endpoints"
```

---

## Phase 4: Backend API - External Rentals

### Task 4: Create External Rentals API Routes

**Files:**
- Create: `functions/routes/admin/external-rentals.ts`

**Step 1: Create external rentals router**

Create `functions/routes/admin/external-rentals.ts`:

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const externalRentalSchema = z.object({
  amenity_type: z.enum(['clubhouse', 'pool', 'basketball-court', 'tennis-court']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
  slot: z.enum(['AM', 'PM', 'FULL_DAY']),
  renter_name: z.string().min(1, 'Renter name is required'),
  renter_contact: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  notes: z.string().optional(),
});

const recordPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  payment_method: z.string().optional(),
  receipt_number: z.string().optional(),
});

export const externalRentalsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Get all external rentals (with filters)
externalRentalsRouter.get('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const amenityType = c.req.query('amenity_type');
  const paymentStatus = c.req.query('payment_status');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');

  let query = 'SELECT * FROM external_rentals WHERE 1=1';
  const params: any[] = [];

  if (amenityType) {
    query += ' AND amenity_type = ?';
    params.push(amenityType);
  }
  if (paymentStatus) {
    query += ' AND payment_status = ?';
    params.push(paymentStatus);
  }
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY date DESC, created_at DESC';

  const result = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ rentals: result.results || [] });
});

// Export to CSV
externalRentalsRouter.get('/export', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await c.env.DB.prepare(
    'SELECT * FROM external_rentals ORDER BY date DESC'
  ).all();

  const rentals = result.results || [];

  // Generate CSV
  const headers = ['ID', 'Amenity', 'Date', 'Slot', 'Renter Name', 'Contact', 'Amount', 'Paid', 'Status', 'Payment Method', 'Receipt #', 'Notes', 'Created At'];
  const rows = rentals.map((r: any) => [
    r.id,
    r.amenity_type,
    r.date,
    r.slot,
    `"${r.renter_name}"`,
    `"${r.renter_contact || ''}"`,
    r.amount,
    r.amount_paid,
    r.payment_status,
    r.payment_method || '',
    r.receipt_number || '',
    `"${r.notes || ''}"`,
    r.created_at
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  return c.text(csv, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="external-rentals-${new Date().toISOString().split('T')[0]}.csv"`
  });
});

// Get single rental
externalRentalsRouter.get('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  const result = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!result) {
    return c.json({ error: 'External rental not found' }, 404);
  }

  return c.json({ rental: result });
});

// Create external rental
externalRentalsRouter.post('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = externalRentalSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { amenity_type, date, slot, renter_name, renter_contact, amount, notes } = result.data;

  // Check for conflicts
  const existing = await c.env.DB.prepare(
    `SELECT id FROM external_rentals
     WHERE amenity_type = ? AND date = ? AND slot = ?`
  ).bind(amenity_type, date, slot).first();

  if (existing) {
    return c.json({
      error: 'This time slot is already booked.'
    }, 409);
  }

  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO external_rentals (id, amenity_type, date, slot, renter_name, renter_contact, amount, payment_status, amount_paid, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'unpaid', 0, ?, ?)`
  ).bind(id, amenity_type, date, slot, renter_name, renter_contact || null, amount, notes || null, authUser.id).run();

  const rental = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  return c.json({ rental }, 201);
});

// Update rental
externalRentalsRouter.put('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();

  // Build dynamic update query
  const updates: string[] = [];
  const params: any[] = [];

  if (body.amenity_type) {
    updates.push('amenity_type = ?');
    params.push(body.amenity_type);
  }
  if (body.date) {
    updates.push('date = ?');
    params.push(body.date);
  }
  if (body.slot) {
    updates.push('slot = ?');
    params.push(body.slot);
  }
  if (body.renter_name) {
    updates.push('renter_name = ?');
    params.push(body.renter_name);
  }
  if (body.renter_contact !== undefined) {
    updates.push('renter_contact = ?');
    params.push(body.renter_contact || null);
  }
  if (body.amount !== undefined) {
    updates.push('amount = ?');
    params.push(body.amount);
  }
  if (body.notes !== undefined) {
    updates.push('notes = ?');
    params.push(body.notes || null);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  params.push(id);

  await c.env.DB.prepare(
    `UPDATE external_rentals SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...params).run();

  const rental = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  return c.json({ rental });
});

// Record payment
externalRentalsRouter.post('/:id/pay', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const result = recordPaymentSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { amount, payment_method, receipt_number } = result.data;

  // Get rental
  const rental = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!rental) {
    return c.json({ error: 'External rental not found' }, 404);
  }

  const currentAmountPaid = (rental.amount_paid as number) || 0;
  const totalAmount = (rental.amount as number);
  const newAmountPaid = currentAmountPaid + amount;

  // Determine new payment status
  let newStatus = 'partial';
  if (newAmountPaid >= totalAmount) {
    newStatus = 'paid';
  }

  await c.env.DB.prepare(
    `UPDATE external_rentals
     SET amount_paid = ?, payment_status = ?, payment_method = ?, receipt_number = ?
     WHERE id = ?`
  ).bind(newAmountPaid, newStatus, payment_method || null, receipt_number || null, id).run();

  const updated = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  return c.json({ rental: updated });
});

// Delete rental
externalRentalsRouter.delete('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  await c.env.DB.prepare('DELETE FROM external_rentals WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});
```

**Step 2: Register external rentals router**

Add to the admin routes file (same as Task 3, Step 2):

```typescript
import { externalRentalsRouter } from './admin/external-rentals';

// Add to admin router:
app.route('/admin/external-rentals', externalRentalsRouter);
```

**Step 3: Test API endpoints**

```bash
curl -X POST http://localhost:8788/api/admin/external-rentals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"amenity_type":"pool","date":"2026-03-20","slot":"PM","renter_name":"John Doe","amount":5000}'
```

Expected: Returns created rental with id

**Step 4: Commit**

```bash
git add functions/routes/admin/external-rentals.ts
git add functions/routes/admin.ts # or whichever file
git commit -m "feat(api): add external rentals CRUD endpoints with payment tracking"
```

---

## Phase 5: Update Reservations API for New Tables

### Task 5: Update Availability Check

**Files:**
- Modify: `functions/routes/reservations.ts`

**Step 1: Read current availability endpoint**

Read `functions/routes/reservations.ts` and find the `/availability` GET endpoint (around line 85-120 based on earlier read).

**Step 2: Update availability query**

Find the availability query and update it to check time_blocks and external_rentals.

Replace the query section with:

```typescript
// Get all confirmed/pending reservations for the date range and amenity
const query = `
  SELECT date, slot
  FROM reservations
  WHERE amenity_type = ?
    AND date BETWEEN ? AND ?
    AND status IN ('pending', 'confirmed')
`;

const reservations = await c.env.DB.prepare(query)
  .bind(amenityType, startDate, endDate)
  .all();

// Also check time blocks
const blockQuery = `
  SELECT date, slot, reason
  FROM time_blocks
  WHERE amenity_type = ?
    AND date BETWEEN ? AND ?
`;

const blocks = await c.env.DB.prepare(blockQuery)
  .bind(amenityType, startDate, endDate)
  .all();

// Also check external rentals
const rentalQuery = `
  SELECT date, slot
  FROM external_rentals
  WHERE amenity_type = ?
    AND date BETWEEN ? AND ?
`;

const rentals = await c.env.DB.prepare(rentalQuery)
  .bind(amenityType, startDate, endDate)
  .all();
```

**Step 3: Update availability building logic**

Replace the availability building section with:

```typescript
// Build availability map
const availability: Record<string, {
  am_available: boolean;
  pm_available: boolean;
  am_blocked?: boolean;
  pm_blocked?: boolean;
  block_reason?: string;
}> = {};

// Parse dates and initialize all as available
const start = new Date(startDate);
const end = new Date(endDate);
const currentDate = new Date(start);

while (currentDate <= end) {
  const dateStr = currentDate.toISOString().split('T')[0];
  availability[dateStr] = {
    am_available: true,
    pm_available: true,
    am_blocked: false,
    pm_blocked: false
  };
  currentDate.setDate(currentDate.getDate() + 1);
}

// Mark unavailable based on reservations
for (const row of reservations.results || []) {
  const dateStr = row.date as string;
  const slot = row.slot as string;

  if (availability[dateStr]) {
    if (slot === 'AM') {
      availability[dateStr].am_available = false;
    } else if (slot === 'PM') {
      availability[dateStr].pm_available = false;
    }
  }
}

// Mark unavailable based on time blocks
for (const row of blocks.results || []) {
  const dateStr = row.date as string;
  const slot = row.slot as string;
  const reason = row.reason as string;

  if (availability[dateStr]) {
    if (slot === 'AM' || slot === 'FULL_DAY') {
      availability[dateStr].am_available = false;
      availability[dateStr].am_blocked = true;
      availability[dateStr].block_reason = reason;
    }
    if (slot === 'PM' || slot === 'FULL_DAY') {
      availability[dateStr].pm_available = false;
      availability[dateStr].pm_blocked = true;
      availability[dateStr].block_reason = reason;
    }
  }
}

// Mark unavailable based on external rentals
for (const row of rentals.results || []) {
  const dateStr = row.date as string;
  const slot = row.slot as string;

  if (availability[dateStr]) {
    if (slot === 'AM' || slot === 'FULL_DAY') {
      availability[dateStr].am_available = false;
    }
    if (slot === 'PM' || slot === 'FULL_DAY') {
      availability[dateStr].pm_available = false;
    }
  }
}

// Convert to array format
const availabilityList = Object.entries(availability).map(([date, slots]) => ({
  date,
  amenity_type: amenityType as 'clubhouse' | 'pool' | 'basketball-court' | 'tennis-court',
  am_available: slots.am_available,
  pm_available: slots.pm_available,
  am_blocked: slots.am_blocked,
  pm_blocked: slots.pm_blocked,
  block_reason: slots.block_reason
}));
```

**Step 4: Update reservation creation validation**

Find the POST `/` endpoint (create reservation) and add validation for time blocks and external rentals.

Add after the double-booking check:

```typescript
// Check for time blocks
const timeBlock = await c.env.DB.prepare(
  `SELECT reason FROM time_blocks
   WHERE amenity_type = ? AND date = ? AND slot IN (?, 'FULL_DAY')`
).bind(amenity_type, date, slot).first();

if (timeBlock) {
  return c.json({
    error: `This time is not available. Reason: ${timeBlock.reason}`
  }, 409);
}

// Check for external rentals
const externalRental = await c.env.DB.prepare(
  `SELECT renter_name FROM external_rentals
   WHERE amenity_type = ? AND date = ? AND slot IN (?, 'FULL_DAY')`
).bind(amenity_type, date, slot).first();

if (externalRental) {
  return c.json({
    error: 'This time is already booked.'
  }, 409);
}
```

**Step 5: Test availability endpoint**

```bash
curl "http://localhost:8788/api/reservations/availability?start_date=2026-03-01&end_date=2026-03-31&amenity_type=pool"
```

Expected: Returns availability with blocked slots indicated

**Step 6: Commit**

```bash
git add functions/routes/reservations.ts
git commit -m "feat(api): update availability check to include time blocks and external rentals"
```

---

## Phase 6: Frontend API Client

### Task 6: Add API Client Functions

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Read API file structure**

Read `src/lib/api.ts` to understand the pattern. Look for `reservations` section.

**Step 2: Add new API methods**

Find the reservations API object and add new methods:

```typescript
// Add to api object:

// Time Blocks
timeBlocks: {
  list: async (filters?: { amenity_type?: string; start_date?: string; end_date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.amenity_type) params.append('amenity_type', filters.amenity_type);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);

    const response = await fetch(`${API_BASE}/admin/time-blocks?${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse<TimeBlocksResponse>(response);
  },

  get: async (id: string) => {
    const response = await fetch(`${API_BASE}/admin/time-blocks/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse<{ time_block: TimeBlock }>(response);
  },

  create: async (data: CreateTimeBlockInput) => {
    const response = await fetch(`${API_BASE}/admin/time-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });
    return handleResponse<{ time_block: TimeBlock }>(response);
  },

  update: async (id: string, data: Partial<CreateTimeBlockInput>) => {
    const response = await fetch(`${API_BASE}/admin/time-blocks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });
    return handleResponse<{ time_block: TimeBlock }>(response);
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/admin/time-blocks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse<{ success: boolean }>(response);
  }
},

// External Rentals
externalRentals: {
  list: async (filters?: {
    amenity_type?: string;
    payment_status?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.amenity_type) params.append('amenity_type', filters.amenity_type);
    if (filters?.payment_status) params.append('payment_status', filters.payment_status);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);

    const response = await fetch(`${API_BASE}/admin/external-rentals?${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse<ExternalRentalsResponse>(response);
  },

  get: async (id: string) => {
    const response = await fetch(`${API_BASE}/admin/external-rentals/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse<{ rental: ExternalRental }>(response);
  },

  create: async (data: CreateExternalRentalInput) => {
    const response = await fetch(`${API_BASE}/admin/external-rentals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });
    return handleResponse<{ rental: ExternalRental }>(response);
  },

  update: async (id: string, data: Partial<CreateExternalRentalInput>) => {
    const response = await fetch(`${API_BASE}/admin/external-rentals/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });
    return handleResponse<{ rental: ExternalRental }>(response);
  },

  recordPayment: async (id: string, data: RecordPaymentInput) => {
    const response = await fetch(`${API_BASE}/admin/external-rentals/${id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });
    return handleResponse<{ rental: ExternalRental }>(response);
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/admin/external-rentals/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse<{ success: boolean }>(response);
  },

  export: async () => {
    const response = await fetch(`${API_BASE}/admin/external-rentals/export`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || 'Export failed' };
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `external-rentals-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    return { data: { success: true } };
  }
}
```

**Step 3: Add type imports to api.ts**

At the top of the file, add the new type imports:

```typescript
import type {
  // ... existing imports
  TimeBlock,
  TimeBlocksResponse,
  ExternalRental,
  ExternalRentalsResponse,
  CreateTimeBlockInput,
  CreateExternalRentalInput,
  RecordPaymentInput
} from '@/types';
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): add time blocks and external rentals API client methods"
```

---

## Phase 7: Frontend - Admin Sidebar Component

### Task 7: Create Vertical Sidebar Component

**Files:**
- Create: `src/components/admin/Sidebar.tsx`

**Step 1: Create sidebar component**

Create `src/components/admin/Sidebar.tsx`:

```typescript
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/admin?tab=dashboard' },
  {
    id: 'users',
    label: 'Users & Access',
    icon: '👥',
    children: [
      { id: 'users-list', label: 'Users', icon: '', path: '/admin?tab=users' },
      { id: 'whitelist', label: 'Whitelist', icon: '', path: '/admin?tab=whitelist' },
      { id: 'employee-ids', label: 'Employee IDs', icon: '', path: '/admin?tab=employee-ids' }
    ]
  },
  {
    id: 'properties',
    label: 'Properties',
    icon: '🏠',
    children: [
      { id: 'households', label: 'Households', icon: '', path: '/admin?tab=households' },
      { id: 'lots', label: 'Lots', icon: '', path: '/admin?tab=lots' },
      { id: 'common-areas', label: 'Common Areas', icon: '', path: '/admin?tab=common-areas' }
    ]
  },
  {
    id: 'reservations',
    label: 'Reservations',
    icon: '🗓️',
    children: [
      { id: 'bookings', label: 'Bookings', icon: '', path: '/admin?section=reservations&tab=bookings' },
      { id: 'time-blocks', label: 'Time Blocks', icon: '', path: '/admin?section=reservations&tab=time-blocks' },
      { id: 'external-rentals', label: 'External Rentals', icon: '', path: '/admin?section=reservations&tab=external-rentals' }
    ]
  },
  {
    id: 'communications',
    label: 'Communications',
    icon: '💬',
    children: [
      { id: 'announcements', label: 'Announcements', icon: '', path: '/admin?tab=announcements' },
      { id: 'events', label: 'Events', icon: '', path: '/admin?tab=events' },
      { id: 'messages', label: 'Messages', icon: '', path: '/admin?tab=messages' }
    ]
  },
  {
    id: 'financials',
    label: 'Financials',
    icon: '💰',
    children: [
      { id: 'payments', label: 'Payments', icon: '', path: '/admin?tab=payments' },
      { id: 'dues-config', label: 'Dues Config', icon: '', path: '/admin?tab=dues-config' },
      { id: 'in-person-payments', label: 'In-Person Payments', icon: '', path: '/admin?tab=in-person-payments' }
    ]
  },
  {
    id: 'system',
    label: 'System',
    icon: '⚙️',
    children: [
      { id: 'settings', label: 'Settings', icon: '', path: '/admin?tab=settings' },
      { id: 'stats', label: 'Stats', icon: '', path: '/admin?tab=stats' },
      { id: 'import', label: 'Import/Export', icon: '', path: '/admin?tab=import' }
    ]
  }
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    const newOpen = new Set(openSections);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    setOpenSections(newOpen);
  };

  const isActive = (path: string) => {
    const url = new URL(path, window.location.origin);
    const params = url.searchParams;
    const section = params.get('section');
    const tab = params.get('tab');

    const currentParams = new URLSearchParams(location.search);
    const currentSection = currentParams.get('section');
    const currentTab = currentParams.get('tab');

    if (section) {
      return section === currentSection && tab === currentTab;
    }
    return tab === currentTab;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        aria-label="Admin navigation"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Admin Panel
            </h2>
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4" aria-label="Main navigation">
            <ul className="space-y-1" role="list">
              {navItems.map((item) => (
                <li key={item.id}>
                  {item.children ? (
                    <div>
                      <button
                        onClick={() => toggleSection(item.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-expanded={openSections.has(item.id)}
                        aria-controls={`section-${item.id}`}
                      >
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true">{item.icon}</span>
                          {item.label}
                        </span>
                        {openSections.has(item.id) ? (
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                      {openSections.has(item.id) && (
                        <ul
                          id={`section-${item.id}`}
                          className="mt-1 ml-4 space-y-1"
                          role="list"
                        >
                          {item.children.map((child) => (
                            <li key={child.id}>
                              <NavLink
                                to={child.path || ''}
                                onClick={() => {
                                  if (window.innerWidth < 1024) onClose();
                                }}
                                className={({ isActive: isNavActive }) =>
                                  `block px-3 py-2 text-sm rounded-md ${
                                    isActive(child.path || '') || isNavActive
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`
                                }
                                aria-current={isActive(child.path || '') ? 'page' : undefined}
                              >
                                {child.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <NavLink
                      to={item.path || ''}
                      onClick={() => {
                        if (window.innerWidth < 1024) onClose();
                      }}
                      className={({ isActive: isNavActive }) =>
                        `flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${
                          isActive(item.path || '') || isNavActive
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`
                      }
                      aria-current={isActive(item.path || '') ? 'page' : undefined}
                    >
                      <span aria-hidden="true">{item.icon}</span>
                      {item.label}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/admin/Sidebar.tsx
git commit -m "feat(admin): create vertical sidebar component with collapsible sections"
```

---

## Phase 8: Frontend - Admin Reservations Pages

### Task 8: Create Bookings Tab Component

**Files:**
- Create: `src/pages/admin/reservations/BookingsTab.tsx`

**Step 1: Create BookingsTab component**

Create `src/pages/admin/reservations/BookingsTab.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { api, type Reservation } from '@/lib/api';
import { format } from 'date-fns';
import { Check, X, Calendar, Filter } from 'lucide-react';

const amenityLabels: Record<string, string> = {
  clubhouse: 'Clubhouse',
  pool: 'Swimming Pool',
  'basketball-court': 'Basketball Court',
  'tennis-court': 'Tennis Court'
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

export function BookingsTab() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    amenity_type: ''
  });

  useEffect(() => {
    loadReservations();
  }, []);

  async function loadReservations() {
    setLoading(true);
    setError('');

    const result = await api.reservations.list(filters);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setReservations(result.data.reservations || []);
    }

    setLoading(false);
  }

  async function handleUpdateStatus(id: string, status: 'confirmed' | 'cancelled') {
    const result = await api.reservations.update(id, { status });

    if (result.error) {
      setError(result.error);
    } else {
      loadReservations();
    }
  }

  const filteredReservations = reservations.filter(r => {
    if (filters.status && r.status !== filters.status) return false;
    if (filters.amenity_type && r.amenity_type !== filters.amenity_type) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Resident Bookings
        </h2>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filters:</span>
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={filters.amenity_type}
          onChange={(e) => setFilters({ ...filters, amenity_type: e.target.value })}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
        >
          <option value="">All Amenities</option>
          <option value="clubhouse">Clubhouse</option>
          <option value="pool">Swimming Pool</option>
          <option value="basketball-court">Basketball Court</option>
          <option value="tennis-court">Tennis Court</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg" role="alert">
          {error}
          <button onClick={() => setError('')} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        /* Reservations List */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {filteredReservations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amenity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Slot
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Household
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Purpose
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredReservations.map((reservation) => (
                    <tr key={reservation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {amenityLabels[reservation.amenity_type]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(reservation.date), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {reservation.slot === 'AM' ? 'Morning (8AM-12PM)' : 'Afternoon (1PM-5PM)'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {reservation.household_id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[reservation.status]}`}>
                          {reservation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {reservation.purpose || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {reservation.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleUpdateStatus(reservation.id, 'confirmed')}
                              className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                              aria-label="Approve booking"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(reservation.id, 'cancelled')}
                              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                              aria-label="Decline booking"
                              title="Decline"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No reservations found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/admin/reservations/BookingsTab.tsx
git commit -m "feat(admin): create BookingsTab for managing resident reservations"
```

### Task 9: Create Time Blocks Tab Component

**Files:**
- Create: `src/pages/admin/reservations/TimeBlocksTab.tsx`

**Step 1: Create TimeBlocksTab component**

Create `src/pages/admin/reservations/TimeBlocksTab.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { api, type TimeBlock, type CreateTimeBlockInput } from '@/lib/api';
import { format } from 'date-fns';
import { Plus, Edit2, Trash2, Calendar } from 'lucide-react';

const amenityLabels: Record<string, string> = {
  clubhouse: 'Clubhouse',
  pool: 'Swimming Pool',
  'basketball-court': 'Basketball Court',
  'tennis-court': 'Tennis Court'
};

const slotLabels: Record<string, string> = {
  AM: 'Morning (8AM-12PM)',
  PM: 'Afternoon (1PM-5PM)',
  FULL_DAY: 'Full Day'
};

interface FormData extends CreateTimeBlockInput {
  amenity_type: 'clubhouse' | 'pool' | 'basketball-court' | 'tennis-court';
  date: string;
  slot: 'AM' | 'PM' | 'FULL_DAY';
  reason: string;
}

export function TimeBlocksTab() {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TimeBlock | null>(null);
  const [formData, setFormData] = useState<FormData>({
    amenity_type: 'clubhouse',
    date: format(new Date(), 'yyyy-MM-dd'),
    slot: 'AM',
    reason: ''
  });

  useEffect(() => {
    loadTimeBlocks();
  }, []);

  async function loadTimeBlocks() {
    setLoading(true);
    setError('');

    const result = await api.timeBlocks.list();

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setTimeBlocks(result.data.time_blocks || []);
    }

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (editing) {
      const result = await api.timeBlocks.update(editing.id, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
    } else {
      const result = await api.timeBlocks.create(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
    }

    setShowForm(false);
    setEditing(null);
    setFormData({
      amenity_type: 'clubhouse',
      date: format(new Date(), 'yyyy-MM-dd'),
      slot: 'AM',
      reason: ''
    });
    loadTimeBlocks();
  }

  async function handleEdit(block: TimeBlock) {
    setEditing(block);
    setFormData({
      amenity_type: block.amenity_type,
      date: block.date,
      slot: block.slot,
      reason: block.reason
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this time block?')) return;

    const result = await api.timeBlocks.delete(id);
    if (result.error) {
      setError(result.error);
    } else {
      loadTimeBlocks();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Time Blocks
        </h2>
        <button
          onClick={() => {
            setEditing(null);
            setFormData({
              amenity_type: 'clubhouse',
              date: format(new Date(), 'yyyy-MM-dd'),
              slot: 'AM',
              reason: ''
            });
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Cancel' : 'Add Time Block'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editing ? 'Edit Time Block' : 'Create Time Block'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="amenity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amenity
                </label>
                <select
                  id="amenity"
                  value={formData.amenity_type}
                  onChange={(e) => setFormData({ ...formData, amenity_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                >
                  <option value="clubhouse">Clubhouse</option>
                  <option value="pool">Swimming Pool</option>
                  <option value="basketball-court">Basketball Court</option>
                  <option value="tennis-court">Tennis Court</option>
                </select>
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="slot" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time Slot
                </label>
                <select
                  id="slot"
                  value={formData.slot}
                  onChange={(e) => setFormData({ ...formData, slot: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                >
                  <option value="AM">Morning (8AM-12PM)</option>
                  <option value="PM">Afternoon (1PM-5PM)</option>
                  <option value="FULL_DAY">Full Day</option>
                </select>
              </div>
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason
                </label>
                <input
                  id="reason"
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Maintenance, Private Event"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editing ? 'Update' : 'Create'} Time Block
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg" role="alert">
          {error}
          <button onClick={() => setError('')} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        /* Time Blocks List */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {timeBlocks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amenity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Slot
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {timeBlocks.map((block) => (
                    <tr key={block.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {amenityLabels[block.amenity_type]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(block.date), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {slotLabels[block.slot]}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {block.reason}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(block)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                            aria-label="Edit time block"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(block.id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                            aria-label="Delete time block"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No time blocks found. Create one to block a time slot.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/admin/reservations/TimeBlocksTab.tsx
git commit -m "feat(admin): create TimeBlocksTab for managing blocked time slots"
```

### Task 10: Create External Rentals Tab Component

**Files:**
- Create: `src/pages/admin/reservations/ExternalRentalsTab.tsx`

**Step 1: Create ExternalRentalsTab component**

Create `src/pages/admin/reservations/ExternalRentalsTab.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { api, type ExternalRental, type CreateExternalRentalInput } from '@/lib/api';
import { format } from 'date-fns';
import { Plus, Edit2, Trash2, Calendar, Download, DollarSign } from 'lucide-react';

const amenityLabels: Record<string, string> = {
  clubhouse: 'Clubhouse',
  pool: 'Swimming Pool',
  'basketball-court': 'Basketball Court',
  'tennis-court': 'Tennis Court'
};

const slotLabels: Record<string, string> = {
  AM: 'Morning (8AM-12PM)',
  PM: 'Afternoon (1PM-5PM)',
  FULL_DAY: 'Full Day'
};

const statusColors: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-200 text-red-800'
};

interface RentalFormData extends CreateExternalRentalInput {
  amenity_type: 'clubhouse' | 'pool' | 'basketball-court' | 'tennis-court';
  date: string;
  slot: 'AM' | 'PM' | 'FULL_DAY';
  renter_name: string;
  renter_contact: string;
  amount: number;
  notes: string;
}

interface PaymentFormData {
  amount: number;
  payment_method: string;
  receipt_number: string;
}

export function ExternalRentalsTab() {
  const [rentals, setRentals] = useState<ExternalRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editing, setEditing] = useState<ExternalRental | null>(null);
  const [payingRental, setPayingRental] = useState<ExternalRental | null>(null);
  const [formData, setFormData] = useState<RentalFormData>({
    amenity_type: 'clubhouse',
    date: format(new Date(), 'yyyy-MM-dd'),
    slot: 'AM',
    renter_name: '',
    renter_contact: '',
    amount: 0,
    notes: ''
  });
  const [paymentData, setPaymentData] = useState<PaymentFormData>({
    amount: 0,
    payment_method: '',
    receipt_number: ''
  });

  useEffect(() => {
    loadRentals();
  }, []);

  async function loadRentals() {
    setLoading(true);
    setError('');

    const result = await api.externalRentals.list();

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setRentals(result.data.rentals || []);
    }

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (editing) {
      const result = await api.externalRentals.update(editing.id, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
    } else {
      const result = await api.externalRentals.create(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
    }

    setShowForm(false);
    setEditing(null);
    setFormData({
      amenity_type: 'clubhouse',
      date: format(new Date(), 'yyyy-MM-dd'),
      slot: 'AM',
      renter_name: '',
      renter_contact: '',
      amount: 0,
      notes: ''
    });
    loadRentals();
  }

  async function handleEdit(rental: ExternalRental) {
    setEditing(rental);
    setFormData({
      amenity_type: rental.amenity_type,
      date: rental.date,
      slot: rental.slot,
      renter_name: rental.renter_name,
      renter_contact: rental.renter_contact || '',
      amount: rental.amount,
      notes: rental.notes || ''
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this rental?')) return;

    const result = await api.externalRentals.delete(id);
    if (result.error) {
      setError(result.error);
    } else {
      loadRentals();
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingRental) return;

    setError('');

    const result = await api.externalRentals.recordPayment(payingRental.id, paymentData);
    if (result.error) {
      setError(result.error);
      return;
    }

    setShowPaymentForm(false);
    setPayingRental(null);
    setPaymentData({
      amount: 0,
      payment_method: '',
      receipt_number: ''
    });
    loadRentals();
  }

  async function handleExport() {
    const result = await api.externalRentals.export();
    if (result.error) {
      setError(result.error);
    }
  }

  function openPaymentForm(rental: ExternalRental) {
    setPayingRental(rental);
    const remaining = rental.amount - rental.amount_paid;
    setPaymentData({
      amount: remaining > 0 ? remaining : 0,
      payment_method: '',
      receipt_number: ''
    });
    setShowPaymentForm(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          External Rentals
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setFormData({
                amenity_type: 'clubhouse',
                date: format(new Date(), 'yyyy-MM-dd'),
                slot: 'AM',
                renter_name: '',
                renter_contact: '',
                amount: 0,
                notes: ''
              });
              setShowForm(!showForm);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Cancel' : 'Add Rental'}
          </button>
        </div>
      </div>

      {/* Rental Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editing ? 'Edit Rental' : 'Create Rental'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="r-amenity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amenity
                </label>
                <select
                  id="r-amenity"
                  value={formData.amenity_type}
                  onChange={(e) => setFormData({ ...formData, amenity_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                >
                  <option value="clubhouse">Clubhouse</option>
                  <option value="pool">Swimming Pool</option>
                  <option value="basketball-court">Basketball Court</option>
                  <option value="tennis-court">Tennis Court</option>
                </select>
              </div>
              <div>
                <label htmlFor="r-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <input
                  id="r-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="r-slot" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time Slot
                </label>
                <select
                  id="r-slot"
                  value={formData.slot}
                  onChange={(e) => setFormData({ ...formData, slot: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                >
                  <option value="AM">Morning (8AM-12PM)</option>
                  <option value="PM">Afternoon (1PM-5PM)</option>
                  <option value="FULL_DAY">Full Day</option>
                </select>
              </div>
              <div>
                <label htmlFor="r-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount (₱)
                </label>
                <input
                  id="r-amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="r-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Renter Name
                </label>
                <input
                  id="r-name"
                  type="text"
                  value={formData.renter_name}
                  onChange={(e) => setFormData({ ...formData, renter_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="r-contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contact (optional)
                </label>
                <input
                  id="r-contact"
                  type="text"
                  value={formData.renter_contact}
                  onChange={(e) => setFormData({ ...formData, renter_contact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="r-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  id="r-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editing ? 'Update' : 'Create'} Rental
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payment Form */}
      {showPaymentForm && payingRental && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Record Payment</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Recording payment for: {payingRental.renter_name} - {amenityLabels[payingRental.amenity_type]} on {format(new Date(payingRental.date), 'MMM d, yyyy')}
          </p>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="p-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Amount (₱)
                </label>
                <input
                  id="p-amount"
                  type="number"
                  step="0.01"
                  max={payingRental.amount - payingRental.amount_paid}
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Remaining: ₱{(payingRental.amount - payingRental.amount_paid).toFixed(2)}
                </p>
              </div>
              <div>
                <label htmlFor="p-method" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Method
                </label>
                <select
                  id="p-method"
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="">Select method</option>
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="paymaya">PayMaya</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label htmlFor="p-receipt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Receipt Number
                </label>
                <input
                  id="p-receipt"
                  type="text"
                  value={paymentData.receipt_number}
                  onChange={(e) => setPaymentData({ ...paymentData, receipt_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentForm(false);
                  setPayingRental(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Record Payment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg" role="alert">
          {error}
          <button onClick={() => setError('')} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        /* Rentals List */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {rentals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amenity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date/Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Renter
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {rentals.map((rental) => (
                    <tr key={rental.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {amenityLabels[rental.amenity_type]}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(rental.date), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs">{slotLabels[rental.slot]}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="font-medium text-gray-900 dark:text-white">{rental.renter_name}</div>
                        <div className="text-xs">{rental.renter_contact || 'No contact'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          <span className="font-medium">{rental.amount.toFixed(2)}</span>
                        </div>
                        <div className="text-xs">Paid: {rental.amount_paid.toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[rental.payment_status]}`}>
                          {rental.payment_status}
                        </span>
                        {rental.receipt_number && (
                          <div className="text-xs text-gray-500 mt-1">
                            Receipt: {rental.receipt_number}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {rental.payment_status !== 'paid' && (
                            <button
                              onClick={() => openPaymentForm(rental)}
                              className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                              aria-label="Record payment"
                              title="Record Payment"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(rental)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                            aria-label="Edit rental"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rental.id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                            aria-label="Delete rental"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No external rentals found. Create one to add a non-resident booking.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/admin/reservations/ExternalRentalsTab.tsx
git commit -m "feat(admin): create ExternalRentalsTab with payment tracking"
```

### Task 11: Create Reservations Container

**Files:**
- Create: `src/pages/admin/reservations/index.tsx`

**Step 1: Create container component**

Create `src/pages/admin/reservations/index.tsx`:

```typescript
import { useSearchParams } from 'react-router-dom';
import { BookingsTab } from './BookingsTab';
import { TimeBlocksTab } from './TimeBlocksTab';
import { ExternalRentalsTab } from './ExternalRentalsTab';

type ReservationsTab = 'bookings' | 'time-blocks' | 'external-rentals';

export function AdminReservationsPage() {
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as ReservationsTab) || 'bookings';

  const tabs = [
    { id: 'bookings' as ReservationsTab, label: 'Bookings' },
    { id: 'time-blocks' as ReservationsTab, label: 'Time Blocks' },
    { id: 'external-rentals' as ReservationsTab, label: 'External Rentals' }
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Reservations tabs">
          {tabs.map((tab) => {
            const href = `/admin?section=reservations&tab=${tab.id}`;
            return (
              <a
                key={tab.id}
                href={href}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.label}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'bookings' && <BookingsTab />}
      {activeTab === 'time-blocks' && <TimeBlocksTab />}
      {activeTab === 'external-rentals' && <ExternalRentalsTab />}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/admin/reservations/index.tsx
git commit -m "feat(admin): create AdminReservationsPage container with tab navigation"
```

---

## Phase 9: Update ReservationsPage for Tennis Court

### Task 12: Add Tennis Court to Resident Reservations

**Files:**
- Modify: `src/pages/ReservationsPage.tsx`

**Step 1: Update amenity labels**

Find the `amenityLabels` constant (around line 28-34) and add tennis court:

```typescript
const amenityLabels: Record<AmenityType, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court",
};
```

**Step 2: Update amenity icons**

Find the `amenityIcons` constant (around line 39-43) and add tennis court:

```typescript
const amenityIcons: Record<AmenityType, string> = {
  clubhouse: "🏠",
  pool: "🏊",
  "basketball-court": "🏀",
  "tennis-court": "🎾",
};
```

**Step 3: Update booking form select**

Find the booking form amenity select (around line 236-248) and add tennis court option:

```html
<option value="tennis-court">🎾 Tennis Court</option>
```

**Step 4: Update calendar view select**

Find the calendar amenity select (around line 340-346) and add tennis court option:

```html
<option value="tennis-court">🎾 Tennis Court</option>
```

**Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 6: Test in browser**

1. Start dev server: `npm run dev:all`
2. Navigate to /reservations
3. Verify Tennis Court appears in amenity dropdowns
4. Create a test booking for Tennis Court

**Step 7: Commit**

```bash
git add src/pages/ReservationsPage.tsx
git commit -m "feat(reservations): add Tennis Court as bookable amenity"
```

---

## Phase 10: Update AdminPanelPage with Sidebar

### Task 13: Integrate Sidebar into AdminPanelPage

**Files:**
- Modify: `src/pages/AdminPanelPage.tsx`

**Step 1: Read current AdminPanelPage structure**

Read `src/pages/AdminPanelPage.tsx` to understand the current tab navigation.

**Step 2: Add imports**

Add at the top of the file:

```typescript
import { Sidebar } from '@/components/admin/Sidebar';
import { AdminReservationsPage } from './admin/reservations';
import { useState } from 'react';
```

**Step 3: Add sidebar state**

Add after existing state declarations:

```typescript
const [sidebarOpen, setSidebarOpen] = useState(false);
```

**Step 4: Update URL parameter handling**

Find where `activeTab` is determined from URL params and update to handle `section` parameter too:

```typescript
// OLD:
const [activeTab, setActiveTab] = useState<Tab>("users");

// NEW: Handle both tab and section parameters
const [activeSection, setActiveSection] = useState<string | null>(null);
const [activeTab, setActiveTab] = useState<Tab>("users");

useEffect(() => {
  const params = new URLSearchParams(location.search);
  const section = params.get('section');
  const tab = params.get('tab') as Tab;

  if (section === 'reservations') {
    setActiveSection('reservations');
  } else {
    setActiveSection(null);
    if (tab && ['users', 'households', 'lots', 'import', 'payments', 'settings'].includes(tab)) {
      setActiveTab(tab);
    }
  }
}, [location.search]);
```

**Step 5: Add mobile menu button**

Add before the tab navigation:

```typescript
<div className="flex items-center gap-4">
  <button
    onClick={() => setSidebarOpen(!sidebarOpen)}
    className="lg:hidden p-2 rounded-md hover:bg-gray-100"
    aria-label="Toggle sidebar"
  >
    ☰
  </button>
  <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
</div>
```

**Step 6: Wrap content with sidebar**

Wrap the existing content in a div with sidebar:

```typescript
return (
  <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
    <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

    <div className="flex-1 flex flex-col">
      {/* Existing content */}
      <div className="p-6">
        {/* existing header and content */}
      </div>
    </div>
  </div>
);
```

**Step 7: Add reservations section handling**

In the content area, add handling for the reservations section:

```typescript
{activeSection === 'reservations' ? (
  <AdminReservationsPage />
) : (
  // existing tab content
)}
```

**Step 8: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 9: Commit**

```bash
git add src/pages/AdminPanelPage.tsx
git commit -m "feat(admin): integrate sidebar and reservations section into admin panel"
```

---

## Phase 11: Testing & Verification

### Task 14: End-to-End Testing

**Files:** (no new files, testing only)

**Step 1: Test database migration**

```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0014_reservations_enhancements.sql --local
```

Expected: Success message

**Step 2: Test API endpoints**

```bash
# Test time blocks
curl -X POST http://localhost:8788/api/admin/time-blocks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"amenity_type":"pool","date":"2026-04-01","slot":"AM","reason":"Maintenance"}'

# Test external rentals
curl -X POST http://localhost:8788/api/admin/external-rentals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"amenity_type":"pool","date":"2026-04-02","slot":"PM","renter_name":"John Doe","amount":5000}'

# Test availability (should show blocked slots)
curl "http://localhost:8788/api/reservations/availability?start_date=2026-04-01&end_date=2026-04-30&amenity_type=pool"
```

Expected: All return correct data

**Step 3: Test admin UI**

1. Navigate to `/admin`
2. Verify sidebar is visible
3. Click "Reservations" → "Time Blocks"
4. Create a new time block
5. Navigate to "External Rentals"
6. Create a new rental
7. Navigate to "Bookings"
8. Approve/decline a reservation

**Step 4: Test resident UI**

1. Navigate to `/reservations`
2. Verify "Tennis Court" appears in amenity dropdown
3. Try to book a time that was blocked
4. Verify error message shows

**Step 5: Test accessibility**

Run keyboard navigation tests:
- Tab through all interactive elements
- Verify focus states are visible
- Test Escape key closes modals
- Verify ARIA labels on icons

**Step 6: Check for TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 7: Run production build**

```bash
npm run build
```

Expected: Build succeeds

**Step 8: Commit any fixes**

```bash
# Fix any issues found during testing
git add .
git commit -m "fix: address issues found during testing"
```

---

## Summary Checklist

Track implementation progress:

- [ ] Task 1: Database migration created and tested
- [ ] Task 2: Type definitions added
- [ ] Task 3: Time blocks API routes created
- [ ] Task 4: External rentals API routes created
- [ ] Task 5: Availability check updated
- [ ] Task 6: Frontend API client methods added
- [ ] Task 7: Sidebar component created
- [ ] Task 8: BookingsTab component created
- [ ] Task 9: TimeBlocksTab component created
- [ ] Task 10: ExternalRentalsTab component created
- [ ] Task 11: Reservations container created
- [ ] Task 12: ReservationsPage updated for tennis court
- [ ] Task 13: AdminPanelPage updated with sidebar
- [ ] Task 14: End-to-end testing completed

---

**Plan created:** 2026-03-09
**Estimated effort:** 14 tasks, ~2-3 days for experienced developer
**Dependencies:** None (can start with any phase, but order recommended)
