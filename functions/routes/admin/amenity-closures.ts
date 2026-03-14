/**
 * Amenity Closures Management API
 *
 * Admin-created blocks for maintenance/events.
 * Separate from booking_blocked_dates which is for confirmed bookings.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../../lib/auth';
import type { AmenityClosure, AmenityType } from '../../types';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const amenityClosuresRouter = new Hono<{ Bindings: Env }>();

// Validation schema
const createClosureSchema = z.object({
  amenity_type: z.enum(['clubhouse', 'pool', 'basketball-court', 'tennis-court']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(['AM', 'PM', 'FULL_DAY']),
  reason: z.string().min(1).max(500),
});

/**
 * GET /admin/amenity-closures
 * List all closures (admin/staff only)
 */
amenityClosuresRouter.get('/', async (c) => {
  const auth = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const filters = {
    amenity_type: c.req.query('amenity_type'),
    start_date: c.req.query('start_date'),
    end_date: c.req.query('end_date'),
  };

  let query = 'SELECT * FROM amenity_closures WHERE 1=1';
  const params: (string | number)[] = [];

  if (filters.amenity_type) {
    query += ' AND amenity_type = ?';
    params.push(filters.amenity_type);
  }
  if (filters.start_date) {
    query += ' AND date >= ?';
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    query += ' AND date <= ?';
    params.push(filters.end_date);
  }

  query += ' ORDER BY date, amenity_type, slot';

  const result = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({
    data: {
      closures: result.results || [],
    },
  });
});

/**
 * POST /admin/amenity-closures
 * Create a new closure (admin only)
 */
amenityClosuresRouter.post('/', async (c) => {
  const auth = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!auth || auth.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const data = createClosureSchema.safeParse(body);

  if (!data.success) {
    return c.json({ error: 'Invalid input', details: data.error.flatten() }, 400);
  }

  const { amenity_type, date, slot, reason } = data.data;

  // Check if closure already exists for this slot
  const existing = await c.env.DB.prepare(
    'SELECT id FROM amenity_closures WHERE amenity_type = ? AND date = ? AND slot = ?'
  ).bind(amenity_type, date, slot).first();

  if (existing) {
    return c.json({ error: 'Closure already exists for this amenity, date, and slot' }, 409);
  }

  // Create closure
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO amenity_closures (id, amenity_type, date, slot, reason, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, amenity_type, date, slot, reason, auth.userId, now).run();

  // Fetch created closure
  const closure = await c.env.DB.prepare(
    'SELECT * FROM amenity_closures WHERE id = ?'
  ).bind(id).first() as AmenityClosure;

  return c.json({
    data: { closure },
  }, 201);
});

/**
 * DELETE /admin/amenity-closures/:id
 * Delete a closure (admin only)
 */
amenityClosuresRouter.delete('/:id', async (c) => {
  const auth = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!auth || auth.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  // Check if closure exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM amenity_closures WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'Closure not found' }, 404);
  }

  // Delete closure
  await c.env.DB.prepare(
    'DELETE FROM amenity_closures WHERE id = ?'
  ).bind(id).run();

  return c.json({ success: true });
});

export { amenityClosuresRouter };
