import { Hono } from 'hono';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const dashboardRouter = new Hono<{ Bindings: Env }>();

// Helper function to generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

// Get dashboard statistics
dashboardRouter.get('/stats', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Get household counts
  const householdCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM households'
  ).first<{ count: number }>();

  // Get pending service requests
  const pendingRequests = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM service_requests WHERE status = 'pending'"
  ).first<{ count: number }>();

  // Get upcoming reservations (next 7 days)
  const upcomingReservations = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM reservations
     WHERE date >= date('now')
     AND date <= date('now', '+7 days')
     AND status = 'confirmed'`
  ).first<{ count: number }>();

  // Get unpaid payments
  const unpaidPayments = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM payments WHERE status = 'pending'`
  ).first<{ count: number }>();

  // Get recent announcements
  const recentAnnouncements = await c.env.DB.prepare(
    `SELECT id, title, content, category, is_pinned, created_at
     FROM announcements
     ORDER BY created_at DESC
     LIMIT 5`
  ).all();

  return c.json({
    stats: {
      households: householdCount?.count || 0,
      pendingRequests: pendingRequests?.count || 0,
      upcomingReservations: upcomingReservations?.count || 0,
      unpaidPayments: unpaidPayments?.count || 0,
    },
    recentAnnouncements: recentAnnouncements.results,
  });
});

// Get quick stats for a specific household (for resident view)
dashboardRouter.get('/my-stats/:householdId', async (c) => {
  const authUser = getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');

  // Get pending service requests for this household
  const pendingRequests = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM service_requests
     WHERE household_id = ? AND status IN ('pending', 'in-progress')`
  ).bind(householdId).first<{ count: number }>();

  // Get upcoming reservations for this household
  const upcomingReservations = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM reservations
     WHERE household_id = ?
     AND date >= date('now')
     AND status = 'confirmed'`
  ).bind(householdId).first<{ count: number }>();

  // Get unpaid payments for this household
  const unpaidPayments = await c.env.DB.prepare(
    `SELECT COUNT(*) as count, SUM(amount) as total FROM payments
     WHERE household_id = ? AND status = 'pending'`
  ).bind(householdId).first<{ count: number; total: number }>();

  return c.json({
    pendingRequests: pendingRequests?.count || 0,
    upcomingReservations: upcomingReservations?.count || 0,
    unpaidPayments: unpaidPayments?.count || 0,
    totalDue: unpaidPayments?.total || 0,
  });
});
