import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../../lib/auth';

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
