import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

// =============================================================================
// SCHEMAS
// =============================================================================

const employeeSchema = z.object({
  household_id: z.string(),
  full_name: z.string().min(1, 'Full name is required'),
  employee_type: z.enum(['driver', 'housekeeper', 'caretaker', 'other']),
  id_number: z.string().min(1, 'ID number is required'),
  photo_url: z.string().url().optional(),
  notes: z.string().optional(),
});

const employeeUpdateSchema = z.object({
  full_name: z.string().min(1).optional(),
  employee_type: z.enum(['driver', 'housekeeper', 'caretaker', 'other']).optional(),
  id_number: z.string().min(1).optional(),
  photo_url: z.string().url().optional(),
  status: z.enum(['pending', 'active', 'revoked', 'expired']).optional(),
  expiry_date: z.string().optional(),
  notes: z.string().optional(),
});

const vehicleSchema = z.object({
  household_id: z.string(),
  plate_number: z.string().min(1, 'Plate number is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  color: z.string().min(1, 'Color is required'),
  pass_type: z.enum(['sticker', 'rfid', 'both']),
  payment_method: z.enum(['gcash', 'paymaya', 'instapay', 'cash', 'in-person']).optional(),
  notes: z.string().optional(),
});

const vehicleUpdateSchema = z.object({
  plate_number: z.string().min(1).optional(),
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  pass_type: z.enum(['sticker', 'rfid', 'both']).optional(),
  status: z.enum(['pending_payment', 'pending_approval', 'active', 'cancelled']).optional(),
  payment_status: z.enum(['unpaid', 'paid']).optional(),
  rfid_code: z.string().optional(),
  sticker_number: z.string().optional(),
  notes: z.string().optional(),
});

export const passManagementRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// UTILITIES
// =============================================================================

function generateId(): string {
  return crypto.randomUUID();
}

async function canAccessHousehold(c: any, householdId: string): Promise<boolean> {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) return false;

  // Admin and staff can access any household
  if (authUser.role === 'admin' || authUser.role === 'staff') return true;

  // Residents can only access their own households
  const household = await c.env.DB.prepare(
    'SELECT id FROM households WHERE id = ? AND owner_id = ?'
  ).bind(householdId, authUser.userId).first();

  return !!household;
}

// =============================================================================
// EMPLOYEE ENDPOINTS (RESIDENT)
// =============================================================================

/**
 * GET /api/pass-management/employees/:householdId
 * Get all employees for a household
 */
passManagementRouter.get('/employees/:householdId', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');

  // Check permission
  const canAccess = await canAccessHousehold(c, householdId);
  if (!canAccess) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const employees = await c.env.DB.prepare(`
    SELECT
      he.*,
      h.address as household_address
    FROM household_employees he
    JOIN households h ON he.household_id = h.id
    WHERE he.household_id = ?
    ORDER BY he.created_at DESC
  `).bind(householdId).all();

  return c.json({ employees: employees.results || [] });
});

/**
 * GET /api/pass-management/employees/:householdId/:id
 * Get single employee
 */
passManagementRouter.get('/employees/:householdId/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');
  const employeeId = c.req.param('id');

  // Check permission
  const canAccess = await canAccessHousehold(c, householdId);
  if (!canAccess) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const employee = await c.env.DB.prepare(`
    SELECT
      he.*,
      h.address as household_address
    FROM household_employees he
    JOIN households h ON he.household_id = h.id
    WHERE he.id = ? AND he.household_id = ?
  `).bind(employeeId, householdId).first();

  if (!employee) {
    return c.json({ error: 'Employee not found' }, 404);
  }

  return c.json({ employee });
});

/**
 * POST /api/pass-management/employees
 * Create new employee
 */
passManagementRouter.post('/employees', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = employeeSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { household_id, full_name, employee_type, id_number, photo_url, notes } = result.data;

  // Check permission
  const canAccess = await canAccessHousehold(c, household_id);
  if (!canAccess) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Check for duplicate ID number within household
  const existing = await c.env.DB.prepare(
    'SELECT id FROM household_employees WHERE household_id = ? AND id_number = ?'
  ).bind(household_id, id_number).first();

  if (existing) {
    return c.json({ error: 'An employee with this ID number already exists in your household' }, 409);
  }

  const id = generateId();

  await c.env.DB.prepare(`
    INSERT INTO household_employees (
      id, household_id, full_name, employee_type, id_number,
      photo_url, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).bind(id, household_id, full_name, employee_type, id_number, photo_url || null, notes || null).run();

  const employee = await c.env.DB.prepare(
    'SELECT * FROM household_employees WHERE id = ?'
  ).bind(id).first();

  return c.json({ employee }, 201);
});

/**
 * PUT /api/pass-management/employees/:householdId/:id
 * Update employee
 */
passManagementRouter.put('/employees/:householdId/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');
  const employeeId = c.req.param('id');
  const body = await c.req.json();
  const result = employeeUpdateSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  // Check permission
  const canAccess = await canAccessHousehold(c, householdId);
  if (!canAccess) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Get existing employee
  const existing = await c.env.DB.prepare(
    'SELECT * FROM household_employees WHERE id = ? AND household_id = ?'
  ).bind(employeeId, householdId).first();

  if (!existing) {
    return c.json({ error: 'Employee not found' }, 404);
  }

  // Residents can only update specific fields
  const residentAllowedFields = ['full_name', 'employee_type', 'id_number', 'photo_url', 'notes'];
  const isResident = authUser.role === 'resident';

  // Build update query dynamically
  const updates: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(result.data)) {
    if (value !== undefined) {
      if (isResident && !residentAllowedFields.includes(key)) {
        continue; // Skip fields residents can't modify
      }
      updates.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (updates.length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  params.push(employeeId);
  const query = `UPDATE household_employees SET ${updates.join(', ')} WHERE id = ?`;

  await c.env.DB.prepare(query).bind(...params).run();

  const employee = await c.env.DB.prepare(
    'SELECT * FROM household_employees WHERE id = ?'
  ).bind(employeeId).first();

  return c.json({ employee });
});

/**
 * DELETE /api/pass-management/employees/:householdId/:id
 * Delete employee (resident can revoke, admin can delete)
 */
passManagementRouter.delete('/employees/:householdId/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');
  const employeeId = c.req.param('id');

  // Check permission
  const canAccess = await canAccessHousehold(c, householdId);
  if (!canAccess) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Get existing employee
  const existing = await c.env.DB.prepare(
    'SELECT * FROM household_employees WHERE id = ? AND household_id = ?'
  ).bind(employeeId, householdId).first();

  if (!existing) {
    return c.json({ error: 'Employee not found' }, 404);
  }

  // Residents can only revoke, admin can delete
  if (authUser.role === 'resident') {
    await c.env.DB.prepare(
      'UPDATE household_employees SET status = ? WHERE id = ?'
    ).bind('revoked', employeeId).run();
    return c.json({ success: true, message: 'Employee pass revoked' });
  } else {
    await c.env.DB.prepare(
      'DELETE FROM household_employees WHERE id = ?'
    ).bind(employeeId).run();
    return c.json({ success: true, message: 'Employee deleted' });
  }
});

// =============================================================================
// VEHICLE ENDPOINTS (RESIDENT)
// =============================================================================

/**
 * GET /api/pass-management/vehicles/:householdId
 * Get all vehicles for a household
 */
passManagementRouter.get('/vehicles/:householdId', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');

  // Check permission
  const canAccess = await canAccessHousehold(c, householdId);
  if (!canAccess) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const vehicles = await c.env.DB.prepare(`
    SELECT
      vr.*,
      h.address as household_address
    FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.household_id = ?
    ORDER BY vr.created_at DESC
  `).bind(householdId).all();

  // Get current fees
  const fees = await c.env.DB.prepare(`
    SELECT fee_type, amount
    FROM pass_fees
    WHERE effective_date <= DATE('now')
    ORDER BY effective_date DESC
  `).all();

  const feeMap = (fees.results || []).reduce((acc: any, fee: any) => {
    acc[fee.fee_type] = fee.amount;
    return acc;
  }, {} as Record<string, number>);

  // Add amount_due based on pass_type
  const vehiclesWithFees = (vehicles.results || []).map((v: any) => {
    const amountDue = feeMap[v.pass_type] || 0;
    return {
      ...v,
      amount_due: v.amount_due || amountDue,
    };
  });

  return c.json({ vehicles: vehiclesWithFees });
});

/**
 * GET /api/pass-management/vehicles/:householdId/:id
 * Get single vehicle
 */
passManagementRouter.get('/vehicles/:householdId/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');
  const vehicleId = c.req.param('id');

  // Check permission
  const canAccess = await canAccessHousehold(c, householdId);
  if (!canAccess) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const vehicle = await c.env.DB.prepare(`
    SELECT
      vr.*,
      h.address as household_address
    FROM vehicle_registrations vr
    JOIN households h ON vr.household_id = h.id
    WHERE vr.id = ? AND vr.household_id = ?
  `).bind(vehicleId, householdId).first();

  if (!vehicle) {
    return c.json({ error: 'Vehicle not found' }, 404);
  }

  return c.json({ vehicle });
});

/**
 * POST /api/pass-management/vehicles
 * Create new vehicle registration
 */
passManagementRouter.post('/vehicles', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = vehicleSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { household_id, plate_number, make, model, color, pass_type, payment_method, notes } = result.data;

  // Check permission
  const canAccess = await canAccessHousehold(c, household_id);
  if (!canAccess) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Check for duplicate plate number (globally unique)
  const existing = await c.env.DB.prepare(
    'SELECT id FROM vehicle_registrations WHERE plate_number = ? AND status != ?'
  ).bind(plate_number.toUpperCase(), 'cancelled').first();

  if (existing) {
    return c.json({ error: 'This plate number is already registered' }, 409);
  }

  // Get current fee for pass_type
  const fee = await c.env.DB.prepare(`
    SELECT amount FROM pass_fees
    WHERE fee_type = ? AND effective_date <= DATE('now')
    ORDER BY effective_date DESC
    LIMIT 1
  `).bind(pass_type).first();

  const amountDue = fee?.amount || 0;

  const id = generateId();

  await c.env.DB.prepare(`
    INSERT INTO vehicle_registrations (
      id, household_id, plate_number, make, model, color,
      pass_type, amount_due, payment_status, payment_method, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, 'pending_payment')
  `).bind(
    id,
    household_id,
    plate_number.toUpperCase(),
    make,
    model,
    color,
    pass_type,
    amountDue,
    payment_method || null,
    notes || null
  ).run();

  const vehicle = await c.env.DB.prepare(
    'SELECT * FROM vehicle_registrations WHERE id = ?'
  ).bind(id).first();

  return c.json({ vehicle }, 201);
});

/**
 * PUT /api/pass-management/vehicles/:householdId/:id
 * Update vehicle
 */
passManagementRouter.put('/vehicles/:householdId/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');
  const vehicleId = c.req.param('id');
  const body = await c.req.json();
  const result = vehicleUpdateSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  // Check permission
  const canAccess = await canAccessHousehold(c, householdId);
  if (!canAccess) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Get existing vehicle
  const existing = await c.env.DB.prepare(
    'SELECT * FROM vehicle_registrations WHERE id = ? AND household_id = ?'
  ).bind(vehicleId, householdId).first();

  if (!existing) {
    return c.json({ error: 'Vehicle not found' }, 404);
  }

  // Residents can only update specific fields
  const residentAllowedFields = ['plate_number', 'make', 'model', 'color', 'pass_type', 'notes'];
  const isResident = authUser.role === 'resident';

  // Check for duplicate plate number if changing it
  if (result.data.plate_number && result.data.plate_number.toUpperCase() !== existing.plate_number) {
    const duplicate = await c.env.DB.prepare(
      'SELECT id FROM vehicle_registrations WHERE plate_number = ? AND id != ? AND status != ?'
    ).bind(result.data.plate_number.toUpperCase(), vehicleId, 'cancelled').first();

    if (duplicate) {
      return c.json({ error: 'This plate number is already registered' }, 409);
    }
  }

  // Build update query dynamically
  const updates: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(result.data)) {
    if (value !== undefined) {
      if (isResident && !residentAllowedFields.includes(key)) {
        continue; // Skip fields residents can't modify
      }
      // Capitalize plate number
      if (key === 'plate_number') {
        updates.push(`${key} = ?`);
        params.push((value as string).toUpperCase());
      } else {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }
  }

  if (updates.length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  params.push(vehicleId);
  const query = `UPDATE vehicle_registrations SET ${updates.join(', ')} WHERE id = ?`;

  await c.env.DB.prepare(query).bind(...params).run();

  const vehicle = await c.env.DB.prepare(
    'SELECT * FROM vehicle_registrations WHERE id = ?'
  ).bind(vehicleId).first();

  return c.json({ vehicle });
});

/**
 * DELETE /api/pass-management/vehicles/:householdId/:id
 * Delete vehicle (resident can cancel, admin can delete)
 */
passManagementRouter.delete('/vehicles/:householdId/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');
  const vehicleId = c.req.param('id');

  // Check permission
  const canAccess = await canAccessHousehold(c, householdId);
  if (!canAccess) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Get existing vehicle
  const existing = await c.env.DB.prepare(
    'SELECT * FROM vehicle_registrations WHERE id = ? AND household_id = ?'
  ).bind(vehicleId, householdId).first();

  if (!existing) {
    return c.json({ error: 'Vehicle not found' }, 404);
  }

  // Residents can only cancel, admin can delete
  if (authUser.role === 'resident') {
    await c.env.DB.prepare(
      'UPDATE vehicle_registrations SET status = ? WHERE id = ?'
    ).bind('cancelled', vehicleId).run();
    return c.json({ success: true, message: 'Vehicle registration cancelled' });
  } else {
    await c.env.DB.prepare(
      'DELETE FROM vehicle_registrations WHERE id = ?'
    ).bind(vehicleId).run();
    return c.json({ success: true, message: 'Vehicle registration deleted' });
  }
});

// =============================================================================
// PASS FEES ENDPOINTS (PUBLIC/RESIDENT)
// =============================================================================

/**
 * GET /api/pass-management/fees
 * Get current pass fees
 */
passManagementRouter.get('/fees', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const fees = await c.env.DB.prepare(`
    SELECT fee_type, amount, effective_date
    FROM pass_fees
    WHERE effective_date <= DATE('now')
    ORDER BY fee_type, effective_date DESC
  `).all();

  // Get latest fee for each type
  const feeMap: Record<string, { amount: number; effective_date: string }> = {};

  for (const fee of fees.results || []) {
    if (!feeMap[fee.fee_type]) {
      feeMap[fee.fee_type] = {
        amount: fee.amount,
        effective_date: fee.effective_date,
      };
    }
  }

  return c.json({
    fees: [
      { fee_type: 'sticker', ...feeMap['sticker'] },
      { fee_type: 'rfid', ...feeMap['rfid'] },
      { fee_type: 'both', ...feeMap['both'] },
    ].filter((f) => f.amount !== undefined),
  });
});
