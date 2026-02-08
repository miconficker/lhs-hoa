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

// Schema for recording in-person votes (admin only)
const inPersonVoteSchema = z.object({
  user_id: z.string(),
  selected_option: z.string(),
  voted_at: z.string().optional(),
  recorded_by: z.string().optional(),
  witness: z.string().optional(),
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

// Get single poll with results (WEIGHTED BY lot_count for proxy voting)
pollsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  const poll = await c.env.DB.prepare(
    'SELECT * FROM polls WHERE id = ?'
  ).bind(id).first();

  if (!poll) {
    return c.json({ error: 'Poll not found' }, 404);
  }

  // Get vote counts per option (WEIGHTED by lot_count for proxy voting)
  // Note: Votes already have lot_count calculated at voting time, excluding community lots
  const votes = await c.env.DB.prepare(
    `SELECT selected_option, SUM(lot_count) as count
     FROM poll_votes
     WHERE poll_id = ?
     GROUP BY selected_option`
  ).bind(id).all();

  // Parse options from JSON
  const options = JSON.parse(poll.options as string);

  // Build results with weighted counts
  const voteResults = options.map((option: string) => {
    const voteRecord = votes.results.find((v: any) => v.selected_option === option);
    return {
      option,
      count: voteRecord ? (voteRecord.count as number) : 0,
    };
  });

  const totalVotes = voteResults.reduce((sum: number, r: any) => sum + r.count, 0);
  const totalLots = totalVotes; // This is now weighted lot count

  // Check if current user has voted
  let hasVoted = false;
  let userLotCount = 0;
  if (authUser) {
    const userVote = await c.env.DB.prepare(
      'SELECT lot_count, voting_method FROM poll_votes WHERE poll_id = ? AND household_id = ?'
    ).bind(id, authUser.userId).first();

    if (userVote) {
      hasVoted = true;
      userLotCount = userVote.lot_count || 1;
    }
  }

  return c.json({
    poll: {
      ...poll,
      options,
      votes: voteResults,
      total_votes: votes.results?.length || 0, // Number of votes cast (households)
      total_lots: totalLots, // Weighted lot count
      has_voted: hasVoted,
      user_lot_count: userLotCount,
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

// Cast vote (prevent duplicate votes) - PROXY VOTING (1 vote = all lots owned)
pollsRouter.post('/:id/vote', async (c) => {
  const id = c.req.param('id');
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

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

  // PROXY VOTING: Check if user has already voted (any of their lots)
  const existingVote = await c.env.DB.prepare(
    'SELECT id FROM poll_votes WHERE poll_id = ? AND household_id = ?'
  ).bind(id, household_id).first();

  if (existingVote) {
    return c.json({ error: 'You have already voted on behalf of your lots' }, 400);
  }

  // PROXY VOTING: Count all lots owned by this user (excluding community/utility)
  const lotsCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM households
     WHERE owner_id = ?
       AND lot_type IN ('residential', 'resort', 'commercial')`
  ).bind(authUser.userId).first();

  const lotCount = lotsCount ? (lotsCount.count as number) : 1;

  // Cast the vote with lot_count (all lots vote together)
  const voteId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO poll_votes (id, poll_id, household_id, selected_option, lot_count, voting_method)
     VALUES (?, ?, ?, ?, ?, 'online')`
  ).bind(voteId, id, household_id, selected_option, lotCount).run();

  const vote = await c.env.DB.prepare(
    'SELECT * FROM poll_votes WHERE id = ?'
  ).bind(voteId).first();

  return c.json({
    vote,
    lots_voted: lotCount,
    message: `Your vote has been cast on behalf of your ${lotCount} lot(s)`
  }, 201);
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

// =============================================================================
// ADMIN: Record In-Person Vote
// =============================================================================

/**
 * POST /api/polls/:id/record-vote
 * Record an in-person vote for a user (admin only)
 */
pollsRouter.post('/:id/record-vote', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const result = inPersonVoteSchema.safeParse(body);

    if (!result.success) {
      return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
    }

    const { user_id, selected_option, voted_at, recorded_by, witness } = result.data;

    // Verify poll exists and is active
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

    // Verify selected option is valid
    const options = JSON.parse(poll.options as string);
    if (!options.includes(selected_option)) {
      return c.json({ error: 'Invalid option' }, 400);
    }

    // Verify user exists
    const user = await c.env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(user_id).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Check if user has already voted (in-person or online)
    const existingVote = await c.env.DB.prepare(
      'SELECT id FROM poll_votes WHERE poll_id = ? AND household_id = ?'
    ).bind(id, user_id).first();

    if (existingVote) {
      return c.json({ error: 'User has already voted on this poll' }, 400);
    }

    // Count lots owned by this user for proxy voting (excluding community/utility)
    const lotsCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM households
       WHERE owner_id = ?
         AND lot_type IN ('residential', 'resort', 'commercial')`
    ).bind(user_id).first();

    const lotCount = lotsCount ? (lotsCount.count as number) : 1;

    // Record the in-person vote
    const voteId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO poll_votes (id, poll_id, household_id, selected_option, lot_count, voting_method, voted_at, recorded_by)
       VALUES (?, ?, ?, ?, ?, 'in-person', ?, ?)`
    ).bind(
      voteId,
      id,
      user_id,
      selected_option,
      lotCount,
      voted_at || new Date().toISOString(),
      recorded_by || authUser.userId
    ).run();

    const vote = await c.env.DB.prepare(
      'SELECT * FROM poll_votes WHERE id = ?'
    ).bind(voteId).first();

    return c.json({
      vote,
      lots_voted: lotCount,
      message: `In-person vote recorded for ${lotCount} lot(s)`
    }, 201);
  } catch (error) {
    console.error('Error recording in-person vote:', error);
    return c.json({ error: 'Failed to record vote' }, 500);
  }
});
