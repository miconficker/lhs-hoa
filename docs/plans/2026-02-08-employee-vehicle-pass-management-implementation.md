# Employee & Vehicle Pass Management System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a pass management system for household employee IDs and vehicle gate passes (stickers/RFID) for the Laguna Hills HOA.

**Architecture:** Frontend (React + TypeScript) + Backend (Cloudflare Workers + Hono + D1). Admin manages issuance, residents submit requests. Payments integrated with existing payment system. Photo storage via R2.

**Tech Stack:** React 18, TypeScript, Hono, D1 (SQLite), R2 storage, Cloudflare Workers, Tailwind CSS, shadcn/ui

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/0008_pass_management.sql`

**Step 1: Create the migration file**

```sql
-- Migration 0008: Employee and Vehicle Pass Management

-- Household employees table
CREATE TABLE IF NOT EXISTS household_employees (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  full_name TEXT NOT NULL,
  employee_type TEXT NOT NULL CHECK(employee_type IN ('driver', 'housekeeper', 'caretaker', 'other')),
  id_number TEXT NOT NULL UNIQUE,
  photo_url TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'revoked', 'expired')),
  issued_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle registrations table
CREATE TABLE IF NOT EXISTS vehicle_registrations (
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
  amount_due REAL,
  amount_paid REAL,
  payment_method TEXT CHECK(payment_method IN ('gcash', 'paymaya', 'instapay', 'cash', 'in-person')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, plate_number)
);

-- Pass fees table
CREATE TABLE IF NOT EXISTS pass_fees (
  id TEXT PRIMARY KEY,
  fee_type TEXT NOT NULL CHECK(fee_type IN ('sticker', 'rfid', 'both')),
  amount REAL NOT NULL,
  effective_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default fees (configurable, will be set by admin)
INSERT INTO pass_fees (id, fee_type, amount, effective_date)
VALUES
  ('default-sticker', 'sticker', 500, DATE('now')),
  ('default-rfid', 'rfid', 800, DATE('now')),
  ('default-both', 'both', 1000, DATE('now'));

-- Add payment_category to payments table
ALTER TABLE payments ADD COLUMN payment_category TEXT DEFAULT 'dues' CHECK(payment_category IN ('dues', 'vehicle_pass', 'employee_id'));

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_household_employees_household_id ON household_employees(household_id);
CREATE INDEX IF NOT EXISTS idx_household_employees_status ON household_employees(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_household_id ON vehicle_registrations(household_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_status ON vehicle_registrations(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_plate ON vehicle_registrations(plate_number);
```

**Step 2: Run the migration locally**

```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0008_pass_management.sql --local
```

Expected output: Success message with tables created.

**Step 3: Run the migration on production (when ready)**

```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0008_pass_management.sql
```

**Step 4: Commit**

```bash
git add migrations/0008_pass_management.sql
git commit -m "feat: add pass management tables (employees, vehicles, fees)"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add pass management types to src/types/index.ts**

Add after line 487 (after `AdminNotificationsResponse`):

```typescript
// =============================================================================
// Pass Management System
// =============================================================================

export type EmployeeType = "driver" | "housekeeper" | "caretaker" | "other";
export type EmployeeStatus = "pending" | "active" | "revoked" | "expired";
export type PassType = "sticker" | "rfid" | "both";
export type VehicleStatus = "pending_payment" | "pending_approval" | "active" | "cancelled";
export type VehiclePaymentStatus = "unpaid" | "paid";

export interface HouseholdEmployee {
  id: string;
  household_id: string;
  household_address?: string; // Populated by JOIN
  full_name: string;
  employee_type: EmployeeType;
  id_number: string;
  photo_url?: string;
  status: EmployeeStatus;
  issued_date?: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleRegistration {
  id: string;
  household_id: string;
  household_address?: string; // Populated by JOIN
  plate_number: string;
  make: string;
  model: string;
  color: string;
  pass_type: PassType;
  rfid_code?: string;
  sticker_number?: string;
  status: VehicleStatus;
  payment_status: VehiclePaymentStatus;
  issued_date?: string;
  amount_due?: number;
  amount_paid?: number;
  payment_method?: PaymentMethod;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PassFee {
  id: string;
  fee_type: PassType;
  amount: number;
  effective_date: string;
  created_at: string;
}

// API Response types for pass management
export interface EmployeesResponse {
  employees: HouseholdEmployee[];
}

export interface EmployeeResponse {
  employee: HouseholdEmployee;
}

export interface VehiclesResponse {
  vehicles: VehicleRegistration[];
}

export interface VehicleResponse {
  vehicle: VehicleRegistration;
}

export interface PassFeesResponse {
  fees: PassFee[];
}

export interface PassFeesUpdateResponse {
  fees: PassFee[];
}

export interface CreateEmployeeInput {
  household_id: string;
  full_name: string;
  employee_type: EmployeeType;
  photo?: File;
  expiry_date?: string;
}

export interface UpdateEmployeeInput {
  full_name?: string;
  employee_type?: EmployeeType;
  expiry_date?: string;
  notes?: string;
}

export interface CreateVehicleInput {
  household_id: string;
  plate_number: string;
  make: string;
  model: string;
  color: string;
  pass_type: PassType;
}

export interface UpdateVehicleInput {
  plate_number?: string;
  make?: string;
  model?: string;
  color?: string;
  pass_type?: PassType;
}

export interface AssignRFIDInput {
  rfid_code: string;
}

export interface AssignStickerInput {
  sticker_number: string;
}

export interface RecordPaymentInput {
  amount: number;
  method: PaymentMethod;
  reference_number?: string;
  received_by: string;
}

export interface UpdateEmployeeStatusInput {
  status: EmployeeStatus;
  notes?: string;
}

export interface UpdateVehicleStatusInput {
  status: VehicleStatus;
  notes?: string;
}

// Dashboard stats for passes
export interface PassStats {
  active_employees: number;
  active_vehicles: number;
  pending_approvals: number;
  monthly_revenue: number;
}
```

**Step 2: Verify TypeScript compilation**

```bash
npm run build
```

Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add pass management types"
```

---

## Task 3: Backend - Pass Management Routes

**Files:**
- Create: `worker/src/routes/pass-management.ts`

**Step 1: Create the pass management router**

```typescript
import { Hono } from 'hono';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
};

export const passManagementRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// RESIDENT ENDPOINTS - /api/pass-requests
// =============================================================================

/**
 * GET /api/pass-requests/employees
 * Get current user's sponsored employees
 */
passManagementRouter.get('/employees', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Get user's household(s)
  const households = await c.env.DB.prepare(`
    SELECT id, address FROM households WHERE owner_id = ?
  `).bind(authUser.sub).all();

  const householdIds = (households.results || []).map((h: any) => h.id);

  if (householdIds.length === 0) {
    return c.json({ employees: [] });
  }

  const placeholders = householdIds.map(() => '?').join(',');
  const employees = await c.env.DB.prepare(`
    SELECT
      he.*,
      h.address as household_address
    FROM household_employees he
    JOIN households h ON he.household_id = h.id
    WHERE he.household_id IN (${placeholders})
    ORDER BY he.created_at DESC
  `).bind(...householdIds).all();

  return c.json({ employees: employees.results || [] });
});

/**
 * POST /api/pass-requests/employees
 * Request new employee ID
 */
passManagementRouter.post('/employees', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.parseBody();
  const { household_id, full_name, employee_type, expiry_date } = body;

  if (!household_id || !full_name || !employee_type) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // Verify ownership
  const household = await c.env.DB.prepare(`
    SELECT id FROM households WHERE id = ? AND owner_id = ?
  `).bind(household_id as string, authUser.sub).first();

  if (!household) {
    return c.json({ error: 'Household not found or access denied' }, 404);
  }

  // Check employee limit (5 per household)
  const countResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM household_employees
    WHERE household_id = ? AND status IN ('pending', 'active')
  `).bind(household_id as string).first();

  const count = (countResult?.count as number) || 0;
  if (count >= 5) {
    return c.json({ error: 'Maximum employee limit reached (5 per household)' }, 400);
  }

  // Generate unique ID number (format: EMP-XXXXX)
  const idNumber = `EMP-${String(Date.now()).slice(-6)}`;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Handle photo upload if present
  let photoUrl: string | undefined;
  const photo = body.photo as File;
  if (photo && photo.size > 0) {
    const key = `employee-photos/${id}-${photo.name}`;
    await c.env.R2.put(key, photo);
    photoUrl = `r2://${key}`;
  }

  await c.env.DB.prepare(`
    INSERT INTO household_employees (id, household_id, full_name, employee_type, id_number, photo_url, status, created_at, updated_at${expiry_date ? ', expiry_date' : ''})
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?${expiry_date ? ', ?' : ''})
  `).bind(
    id,
    household_id,
    full_name,
    employee_type,
    idNumber,
    photoUrl || null,
    now,
    now,
    ...(expiry_date ? [expiry_date] : [])
  ).run();

  const employee = await c.env.DB.prepare(`
    SELECT he.*, h.address as household_address
    FROM household_employees he
    JOIN households h ON he.household_id = h.id
    WHERE he.id = ?
  `).bind(id).first();

  return c.json({ employee }, 201);
});

/**
 * PUT /api/pass-requests/employees/:id
 * Update employee details
 */
passManagementRouter.put('/employees/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();

  // Verify ownership
  const employee = await c.env.DB.prepare(`
    SELECT he.* FROM household_employees he
    JOIN households h ON he.household_id = h.id
    WHERE he.id = ? AND h.owner_id = ?
  `).bind(id, authUser.sub).first();

  if (!employee) {
    return c.json({ error: 'Employee not found or access denied' }, 404);
  }

  // Only allow updates if status is pending
  if (employee.status !== 'pending') {
    return c.json({ error: 'Cannot update employee after approval' }, 400);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (body.full_name) {
    updates.push('full_name = ?');
    values.push(body.full_name);
  }
  if (body.employee_type) {
    updates.push('employee_type = ?');
    values.push(body.employee_type);
  }
  if (body.expiry_date !== undefined) {
    updates.push('expiry_date = ?');
    values.push(body.expiry_date || null);
  }
  if (body.notes !== undefined) {
    updates.push('notes = ?');
    values.push(body.notes);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await c.env.DB.prepare(`
    UPDATE household_employees SET ${updates.join(', ')} WHERE id = ?
  `).bind(...values).run();

  const updated = await c.env.DB.prepare(`
    SELECT he.*, h.address as household_address
    FROM household_employees he
    JOIN households h ON he.household_id = h.id
    WHERE he.id = ?
  `).bind(id).first();

  return c.json({ employee: updated });
});

/**
 * DELETE /api/pass-requests/employees/:id
 * Request employee revocation
 */
passManagementRouter.delete('/employees/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  // Verify ownership
  const employee = await c.env.DB.prepare(`
    SELECT he.* FROM household_employees he
    JOIN households h ON he.household_id = h.id
    WHERE he.id = ? AND h.owner_id = ?
  `).bind(id, authUser.sub).first();

  if (!employee) {
    return c.json({ error: 'Employee not found or access denied' }, 404);
  }

  if (employee.status === 'revoked') {
    return c.json({ error: 'Employee already revoked' }, 400);
  }

  await c.env.DB.prepare(`
    UPDATE household_employees SET status = 'revoked', updated_at = ?
    WHERE id = ?
  `).bind(new Date().toISOString(), id).run();

  return c.json({ success: true });
});

// =============================================================================
// VEHICLE ENDPOINTS
// =============================================================================

/**
 * GET /api/pass-requests/vehicles
 * Get current user's vehicle registrations
 */
passManagementRouter.get('/vehicles', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const households = await c.env.DB.prepare(`
    SELECT id, address FROM households WHERE owner_id = ?
  `).bind(authUser.sub).all();

  const householdIds = (households.results || []).map((h: any) => h.id);

  if (householdIds.length === 0) {
    return c.json({ vehicles: [] });
  }

  const placeholders = householdIds.map(() => '?').join(',');
  const vehicles = await c.env.DB.prepare(`
    SELECT
      vr.*,
      h.address as household_address
    FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.household_id IN (${placeholders})
    ORDER BY vr.created_at DESC
  `).bind(...householdIds).all();

  return c.json({ vehicles: vehicles.results || [] });
});

/**
 * POST /api/pass-requests/vehicles
 * Request vehicle pass
 */
passManagementRouter.post('/vehicles', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { household_id, plate_number, make, model, color, pass_type } = body;

  if (!household_id || !plate_number || !make || !model || !color || !pass_type) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // Verify ownership
  const household = await c.env.DB.prepare(`
    SELECT id FROM households WHERE id = ? AND owner_id = ?
  `).bind(household_id, authUser.sub).first();

  if (!household) {
    return c.json({ error: 'Household not found or access denied' }, 404);
  }

  // Check vehicle limit (3 per household)
  const countResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM vehicle_registrations
    WHERE household_id = ? AND status IN ('pending_payment', 'pending_approval', 'active')
  `).bind(household_id).first();

  const count = (countResult?.count as number) || 0;
  if (count >= 3) {
    return c.json({ error: 'Maximum vehicle limit reached (3 per household)' }, 400);
  }

  // Check for duplicate plate
  const existing = await c.env.DB.prepare(`
    SELECT id FROM vehicle_registrations
    WHERE plate_number = ? AND household_id = ? AND status != 'cancelled'
  `).bind(plate_number.toUpperCase(), household_id).first();

  if (existing) {
    return c.json({ error: 'Vehicle with this plate is already registered' }, 400);
  }

  // Get fee amount
  const feeResult = await c.env.DB.prepare(`
    SELECT amount FROM pass_fees
    WHERE fee_type = ? AND effective_date <= DATE('now')
    ORDER BY effective_date DESC LIMIT 1
  `).bind(pass_type).first();

  const amountDue = (feeResult?.amount as number) || 0;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO vehicle_registrations
    (id, household_id, plate_number, make, model, color, pass_type, status, payment_status, amount_due, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'unpaid', ?, ?, ?)
  `).bind(
    id,
    household_id,
    plate_number.toUpperCase(),
    make,
    model,
    color,
    pass_type,
    amountDue,
    now,
    now
  ).run();

  const vehicle = await c.env.DB.prepare(`
    SELECT vr.*, h.address as household_address
    FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.id = ?
  `).bind(id).first();

  return c.json({ vehicle }, 201);
});

/**
 * PUT /api/pass-requests/vehicles/:id
 * Update vehicle details
 */
passManagementRouter.put('/vehicles/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();

  // Verify ownership
  const vehicle = await c.env.DB.prepare(`
    SELECT vr.* FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.id = ? AND h.owner_id = ?
  `).bind(id, authUser.sub).first();

  if (!vehicle) {
    return c.json({ error: 'Vehicle not found or access denied' }, 404);
  }

  // Only allow updates if not yet active
  if (vehicle.status === 'active') {
    return c.json({ error: 'Cannot update vehicle after activation' }, 400);
  }

  const updates: string[] = [];
  const values: any[] = [];

  const allowedFields = ['plate_number', 'make', 'model', 'color', 'pass_type'];
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(field === 'plate_number' ? body[field].toUpperCase() : body[field]);
    }
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await c.env.DB.prepare(`
    UPDATE vehicle_registrations SET ${updates.join(', ')} WHERE id = ?
  `).bind(...values).run();

  const updated = await c.env.DB.prepare(`
    SELECT vr.*, h.address as household_address
    FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.id = ?
  `).bind(id).first();

  return c.json({ vehicle: updated });
});

/**
 * DELETE /api/pass-requests/vehicles/:id
 * Request vehicle cancellation
 */
passManagementRouter.delete('/vehicles/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  // Verify ownership
  const vehicle = await c.env.DB.prepare(`
    SELECT vr.* FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.id = ? AND h.owner_id = ?
  `).bind(id, authUser.sub).first();

  if (!vehicle) {
    return c.json({ error: 'Vehicle not found or access denied' }, 404);
  }

  if (vehicle.status === 'cancelled') {
    return c.json({ error: 'Vehicle already cancelled' }, 400);
  }

  await c.env.DB.prepare(`
    UPDATE vehicle_registrations SET status = 'cancelled', updated_at = ?
    WHERE id = ?
  `).bind(new Date().toISOString(), id).run();

  return c.json({ success: true });
});
```

**Step 2: Export and register the router**

Modify `worker/src/index.ts` - add after line 13:

```typescript
import { passManagementRouter } from './routes/pass-management';
```

Then add after line 44 (before admin route):

```typescript
app.route('/api/pass-requests', passManagementRouter);
```

**Step 3: Verify TypeScript compilation in worker**

```bash
cd worker && npm run build
```

Expected: No errors.

**Step 4: Commit**

```bash
git add worker/src/routes/pass-management.ts worker/src/index.ts
git commit -m "feat: add resident pass request endpoints"
```

---

## Task 4: Backend - Admin Pass Management Routes

**Files:**
- Modify: `worker/src/routes/admin.ts`

**Step 1: Add pass management routes to admin router**

Add this section at the end of `worker/src/routes/admin.ts` before the export:

```typescript
// =============================================================================
// PASS MANAGEMENT - ADMIN
// =============================================================================

/**
 * GET /api/admin/pass-management/employees
 * Get all employees with optional filters
 */
adminRouter.get('/pass-management/employees', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { status, household_id, employee_type, search } = c.req.query();

  let query = `
    SELECT
      he.*,
      h.address as household_address,
      u.email as owner_email
    FROM household_employees he
    JOIN households h ON he.household_id = h.id
    LEFT JOIN users u ON h.owner_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    query += ' AND he.status = ?';
    params.push(status);
  }
  if (household_id) {
    query += ' AND he.household_id = ?';
    params.push(household_id);
  }
  if (employee_type) {
    query += ' AND he.employee_type = ?';
    params.push(employee_type);
  }
  if (search) {
    query += ' AND (he.full_name LIKE ? OR he.id_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY he.created_at DESC';

  const employees = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ employees: employees.results || [] });
});

/**
 * GET /api/admin/pass-management/employees/:id
 * Get employee details
 */
adminRouter.get('/pass-management/employees/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');

  const employee = await c.env.DB.prepare(`
    SELECT
      he.*,
      h.address as household_address,
      u.email as owner_email,
      u.phone as owner_phone
    FROM household_employees he
    JOIN households h ON he.household_id = h.id
    LEFT JOIN users u ON h.owner_id = u.id
    WHERE he.id = ?
  `).bind(id).first();

  if (!employee) {
    return c.json({ error: 'Employee not found' }, 404);
  }

  return c.json({ employee });
});

/**
 * PUT /api/admin/pass-management/employees/:id/status
 * Approve/revoke employee ID
 */
adminRouter.put('/pass-management/employees/:id/status', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const { status, notes } = body;

  if (!status || !['pending', 'active', 'revoked', 'expired'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }

  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const values: any[] = [status, new Date().toISOString()];

  if (status === 'active') {
    updates.push('issued_date = ?');
    values.push(new Date().toISOString().split('T')[0]);
  }

  if (notes !== undefined) {
    updates.push('notes = ?');
    values.push(notes);
  }

  values.push(id);

  await c.env.DB.prepare(`
    UPDATE household_employees SET ${updates.join(', ')} WHERE id = ?
  `).bind(...values).run();

  const employee = await c.env.DB.prepare(`
    SELECT he.*, h.address as household_address
    FROM household_employees he
    JOIN households h ON he.household_id = h.id
    WHERE he.id = ?
  `).bind(id).first();

  return c.json({ employee });
});

/**
 * GET /api/admin/pass-management/vehicles
 * Get all vehicles with optional filters
 */
adminRouter.get('/pass-management/vehicles', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { status, household_id, pass_type, search } = c.req.query();

  let query = `
    SELECT
      vr.*,
      h.address as household_address,
      u.email as owner_email
    FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    LEFT JOIN users u ON h.owner_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    query += ' AND vr.status = ?';
    params.push(status);
  }
  if (household_id) {
    query += ' AND vr.household_id = ?';
    params.push(household_id);
  }
  if (pass_type) {
    query += ' AND vr.pass_type = ?';
    params.push(pass_type);
  }
  if (search) {
    query += ' AND (vr.plate_number LIKE ? OR vr.make LIKE ? OR vr.model LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY vr.created_at DESC';

  const vehicles = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ vehicles: vehicles.results || [] });
});

/**
 * GET /api/admin/pass-management/vehicles/:id
 * Get vehicle details
 */
adminRouter.get('/pass-management/vehicles/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');

  const vehicle = await c.env.DB.prepare(`
    SELECT
      vr.*,
      h.address as household_address,
      u.email as owner_email,
      u.phone as owner_phone
    FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    LEFT JOIN users u ON h.owner_id = u.id
    WHERE vr.id = ?
  `).bind(id).first();

  if (!vehicle) {
    return c.json({ error: 'Vehicle not found' }, 404);
  }

  return c.json({ vehicle });
});

/**
 * PUT /api/admin/pass-management/vehicles/:id/status
 * Approve/cancel vehicle registration
 */
adminRouter.put('/pass-management/vehicles/:id/status', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const { status, notes } = body;

  if (!status || !['pending_payment', 'pending_approval', 'active', 'cancelled'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }

  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const values: any[] = [status, new Date().toISOString()];

  if (status === 'active') {
    updates.push('issued_date = ?');
    values.push(new Date().toISOString().split('T')[0]);
  }

  if (notes !== undefined) {
    updates.push('notes = ?');
    values.push(notes);
  }

  values.push(id);

  await c.env.DB.prepare(`
    UPDATE vehicle_registrations SET ${updates.join(', ')} WHERE id = ?
  `).bind(...values).run();

  const vehicle = await c.env.DB.prepare(`
    SELECT vr.*, h.address as household_address
    FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.id = ?
  `).bind(id).first();

  return c.json({ vehicle });
});

/**
 * PUT /api/admin/pass-management/vehicles/:id/assign-rfid
 * Assign RFID code to vehicle
 */
adminRouter.put('/pass-management/vehicles/:id/assign-rfid', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');
  const { rfid_code } = await c.req.json();

  if (!rfid_code) {
    return c.json({ error: 'RFID code is required' }, 400);
  }

  // Check if RFID is already assigned
  const existing = await c.env.DB.prepare(`
    SELECT id FROM vehicle_registrations WHERE rfid_code = ? AND id != ?
  `).bind(rfid_code, id).first();

  if (existing) {
    return c.json({ error: 'RFID code already assigned to another vehicle' }, 400);
  }

  await c.env.DB.prepare(`
    UPDATE vehicle_registrations SET rfid_code = ?, updated_at = ? WHERE id = ?
  `).bind(rfid_code, new Date().toISOString(), id).run();

  const vehicle = await c.env.DB.prepare(`
    SELECT vr.*, h.address as household_address
    FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.id = ?
  `).bind(id).first();

  return c.json({ vehicle });
});

/**
 * PUT /api/admin/pass-management/vehicles/:id/assign-sticker
 * Assign sticker number to vehicle
 */
adminRouter.put('/pass-management/vehicles/:id/assign-sticker', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');
  const { sticker_number } = await c.req.json();

  if (!sticker_number) {
    return c.json({ error: 'Sticker number is required' }, 400);
  }

  // Check if sticker is already assigned
  const existing = await c.env.DB.prepare(`
    SELECT id FROM vehicle_registrations WHERE sticker_number = ? AND id != ?
  `).bind(sticker_number, id).first();

  if (existing) {
    return c.json({ error: 'Sticker number already assigned to another vehicle' }, 400);
  }

  await c.env.DB.prepare(`
    UPDATE vehicle_registrations SET sticker_number = ?, updated_at = ? WHERE id = ?
  `).bind(sticker_number, new Date().toISOString(), id).run();

  const vehicle = await c.env.DB.prepare(`
    SELECT vr.*, h.address as household_address
    FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.id = ?
  `).bind(id).first();

  return c.json({ vehicle });
});

/**
 * POST /api/admin/pass-management/vehicles/:id/record-payment
 * Record in-person payment for vehicle pass
 */
adminRouter.post('/pass-management/vehicles/:id/record-payment', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');
  const { amount, method, reference_number, received_by } = await c.req.json();

  if (!amount || !method || !received_by) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // Get vehicle details
  const vehicle = await c.env.DB.prepare(`
    SELECT vr.*, h.id as household_id FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.id = ?
  `).bind(id).first();

  if (!vehicle) {
    return c.json({ error: 'Vehicle not found' }, 404);
  }

  // Create payment record
  const paymentId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO payments (id, household_id, amount, method, status, reference_number, period, payment_category, created_at)
    VALUES (?, ?, ?, ?, 'completed', ?, ?, 'vehicle_pass', ?)
  `).bind(
    paymentId,
    vehicle.household_id,
    amount,
    method,
    reference_number || null,
    now.getFullYear().toString(),
    now
  ).run();

  // Update vehicle registration
  await c.env.DB.prepare(`
    UPDATE vehicle_registrations
    SET payment_status = 'paid', amount_paid = ?, payment_method = ?, status = 'pending_approval', updated_at = ?
    WHERE id = ?
  `).bind(amount, method, now, id).run();

  const updated = await c.env.DB.prepare(`
    SELECT vr.*, h.address as household_address
    FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.id = ?
  `).bind(id).first();

  return c.json({ vehicle: updated });
});

/**
 * GET /api/admin/pass-management/fees
 * Get current fee structure
 */
adminRouter.get('/pass-management/fees', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const fees = await c.env.DB.prepare(`
    SELECT * FROM pass_fees
    WHERE effective_date <= DATE('now')
    ORDER BY fee_type, effective_date DESC
  `).all();

  // Group by fee_type, taking the most recent effective date
  const grouped = new Map();
  for (const fee of fees.results || []) {
    if (!grouped.has(fee.fee_type)) {
      grouped.set(fee.fee_type, fee);
    }
  }

  return c.json({ fees: Array.from(grouped.values()) });
});

/**
 * PUT /api/admin/pass-management/fees
 * Update fee structure
 */
adminRouter.put('/pass-management/fees', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { fees } = await c.req.json();

  if (!Array.isArray(fees) || fees.length !== 3) {
    return c.json({ error: 'Must provide exactly 3 fee entries (sticker, rfid, both)' }, 400);
  }

  const requiredTypes = ['sticker', 'rfid', 'both'];
  const now = new Date().toISOString().split('T')[0];

  for (const feeInput of fees) {
    if (!requiredTypes.includes(feeInput.fee_type) || typeof feeInput.amount !== 'number') {
      return c.json({ error: 'Invalid fee entry' }, 400);
    }

    const id = crypto.randomUUID();

    await c.env.DB.prepare(`
      INSERT INTO pass_fees (id, fee_type, amount, effective_date, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, feeInput.fee_type, feeInput.amount, now, now).run();
  }

  // Return updated fees
  const updated = await c.env.DB.prepare(`
    SELECT * FROM pass_fees
    WHERE effective_date = ?
    ORDER BY fee_type
  `).bind(now).all();

  return c.json({ fees: updated.results || [] });
});

/**
 * GET /api/admin/pass-management/stats
 * Get pass management statistics for admin dashboard
 */
adminRouter.get('/pass-management/stats', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Active employees
  const activeEmployees = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM household_employees WHERE status = 'active'
  `).first();

  // Active vehicles
  const activeVehicles = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM vehicle_registrations WHERE status = 'active'
  `).first();

  // Pending approvals (employees + vehicles)
  const pendingApprovals = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as count
    FROM (
      SELECT id FROM household_employees WHERE status = 'pending'
      UNION ALL
      SELECT id FROM vehicle_registrations WHERE status = 'pending_approval'
    )
  `).first();

  // Monthly revenue (current month)
  const monthlyRevenue = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(amount_paid), 0) as total
    FROM vehicle_registrations
    WHERE status != 'cancelled'
      AND payment_status = 'paid'
      AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).first();

  return c.json({
    stats: {
      active_employees: (activeEmployees?.count as number) || 0,
      active_vehicles: (activeVehicles?.count as number) || 0,
      pending_approvals: (pendingApprovals?.count as number) || 0,
      monthly_revenue: (monthlyRevenue?.total as number) || 0,
    }
  });
});
```

**Step 2: Verify TypeScript compilation**

```bash
cd worker && npm run build
```

Expected: No errors.

**Step 3: Commit**

```bash
git add worker/src/routes/admin.ts
git commit -m "feat: add admin pass management endpoints"
```

---

## Task 5: Frontend - API Client Extensions

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Add pass management API client methods**

Add after line 1056 (after `notifications` object):

```typescript
  passRequests: {
    // Employees
    listEmployees: (): Promise<ApiResponse<EmployeesResponse>> =>
      apiGet<EmployeesResponse>('/pass-requests/employees'),
    getEmployee: (id: string): Promise<ApiResponse<EmployeeResponse>> =>
      apiGet<EmployeeResponse>(`/pass-requests/employees/${id}`),
    createEmployee: (input: {
      household_id: string;
      full_name: string;
      employee_type: EmployeeType;
      photo?: File;
      expiry_date?: string;
    }) => {
      const formData = new FormData();
      formData.append('household_id', input.household_id);
      formData.append('full_name', input.full_name);
      formData.append('employee_type', input.employee_type);
      if (input.expiry_date) {
        formData.append('expiry_date', input.expiry_date);
      }
      if (input.photo) {
        formData.append('photo', input.photo);
      }
      return apiUpload<EmployeeResponse>('/pass-requests/employees', formData);
    },
    updateEmployee: (id: string, input: {
      full_name?: string;
      employee_type?: EmployeeType;
      expiry_date?: string;
      notes?: string;
    }) =>
      apiRequest<EmployeeResponse>(`/pass-requests/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    deleteEmployee: (id: string) =>
      apiRequest<{ success: boolean }>(`/pass-requests/employees/${id}`, {
        method: 'DELETE',
      }),
    // Vehicles
    listVehicles: (): Promise<ApiResponse<VehiclesResponse>> =>
      apiGet<VehiclesResponse>('/pass-requests/vehicles'),
    getVehicle: (id: string): Promise<ApiResponse<VehicleResponse>> =>
      apiGet<VehicleResponse>(`/pass-requests/vehicles/${id}`),
    createVehicle: (input: {
      household_id: string;
      plate_number: string;
      make: string;
      model: string;
      color: string;
      pass_type: PassType;
    }) =>
      apiRequest<VehicleResponse>('/pass-requests/vehicles', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateVehicle: (id: string, input: {
      plate_number?: string;
      make?: string;
      model?: string;
      color?: string;
      pass_type?: PassType;
    }) =>
      apiRequest<VehicleResponse>(`/pass-requests/vehicles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    deleteVehicle: (id: string) =>
      apiRequest<{ success: boolean }>(`/pass-requests/vehicles/${id}`, {
        method: 'DELETE',
      }),
  },
  admin: {
    // ... existing admin methods ...

    // Pass Management - Admin
    passManagement: {
      // Employees
      listEmployees: (params?: {
        status?: EmployeeStatus;
        household_id?: string;
        employee_type?: EmployeeType;
        search?: string;
      }) => {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        if (params?.household_id) query.append('household_id', params.household_id);
        if (params?.employee_type) query.append('employee_type', params.employee_type);
        if (params?.search) query.append('search', params.search);
        const queryString = query.toString();
        return apiRequest<EmployeesResponse>(
          `/admin/pass-management/employees${queryString ? '?' + queryString : ''}`
        );
      },
      getEmployee: (id: string): Promise<ApiResponse<EmployeeResponse>> =>
        apiGet<EmployeeResponse>(`/admin/pass-management/employees/${id}`),
      updateEmployeeStatus: (id: string, input: {
        status: EmployeeStatus;
        notes?: string;
      }) =>
        apiRequest<EmployeeResponse>(`/admin/pass-management/employees/${id}/status`, {
          method: 'PUT',
          body: JSON.stringify(input),
        }),
      // Vehicles
      listVehicles: (params?: {
        status?: VehicleStatus;
        household_id?: string;
        pass_type?: PassType;
        search?: string;
      }) => {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        if (params?.household_id) query.append('household_id', params.household_id);
        if (params?.pass_type) query.append('pass_type', params.pass_type);
        if (params?.search) query.append('search', params.search);
        const queryString = query.toString();
        return apiRequest<VehiclesResponse>(
          `/admin/pass-management/vehicles${queryString ? '?' + queryString : ''}`
        );
      },
      getVehicle: (id: string): Promise<ApiResponse<VehicleResponse>> =>
        apiGet<VehicleResponse>(`/admin/pass-management/vehicles/${id}`),
      updateVehicleStatus: (id: string, input: {
        status: VehicleStatus;
        notes?: string;
      }) =>
        apiRequest<VehicleResponse>(`/admin/pass-management/vehicles/${id}/status`, {
          method: 'PUT',
          body: JSON.stringify(input),
        }),
      assignRFID: (id: string, input: { rfid_code: string }) =>
        apiRequest<VehicleResponse>(`/admin/pass-management/vehicles/${id}/assign-rfid`, {
          method: 'PUT',
          body: JSON.stringify(input),
        }),
      assignSticker: (id: string, input: { sticker_number: string }) =>
        apiRequest<VehicleResponse>(`/admin/pass-management/vehicles/${id}/assign-sticker`, {
          method: 'PUT',
          body: JSON.stringify(input),
        }),
      recordPayment: (id: string, input: {
        amount: number;
        method: PaymentMethod;
        reference_number?: string;
        received_by: string;
      }) =>
        apiRequest<VehicleResponse>(`/admin/pass-management/vehicles/${id}/record-payment`, {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      // Fees
      getFees: (): Promise<ApiResponse<PassFeesResponse>> =>
        apiGet<PassFeesResponse>('/admin/pass-management/fees'),
      updateFees: (fees: Array<{ fee_type: PassType; amount: number }>) =>
        apiRequest<PassFeesUpdateResponse>('/admin/pass-management/fees', {
          method: 'PUT',
          body: JSON.stringify({ fees }),
        }),
      // Stats
      getStats: (): Promise<ApiResponse<{ stats: PassStats }>> =>
        apiGet<{ stats: PassStats }>('/admin/pass-management/stats'),
    },
  },
```

**Note:** You'll need to add the new type imports at the top of the file:

After line 26 (after `AdminNotificationsResponse`):

```typescript
  PassStats,
  EmployeesResponse,
  EmployeeResponse,
  VehiclesResponse,
  VehicleResponse,
  PassFeesResponse,
  PassFeesUpdateResponse,
  EmployeeType,
  PassType,
  EmployeeStatus,
  VehicleStatus,
```

**Step 2: Verify TypeScript compilation**

```bash
npm run build
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add pass management API client"
```

---

## Task 6: Frontend - Resident Passes Page

**Files:**
- Create: `src/pages/PassesPage.tsx`
- Modify: `src/App.tsx` (add route)

**Step 1: Create PassesPage component**

Create `src/pages/PassesPage.tsx`:

```typescript
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  HouseholdEmployee,
  VehicleRegistration,
  EmployeeType,
  EmployeeStatus,
  PassType,
  VehicleStatus,
  MyLotsSummary,
} from "@/types";
import {
  User,
  Car,
  Plus,
  X,
  Edit,
  Trash2,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  driver: "Driver",
  housekeeper: "Housekeeper",
  caretaker: "Caretaker",
  other: "Other",
};

const EMPLOYEE_STATUS_COLORS: Record<EmployeeStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  revoked: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-700",
};

const VEHICLE_STATUS_COLORS: Record<VehicleStatus, string> = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  pending_approval: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const PASS_TYPE_LABELS: Record<PassType, string> = {
  sticker: "Sticker Only",
  rfid: "RFID Only",
  both: "Sticker + RFID",
};

export function PassesPage() {
  const { user } = useAuth();
  const [myLots, setMyLots] = useState<MyLotsSummary | null>(null);
  const [employees, setEmployees] = useState<HouseholdEmployee[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<HouseholdEmployee | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<VehicleRegistration | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      // Load user's lots first
      const lotsResult = await api.households.getMyLots();
      if (lotsResult.data?.lots) {
        setMyLots(lotsResult.data);
      }

      // Load employees and vehicles in parallel
      const [employeesResult, vehiclesResult] = await Promise.all([
        api.passRequests.listEmployees(),
        api.passRequests.listVehicles(),
      ]);

      if (employeesResult.data?.employees) {
        setEmployees(employeesResult.data.employees);
      }
      if (vehiclesResult.data?.vehicles) {
        setVehicles(vehiclesResult.data.vehicles);
      }
    } catch (err) {
      console.error("Error loading passes data:", err);
      setError("Failed to load passes data");
    } finally {
      setLoading(false);
    }
  }

  const activeEmployeeCount = employees.filter(
    (e) => e.status === "pending" || e.status === "active"
  ).length;

  const activeVehicleCount = vehicles.filter(
    (v) => v.status !== "cancelled"
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Passes</h1>
        <p className="mt-2 text-gray-600">
          Manage your household employee IDs and vehicle gate passes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Employee IDs</p>
              <p className="text-2xl font-semibold text-gray-900">
                {activeEmployeeCount} Active
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <Car className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Vehicle Passes</p>
              <p className="text-2xl font-semibold text-gray-900">
                {activeVehicleCount} Registered
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Employees Section */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Employee IDs</h2>
          <button
            onClick={() => setShowEmployeeForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Request ID
          </button>
        </div>

        <div className="divide-y divide-gray-200">
          {employees.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No employee IDs requested yet</p>
            </div>
          ) : (
            employees.map((employee) => (
              <div key={employee.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {employee.photo_url && (
                    <img
                      src={employee.photo_url}
                      alt={employee.full_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{employee.full_name}</p>
                    <p className="text-sm text-gray-500">
                      {EMPLOYEE_TYPE_LABELS[employee.employee_type]} • {employee.id_number}
                    </p>
                    {employee.expiry_date && (
                      <p className="text-xs text-gray-400">
                        Expires: {new Date(employee.expiry_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${EMPLOYEE_STATUS_COLORS[employee.status]}`}
                  >
                    {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                  </span>
                  {employee.status === "pending" && (
                    <button
                      onClick={() => setEditingEmployee(employee)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Vehicles Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Vehicle Passes</h2>
          <button
            onClick={() => setShowVehicleForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Register Vehicle
          </button>
        </div>

        <div className="divide-y divide-gray-200">
          {vehicles.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Car className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No vehicles registered yet</p>
            </div>
          ) : (
            vehicles.map((vehicle) => (
              <div key={vehicle.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {vehicle.plate_number}
                    </p>
                    <p className="text-sm text-gray-500">
                      {vehicle.make} {vehicle.model} • {vehicle.color}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {PASS_TYPE_LABELS[vehicle.pass_type]}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    {vehicle.status === "pending_payment" && (
                      <div className="flex items-center text-amber-600">
                        <CreditCard className="w-4 h-4 mr-1" />
                        <span className="text-sm">
                          ₱{vehicle.amount_due?.toLocaleString()} due
                        </span>
                      </div>
                    )}
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${VEHICLE_STATUS_COLORS[vehicle.status]}`}
                    >
                      {vehicle.status === "pending_payment"
                        ? "Payment Due"
                        : vehicle.status === "pending_approval"
                          ? "Pending Approval"
                          : vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1)}
                    </span>
                    {vehicle.status !== "active" && vehicle.status !== "cancelled" && (
                      <button
                        onClick={() => setEditingVehicle(vehicle)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {(vehicle.rfid_code || vehicle.sticker_number) && (
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    {vehicle.rfid_code && <span>RFID: {vehicle.rfid_code}</span>}
                    {vehicle.sticker_number && <span>Sticker: {vehicle.sticker_number}</span>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Forms (rendered as modals in next task) */}
      {showEmployeeForm && (
        <EmployeeFormModal
          lots={myLots?.lots || []}
          onClose={() => setShowEmployeeForm(false)}
          onSuccess={() => {
            setShowEmployeeForm(false);
            loadData();
          }}
        />
      )}

      {editingEmployee && (
        <EmployeeEditModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSuccess={() => {
            setEditingEmployee(null);
            loadData();
          }}
        />
      )}

      {showVehicleForm && (
        <VehicleFormModal
          lots={myLots?.lots || []}
          onClose={() => setShowVehicleForm(false)}
          onSuccess={() => {
            setShowVehicleForm(false);
            loadData();
          }}
        />
      )}

      {editingVehicle && (
        <VehicleEditModal
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onSuccess={() => {
            setEditingVehicle(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// Helper components for forms (to be implemented in next task)
function EmployeeFormModal({ lots, onClose, onSuccess }: any) {
  return <div>Employee Form - To be implemented</div>;
}

function EmployeeEditModal({ employee, onClose, onSuccess }: any) {
  return <div>Employee Edit - To be implemented</div>;
}

function VehicleFormModal({ lots, onClose, onSuccess }: any) {
  return <div>Vehicle Form - To be implemented</div>;
}

function VehicleEditModal({ vehicle, onClose, onSuccess }: any) {
  return <div>Vehicle Edit - To be implemented</div>;
}
```

**Step 2: Add route to App.tsx**

Find the routes section in `src/App.tsx` and add:

```typescript
import { PassesPage } from "./pages/PassesPage";
```

Then add the route (pattern based on existing routes):

```typescript
<Route path="/passes" element={<PassesPage />} />
```

**Step 3: Verify TypeScript compilation**

```bash
npm run build
```

Expected: No errors (placeholder components will show warnings).

**Step 4: Commit**

```bash
git add src/pages/PassesPage.tsx src/App.tsx
git commit -m "feat: add resident passes page scaffold"
```

---

## Task 7: Frontend - Employee Form Modals

**Files:**
- Modify: `src/pages/PassesPage.tsx`

**Step 1: Implement EmployeeFormModal component**

Replace the `EmployeeFormModal` placeholder with:

```typescript
function EmployeeFormModal({ lots, onClose, onSuccess }: {
  lots: Array<{ lot_id: string; address?: string }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedLotId, setSelectedLotId] = useState("");
  const [fullName, setFullName] = useState("");
  const [employeeType, setEmployeeType] = useState<EmployeeType>("driver");
  const [expiryDate, setExpiryDate] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLotId || !fullName) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");

    api.passRequests
      .createEmployee({
        household_id: selectedLotId,
        full_name: fullName,
        employee_type: employeeType,
        photo: photo || undefined,
        expiry_date: expiryDate || undefined,
      })
      .then((result) => {
        if (result.error) {
          setError(result.error);
        } else {
          onSuccess();
        }
      })
      .finally(() => setLoading(false));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      setPreview(URL.createObjectURL(file));
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Request Employee ID</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedLotId}
              onChange={(e) => setSelectedLotId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              required
            >
              <option value="">Select property</option>
              {lots.map((lot) => (
                <option key={lot.lot_id} value={lot.lot_id}>
                  {lot.address || lot.lot_id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employee Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="Full name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={employeeType}
              onChange={(e) => setEmployeeType(e.target.value as EmployeeType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              required
            >
              {Object.entries(EMPLOYEE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photo (Optional)
            </label>
            <div className="flex items-center space-x-4">
              {preview && (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-16 h-16 rounded-full object-cover"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiry Date (Optional)
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank for long-term employees
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Implement EmployeeEditModal component**

Replace the `EmployeeEditModal` placeholder with:

```typescript
function EmployeeEditModal({ employee, onClose, onSuccess }: {
  employee: HouseholdEmployee;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [fullName, setFullName] = useState(employee.full_name);
  const [employeeType, setEmployeeType] = useState<EmployeeType>(employee.employee_type);
  const [expiryDate, setExpiryDate] = useState(employee.expiry_date || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    api.passRequests
      .updateEmployee(employee.id, {
        full_name: fullName,
        employee_type: employeeType,
        expiry_date: expiryDate || undefined,
      })
      .then((result) => {
        if (result.error) {
          setError(result.error);
        } else {
          onSuccess();
        }
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Employee</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employee Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={employeeType}
              onChange={(e) => setEmployeeType(e.target.value as EmployeeType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              required
            >
              {Object.entries(EMPLOYEE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiry Date
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 3: Verify TypeScript compilation**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/pages/PassesPage.tsx
git commit -m "feat: implement employee form modals"
```

---

## Task 8: Frontend - Vehicle Form Modals

**Files:**
- Modify: `src/pages/PassesPage.tsx`

**Step 1: Implement VehicleFormModal component**

Replace the `VehicleFormModal` placeholder with:

```typescript
function VehicleFormModal({ lots, onClose, onSuccess }: {
  lots: Array<{ lot_id: string; address?: string }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedLotId, setSelectedLotId] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [passType, setPassType] = useState<PassType>("sticker");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feeAmount, setFeeAmount] = useState<number>(0);

  // Fetch current fees when pass type changes
  useEffect(() => {
    api.admin.passManagement
      .getFees()
      .then((result) => {
        if (result.data?.fees) {
          const fee = result.data.fees.find((f) => f.fee_type === passType);
          setFeeAmount(fee?.amount || 0);
        }
      });
  }, [passType]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLotId || !plateNumber || !make || !model || !color) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");

    api.passRequests
      .createVehicle({
        household_id: selectedLotId,
        plate_number: plateNumber,
        make,
        model,
        color,
        pass_type: passType,
      })
      .then((result) => {
        if (result.error) {
          setError(result.error);
        } else {
          onSuccess();
        }
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Register Vehicle Pass</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Fee Required
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {PASS_TYPE_LABELS[passType]}: ₱{feeAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedLotId}
              onChange={(e) => setSelectedLotId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              required
            >
              <option value="">Select property</option>
              {lots.map((lot) => (
                <option key={lot.lot_id} value={lot.lot_id}>
                  {lot.address || lot.lot_id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plate Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="ABC 123"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Make <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="Toyota"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="Vios"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="White"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pass Type <span className="text-red-500">*</span>
            </label>
            <select
              value={passType}
              onChange={(e) => setPassType(e.target.value as PassType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              required
            >
              {Object.entries(PASS_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Continue to Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Implement VehicleEditModal component**

Replace the `VehicleEditModal` placeholder with:

```typescript
function VehicleEditModal({ vehicle, onClose, onSuccess }: {
  vehicle: VehicleRegistration;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [plateNumber, setPlateNumber] = useState(vehicle.plate_number);
  const [make, setMake] = useState(vehicle.make);
  const [model, setModel] = useState(vehicle.model);
  const [color, setColor] = useState(vehicle.color);
  const [passType, setPassType] = useState<PassType>(vehicle.pass_type);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    api.passRequests
      .updateVehicle(vehicle.id, {
        plate_number: plateNumber,
        make,
        model,
        color,
        pass_type: passType,
      })
      .then((result) => {
        if (result.error) {
          setError(result.error);
        } else {
          onSuccess();
        }
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Vehicle</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plate Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Make <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pass Type <span className="text-red-500">*</span>
            </label>
            <select
              value={passType}
              onChange={(e) => setPassType(e.target.value as PassType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              required
            >
              {Object.entries(PASS_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 3: Verify TypeScript compilation**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/pages/PassesPage.tsx
git commit -m "feat: implement vehicle form modals"
```

---

## Task 9: Frontend - Add Navigation Link

**Files:**
- Modify: `src/components/Layout.tsx` (or wherever navigation is defined)

**Step 1: Find the navigation component**

```bash
grep -r "Dashboard\|Service Requests\|Reservations" src/components/ --include="*.tsx"
```

Expected: Find the navigation/sidebar component.

**Step 2: Add Passes link to navigation**

Add navigation entry for Passes (following existing pattern):

```typescript
<Link to="/passes" className="flex items-center space-x-3 ...">
  <IdCard className="w-5 h-5" />
  <span>Passes</span>
</Link>
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat: add passes navigation link"
```

---

## Task 10: Frontend - Admin Pass Management Page

**Files:**
- Create: `src/pages/PassManagementPage.tsx`
- Modify: `src/App.tsx` (add admin route)

**Step 1: Create admin pass management page**

Create `src/pages/PassManagementPage.tsx` with full CRUD interface for employees and vehicles. This should include:
- Tabbed interface (Employees / Vehicles)
- Filter controls
- Search functionality
- Action buttons (approve, revoke, assign RFID, record payment)
- Status badges

**Step 2: Add admin route**

```typescript
<Route path="/admin/pass-management" element={<PassManagementPage />} />
```

**Step 3: Build and commit**

```bash
npm run build
git add src/pages/PassManagementPage.tsx src/App.tsx
git commit -m "feat: add admin pass management page"
```

---

## Task 11: Frontend - Dashboard Stats Integration

**Files:**
- Modify: `src/pages/DashboardPage.tsx` (resident)
- Modify: `src/pages/AdminPanelPage.tsx` (admin)

**Step 1: Add pass stats to resident dashboard**

Add pass counts to DashboardPage.

**Step 2: Add pass stats to admin dashboard**

Call `api.admin.passManagement.getStats()` and display in AdminPanelPage.

**Step 3: Build and commit**

```bash
npm run build
git add src/pages/DashboardPage.tsx src/pages/AdminPanelPage.tsx
git commit -m "feat: add pass stats to dashboards"
```

---

## Task 12: Testing & Verification

**Files:** N/A (manual testing)

**Step 1: Run the application**

```bash
npm run dev:all
```

**Step 2: Test as resident**

1. Login as resident user
2. Navigate to /passes
3. Create employee ID request
4. Create vehicle registration
5. Verify status badges display correctly
6. Test edit functionality

**Step 3: Test as admin**

1. Login as admin user
2. Navigate to /admin/pass-management
3. Approve employee ID
4. Process vehicle payment
5. Approve vehicle registration
6. Assign RFID/sticker numbers
7. Test filters and search

**Step 4: Test edge cases**

- Duplicate plate number rejection
- Employee/vehicle limit enforcement
- Status transitions
- Concurrent edits

**Step 5: Document any issues**

Create issues for any bugs found.

---

## Task 13: Final Cleanup

**Files:**
- Modify: `CLAUDE.md` (update project docs)

**Step 1: Update CLAUDE.md**

Add pass management section to project documentation.

**Step 2: Final build**

```bash
npm run build
```

**Step 3: Merge to main**

```bash
git checkout master
git merge feature/employee-vehicle-pass-management
git push
```

**Step 4: Cleanup branch**

```bash
git branch -d feature/employee-vehicle-pass-management
```
