/**
 * Unified Bookings API
 *
 * Handles both resident and external guest bookings through a single interface.
 *
 * Key architectural decisions (from issue fixes):
 * - `customers` table: external guests ONLY
 * - `bookings` table: either user_id (residents) OR customer_id (guests)
 * - booking_blocked_dates: kept for confirmed slot enforcement
 * - amenity_closures: separate admin-created blocks
 * - Status workflow: preserves existing inquiry-based flow
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type {
  Booking,
  BookingWithCustomer,
  BookingWithReference,
  CreateBookingRequest,
  UnifiedBookingStatus,
  PricingCalculation,
  GuestSession,
} from '../../types';
import { getUserFromRequest } from '../lib/auth';
import {
  getGuestSessionFromRequest,
  getClientIp,
} from '../middleware/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const bookingsRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const createBookingSchema = z.object({
  amenity_type: z.enum(['clubhouse', 'pool', 'basketball-court', 'tennis-court']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(['AM', 'PM', 'FULL_DAY']),
  event_type: z.enum(['wedding', 'birthday', 'meeting', 'sports', 'other']).optional(),
  purpose: z.string().optional(),
  attendee_count: z.number().int().optional(),
});

const createGuestBookingSchema = createBookingSchema.extend({
  guest_first_name: z.string().min(1),
  guest_last_name: z.string().min(1),
  guest_email: z.string().email(),
  guest_phone: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum([
    'inquiry_submitted',
    'pending_approval',
    'pending_payment',
    'pending_verification',
    'pending_resident',
    'awaiting_resident_payment',
    'confirmed',
    'rejected',
    'cancelled',
    'no_show',
  ]),
  rejection_reason: z.string().optional(),
  admin_notes: z.string().optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get either resident user or guest session from request
 */
async function getAuthOrGuest(
  request: Request,
  env: Env
): Promise<{ user?: any; guest?: GuestSession }> {
  // Try resident user first
  const user = await getUserFromRequest(request, env.JWT_SECRET);
  if (user) return { user };

  // Try guest session
  const guest = await getGuestSessionFromRequest(request, env.JWT_SECRET);
  if (guest) return { guest };

  // Neither authenticated
  throw new Error('Authentication required');
}

/**
 * Get resident customer (user + household) for booking
 */
async function getResidentCustomer(
  db: D1Database,
  userId: string
): Promise<{ id: string; household_id: string; customer_type: 'resident' } | null> {
  // Get household from lot_members
  const lotMember = await db.prepare(
    'SELECT household_id FROM lot_members WHERE user_id = ? AND member_type = "primary_owner" LIMIT 1'
  ).bind(userId).first() as any;

  if (!lotMember) {
    return null;
  }

  return {
    id: userId,
    household_id: lotMember.household_id,
    customer_type: 'resident',
  };
}

/**
 * Get guest customer for booking
 */
async function getGuestCustomer(
  db: D1Database,
  customerId: string
): Promise<{ id: string; customer_type: 'external' } | null> {
  const customer = await db.prepare(
    'SELECT id FROM customers WHERE id = ?'
  ).bind(customerId).first();

  if (!customer) {
    return null;
  }

  return {
    id: customerId,
    customer_type: 'external',
  };
}

/**
 * Calculate pricing for a booking
 */
export async function calculatePricing(
  db: D1Database,
  booking: { amenity_type: string; date: string; slot: string },
  customer: { customer_type: string }
): Promise<PricingCalculation> {
  // Get base rate (hourly)
  const baseRateResult = await db.prepare(
    `SELECT CAST(setting_value AS REAL) as rate FROM system_settings
     WHERE setting_key = 'external_pricing_' || ? || '_hourly'`
  ).bind(booking.amenity_type).first();

  const baseRate = baseRateResult?.rate as number || 500;

  // Get duration
  const durations: Record<string, number> = { AM: 4, PM: 4, FULL_DAY: 9 };
  const durationHours = durations[booking.slot] || 4;

  // Get day multipliers
  const dayMultipliersResult = await db.prepare(
    `SELECT setting_value FROM system_settings
     WHERE setting_key = 'external_pricing_day_multipliers'`
  ).first();

  const dayMultipliers = JSON.parse(
    (dayMultipliersResult?.setting_value as string) || '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}'
  );

  // Get season multipliers
  const seasonMultipliersResult = await db.prepare(
    `SELECT setting_value FROM system_settings
     WHERE setting_key = 'external_pricing_season_multipliers'`
  ).first();

  const seasonMultipliers = JSON.parse(
    (seasonMultipliersResult?.setting_value as string) || '{"peak": 1.3, "off_peak": 1.0}'
  );

  // Get peak months
  const peakMonthsResult = await db.prepare(
    `SELECT setting_value FROM system_settings
     WHERE setting_key = 'external_pricing_peak_months'`
  ).first();

  const peakMonths = (peakMonthsResult?.setting_value as string || '12,1,2,3,4,5')
    .split(',')
    .map(Number);

  // Get holidays
  const holidaysResult = await db.prepare(
    `SELECT setting_value FROM system_settings
     WHERE setting_key = 'external_pricing_holidays_2026'`
  ).first();

  const holidays = (holidaysResult?.setting_value as string || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // Calculate multipliers
  const bookingDate = new Date(booking.date);
  const dayOfWeek = bookingDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = holidays.includes(booking.date);
  const month = bookingDate.getMonth() + 1;
  const isPeak = peakMonths.includes(month);

  let dayType: 'weekday' | 'weekend' | 'holiday' = 'weekday';
  let dayMultiplier = dayMultipliers.weekday;
  if (isHoliday) {
    dayType = 'holiday';
    dayMultiplier = dayMultipliers.holiday;
  } else if (isWeekend) {
    dayType = 'weekend';
    dayMultiplier = dayMultipliers.weekend;
  }

  const seasonType: 'peak' | 'off_peak' = isPeak ? 'peak' : 'off_peak';
  const seasonMultiplier = isPeak ? seasonMultipliers.peak : seasonMultipliers.off_peak;

  // Calculate resident discount
  let residentDiscount = 0;
  if (customer.customer_type === 'resident') {
    const discountResult = await db.prepare(
      `SELECT CAST(setting_value AS REAL) as rate FROM system_settings
       WHERE setting_key = 'external_pricing_resident_discount_percent'`
    ).first();

    residentDiscount = (discountResult?.rate as number) || 0.5;
  }

  const subtotal = baseRate * durationHours * dayMultiplier * seasonMultiplier;
  const finalAmount = Math.round(subtotal * (1 - residentDiscount));

  return {
    baseRate,
    durationHours,
    dayType,
    dayMultiplier,
    seasonType,
    seasonMultiplier,
    residentDiscount,
    finalAmount,
    isHoliday,
    isWeekend,
    isPeakSeason: isPeak,
  } as PricingCalculation;
}

/**
 * Generate human-readable reference number
 */
function generateReferenceNumber(booking: Partial<Booking>): string {
  const amenityCodes: Record<string, string> = {
    clubhouse: 'CH',
    pool: 'PL',
    'basketball-court': 'BC',
    'tennis-court': 'TC',
  };

  const amenityCode = amenityCodes[booking.amenity_type || ''] || 'AM';
  const date = booking.date ? booking.date.replace(/-/g, '').slice(2) : '';
  const slotCode = booking.slot === 'AM' ? 'AM' : booking.slot === 'PM' ? 'PM' : 'FD';
  const idSuffix = booking.id ? booking.id.slice(-6).toUpperCase() : 'XXXXXX';

  return `${amenityCode}-${date}-${slotCode}-${idSuffix}`;
}

// =============================================================================
// Public Endpoints (no authentication required)
// =============================================================================

/**
 * GET /bookings/availability/:amenityType
 * Check available slots for a date
 */
bookingsRouter.get('/availability/:amenityType', async (c) => {
  const amenityType = c.req.param('amenityType');
  const date = c.req.query('date');

  if (!amenityType || !date) {
    return c.json({ error: 'amenityType and date are required' }, 400);
  }

  // Check for closures
  const closures = await c.env.DB.prepare(
    'SELECT * FROM amenity_closures WHERE amenity_type = ? AND date = ?'
  ).bind(amenityType, date).all();

  const closedSlots = new Set((closures.results || []).map((c: any) => c.slot));

  // Check confirmed bookings
  const confirmedBookings = await c.env.DB.prepare(
    `SELECT slot FROM bookings
     WHERE amenity_type = ? AND date = ?
       AND booking_status = 'confirmed'
       AND deleted_at IS NULL`
  ).bind(amenityType, date).all();

  const bookedSlots = new Set((confirmedBookings.results || []).map((b: any) => b.slot));

  // Available slots
  const allSlots = ['AM', 'PM', 'FULL_DAY'] as const;
  const availableSlots = allSlots.filter(
    slot => !closedSlots.has(slot) && !bookedSlots.has(slot)
  );

  return c.json({
    data: {
      date,
      amenity_type: amenityType,
      available_slots: availableSlots,
      existing_bookings: (confirmedBookings.results || []).map((b: any) => ({
        slot: b.slot,
        status: 'confirmed',
      })),
      closures: closures.results || [],
    },
  });
});

/**
 * GET /bookings/pricing/:amenityType
 * Calculate pricing for a booking
 */
bookingsRouter.get('/pricing/:amenityType', async (c) => {
  const amenityType = c.req.param('amenityType');
  const date = c.req.query('date');
  const slot = c.req.query('slot');
  const isResident = c.req.query('resident') === 'true';

  if (!amenityType || !date || !slot) {
    return c.json({ error: 'amenityType, date, and slot are required' }, 400);
  }

  try {
    const pricing = await calculatePricing(
      c.env.DB,
      { amenity_type: amenityType, date, slot },
      { customer_type: isResident ? 'resident' : 'external' }
    );

    return c.json({ data: pricing });
  } catch (error: any) {
    console.error('Pricing calculation error:', error);
    return c.json({ error: 'Failed to calculate pricing' }, 500);
  }
});

/**
 * GET /bookings/:id/status
 * Get booking status (public endpoint for status checks)
 */
bookingsRouter.get('/:id/status', async (c) => {
  const id = c.req.param('id');

  const booking = await c.env.DB.prepare(
    `SELECT
      b.*,
      CASE WHEN b.user_id IS NOT NULL THEN 'resident' ELSE 'external' END AS customer_type,
      COALESCE(u.first_name, c.first_name) AS first_name,
      COALESCE(u.last_name, c.last_name) AS last_name,
      COALESCE(u.email, c.email) AS email,
      h.address AS household_address
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN households h ON b.household_id = h.id
    WHERE b.id = ? AND b.deleted_at IS NULL`
  ).bind(id).first() as any;

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  const referenceNumber = generateReferenceNumber(booking);

  return c.json({
    data: {
      booking: {
        ...booking,
        reference_number: referenceNumber,
      },
    },
  });
});

// =============================================================================
// Authenticated Endpoints
// =============================================================================

/**
 * POST /bookings
 * Create a new booking (authenticated residents only)
 */
bookingsRouter.post('/', async (c) => {
  const auth = await getAuthOrGuest(c.req.raw, c.env);

  // Only residents can use this endpoint (guests use /guest)
  if (!auth.user) {
    return c.json({ error: 'Must be authenticated as a resident' }, 401);
  }

  const body = await c.req.json();
  const data = createBookingSchema.safeParse(body);

  if (!data.success) {
    return c.json({ error: 'Invalid input', details: data.error.flatten() }, 400);
  }

  // Get resident customer
  const customer = await getResidentCustomer(c.env.DB, auth.user.id);
  if (!customer) {
    return c.json({ error: 'Resident household not found. Please contact admin.' }, 404);
  }

  // Calculate pricing
  const pricing = await calculatePricing(
    c.env.DB,
    data.data,
    { customer_type: 'resident' }
  );

  // Create booking
  const bookingId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO bookings (
      id, user_id, household_id, amenity_type, date, slot,
      base_rate, duration_hours, day_multiplier, season_multiplier, resident_discount, amount,
      pricing_calculated_at, booking_status, event_type, purpose, attendee_count,
      created_at, created_by, created_ip, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    bookingId,
    customer.id,
    customer.household_id,
    data.data.amenity_type,
    data.data.date,
    data.data.slot,
    pricing.baseRate,
    pricing.durationHours,
    pricing.dayMultiplier,
    pricing.seasonMultiplier,
    pricing.residentDiscount,
    pricing.finalAmount,
    now,
    'pending_resident', // Resident bookings start here
    data.data.event_type || null,
    data.data.purpose || null,
    data.data.attendee_count || null,
    now,
    auth.user.id,
    getClientIp(c.req.raw),
    now
  ).run();

  // Fetch created booking with customer details
  const booking = await c.env.DB.prepare(
    `SELECT
      b.*,
      'resident' as customer_type,
      u.first_name,
      u.last_name,
      u.email,
      u.phone,
      h.address as household_address
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    LEFT JOIN households h ON b.household_id = h.id
    WHERE b.id = ?`
  ).bind(bookingId).first() as any;

  const referenceNumber = generateReferenceNumber(booking);

  return c.json({
    data: {
      booking: {
        ...booking,
        reference_number: referenceNumber,
      },
    },
  }, 201);
});

/**
 * POST /bookings/guest
 * Create a new guest booking (unauthenticated guests)
 */
bookingsRouter.post('/guest', async (c) => {
  const body = await c.req.json();
  const data = createGuestBookingSchema.safeParse(body);

  if (!data.success) {
    return c.json({ error: 'Invalid input', details: data.error.flatten() }, 400);
  }

  // Check if guest is authenticated via Google SSO
  const guest = await getGuestSessionFromRequest(c.req.raw, c.env.JWT_SECRET);

  let customerId: string;

  if (guest) {
    // Use existing customer from Google SSO
    customerId = guest.customerId;
  } else {
    // Create new customer from form data
    // Check if customer exists by email first
    const existingCustomer = await c.env.DB.prepare(
      'SELECT id FROM customers WHERE email = ?'
    ).bind(data.data.guest_email).first();

    if (existingCustomer) {
      customerId = existingCustomer.id as string;
    } else {
      // Create new customer
      customerId = crypto.randomUUID();
      await c.env.DB.prepare(
        `INSERT INTO customers (id, first_name, last_name, email, phone, created_at, updated_at, created_ip, ip_retained_until)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, datetime('now', '+90 days'))`
      ).bind(
        customerId,
        data.data.guest_first_name,
        data.data.guest_last_name,
        data.data.guest_email,
        data.data.guest_phone || null,
        getClientIp(c.req.raw)
      ).run();
    }
  }

  // Calculate pricing
  const pricing = await calculatePricing(
    c.env.DB,
    data.data,
    { customer_type: 'external' }
  );

  // Create booking
  const bookingId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO bookings (
      id, customer_id, amenity_type, date, slot,
      base_rate, duration_hours, day_multiplier, season_multiplier, resident_discount, amount,
      pricing_calculated_at, booking_status, event_type, purpose, attendee_count,
      created_at, created_by_customer_id, created_ip, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    bookingId,
    customerId,
    data.data.amenity_type,
    data.data.date,
    data.data.slot,
    pricing.baseRate,
    pricing.durationHours,
    pricing.dayMultiplier,
    pricing.seasonMultiplier,
    pricing.residentDiscount,
    pricing.finalAmount,
    now,
    'inquiry_submitted', // External guests start here
    data.data.event_type || null,
    data.data.purpose || null,
    data.data.attendee_count || null,
    now,
    customerId,
    getClientIp(c.req.raw),
    now
  ).run();

  // Fetch created booking with customer details
  const booking = await c.env.DB.prepare(
    `SELECT
      b.*,
      'external' as customer_type,
      c.first_name,
      c.last_name,
      c.email,
      c.phone
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    WHERE b.id = ?`
  ).bind(bookingId).first() as any;

  const referenceNumber = generateReferenceNumber(booking);

  return c.json({
    data: {
      booking: {
        ...booking,
        reference_number: referenceNumber,
      },
    },
  }, 201);
});

/**
 * GET /bookings
 * List bookings (admin/staff only)
 */
bookingsRouter.get('/', async (c) => {
  const auth = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const filters = {
    status: c.req.query('status'),
    amenity_type: c.req.query('amenity_type'),
    date_from: c.req.query('date_from'),
    date_to: c.req.query('date_to'),
    customer_type: c.req.query('customer_type'),
    household_id: c.req.query('household_id'),
    user_id: c.req.query('user_id'),
    customer_id: c.req.query('customer_id'),
  };

  let query = `
    SELECT
      b.*,
      CASE WHEN b.user_id IS NOT NULL THEN 'resident' ELSE 'external' END AS customer_type,
      COALESCE(u.first_name, c.first_name) AS first_name,
      COALESCE(u.last_name, c.last_name) AS last_name,
      COALESCE(u.email, c.email) AS email,
      COALESCE(u.phone, c.phone) AS phone,
      h.address AS household_address
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN households h ON b.household_id = h.id
    WHERE b.deleted_at IS NULL
  `;

  const params: (string | number)[] = [];

  if (filters.status) {
    query += ' AND b.booking_status = ?';
    params.push(filters.status);
  }
  if (filters.amenity_type) {
    query += ' AND b.amenity_type = ?';
    params.push(filters.amenity_type);
  }
  if (filters.date_from) {
    query += ' AND b.date >= ?';
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    query += ' AND b.date <= ?';
    params.push(filters.date_to);
  }
  if (filters.customer_type) {
    if (filters.customer_type === 'resident') {
      query += ' AND b.user_id IS NOT NULL';
    } else {
      query += ' AND b.customer_id IS NOT NULL';
    }
  }
  if (filters.household_id) {
    query += ' AND b.household_id = ?';
    params.push(filters.household_id);
  }
  if (filters.user_id) {
    query += ' AND b.user_id = ?';
    params.push(filters.user_id);
  }
  if (filters.customer_id) {
    query += ' AND b.customer_id = ?';
    params.push(filters.customer_id);
  }

  query += ' ORDER BY b.date DESC, b.created_at DESC';

  const result = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({
    data: {
      bookings: result.results || [],
      total: (result.results || []).length,
    },
  });
});

/**
 * GET /bookings/my
 * Get my bookings (for both residents and guests)
 */
bookingsRouter.get('/my', async (c) => {
  const auth = await getAuthOrGuest(c.req.raw, c.env);

  const statusFilter = c.req.query('status');
  const listFilter = c.req.query('filter'); // upcoming, past, cancelled, all

  let query = '';
  let params: (string | number)[] = [];

  if (auth.user) {
    // Resident bookings
    query = `
      SELECT
        b.*,
        'resident' as customer_type,
        u.first_name,
        u.last_name,
        u.email,
        h.address as household_address
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN households h ON b.household_id = h.id
      WHERE b.user_id = ? AND b.deleted_at IS NULL
    `;
    params.push(auth.user.userId);
  } else if (auth.guest) {
    // Guest bookings
    query = `
      SELECT
        b.*,
        'external' as customer_type,
        c.first_name,
        c.last_name,
        c.email
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.customer_id = ? AND b.deleted_at IS NULL
    `;
    params.push(auth.guest.customerId);
  } else {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Apply status filter if specified
  if (statusFilter) {
    query += ' AND b.booking_status = ?';
    params.push(statusFilter);
  }

  // Apply list filter
  const today = new Date().toISOString().split('T')[0];
  if (listFilter === 'upcoming') {
    query += ' AND b.date >= ? AND b.booking_status NOT IN (?, ?, ?)';
    params.push(today, 'cancelled', 'rejected', 'no_show');
  } else if (listFilter === 'past') {
    query += ' AND b.date < ?';
    params.push(today);
  } else if (listFilter === 'cancelled') {
    query += ' AND b.booking_status = ?';
    params.push('cancelled');
  }

  query += ' ORDER BY b.date DESC, b.created_at DESC';

  const result = await c.env.DB.prepare(query).bind(...params).all();
  const bookings = (result.results || []) as any[];

  // Calculate counts
  const upcoming = bookings.filter(b =>
    b.date >= today &&
    !['cancelled', 'rejected', 'no_show'].includes(b.booking_status)
  ).length;
  const past = bookings.filter(b => b.date < today).length;
  const cancelled = bookings.filter(b => b.booking_status === 'cancelled').length;

  // Add reference numbers
  const bookingsWithRefs = bookings.map(b => ({
    ...b,
    reference_number: generateReferenceNumber(b),
  }));

  return c.json({
    data: {
      bookings: bookingsWithRefs,
      upcoming,
      past,
      cancelled,
    },
  });
});

/**
 * GET /bookings/:id
 * Get single booking
 */
bookingsRouter.get('/:id', async (c) => {
  const auth = await getAuthOrGuest(c.req.raw, c.env);
  const id = c.req.param('id');

  const booking = await c.env.DB.prepare(
    `SELECT
      b.*,
      CASE WHEN b.user_id IS NOT NULL THEN 'resident' ELSE 'external' END AS customer_type,
      COALESCE(u.first_name, c.first_name) AS first_name,
      COALESCE(u.last_name, c.last_name) AS last_name,
      COALESCE(u.email, c.email) AS email,
      COALESCE(u.phone, c.phone) AS phone,
      h.address AS household_address
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN households h ON b.household_id = h.id
    WHERE b.id = ? AND b.deleted_at IS NULL`
  ).bind(id).first() as any;

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  // Check access permission
  const isAdmin = auth.user?.role === 'admin' || auth.user?.role === 'staff';
  const isOwner = auth.user?.userId === booking.user_id;
  const isGuestOwner = auth.guest?.customerId === booking.customer_id;

  if (!isAdmin && !isOwner && !isGuestOwner) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json({ data: { booking } });
});

/**
 * PUT /bookings/:id/status
 * Update booking status (admin/staff only)
 */
bookingsRouter.put('/:id/status', async (c) => {
  const auth = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const data = updateStatusSchema.safeParse(body);

  if (!data.success) {
    return c.json({ error: 'Invalid input', details: data.error.flatten() }, 400);
  }

  const { status, rejection_reason, admin_notes } = data.data;

  // Check current status
  const currentBooking = await c.env.DB.prepare(
    'SELECT booking_status, user_id, amenity_type, date, slot FROM bookings WHERE id = ?'
  ).bind(id).first() as any;

  if (!currentBooking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  // Determine customer type for transition validation
  const isResident = !!currentBooking.user_id;
  const customerType: 'resident' | 'external' = isResident ? 'resident' : 'external';

  // Validate status transition
  const validTransitions: Record<string, string[]> = {
    // Resident transitions
    pending_resident: ['confirmed', 'cancelled'],
    awaiting_resident_payment: ['confirmed', 'cancelled'],
    // External transitions
    inquiry_submitted: ['pending_approval', 'rejected', 'cancelled'],
    pending_approval: ['pending_payment', 'rejected', 'cancelled'],
    pending_payment: ['pending_verification', 'cancelled'],
    pending_verification: ['confirmed', 'pending_payment', 'cancelled'],
    // Shared
    confirmed: ['cancelled', 'no_show'],
    cancelled: [],
    rejected: [],
    no_show: ['cancelled'],
  };

  const allowed = validTransitions[currentBooking.booking_status] || [];
  if (!allowed.includes(status)) {
    return c.json({
      error: `Cannot transition from ${currentBooking.booking_status} to ${status}`,
      allowedTransitions: allowed,
    }, 400);
  }

  // Update booking
  await c.env.DB.prepare(
    `UPDATE bookings
     SET booking_status = ?,
         rejection_reason = ?,
         admin_notes = ?,
         approved_at = CASE WHEN ? IN ('pending_payment', 'confirmed') THEN datetime('now') ELSE approved_at END,
         approved_by = CASE WHEN ? IN ('pending_payment', 'confirmed') THEN ? ELSE approved_by END,
         updated_at = datetime('now'),
         updated_by = ?
     WHERE id = ?`
  ).bind(
    status,
    rejection_reason || null,
    admin_notes || null,
    status,
    status,
    auth.userId,
    auth.userId,
    id
  ).run();

  // If confirming, add to booking_blocked_dates
  if (status === 'confirmed' && currentBooking.booking_status !== 'confirmed') {
    try {
      await c.env.DB.prepare(
        `INSERT INTO booking_blocked_dates (id, booking_id, amenity_type, booking_date, slot, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        id,
        currentBooking.amenity_type,
        currentBooking.date,
        currentBooking.slot
      ).run();
    } catch (error: any) {
      // UNIQUE constraint violation - slot already taken
      if (error.message.includes('UNIQUE constraint')) {
        // Revert the status change
        await c.env.DB.prepare(
          `UPDATE bookings SET booking_status = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(currentBooking.booking_status, id).run();

        return c.json({
          error: 'Slot is no longer available (already booked)',
          conflict: true,
        }, 409);
      }
      throw error;
    }
  }

  // If cancelling a confirmed booking, remove from booking_blocked_dates
  if (status === 'cancelled' && currentBooking.booking_status === 'confirmed') {
    await c.env.DB.prepare(
      'DELETE FROM booking_blocked_dates WHERE booking_id = ?'
    ).bind(id).run();
  }

  // Fetch updated booking
  const booking = await c.env.DB.prepare(
    `SELECT
      b.*,
      CASE WHEN b.user_id IS NOT NULL THEN 'resident' ELSE 'external' END AS customer_type,
      COALESCE(u.first_name, c.first_name) AS first_name,
      COALESCE(u.last_name, c.last_name) AS last_name,
      COALESCE(u.email, c.email) AS email,
      h.address AS household_address
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN households h ON b.household_id = h.id
    WHERE b.id = ?`
  ).bind(id).first() as any;

  return c.json({ data: { booking } });
});

/**
 * PUT /bookings/:id/cancel
 * Cancel booking (owner only)
 */
bookingsRouter.put('/:id/cancel', async (c) => {
  const auth = await getAuthOrGuest(c.req.raw, c.env);
  const id = c.req.param('id');

  const booking = await c.env.DB.prepare(
    'SELECT booking_status, user_id, customer_id FROM bookings WHERE id = ?'
  ).bind(id).first() as any;

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  // Check permission
  const isAdmin = auth.user?.role === 'admin' || auth.user?.role === 'staff';
  const isOwner = auth.user?.userId === booking.user_id;
  const isGuestOwner = auth.guest?.customerId === booking.customer_id;

  if (!isAdmin && !isOwner && !isGuestOwner) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Check if can be cancelled
  if (['rejected', 'cancelled', 'no_show'].includes(booking.booking_status)) {
    return c.json({ error: 'Booking cannot be cancelled' }, 400);
  }

  // Cancel booking
  await c.env.DB.prepare(
    `UPDATE bookings
     SET booking_status = 'cancelled',
         updated_at = datetime('now'),
         updated_by = ?
     WHERE id = ?`
  ).bind(auth.user?.userId || null, id).run();

  // If was confirmed, remove from booking_blocked_dates
  if (booking.booking_status === 'confirmed') {
    await c.env.DB.prepare(
      'DELETE FROM booking_blocked_dates WHERE booking_id = ?'
    ).bind(id).run();
  }

  return c.json({ success: true });
});

/**
 * POST /bookings/:id/proof
 * Upload payment proof
 */
bookingsRouter.post('/:id/proof', async (c) => {
  const auth = await getAuthOrGuest(c.req.raw, c.env);
  const id = c.req.param('id');

  const booking = await c.env.DB.prepare(
    'SELECT booking_status, customer_id, user_id FROM bookings WHERE id = ?'
  ).bind(id).first() as any;

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  // Check permission
  const isAdmin = auth.user?.role === 'admin' || auth.user?.role === 'staff';
  const isOwner = auth.user?.userId === booking.user_id;
  const isGuestOwner = auth.guest?.customerId === booking.customer_id;

  if (!isAdmin && !isOwner && !isGuestOwner) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const body = await c.req.json();
  const { proof_url } = body;

  if (!proof_url) {
    return c.json({ error: 'proof_url is required' }, 400);
  }

  // Update booking
  await c.env.DB.prepare(
    `UPDATE bookings
     SET proof_of_payment_url = ?,
         booking_status = 'pending_verification',
         updated_at = datetime('now')
     WHERE id = ?`
  ).bind(proof_url, id).run();

  // Fetch updated booking
  const updatedBooking = await c.env.DB.prepare(
    `SELECT
      b.*,
      CASE WHEN b.user_id IS NOT NULL THEN 'resident' ELSE 'external' END AS customer_type,
      COALESCE(u.first_name, c.first_name) AS first_name,
      COALESCE(u.last_name, c.last_name) AS last_name,
      COALESCE(u.email, c.email) AS email
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE b.id = ?`
  ).bind(id).first() as any;

  return c.json({ data: { booking: updatedBooking } });
});

/**
 * GET /bookings/:id/reference
 * Generate reference number for booking
 */
bookingsRouter.get('/:id/reference', async (c) => {
  const id = c.req.param('id');

  const booking = await c.env.DB.prepare(
    'SELECT * FROM bookings WHERE id = ?'
  ).bind(id).first() as any;

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  const referenceNumber = generateReferenceNumber(booking);

  return c.json({ data: { reference_number: referenceNumber } });
});

export { bookingsRouter };
