import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../../lib/auth';

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

const paymentSchema = z.object({
  amount: z.number().positive('Payment amount must be positive'),
  payment_method: z.enum(['cash', 'check', 'bank_transfer', 'gcash', 'maya', 'other']),
  receipt_number: z.string().optional(),
});

export const externalRentalsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Helper to recalculate payment status
function calculatePaymentStatus(amount: number, amountPaid: number): 'unpaid' | 'partial' | 'paid' {
  if (amountPaid <= 0) return 'unpaid';
  if (amountPaid >= amount) return 'paid';
  return 'partial';
}

// Helper to check if user has admin or staff access
async function requireAdminOrStaff(c: any, env: Env): Promise<{ userId: string; role: string } | null> {
  const authUser = await getUserFromRequest(c.req.raw, env.JWT_SECRET);
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'staff')) {
    return null;
  }
  return authUser;
}

// Helper to check if user has admin access
async function requireAdmin(c: any, env: Env): Promise<{ userId: string; role: string } | null> {
  const authUser = await getUserFromRequest(c.req.raw, env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return null;
  }
  return authUser;
}

// GET / - List all external rentals (admin/staff)
externalRentalsRouter.get('/', async (c) => {
  const authUser = await requireAdminOrStaff(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const amenityType = c.req.query('amenity_type');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');
  const paymentStatus = c.req.query('payment_status');
  const renterName = c.req.query('renter_name');

  let query = 'SELECT * FROM external_rentals WHERE 1=1';
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
  if (paymentStatus) {
    query += ' AND payment_status = ?';
    params.push(paymentStatus);
  }
  if (renterName) {
    query += ' AND renter_name LIKE ?';
    params.push(`%${renterName}%`);
  }

  query += ' ORDER BY date DESC, created_at DESC';

  const result = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ rentals: result.results || [] });
});

// GET /export - Export rentals to CSV (admin only)
externalRentalsRouter.get('/export', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const amenityType = c.req.query('amenity_type');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');
  const paymentStatus = c.req.query('payment_status');

  let query = 'SELECT * FROM external_rentals WHERE 1=1';
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
  if (paymentStatus) {
    query += ' AND payment_status = ?';
    params.push(paymentStatus);
  }

  query += ' ORDER BY date ASC, created_at ASC';

  const result = await c.env.DB.prepare(query).bind(...params).all();
  const rentals = result.results || [];

  // Generate CSV
  const headers = [
    'ID',
    'Amenity Type',
    'Date',
    'Slot',
    'Renter Name',
    'Renter Contact',
    'Amount',
    'Payment Status',
    'Amount Paid',
    'Payment Method',
    'Receipt Number',
    'Notes',
    'Created By',
    'Created At'
  ];

  const rows = rentals.map((rental: any) => [
    rental.id,
    rental.amenity_type,
    rental.date,
    rental.slot,
    `"${(rental.renter_name || '').replace(/"/g, '""')}"`,
    `"${(rental.renter_contact || '').replace(/"/g, '""')}"`,
    rental.amount?.toString() || '0',
    rental.payment_status || 'unpaid',
    rental.amount_paid?.toString() || '0',
    rental.payment_method || '',
    `"${(rental.receipt_number || '').replace(/"/g, '""')}"`,
    `"${(rental.notes || '').replace(/"/g, '""')}"`,
    rental.created_by || '',
    rental.created_at || ''
  ]);

  const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

  return c.text(csv, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="external-rentals-${new Date().toISOString().split('T')[0]}.csv"`
  });
});

// GET /:id - Get single rental (admin/staff)
externalRentalsRouter.get('/:id', async (c) => {
  const authUser = await requireAdminOrStaff(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  const result = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!result) {
    return c.json({ error: 'Rental not found' }, 404);
  }

  return c.json({ rental: result });
});

// POST / - Create new rental (admin only)
externalRentalsRouter.post('/', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const body = await c.req.json();
  const result = externalRentalSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { amenity_type, date, slot, renter_name, renter_contact, amount, notes } = result.data;

  // Check for conflicts with existing rentals
  const existingRental = await c.env.DB.prepare(
    `SELECT id FROM external_rentals
     WHERE amenity_type = ? AND date = ? AND slot = ?`
  ).bind(amenity_type, date, slot).first();

  if (existingRental) {
    return c.json({
      error: 'This time slot is already booked for an external rental.'
    }, 409);
  }

  // Check for conflicts with time blocks
  const existingTimeBlock = await c.env.DB.prepare(
    `SELECT id FROM time_blocks
     WHERE amenity_type = ? AND date = ? AND slot = ?`
  ).bind(amenity_type, date, slot).first();

  if (existingTimeBlock) {
    return c.json({
      error: 'This time slot is blocked.'
    }, 409);
  }

  const id = generateId();
  const paymentStatus = calculatePaymentStatus(amount, 0);

  await c.env.DB.prepare(
    `INSERT INTO external_rentals (
      id, amenity_type, date, slot, renter_name, renter_contact,
      amount, payment_status, amount_paid, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, amenity_type, date, slot, renter_name, renter_contact || null,
    amount, paymentStatus, 0, notes || null, authUser.userId
  ).run();

  const rental = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  return c.json({ rental }, 201);
});

// PUT /:id - Update rental (admin only)
externalRentalsRouter.put('/:id', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const result = externalRentalSchema.partial().safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  // Check if rental exists
  const existing = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'Rental not found' }, 404);
  }

  const { amenity_type, date, slot, renter_name, renter_contact, amount, notes } = result.data;

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (amenity_type !== undefined) {
    updates.push('amenity_type = ?');
    values.push(amenity_type);
  }
  if (date !== undefined) {
    updates.push('date = ?');
    values.push(date);
  }
  if (slot !== undefined) {
    updates.push('slot = ?');
    values.push(slot);
  }
  if (renter_name !== undefined) {
    updates.push('renter_name = ?');
    values.push(renter_name);
  }
  if (renter_contact !== undefined) {
    updates.push('renter_contact = ?');
    values.push(renter_contact || null);
  }
  if (amount !== undefined) {
    updates.push('amount = ?');
    values.push(amount);
    // Recalculate payment status when amount changes
    const currentAmountPaid = existing.amount_paid || 0;
    updates.push('payment_status = ?');
    values.push(calculatePaymentStatus(amount, currentAmountPaid));
  }
  if (notes !== undefined) {
    updates.push('notes = ?');
    values.push(notes || null);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  // Check for conflicts if amenity_type, date, or slot changed
  const newAmenityType = amenity_type ?? existing.amenity_type;
  const newDate = date ?? existing.date;
  const newSlot = slot ?? existing.slot;

  if (amenity_type !== undefined || date !== undefined || slot !== undefined) {
    const conflict = await c.env.DB.prepare(
      `SELECT id FROM external_rentals
       WHERE amenity_type = ? AND date = ? AND slot = ? AND id != ?`
    ).bind(newAmenityType, newDate, newSlot, id).first();

    if (conflict) {
      return c.json({
        error: 'This time slot is already booked for an external rental.'
      }, 409);
    }

    const timeBlockConflict = await c.env.DB.prepare(
      `SELECT id FROM time_blocks
       WHERE amenity_type = ? AND date = ? AND slot = ?`
    ).bind(newAmenityType, newDate, newSlot).first();

    if (timeBlockConflict) {
      return c.json({
        error: 'This time slot is blocked.'
      }, 409);
    }
  }

  values.push(id);
  await c.env.DB.prepare(
    `UPDATE external_rentals SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const rental = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  return c.json({ rental });
});

// POST /:id/pay - Record payment (admin only)
externalRentalsRouter.post('/:id/pay', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const result = paymentSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { amount, payment_method, receipt_number } = result.data;

  // Get current rental
  const rental = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!rental) {
    return c.json({ error: 'Rental not found' }, 404);
  }

  const currentAmountPaid = rental.amount_paid || 0;
  const newAmountPaid = currentAmountPaid + amount;
  const totalAmount = rental.amount || 0;

  // Check if payment exceeds total amount
  if (newAmountPaid > totalAmount) {
    return c.json({
      error: `Payment exceeds total amount. Total: ${totalAmount}, Already paid: ${currentAmountPaid}`
    }, 400);
  }

  const newPaymentStatus = calculatePaymentStatus(totalAmount, newAmountPaid);

  await c.env.DB.prepare(
    `UPDATE external_rentals
     SET amount_paid = ?, payment_status = ?, payment_method = ?, receipt_number = ?
     WHERE id = ?`
  ).bind(newAmountPaid, newPaymentStatus, payment_method, receipt_number || null, id).run();

  const updatedRental = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  return c.json({
    rental: updatedRental,
    payment: {
      amount,
      payment_method,
      receipt_number,
      previous_paid: currentAmountPaid,
      new_total: newAmountPaid
    }
  });
});

// DELETE /:id - Delete rental (admin only)
externalRentalsRouter.delete('/:id', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');

  // Check if rental exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'Rental not found' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM external_rentals WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});
