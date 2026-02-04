import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const pollSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(10),
  ends_at: z.string(),
});

const voteSchema = z.object({
  household_id: z.string(),
  selected_option: z.string(),
});

export const pollsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Get all active polls (not expired)
pollsRouter.get('/', async (c) => {
  const polls = await c.env.DB.prepare(
    `SELECT id, question, options, ends_at, created_by, created_at
     FROM polls
     WHERE ends_at > datetime('now')
     ORDER BY created_at DESC`
  ).all();

  return c.json({ polls: polls.results });
});

// Get single poll with results
pollsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  const poll = await c.env.DB.prepare(
    'SELECT * FROM polls WHERE id = ?'
  ).bind(id).first();

  if (!poll) {
    return c.json({ error: 'Poll not found' }, 404);
  }

  // Get vote counts per option
  const votes = await c.env.DB.prepare(
    `SELECT selected_option, COUNT(*) as count
     FROM poll_votes
     WHERE poll_id = ?
     GROUP BY selected_option`
  ).bind(id).all();

  // Parse options from JSON
  const options = JSON.parse(poll.options as string);

  // Build results with counts
  const voteResults = options.map((option: string) => {
    const voteRecord = votes.results.find((v: any) => v.selected_option === option);
    return {
      option,
      count: voteRecord ? (voteRecord.count as number) : 0,
    };
  });

  const totalVotes = voteResults.reduce((sum: number, r: any) => sum + r.count, 0);

  return c.json({
    poll: {
      ...poll,
      options,
      votes: voteResults,
      total_votes: totalVotes,
    },
  });
});

// Get user's vote for a poll
pollsRouter.get('/:id/my-vote', async (c) => {
  const id = c.req.param('id');
  const householdId = c.req.query('household_id');

  if (!householdId) {
    return c.json({ error: 'household_id parameter required' }, 400);
  }

  const vote = await c.env.DB.prepare(
    'SELECT * FROM poll_votes WHERE poll_id = ? AND household_id = ?'
  ).bind(id, householdId).first();

  if (!vote) {
    return c.json({ voted: false });
  }

  return c.json({ voted: true, vote });
});

// Create new poll (admin only)
pollsRouter.post('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = pollSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { question, options, ends_at } = result.data;
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO polls (id, question, options, ends_at, created_by)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, question, JSON.stringify(options), ends_at, authUser.userId).run();

  const poll = await c.env.DB.prepare(
    'SELECT * FROM polls WHERE id = ?'
  ).bind(id).first();

  return c.json({ poll }, 201);
});

// Cast vote (prevent duplicate votes)
pollsRouter.post('/:id/vote', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = voteSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { household_id, selected_option } = result.data;

  // Check if poll exists and is still active
  const poll = await c.env.DB.prepare(
    'SELECT options, ends_at FROM polls WHERE id = ?'
  ).bind(id).first();

  if (!poll) {
    return c.json({ error: 'Poll not found' }, 404);
  }

  // Check if poll has expired
  if (new Date(poll.ends_at as string) < new Date()) {
    return c.json({ error: 'Poll has expired' }, 400);
  }

  // Check if selected option is valid
  const options = JSON.parse(poll.options as string);
  if (!options.includes(selected_option)) {
    return c.json({ error: 'Invalid option' }, 400);
  }

  // Check if household has already voted
  const existingVote = await c.env.DB.prepare(
    'SELECT id FROM poll_votes WHERE poll_id = ? AND household_id = ?'
  ).bind(id, household_id).first();

  if (existingVote) {
    return c.json({ error: 'You have already voted on this poll' }, 400);
  }

  // Cast the vote
  const voteId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO poll_votes (id, poll_id, household_id, selected_option)
     VALUES (?, ?, ?, ?)`
  ).bind(voteId, id, household_id, selected_option).run();

  const vote = await c.env.DB.prepare(
    'SELECT * FROM poll_votes WHERE id = ?'
  ).bind(voteId).first();

  return c.json({ vote }, 201);
});

// Update poll (admin only)
pollsRouter.put('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const result = pollSchema.partial().safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (result.data.question !== undefined) {
    updates.push('question = ?');
    values.push(result.data.question);
  }
  if (result.data.options !== undefined) {
    updates.push('options = ?');
    values.push(JSON.stringify(result.data.options));
  }
  if (result.data.ends_at !== undefined) {
    updates.push('ends_at = ?');
    values.push(result.data.ends_at);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }

  values.push(id);
  await c.env.DB.prepare(
    `UPDATE polls SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const poll = await c.env.DB.prepare(
    'SELECT * FROM polls WHERE id = ?'
  ).bind(id).first();

  return c.json({ poll });
});

// Delete poll (admin only)
pollsRouter.delete('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  // Delete associated votes first
  await c.env.DB.prepare('DELETE FROM poll_votes WHERE poll_id = ?').bind(id).run();

  // Delete poll
  await c.env.DB.prepare('DELETE FROM polls WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});
