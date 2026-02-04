import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const serviceRequestSchema = z.object({
  household_id: z.string(),
  category: z.enum(['plumbing', 'electrical', 'common-area', 'security', 'other']),
  description: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

export const serviceRequestsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Get all service requests (with optional filters)
serviceRequestsRouter.get('/', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const status = c.req.query('status');
  const priority = c.req.query('priority');
  const category = c.req.query('category');
  const householdId = c.req.query('household_id');

  // Non-admin users can only see their own household's requests
  const isOwnRequests = authUser.role !== 'admin' && authUser.role !== 'staff';

  let query = 'SELECT * FROM service_requests WHERE 1=1';
  const params: any[] = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (priority) {
    query += ' AND priority = ?';
    params.push(priority);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (householdId && (isOwnRequests || authUser.role === 'admin' || authUser.role === 'staff')) {
    query += ' AND household_id = ?';
    params.push(householdId);
  } else if (isOwnRequests) {
    // If not admin/staff, must filter by user's household
    // For now, we'll return empty - this should be enhanced with user-household relation
    return c.json({ requests: [] });
  }

  query += ' ORDER BY created_at DESC';

  const requests = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ requests: requests.results });
});

// Get single service request
serviceRequestsRouter.get('/:id', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  const request = await c.env.DB.prepare(
    'SELECT * FROM service_requests WHERE id = ?'
  ).bind(id).first();

  if (!request) {
    return c.json({ error: 'Service request not found' }, 404);
  }

  // Check permission
  if (authUser.role !== 'admin' && authUser.role !== 'staff') {
    // Should check if user belongs to the household
    // For now, allow access
  }

  return c.json({ request });
});

// Create service request
serviceRequestsRouter.post('/', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = serviceRequestSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { household_id, category, description, priority } = result.data;
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO service_requests (id, household_id, category, description, priority, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  ).bind(id, household_id, category, description, priority || 'normal').run();

  const request = await c.env.DB.prepare(
    'SELECT * FROM service_requests WHERE id = ?'
  ).bind(id).first();

  return c.json({ request }, 201);
});

// Update service request (status, assignment)
serviceRequestsRouter.put('/:id', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();

  // Only admin/staff can update
  if (authUser.role !== 'admin' && authUser.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (body.status !== undefined) {
    if (!['pending', 'in-progress', 'completed', 'rejected'].includes(body.status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }
    updates.push('status = ?');
    values.push(body.status);
  }
  if (body.priority !== undefined) {
    if (!['low', 'normal', 'high', 'urgent'].includes(body.priority)) {
      return c.json({ error: 'Invalid priority' }, 400);
    }
    updates.push('priority = ?');
    values.push(body.priority);
  }
  if (body.assigned_to !== undefined) {
    updates.push('assigned_to = ?');
    values.push(body.assigned_to);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }

  updates.push('updated_at = datetime(\'now\')');

  if (body.status === 'completed') {
    updates.push('completed_at = datetime(\'now\')');
  }

  values.push(id);
  await c.env.DB.prepare(
    `UPDATE service_requests SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const request = await c.env.DB.prepare(
    'SELECT * FROM service_requests WHERE id = ?'
  ).bind(id).first();

  return c.json({ request });
});

// Delete service request (admin only)
serviceRequestsRouter.delete('/:id', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  await c.env.DB.prepare('DELETE FROM service_requests WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});
