import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';
import { canAccessHousehold, isAdmin, getHouseholdMembers, getUserLots, getUserVoteCount } from '../lib/lot-access';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const lotMembersRouter = new Hono<{ Bindings: Env }>();

// Helper to generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

// Auth middleware for all routes
lotMembersRouter.use('/*', async (c, next) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', authUser);
  await next();
});

// GET /api/lot-members/my - Get current user's memberships
lotMembersRouter.get('/my', async (c) => {
  const authUser = c.get('user');

  const lots = await getUserLots(authUser.userId, c.env.DB);
  const voteCount = await getUserVoteCount(authUser.userId, c.env.DB);

  return c.json({
    lots,
    voteCount,
    totalVotes: voteCount
  });
});

// GET /api/lot-members/household/:id - Get all members of a household
lotMembersRouter.get('/household/:id', async (c) => {
  const authUser = c.get('user');
  const householdId = c.req.param('id');

  // Check access
  const access = await canAccessHousehold(authUser.userId, householdId, c.env.DB);
  if (!access.hasAccess && authUser.role !== 'admin') {
    return c.json({ error: 'Access denied' }, 403);
  }

  const members = await getHouseholdMembers(householdId, c.env.DB);

  return c.json({ householdId, members });
});

// Admin routes below
const adminLotMembersRouter = new Hono<{ Bindings: Env }>();

adminLotMembersRouter.use('/*', async (c, next) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  c.set('user', authUser);
  await next();
});

// DTOs
const assignMemberSchema = z.object({
  household_id: z.string(),
  user_id: z.string().optional(), // Optional if email is provided
  email: z.string().optional(), // Optional if user_id is provided
  member_type: z.enum(['primary_owner', 'secondary']),
  notes: z.string().optional()
}).refine(data => data.user_id || data.email, {
  message: "Either user_id or email must be provided"
});

const verifyMemberSchema = z.object({
  notes: z.string().optional()
});

// POST /api/admin/lot-members - Assign a member to a household
adminLotMembersRouter.post('/', async (c) => {
  const authUser = c.get('user');
  const body = await c.req.json();
  const result = assignMemberSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const data = result.data;

  // Look up user by email if email is provided instead of user_id
  let userId = data.user_id;
  if (!userId && data.email) {
    const user = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(data.email).first<{ id: string }>();

    if (!user) {
      return c.json({ error: 'User not found with that email' }, 404);
    }
    userId = user.id;
  }

  if (!userId) {
    return c.json({ error: 'Either user_id or email must be provided' }, 400);
  }

  // Verify lot is assignable
  const household = await c.env.DB.prepare(
    'SELECT lot_type FROM households WHERE id = ?'
  ).bind(data.household_id).first<{ lot_type: string }>();

  if (!household) {
    return c.json({ error: 'Household not found' }, 404);
  }

  if (!['residential', 'resort', 'commercial'].includes(household.lot_type)) {
    return c.json({ error: 'Lot type not assignable' }, 400);
  }

  // Check for duplicate
  const duplicate = await c.env.DB.prepare(
    'SELECT id FROM lot_members WHERE household_id = ? AND user_id = ?'
  ).bind(data.household_id, userId).first<{ id: string }>();

  if (duplicate) {
    return c.json({ error: 'User already assigned to this household' }, 400);
  }

  // If assigning primary_owner, check if one already exists
  if (data.member_type === 'primary_owner') {
    const existing = await c.env.DB.prepare(
      `SELECT id FROM lot_members WHERE household_id = ? AND member_type = 'primary_owner'`
    ).bind(data.household_id).first<{ id: string }>();

    if (existing) {
      return c.json({ error: 'Primary owner already exists for this household' }, 400);
    }
  }

  // Create membership
  const id = generateId();
  const canVote = 0; // Starts as 0 until verified

  await c.env.DB.prepare(
    `INSERT INTO lot_members (id, household_id, user_id, member_type, can_vote, verified, notes)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).bind(id, data.household_id, userId, data.member_type, canVote, data.notes || null).run();

  return c.json({
    id,
    household_id: data.household_id,
    user_id: userId,
    member_type: data.member_type,
    can_vote: canVote,
    verified: false
  }, 201);
});

// PUT /api/admin/lot-members/:id/verify - Verify a membership
adminLotMembersRouter.put('/:id/verify', async (c) => {
  const authUser = c.get('user');
  const memberId = c.req.param('id');
  const body = await c.req.json();
  const result = verifyMemberSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  // Get current membership
  const member = await c.env.DB.prepare(
    'SELECT * FROM lot_members WHERE id = ?'
  ).bind(memberId).first<any>();

  if (!member) {
    return c.json({ error: 'Membership not found' }, 404);
  }

  // Calculate can_vote based on member_type and verified
  const newVerified = 1;
  const newCanVote = member.member_type === 'primary_owner' ? 1 : 0;

  // Update membership
  await c.env.DB.prepare(
    `UPDATE lot_members
     SET verified = ?, can_vote = ?, verified_at = datetime('now'), verified_by = ?, notes = ?
     WHERE id = ?`
  ).bind(newVerified, newCanVote, authUser.userId, result.data.notes || member.notes, memberId).run();

  return c.json({
    id: memberId,
    verified: newVerified,
    can_vote: newCanVote,
    verified_at: new Date().toISOString()
  });
});

// GET /api/admin/lot-members/pending - Get all unverified/pending members
adminLotMembersRouter.get('/pending', async (c) => {
  const stmt = c.env.DB.prepare(`
    SELECT lm.id, lm.household_id, lm.user_id, lm.member_type, lm.can_vote,
           lm.verified, lm.notes, lm.created_at,
           u.email, u.first_name, u.last_name, u.role,
           h.block, h.lot, h.address
      FROM lot_members lm
      JOIN users u ON lm.user_id = u.id
      JOIN households h ON lm.household_id = h.id
     WHERE lm.verified = 0
     ORDER BY lm.created_at DESC
  `);

  const result = await stmt.all();
  return c.json({ members: result.results || [] });
});

// DELETE /api/admin/lot-members/:id - Remove a membership
adminLotMembersRouter.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM lot_members WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// GET /api/admin/lot-members/lots/unassigned - Get list of unassigned assignable lots
adminLotMembersRouter.get('/lots/unassigned', async (c) => {
  const stmt = c.env.DB.prepare(`
    SELECT h.id, h.block, h.lot, h.address, h.lot_type, h.lot_status
      FROM households h
     WHERE h.lot_type IN ('residential', 'resort', 'commercial')
       AND NOT EXISTS (
           SELECT 1 FROM lot_members lm
            WHERE lm.household_id = h.id
              AND lm.member_type = 'primary_owner'
              AND lm.verified = 1
       )
     ORDER BY h.block, h.lot
  `);

  const result = await stmt.all();
  return c.json({ lots: result.results || [] });
});

// GET /api/admin/lot-members/user/:userId/household - Get household for a user
adminLotMembersRouter.get('/user/:userId/household', async (c) => {
  const userId = c.req.param('userId');

  const member = await c.env.DB.prepare(`
    SELECT household_id
      FROM lot_members
     WHERE user_id = ?
       AND verified = 1
     LIMIT 1
  `).bind(userId).first<{ household_id: string }>();

  if (!member) {
    return c.json({ error: 'No verified household found for user' }, 404);
  }

  return c.json({ household_id: member.household_id });
});

export { lotMembersRouter, adminLotMembersRouter };
