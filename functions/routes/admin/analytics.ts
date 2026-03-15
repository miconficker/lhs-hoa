/**
 * Admin Analytics API Routes
 *
 * Provides endpoints for admins to view booking analytics, revenue statistics,
 * and customer insights.
 */

import { Hono } from 'hono';
import { getUserFromRequest } from '../../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const analyticsRouter = new Hono<{ Bindings: Env }>();

/**
 * Get booking analytics with revenue and statistics
 * GET /api/admin/analytics/bookings
 */
analyticsRouter.get('/bookings', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const startDate = c.req.query('start_date') as string;
  const endDate = c.req.query('end_date') as string;
  const period = c.req.query('period') || '30d';

  let start: Date, end: Date;

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    end = new Date();
    end.setHours(23, 59, 59, 999);
    start = new Date();

    switch (period) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case 'this_month':
        start = new Date(start.getFullYear(), start.getMonth(), 1);
        break;
    }

    start.setHours(0, 0, 0, 0);
  }

  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  try {
    // Get summary stats
    const summary = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total_bookings,
        SUM(CASE WHEN booking_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_bookings,
        SUM(CASE WHEN booking_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings,
        SUM(CASE WHEN booking_status = 'confirmed' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN payment_status != 'paid' THEN amount - amount_paid ELSE 0 END) as outstanding_balance
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
    `).bind(startStr, endStr).first();

    // Get unique customers count
    const uniqueCustomers = await c.env.DB.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id ELSE customer_id END) as unique_customers
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
    `).bind(startStr, endStr).first();

    // Get total bookings for repeat calculation
    const totalBookingsForRepeat = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total_booking_count,
        COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id ELSE customer_id END) as unique_customer_count
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
    `).bind(startStr, endStr).first();

    // Revenue by amenity
    const revenueByAmenity = await c.env.DB.prepare(`
      SELECT
        amenity_type as amenity,
        SUM(CASE WHEN booking_status = 'confirmed' THEN amount ELSE 0 END) as revenue,
        COUNT(*) as bookings
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
      GROUP BY amenity_type
      ORDER BY revenue DESC
    `).bind(startStr, endStr).all();

    // Revenue by day
    const revenueByDay = await c.env.DB.prepare(`
      SELECT
        date,
        SUM(CASE WHEN booking_status = 'confirmed' THEN amount ELSE 0 END) as revenue,
        COUNT(*) as bookings
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
      GROUP BY date
      ORDER BY date
    `).bind(startStr, endStr).all();

    // Bookings by status
    const bookingsByStatus = await c.env.DB.prepare(`
      SELECT
        booking_status as status,
        COUNT(*) as count
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
      GROUP BY booking_status
      ORDER BY count DESC
    `).bind(startStr, endStr).all();

    // Customer type breakdown
    const customerTypeBreakdown = await c.env.DB.prepare(`
      SELECT
        CASE WHEN user_id IS NOT NULL THEN 'resident' ELSE 'external' END as type,
        COUNT(*) as count,
        SUM(CASE WHEN booking_status = 'confirmed' THEN amount ELSE 0 END) as revenue
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
      GROUP BY type
    `).bind(startStr, endStr).all();

    // Popular slots
    const popularSlots = await c.env.DB.prepare(`
      SELECT
        slot,
        COUNT(*) as count
      FROM bookings
      WHERE date >= ? AND date <= ?
      AND deleted_at IS NULL
      GROUP BY slot
      ORDER BY count DESC
    `).bind(startStr, endStr).all();

    // Top customers
    const topCustomers = await c.env.DB.prepare(`
      SELECT
        COALESCE(u.first_name || ' ' || u.last_name, c.first_name || ' ' || c.last_name) as customer_name,
        CASE WHEN b.user_id IS NOT NULL THEN 'Resident' ELSE 'Guest' END as customer_type,
        COUNT(*) as bookings,
        SUM(CASE WHEN b.booking_status = 'confirmed' THEN b.amount ELSE 0 END) as total_revenue
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.date >= ? AND b.date <= ?
      AND b.deleted_at IS NULL
      GROUP BY customer_name, customer_type
      ORDER BY total_revenue DESC
      LIMIT 10
    `).bind(startStr, endStr).all();

    const summaryData = summary as any;
    const uniqueCustomersData = uniqueCustomers as any;
    const totalBookingsData = totalBookingsForRepeat as any;

    const totalBookings = summaryData.total_bookings || 0;
    const uniqueCustomersCount = uniqueCustomersData.unique_customers || 0;

    // Calculate percentages
    const bookingsByStatusWithPct = (bookingsByStatus.results || []).map((item: any) => ({
      ...item,
      percentage: totalBookings > 0 ? Math.round((item.count / totalBookings) * 100) : 0,
    }));

    const customerTypeBreakdownWithPct = (customerTypeBreakdown.results || []).map((item: any) => ({
      ...item,
      percentage: totalBookings > 0 ? Math.round((item.count / totalBookings) * 100) : 0,
    }));

    const popularSlotsWithPct = (popularSlots.results || []).map((item: any) => ({
      ...item,
      percentage: totalBookings > 0 ? Math.round((item.count / totalBookings) * 100) : 0,
    }));

    // Calculate repeat customer rate
    const repeatBookings = (totalBookingsData.total_booking_count || 0) - (totalBookingsData.unique_customer_count || 0);
    const repeatCustomerRate = uniqueCustomersCount > 0 ? repeatBookings / uniqueCustomersCount : 0;

    // Calculate cancellation rate
    const cancelledBookings = summaryData.cancelled_bookings || 0;
    const cancellationRate = totalBookings > 0 ? cancelledBookings / totalBookings : 0;

    return c.json({
      summary: {
        period: { start: start.toISOString(), end: end.toISOString() },
        total_revenue: summaryData.total_revenue || 0,
        total_bookings: totalBookings,
        confirmed_bookings: summaryData.confirmed_bookings || 0,
        cancelled_bookings: cancelledBookings,
        outstanding_balance: summaryData.outstanding_balance || 0,
        unique_customers: uniqueCustomersCount,
        repeat_customers: repeatBookings,
        repeat_customer_rate: repeatCustomerRate,
        cancellation_rate: cancellationRate,
      },
      revenue_by_amenity: revenueByAmenity.results || [],
      revenue_by_day: revenueByDay.results || [],
      bookings_by_status: bookingsByStatusWithPct,
      customer_type_breakdown: customerTypeBreakdownWithPct,
      popular_slots: popularSlotsWithPct,
      top_customers: topCustomers.results || [],
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
});

export { analyticsRouter };
