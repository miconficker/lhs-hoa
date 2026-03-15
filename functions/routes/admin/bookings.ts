/**
 * Admin Bookings API Routes
 *
 * Provides endpoints for admins to create bookings on behalf of residents/guests,
 * with support for price overrides, skip approval, and payment recording.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../../lib/auth';
import { calculatePricing } from '../bookings';
import { createBookingNotification } from '../../lib/booking-notifications';
import {
  validateAdminBookingRequest,
  determineInitialStatus,
  determinePaymentStatus,
  generateAdminNotes,
  createNewCustomer,
} from '../../lib/admin-booking-helpers';
import type { AdminBookingRequest, AdminBookingResponse, PricingCalculation } from '../../../types';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
};

const adminBookingsRouter = new Hono<{ Bindings: Env }>();

// Validation schema
const adminBookingSchema = z.object({
  user_type: z.enum(['resident', 'guest', 'new_resident', 'new_guest']),
  user_id: z.string().optional(),
  customer_id: z.string().optional(),
  new_customer: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    household_address: z.string().optional(),
    resident_notes: z.string().optional(),
  }).optional(),
  amenity_type: z.enum(['clubhouse', 'pool', 'basketball-court', 'tennis-court']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(['AM', 'PM', 'FULL_DAY']),
  event_type: z.enum(['wedding', 'birthday', 'meeting', 'sports', 'other']).optional(),
  purpose: z.string().optional(),
  attendee_count: z.number().int().optional(),
  override_price: z.number().nonnegative().optional(),
  skip_approval: z.boolean().optional(),
  record_payment: z.boolean().optional(),
  payment_amount: z.number().nonnegative().optional(),
  payment_method: z.string().optional(),
  receipt_number: z.string().optional(),
  admin_notes_internal: z.string().optional(),
  customer_notes: z.string().optional(),
});

// Helper function to check admin/staff access
async function requireAdminOrStaff(c: any, env: Env): Promise<{ userId: string; role: string } | null> {
  const authUser = await getUserFromRequest(c.req.raw, env.JWT_SECRET);
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'staff')) {
    return null;
  }
  return { userId: authUser.userId, role: authUser.role };
}

// POST /api/admin/bookings/create - Create booking as admin
adminBookingsRouter.post('/create', async (c) => {
  const authUser = await requireAdminOrStaff(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = adminBookingSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: 'Invalid input', details: result.error.flatten() },
      400
    );
  }

  const request: AdminBookingRequest = result.data;

  // Validate request
  const validation = validateAdminBookingRequest(request);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  let userId: string | undefined;
  let customerId: string | undefined;
  let householdId: string | undefined;
  let warning: string | undefined;

  try {
    // Handle customer selection
    if (request.user_type === 'new_guest' || request.user_type === 'new_resident') {
      const newCustomer = await createNewCustomer(c.env.DB, request, authUser.userId);
      if (newCustomer.error) {
        return c.json({ error: newCustomer.error }, 400);
      }
      customerId = newCustomer.customerId;
      userId = newCustomer.userId;
      householdId = newCustomer.householdId;
    } else if (request.user_type === 'resident') {
      userId = request.user_id;
      // Get household_id
      const household = await c.env.DB.prepare(
        'SELECT id FROM households WHERE owner_user_id = ? LIMIT 1'
      ).bind(userId).first();
      householdId = household?.id as string | undefined;
    } else {
      customerId = request.customer_id;
    }

    // Calculate pricing
    const pricing = await calculatePricing(
      c.env.DB,
      { amenity_type: request.amenity_type, date: request.date, slot: request.slot },
      { customer_type: request.user_type === 'resident' ? 'resident' : 'external' }
    );

    const finalAmount = request.override_price ?? pricing.finalAmount;

    // Determine statuses
    const bookingStatus = determineInitialStatus(request);
    const paymentStatus = determinePaymentStatus(request, finalAmount);

    // Generate booking ID and reference
    const bookingId = crypto.randomUUID();
    const referenceNumber = `BK-${Date.now().toString(36).toUpperCase()}`;

    // Create booking
    await c.env.DB.prepare(`
      INSERT INTO bookings (
        id, user_id, customer_id, household_id,
        amenity_type, date, slot,
        base_rate, duration_hours, day_multiplier, season_multiplier, resident_discount,
        amount, pricing_calculated_at,
        payment_status, amount_paid, payment_method, receipt_number,
        booking_status,
        event_type, purpose, attendee_count,
        admin_notes, rejection_reason,
        created_at, created_by, updated_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, datetime('now'),
        ?, ?, ?, ?,
        ?,
        ?, ?, ?,
        ?, NULL,
        datetime('now'), ?, datetime('now')
      )
    `).bind(
      bookingId,
      userId || null,
      customerId || null,
      householdId || null,
      request.amenity_type,
      request.date,
      request.slot,
      pricing.baseRate,
      pricing.durationHours,
      pricing.dayMultiplier,
      pricing.seasonMultiplier,
      pricing.residentDiscount,
      finalAmount,
      paymentStatus,
      request.record_payment ? request.payment_amount || 0 : 0,
      request.payment_method || null,
      request.receipt_number || null,
      bookingStatus,
      request.event_type || null,
      request.purpose || null,
      request.attendee_count || null,
      generateAdminNotes(request),
      authUser.userId
    ).run();

    // Add customer notes if provided
    if (request.customer_notes) {
      await c.env.DB.prepare(`
        UPDATE bookings SET admin_notes = CASE
          WHEN admin_notes IS NULL THEN ?
          ELSE admin_notes || '\n\nCustomer Notes: ' || ?
        END
        WHERE id = ?
      `).bind(`Customer Notes: ${request.customer_notes}`, request.customer_notes, bookingId).run();
    }

    // If confirmed, add to booking_blocked_dates
    if (bookingStatus === 'confirmed') {
      await c.env.DB.prepare(`
        INSERT INTO booking_blocked_dates (id, booking_id, amenity_type, booking_date, slot, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).bind(crypto.randomUUID(), bookingId, request.amenity_type, request.date, request.slot).run();
    }

    // Get the full booking with customer details
    const booking = await c.env.DB.prepare(`
      SELECT
        b.*,
        CASE
          WHEN b.user_id IS NOT NULL THEN 'resident'
          ELSE 'external'
        END as customer_type,
        COALESCE(u.first_name, c.first_name) as first_name,
        COALESCE(u.last_name, c.last_name) as last_name,
        COALESCE(u.email, c.email) as email,
        COALESCE(u.phone, c.phone) as phone,
        h.address as household_address,
        ? as reference_number
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN households h ON b.household_id = h.id
      WHERE b.id = ?
    `).bind(referenceNumber, bookingId).first();

    // Send notification
    await createBookingNotification(c.env.DB, booking, 'booking_created_admin');

    return c.json({
      booking,
      warning,
    } as AdminBookingResponse, 201);

  } catch (error) {
    console.error('Error creating admin booking:', error);
    return c.json({ error: 'Failed to create booking' }, 500);
  }
});

export { adminBookingsRouter };
