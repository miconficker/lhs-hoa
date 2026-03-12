// functions/routes/delinquency.ts
// Delinquency management API routes

import { Hono } from 'hono';
import { getUserFromRequest } from '../lib/auth';
import * as delinquency from '../lib/delinquency';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Valid reason codes for manual delinquency
const VALID_REASON_CODES = [
  'failure_to_pay',
  'repeated_violation',
  'detrimental_conduct',
  'failure_to_attend'
] as const;

// Human-readable labels for reason codes
const REASON_LABELS: Record<string, string> = {
  failure_to_pay: 'Failure to pay dues despite repeated demands',
  repeated_violation: 'Repeated violation or noncompliance',
  detrimental_conduct: 'Commission of detrimental conduct',
  failure_to_attend: 'Failure to attend 3 consecutive general memberships without justifiable reasons',
};

// Admin: Search members for flagging as delinquent
app.get('/admin/delinquency/member-search', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const q = (c.req.query('q') || '').trim();
  if (q.length < 2) {
    return c.json({ members: [] });
  }

  const pattern = `%${q}%`;

  const results = await c.env.DB.prepare(`
    SELECT
      lm.id            AS lot_member_id,
      lm.member_type,
      u.id             AS user_id,
      u.first_name,
      u.last_name,
      u.email,
      h.block,
      h.lot,
      h.address,
      -- Check if already actively flagged
      EXISTS (
        SELECT 1 FROM manual_delinquencies md
        WHERE md.lot_member_id = lm.id AND md.is_active = 1
      ) AS already_flagged
    FROM lot_members lm
    INNER JOIN users u     ON lm.user_id      = u.id
    INNER JOIN households h ON lm.household_id = h.id
    WHERE lm.member_type = 'primary_owner'
      AND (
        u.email      LIKE ?
        OR u.first_name || ' ' || u.last_name LIKE ?
        OR h.block   LIKE ?
        OR h.lot     LIKE ?
        OR h.address LIKE ?
      )
    ORDER BY h.block, h.lot
    LIMIT 15
  `).bind(pattern, pattern, pattern, pattern, pattern).all();

  return c.json({ members: results.results || [] });
});

// Admin: List all delinquent members
app.get('/admin/delinquency/members', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    // Get manual delinquencies
    const manualDelinquents = await c.env.DB.prepare(
      `SELECT md.id, md.lot_member_id, md.reason, md.marked_at, md.marked_by,
              lm.user_id, lm.role,
              u.email, u.first_name, u.last_name,
              h.block, h.lot, h.lot_size_sqm
       FROM manual_delinquencies md
       INNER JOIN lot_members lm ON md.lot_member_id = lm.id
       INNER JOIN users u ON md.marked_by = u.id
       INNER JOIN households h ON lm.household_id = h.id
       WHERE md.is_active = 1`
    ).all();

    // Get automatic delinquencies (unpaid demands 30+ days overdue)
    const automaticDelinquents = await c.env.DB.prepare(
      `SELECT DISTINCT
         lm.id as lot_member_id,
         lm.user_id,
         lm.role,
         u.email,
         u.first_name,
         u.last_name,
         h.block,
         h.lot,
         h.lot_size_sqm,
         pd.due_date,
         pd.amount_due,
         pd.year
       FROM payment_demands pd
       INNER JOIN lot_members lm ON pd.user_id = lm.user_id
       INNER JOIN users u ON lm.user_id = u.id
       INNER JOIN households h ON lm.household_id = h.id
       WHERE pd.status = 'pending'
         AND pd.due_date < DATE('now', '-30 days')
         AND h.lot_type NOT IN ('community', 'utility', 'open_space')
         AND NOT EXISTS (
           SELECT 1 FROM manual_delinquencies md2
           WHERE md2.lot_member_id = lm.id AND md2.is_active = 1
         )
       ORDER BY h.block, h.lot`
    ).all();

    // Format results
    const delinquents = [
      ...(manualDelinquents.results || []).map((d: any) => ({
        id: d.id,
        lot_member_id: d.lot_member_id,
        block: d.block,
        lot: d.lot,
        lot_size_sqm: d.lot_size_sqm,
        member: {
          user_id: d.user_id,
          name: `${d.first_name} ${d.last_name}`.trim(),
          email: d.email
        },
        delinquency_type: 'manual',
        days_overdue: null,
        amount_due: 0,
        unpaid_periods: [],
        marked_at: d.marked_at,
        reason: d.reason
      })),
      ...(automaticDelinquents.results || []).map((d: any) => {
        const dueDate = new Date(d.due_date);
        const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          lot_member_id: d.lot_member_id,
          block: d.block,
          lot: d.lot,
          lot_size_sqm: d.lot_size_sqm,
          member: {
            user_id: d.user_id,
            name: `${d.first_name} ${d.last_name}`.trim(),
            email: d.email
          },
          delinquency_type: 'automatic',
          days_overdue: daysOverdue,
          amount_due: d.amount_due,
          unpaid_periods: [d.year.toString()]
        };
      })
    ];

    return c.json({
      delinquents,
      summary: {
        total: delinquents.length,
        manual: (manualDelinquents.results || []).length,
        automatic: (automaticDelinquents.results || []).length,
        total_amount_due: delinquents.reduce((sum, d) => sum + (d.amount_due || 0), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching delinquents:', error);
    return c.json({ error: 'Failed to fetch delinquents' }, 500);
  }
});

// Admin: Mark member as delinquent
app.post('/admin/delinquency/mark', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { lot_member_id, reason_code, reason_detail } = await c.req.json();

    if (!lot_member_id) {
      return c.json({ error: 'lot_member_id is required' }, 400);
    }

    if (!reason_code || !VALID_REASON_CODES.includes(reason_code)) {
      return c.json({ error: 'Valid reason_code is required' }, 400);
    }

    // For repeated_violation, reason_detail (rule citation) is required
    if (reason_code === 'repeated_violation' && (!reason_detail || reason_detail.trim().length === 0)) {
      return c.json({ error: 'reason_detail (rule citation) is required for repeated violation' }, 400);
    }

    // Build human-readable reason string for the existing `reason` column (backward compat)
    const reason = reason_code === 'repeated_violation'
      ? `${REASON_LABELS[reason_code]}: ${reason_detail?.trim()}`
      : REASON_LABELS[reason_code];

    // Check if already manually delinquent
    const existing = await c.env.DB.prepare(
      'SELECT id FROM manual_delinquencies WHERE lot_member_id = ? AND is_active = 1'
    ).bind(lot_member_id).first();

    if (existing) {
      return c.json({ error: 'Member is already marked as delinquent' }, 400);
    }

    const result = await delinquency.markDelinquent(
      c.env.DB,
      lot_member_id,
      authUser.id,
      reason,
      reason_code,
      reason_detail?.trim() || null
    );

    return c.json({ delinquency: result });
  } catch (error: any) {
    console.error('Error marking delinquent:', error);
    return c.json({ error: error.message || 'Failed to mark as delinquent' }, 500);
  }
});

// Admin: Waive manual delinquency
app.post('/admin/delinquency/waive/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const delinquencyId = c.req.param('id');
    const { waiver_reason } = await c.req.json();

    if (!waiver_reason || waiver_reason.trim().length === 0) {
      return c.json({ error: 'Waiver reason is required' }, 400);
    }

    const success = await delinquency.waiveDelinquency(
      c.env.DB,
      delinquencyId,
      authUser.id,
      waiver_reason.trim()
    );

    if (success) {
      return c.json({ success: true });
    }

    return c.json({ error: 'Delinquency not found or already waived' }, 404);
  } catch (error: any) {
    console.error('Error waiving delinquency:', error);
    return c.json({ error: error.message || 'Failed to waive delinquency' }, 500);
  }
});

// Admin: Generate payment demands for a year
app.post('/admin/delinquency/demands', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { year, due_date } = await c.req.json();

    if (!year) {
      return c.json({ error: 'Year is required' }, 400);
    }

    const fiscalYear = parseInt(year);
    if (isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      return c.json({ error: 'Invalid year' }, 400);
    }

    // Default due date: Jan 31 of the given year (30 days from Jan 1)
    const demandDueDate = due_date || `${year}-01-31`;

    // Get current dues rate
    const rateResult = await c.env.DB.prepare(
      'SELECT rate_per_sqm FROM dues_rates WHERE year = ? ORDER BY effective_date DESC LIMIT 1'
    ).bind(fiscalYear).first();

    if (!rateResult) {
      return c.json({ error: `No dues rate configured for year ${fiscalYear}` }, 400);
    }

    const ratePerSqm = rateResult.rate_per_sqm as number;

    // Get all residential lots
    const lots = await c.env.DB.prepare(
      `SELECT h.id, h.lot_size_sqm, lm.user_id, lm.id as lot_member_id
       FROM households h
       INNER JOIN lot_members lm ON h.id = lm.household_id
       WHERE lm.role = 'primary_owner'
         AND h.lot_type NOT IN ('community', 'utility', 'open_space')`
    ).all();

    let generated = 0;
    let skipped = 0;

    for (const lot of (lots.results || [])) {
      const lotSize = lot.lot_size_sqm as number;
      const userId = lot.user_id as string;
      const amountDue = lotSize * ratePerSqm * 12; // Annual dues

      // Check if demand already exists
      const existing = await c.env.DB.prepare(
        'SELECT id FROM payment_demands WHERE user_id = ? AND year = ?'
      ).bind(userId, fiscalYear).first();

      if (existing) {
        skipped++;
        continue;
      }

      // Create demand
      const demandId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO payment_demands (id, user_id, year, demand_sent_date, due_date, amount_due, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      ).bind(
        demandId,
        userId,
        fiscalYear,
        new Date().toISOString().split('T')[0],
        demandDueDate,
        amountDue
      ).run();

      generated++;
    }

    return c.json({
      generated,
      skipped,
      rate_per_sqm: ratePerSqm,
      due_date: demandDueDate
    });
  } catch (error: any) {
    console.error('Error generating demands:', error);
    return c.json({ error: error.message || 'Failed to generate demands' }, 500);
  }
});

// Public: Get delinquency status for current user
app.get('/my-lots/delinquency-status', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!authUser) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    // Get user's lot_members
    const lotMembers = await c.env.DB.prepare(
      'SELECT id FROM lot_members WHERE user_id = ?'
    ).bind(authUser.id).all();

    if (!lotMembers.results || lotMembers.results.length === 0) {
      return c.json({ error: 'No lots found' }, 404);
    }

    // Check all lots - delinquent if any are delinquent
    let combinedStatus: delinquency.DelinquencyStatus | null = null;

    for (const lm of lotMembers.results) {
      const status = await delinquency.getDelinquencyStatus(c.env.DB, (lm as any).id);

      if (!combinedStatus || status.is_delinquent) {
        combinedStatus = status;
      }
    }

    return c.json(combinedStatus);
  } catch (error: any) {
    console.error('Error fetching delinquency status:', error);
    return c.json({ error: error.message || 'Failed to fetch status' }, 500);
  }
});

export default app;
