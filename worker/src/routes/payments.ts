import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const paymentSchema = z.object({
  household_id: z.string(),
  amount: z.number().positive(),
  method: z.enum(['gcash', 'paymaya', 'instapay', 'cash']),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Period must be in YYYY-MM format'),
  reference_number: z.string().optional(),
});

export const paymentsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Get all payments (with optional filters)
paymentsRouter.get('/', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.query('household_id');
  const status = c.req.query('status');
  const period = c.req.query('period');

  let query = 'SELECT * FROM payments WHERE 1=1';
  const params: any[] = [];

  if (householdId) {
    query += ' AND household_id = ?';
    params.push(householdId);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (period) {
    query += ' AND period = ?';
    params.push(period);
  }

  query += ' ORDER BY created_at DESC';

  const payments = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ payments: payments.results });
});

// Get outstanding balance for a household
paymentsRouter.get('/balance/:householdId', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');

  // Calculate outstanding balance from pending payments
  const pendingResult = await c.env.DB.prepare(
    `SELECT period, SUM(amount) as total FROM payments
     WHERE household_id = ? AND status = 'pending'
     GROUP BY period`
  ).bind(householdId).all();

  const periodsDue: string[] = [];
  let totalDue = 0;

  for (const row of pendingResult.results || []) {
    periodsDue.push(row.period);
    totalDue += row.total;
  }

  return c.json({
    household_id: householdId,
    total_due: totalDue,
    periods_due: periodsDue,
  });
});

// Get my payments (for a specific household)
paymentsRouter.get('/my/:householdId', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');

  const payments = await c.env.DB.prepare(
    `SELECT * FROM payments
     WHERE household_id = ?
     ORDER BY created_at DESC`
  ).bind(householdId).all();

  return c.json({ payments: payments.results });
});

// Create payment
paymentsRouter.post('/', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = paymentSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { household_id, amount, method, period, reference_number } = result.data;
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO payments (id, household_id, amount, currency, method, status, period, reference_number)
     VALUES (?, ?, ?, 'PHP', ?, 'pending', ?, ?)`
  ).bind(id, household_id, amount, method, period, reference_number || null).run();

  const payment = await c.env.DB.prepare(
    'SELECT * FROM payments WHERE id = ?'
  ).bind(id).first();

  return c.json({ payment }, 201);
});

// Update payment status (for webhooks/admin)
paymentsRouter.put('/:id/status', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Only admin/staff can update payment status
  if (authUser.role !== 'admin' && authUser.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();

  if (!body.status || !['pending', 'completed', 'failed'].includes(body.status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }

  const updates = ['status = ?', 'updated_at = datetime(\'now\')'];
  const values: any[] = [body.status];

  if (body.status === 'completed') {
    updates.push('paid_at = datetime(\'now\')');
  }

  values.push(id);

  await c.env.DB.prepare(
    `UPDATE payments SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const payment = await c.env.DB.prepare(
    'SELECT * FROM payments WHERE id = ?'
  ).bind(id).first();

  return c.json({ payment });
});

// Get single payment
paymentsRouter.get('/:id', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  const payment = await c.env.DB.prepare(
    'SELECT * FROM payments WHERE id = ?'
  ).bind(id).first();

  if (!payment) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  return c.json({ payment });
});
