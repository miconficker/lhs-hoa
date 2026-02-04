import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const announcementSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.enum(['event', 'urgent', 'info', 'policy']).optional(),
  is_pinned: z.boolean().optional(),
  expires_at: z.string().optional(),
});

export const announcementsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Get all announcements
announcementsRouter.get('/', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  const announcements = await c.env.DB.prepare(
    `SELECT id, title, content, category, is_pinned, created_at, expires_at
     FROM announcements
     WHERE expires_at IS NULL OR expires_at > datetime('now')
     ORDER BY is_pinned DESC, created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  return c.json({ announcements: announcements.results });
});

// Get single announcement
announcementsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  const announcement = await c.env.DB.prepare(
    'SELECT * FROM announcements WHERE id = ?'
  ).bind(id).first();

  if (!announcement) {
    return c.json({ error: 'Announcement not found' }, 404);
  }

  return c.json({ announcement });
});

// Create announcement (admin only)
announcementsRouter.post('/', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = announcementSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { title, content, category, is_pinned, expires_at } = result.data;
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO announcements (id, title, content, category, is_pinned, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, title, content, category || null, is_pinned || false, authUser.userId, expires_at || null).run();

  const announcement = await c.env.DB.prepare(
    'SELECT * FROM announcements WHERE id = ?'
  ).bind(id).first();

  return c.json({ announcement }, 201);
});

// Update announcement
announcementsRouter.put('/:id', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const result = announcementSchema.partial().safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (result.data.title !== undefined) {
    updates.push('title = ?');
    values.push(result.data.title);
  }
  if (result.data.content !== undefined) {
    updates.push('content = ?');
    values.push(result.data.content);
  }
  if (result.data.category !== undefined) {
    updates.push('category = ?');
    values.push(result.data.category);
  }
  if (result.data.is_pinned !== undefined) {
    updates.push('is_pinned = ?');
    values.push(result.data.is_pinned);
  }
  if (result.data.expires_at !== undefined) {
    updates.push('expires_at = ?');
    values.push(result.data.expires_at);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }

  values.push(id);
  await c.env.DB.prepare(
    `UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const announcement = await c.env.DB.prepare(
    'SELECT * FROM announcements WHERE id = ?'
  ).bind(id).first();

  return c.json({ announcement });
});

// Delete announcement
announcementsRouter.delete('/:id', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  await c.env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});
