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
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
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

  // Get service request status breakdown for chart
  const requestStatusBreakdown = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as count
     FROM service_requests
     GROUP BY status`
  ).all<{ status: string; count: number }>();

  // Build request status chart data
  const requestStatusData = [
    { name: 'Pending', value: 0, color: '#f59e0b' },
    { name: 'In Progress', value: 0, color: '#3b82f6' },
    { name: 'Completed', value: 0, color: '#10b981' },
    { name: 'Rejected', value: 0, color: '#ef4444' },
  ];
  requestStatusBreakdown.results?.forEach((item) => {
    const index = requestStatusData.findIndex(
      (d) => d.name.toLowerCase() === item.status.replace('-', ' ')
    );
    if (index !== -1) {
      requestStatusData[index].value = item.count;
    }
  });

  // Get payment trends for last 6 months
  const paymentTrends = await c.env.DB.prepare(
    `SELECT
       strftime('%Y-%m', created_at) as month,
       status,
       SUM(amount) as total
     FROM payments
     WHERE created_at >= date('now', '-6 months')
     GROUP BY month, status
     ORDER BY month ASC`
  ).all<{ month: string; status: string; total: number }>();

  // Build payment chart data with proper month names
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const paymentData: Array<{
    month: string;
    paid: number;
    pending: number;
    failed: number;
  }> = [];

  // Get the last 6 months including current month
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    paymentData.push({
      month: monthNames[d.getMonth()],
      paid: 0,
      pending: 0,
      failed: 0,
    });
  }

  // Fill in actual payment data
  paymentTrends.results?.forEach((item) => {
    const monthIndex = paymentData.findIndex(
      (d) => {
        const d2 = new Date(now.getFullYear(), now.getMonth() - (5 - paymentData.indexOf(d)), 1);
        const monthKey = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`;
        return monthKey === item.month;
      }
    );
    if (monthIndex !== -1) {
      if (item.status === 'completed') paymentData[monthIndex].paid = item.total;
      else if (item.status === 'pending') paymentData[monthIndex].pending = item.total;
      else if (item.status === 'failed') paymentData[monthIndex].failed = item.total;
    }
  });

  return c.json({
    stats: {
      households: householdCount?.count || 0,
      pendingRequests: pendingRequests?.count || 0,
      upcomingReservations: upcomingReservations?.count || 0,
      unpaidPayments: unpaidPayments?.count || 0,
    },
    recentAnnouncements: recentAnnouncements.results,
    charts: {
      requestStatus: requestStatusData,
      paymentTrends: paymentData,
    },
  });
});

// Get quick stats for a specific household (for resident view)
dashboardRouter.get('/my-stats/:householdId', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
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
