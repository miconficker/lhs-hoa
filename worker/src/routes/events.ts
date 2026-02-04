import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  event_date: z.string(),
  location: z.string().optional(),
});

export const eventsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Get all events
eventsRouter.get('/', async (c) => {
  const upcoming = c.req.query('upcoming') === 'true';

  let query = 'SELECT * FROM events';
  if (upcoming) {
    query += " WHERE event_date >= datetime('now')";
  }
  query += ' ORDER BY event_date ASC';

  const events = await c.env.DB.prepare(query).all();

  return c.json({ events: events.results });
});

// Get single event
eventsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  const event = await c.env.DB.prepare(
    'SELECT * FROM events WHERE id = ?'
  ).bind(id).first();

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  return c.json({ event });
});

// Create event
eventsRouter.post('/', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = eventSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  const { title, description, event_date, location } = result.data;
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO events (id, title, description, event_date, location, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, title, description || null, event_date, location || null, authUser.userId).run();

  const event = await c.env.DB.prepare(
    'SELECT * FROM events WHERE id = ?'
  ).bind(id).first();

  return c.json({ event }, 201);
});

// Update event
eventsRouter.put('/:id', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const result = eventSchema.partial().safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (result.data.title !== undefined) {
    updates.push('title = ?');
    values.push(result.data.title);
  }
  if (result.data.description !== undefined) {
    updates.push('description = ?');
    values.push(result.data.description);
  }
  if (result.data.event_date !== undefined) {
    updates.push('event_date = ?');
    values.push(result.data.event_date);
  }
  if (result.data.location !== undefined) {
    updates.push('location = ?');
    values.push(result.data.location);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }

  values.push(id);
  await c.env.DB.prepare(
    `UPDATE events SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const event = await c.env.DB.prepare(
    'SELECT * FROM events WHERE id = ?'
  ).bind(id).first();

  return c.json({ event });
});

// Delete event
eventsRouter.delete('/:id', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  await c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});
