import { Hono } from 'hono';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
};

// Enums for validation
enum EmployeeType {
  DRIVER = 'driver',
  HOUSEKEEPER = 'housekeeper',
  CARETAKER = 'caretaker',
  OTHER = 'other'
}

enum PassType {
  STICKER = 'sticker',
  RFID = 'rfid',
  BOTH = 'both'
}

enum EmployeeStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired'
}

enum VehicleStatus {
  PENDING_PAYMENT = 'pending_payment',
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

enum PaymentStatus {
  UNPAID = 'unpaid',
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded'
}

// Photo validation constants
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validate photo upload
 */
function validatePhoto(file: File | undefined): { valid: boolean; error?: string } {
  if (!file || file.size === 0) {
    return { valid: true }; // Photo is optional
  }

  // Check file size
  if (file.size > MAX_PHOTO_SIZE) {
    return {
      valid: false,
      error: `Photo size must be less than 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    };
  }

  // Check file type
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Photo must be JPEG, PNG, or WebP format. Current type: ${file.type}`
    };
  }

  return { valid: true };
}

/**
 * Validate employee type enum
 */
function validateEmployeeType(type: string): boolean {
  return Object.values(EmployeeType).includes(type as EmployeeType);
}

/**
 * Validate pass type enum
 */
function validatePassType(type: string): boolean {
  return Object.values(PassType).includes(type as PassType);
}

/**
 * Generate unique ID number with random component
 */
function generateIdNumber(prefix: string): string {
  const timestamp = Date.now().toString(36); // Base36 for shorter string
  const random = Math.random().toString(36).substring(2, 6); // 4 random chars
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

export const passManagementRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// RESIDENT ENDPOINTS - /api/pass-requests
// =============================================================================

/**
 * GET /api/pass-requests/employees
 * Get current user's sponsored employees
 */
passManagementRouter.get('/employees', async (c) => {
  try {
    const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's household(s)
    const households = await c.env.DB.prepare(`
      SELECT id, address FROM households WHERE owner_id = ?
    `).bind(authUser.userId).all();

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
  } catch (error) {
    console.error('Error fetching employees:', error);
    return c.json({ error: 'Failed to fetch employees' }, 500);
  }
});

/**
 * POST /api/pass-requests/employees
 * Request new employee ID
 */
passManagementRouter.post('/employees', async (c) => {
  try {
    const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.parseBody();
    const { household_id, full_name, employee_type, expiry_date } = body;

    if (!household_id || !full_name || !employee_type) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate employee type
    if (!validateEmployeeType(employee_type as string)) {
      return c.json({
        error: `Invalid employee_type. Must be one of: ${Object.values(EmployeeType).join(', ')}`
      }, 400);
    }

    // Validate photo if present
    const photo = body.photo as File;
    const photoValidation = validatePhoto(photo);
    if (!photoValidation.valid) {
      return c.json({ error: photoValidation.error }, 400);
    }

    // Verify ownership
    const household = await c.env.DB.prepare(`
      SELECT id FROM households WHERE id = ? AND owner_id = ?
    `).bind(household_id as string, authUser.userId).first();

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

    // Generate unique ID number with random component
    const idNumber = generateIdNumber('EMP');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Handle photo upload if present
    let photoUrl: string | undefined;
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
  } catch (error) {
    console.error('Error creating employee:', error);
    return c.json({ error: 'Failed to create employee' }, 500);
  }
});

/**
 * PUT /api/pass-requests/employees/:id
 * Update employee details
 */
passManagementRouter.put('/employees/:id', async (c) => {
  try {
    const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const body = await c.req.json();

    // Validate employee_type if provided
    if (body.employee_type && !validateEmployeeType(body.employee_type)) {
      return c.json({
        error: `Invalid employee_type. Must be one of: ${Object.values(EmployeeType).join(', ')}`
      }, 400);
    }

    // Verify ownership
    const employee = await c.env.DB.prepare(`
      SELECT he.* FROM household_employees he
      JOIN households h ON he.household_id = h.id
      WHERE he.id = ? AND h.owner_id = ?
    `).bind(id, authUser.userId).first();

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
  } catch (error) {
    console.error('Error updating employee:', error);
    return c.json({ error: 'Failed to update employee' }, 500);
  }
});

/**
 * DELETE /api/pass-requests/employees/:id
 * Request employee revocation
 */
passManagementRouter.delete('/employees/:id', async (c) => {
  try {
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
    `).bind(id, authUser.userId).first();

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
  } catch (error) {
    console.error('Error revoking employee:', error);
    return c.json({ error: 'Failed to revoke employee' }, 500);
  }
});

// =============================================================================
// VEHICLE ENDPOINTS
// =============================================================================

/**
 * GET /api/pass-requests/vehicles
 * Get current user's vehicle registrations
 */
passManagementRouter.get('/vehicles', async (c) => {
  try {
    const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const households = await c.env.DB.prepare(`
      SELECT id, address FROM households WHERE owner_id = ?
    `).bind(authUser.userId).all();

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
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return c.json({ error: 'Failed to fetch vehicles' }, 500);
  }
});

/**
 * POST /api/pass-requests/vehicles
 * Request vehicle pass
 */
passManagementRouter.post('/vehicles', async (c) => {
  try {
    const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { household_id, plate_number, make, model, color, pass_type } = body;

    if (!household_id || !plate_number || !make || !model || !color || !pass_type) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate pass type
    if (!validatePassType(pass_type)) {
      return c.json({
        error: `Invalid pass_type. Must be one of: ${Object.values(PassType).join(', ')}`
      }, 400);
    }

    // Verify ownership
    const household = await c.env.DB.prepare(`
      SELECT id FROM households WHERE id = ? AND owner_id = ?
    `).bind(household_id, authUser.userId).first();

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
  } catch (error) {
    console.error('Error creating vehicle:', error);
    return c.json({ error: 'Failed to create vehicle' }, 500);
  }
});

/**
 * PUT /api/pass-requests/vehicles/:id
 * Update vehicle details
 */
passManagementRouter.put('/vehicles/:id', async (c) => {
  try {
    const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const body = await c.req.json();

    // Validate pass_type if provided
    if (body.pass_type && !validatePassType(body.pass_type)) {
      return c.json({
        error: `Invalid pass_type. Must be one of: ${Object.values(PassType).join(', ')}`
      }, 400);
    }

    // Verify ownership
    const vehicle = await c.env.DB.prepare(`
      SELECT vr.* FROM vehicle_registrations vr
      JOIN households h ON vr.household_id = h.id
      WHERE vr.id = ? AND h.owner_id = ?
    `).bind(id, authUser.userId).first();

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
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return c.json({ error: 'Failed to update vehicle' }, 500);
  }
});

/**
 * DELETE /api/pass-requests/vehicles/:id
 * Request vehicle cancellation
 */
passManagementRouter.delete('/vehicles/:id', async (c) => {
  try {
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
    `).bind(id, authUser.userId).first();

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
  } catch (error) {
    console.error('Error cancelling vehicle:', error);
    return c.json({ error: 'Failed to cancel vehicle' }, 500);
  }
});
