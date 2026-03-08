import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

// Types
export interface MessageThread {
  id: string;
  created_at: string;
  updated_at: string;
  subject: string | null;
  category: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_email?: string;
  sender_name?: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  is_edited: number;
  edited_at: string | null;
  created_at: string;
  read_at?: string;
}

export interface ThreadParticipant {
  id: string;
  thread_id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  last_read_at: string | null;
  is_active: number;
  joined_at: string;
}

// Validation schemas
const createThreadSchema = z.object({
  subject: z.string().optional(),
  category: z.enum(['general', 'service_request', 'payment', 'reservation', 'admin']).optional(),
  participant_ids: z.array(z.string()).min(1), // At least one recipient
  body: z.string().min(1),
  attachment_url: z.string().optional(),
  attachment_name: z.string().optional(),
  attachment_type: z.string().optional(),
});

const sendMessageSchema = z.object({
  body: z.string().min(1),
  attachment_url: z.string().optional(),
  attachment_name: z.string().optional(),
  attachment_type: z.string().optional(),
});

const updateThreadSchema = z.object({
  subject: z.string().optional(),
});

export const messagesRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Helper: Check if user is participant in thread
async function isThreadParticipant(
  db: D1Database,
  threadId: string,
  userId: string
): Promise<boolean> {
  const participant = await db.prepare(
    `SELECT 1 FROM thread_participants
     WHERE thread_id = ? AND user_id = ? AND is_active = 1`
  ).bind(threadId, userId).first();

  return !!participant;
}

// GET /api/messages/threads - Get all threads for current user
messagesRouter.get('/threads', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  // Get threads where user is active participant
  const threads = await c.env.DB.prepare(
    `SELECT DISTINCT
      mt.id,
      mt.subject,
      mt.category,
      mt.created_at,
      mt.updated_at,
      COUNT(m.id) as message_count,
      MAX(m.created_at) as last_message_at,
      tp.last_read_at,
      SUM(CASE WHEN m.sender_id != ? AND m.created_at > COALESCE(tp.last_read_at, '1970-01-01') THEN 1 ELSE 0 END) as unread_count
    FROM message_threads mt
    INNER JOIN thread_participants tp ON mt.id = tp.thread_id
    LEFT JOIN messages m ON mt.id = m.thread_id
    WHERE tp.user_id = ? AND tp.is_active = 1
    GROUP BY mt.id
    ORDER BY mt.updated_at DESC
    LIMIT ? OFFSET ?`
  ).bind(authUser.userId, authUser.userId, limit, offset).all();

  return c.json({ threads: threads.results ?? [] });
});

// GET /api/messages/threads/:id - Get single thread with messages
messagesRouter.get('/threads/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const threadId = c.req.param('id');

  // Check if user is participant
  const isParticipant = await isThreadParticipant(c.env.DB, threadId, authUser.userId);
  if (!isParticipant) {
    return c.json({ error: 'Thread not found' }, 404);
  }

  // Get thread details
  const thread = await c.env.DB.prepare(
    `SELECT * FROM message_threads WHERE id = ?`
  ).bind(threadId).first();

  if (!thread) {
    return c.json({ error: 'Thread not found' }, 404);
  }

  // Get participants
  const participants = await c.env.DB.prepare(
    `SELECT
      tp.id,
      tp.thread_id,
      tp.user_id,
      tp.last_read_at,
      tp.is_active,
      tp.joined_at,
      u.email as user_email,
      u.name as user_name
    FROM thread_participants tp
    INNER JOIN users u ON tp.user_id = u.id
    WHERE tp.thread_id = ? AND tp.is_active = 1
    ORDER BY tp.joined_at ASC`
  ).bind(threadId).all();

  // Get messages
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const messages = await c.env.DB.prepare(
    `SELECT
      m.id,
      m.thread_id,
      m.sender_id,
      m.body,
      m.attachment_url,
      m.attachment_name,
      m.attachment_type,
      m.is_edited,
      m.edited_at,
      m.created_at,
      u.email as sender_email,
      u.name as sender_name
    FROM messages m
    INNER JOIN users u ON m.sender_id = u.id
    WHERE m.thread_id = ?
    ORDER BY m.created_at ASC
    LIMIT ? OFFSET ?`
  ).bind(threadId, limit, offset).all();

  // Update user's last_read_at
  await c.env.DB.prepare(
    `UPDATE thread_participants SET last_read_at = datetime('now')
     WHERE thread_id = ? AND user_id = ?`
  ).bind(threadId, authUser.userId).run();

  return c.json({
    thread,
    participants: participants.results ?? [],
    messages: messages.results ?? []
  });
});

// POST /api/messages/threads - Create new thread with first message
messagesRouter.post('/threads', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const reqBody = await c.req.json();
  const result = createThreadSchema.safeParse(reqBody);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { subject, category, participant_ids, body, attachment_url, attachment_name, attachment_type } = result.data;

  // Generate thread ID
  const threadId = generateId();

  // Create thread
  await c.env.DB.prepare(
    `INSERT INTO message_threads (id, subject, category)
     VALUES (?, ?, ?)`
  ).bind(threadId, subject || null, category || 'general').run();

  // Add sender as participant
  const senderParticipantId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO thread_participants (id, thread_id, user_id, last_read_at)
     VALUES (?, ?, ?, datetime('now'))`
  ).bind(senderParticipantId, threadId, authUser.userId).run();

  // Add other participants
  for (const participantId of participant_ids) {
    const id = generateId();
    await c.env.DB.prepare(
      `INSERT INTO thread_participants (id, thread_id, user_id)
       VALUES (?, ?, ?)`
    ).bind(id, threadId, participantId).run();
  }

  // Create first message
  const messageId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO messages (id, thread_id, sender_id, body, attachment_url, attachment_name, attachment_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    messageId,
    threadId,
    authUser.userId,
    body,
    attachment_url || null,
    attachment_name || null,
    attachment_type || null
  ).run();

  // Get created message with sender info
  const message = await c.env.DB.prepare(
    `SELECT
      m.id,
      m.thread_id,
      m.sender_id,
      m.body,
      m.attachment_url,
      m.attachment_name,
      m.attachment_type,
      m.is_edited,
      m.edited_at,
      m.created_at,
      u.email as sender_email,
      u.name as sender_name
    FROM messages m
    INNER JOIN users u ON m.sender_id = u.id
    WHERE m.id = ?`
  ).bind(messageId).first();

  return c.json({ thread_id: threadId, message }, 201);
});

// POST /api/messages/threads/:id/messages - Send message to existing thread
messagesRouter.post('/threads/:id/messages', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const threadId = c.req.param('id');

  // Check if user is participant
  const isParticipant = await isThreadParticipant(c.env.DB, threadId, authUser.userId);
  if (!isParticipant) {
    return c.json({ error: 'Thread not found' }, 404);
  }

  const body = await c.req.json();
  const result = sendMessageSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { body: messageBody, attachment_url, attachment_name, attachment_type } = result.data;

  // Create message
  const messageId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO messages (id, thread_id, sender_id, body, attachment_url, attachment_name, attachment_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    messageId,
    threadId,
    authUser.userId,
    messageBody,
    attachment_url || null,
    attachment_name || null,
    attachment_type || null
  ).run();

  // Get created message with sender info
  const message = await c.env.DB.prepare(
    `SELECT
      m.id,
      m.thread_id,
      m.sender_id,
      m.body,
      m.attachment_url,
      m.attachment_name,
      m.attachment_type,
      m.is_edited,
      m.edited_at,
      m.created_at,
      u.email as sender_email,
      u.name as sender_name
    FROM messages m
    INNER JOIN users u ON m.sender_id = u.id
    WHERE m.id = ?`
  ).bind(messageId).first();

  return c.json({ message }, 201);
});

// PUT /api/messages/threads/:id - Update thread (subject)
messagesRouter.put('/threads/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const threadId = c.req.param('id');

  // Check if user is participant
  const isParticipant = await isThreadParticipant(c.env.DB, threadId, authUser.userId);
  if (!isParticipant) {
    return c.json({ error: 'Thread not found' }, 404);
  }

  const body = await c.req.json();
  const result = updateThreadSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { subject } = result.data;

  if (subject !== undefined) {
    await c.env.DB.prepare(
      `UPDATE message_threads SET subject = ? WHERE id = ?`
    ).bind(subject, threadId).run();
  }

  const thread = await c.env.DB.prepare(
    `SELECT * FROM message_threads WHERE id = ?`
  ).bind(threadId).first();

  return c.json({ thread });
});

// POST /api/messages/threads/:id/participants - Add participant to thread
messagesRouter.post('/threads/:id/participants', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const threadId = c.req.param('id');

  // Check if user is participant
  const isParticipant = await isThreadParticipant(c.env.DB, threadId, authUser.userId);
  if (!isParticipant) {
    return c.json({ error: 'Thread not found' }, 404);
  }

  const body = await c.req.json();
  const { user_id } = body;

  if (!user_id) {
    return c.json({ error: 'user_id is required' }, 400);
  }

  // Check if user is already participant
  const existing = await c.env.DB.prepare(
    `SELECT id FROM thread_participants WHERE thread_id = ? AND user_id = ?`
  ).bind(threadId, user_id).first();

  if (existing) {
    // Reactivate if was inactive
    await c.env.DB.prepare(
      `UPDATE thread_participants SET is_active = 1 WHERE id = ?`
    ).bind(existing.id).run();
  } else {
    // Add new participant
    const id = generateId();
    await c.env.DB.prepare(
      `INSERT INTO thread_participants (id, thread_id, user_id)
       VALUES (?, ?, ?)`
    ).bind(id, threadId, user_id).run();
  }

  return c.json({ success: true });
});

// DELETE /api/messages/threads/:id/participants/:userId - Remove participant (or leave thread)
messagesRouter.delete('/threads/:id/participants/:userId', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const threadId = c.req.param('id');
  const targetUserId = c.req.param('userId');

  // Users can only remove themselves unless admin
  if (targetUserId !== authUser.userId && authUser.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Mark participant as inactive
  await c.env.DB.prepare(
    `UPDATE thread_participants SET is_active = 0
     WHERE thread_id = ? AND user_id = ?`
  ).bind(threadId, targetUserId).run();

  return c.json({ success: true });
});
