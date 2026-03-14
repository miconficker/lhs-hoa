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
  R2: R2Bucket;
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
    'submitted',
    'payment_due',
    'payment_review',
    'confirmed',
    'rejected',
    'cancelled',
    'no_show',
  ]),
  rejection_reason: z.string().optional(),
  admin_notes: z.string().optional(),
});

const bookingActionSchema = z.object({
  action: z.enum([
    'approve',
    'confirm_payment',
    'record_payment',
    'request_new_proof',
    'reject',
    'mark_no_show',
  ]),
  payment_amount: z.number().nonnegative().optional(),
  payment_method: z.string().optional(),
  receipt_number: z.string().optional(),
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
  return {};
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
  const maybeAny = booking as any;
  const isExternal =
    Boolean(maybeAny?.customer_id) ||
    maybeAny?.workflow === 'external' ||
    maybeAny?.customer_type === 'external';

  // External/public-facing reference: EXT-YYYYMMDD-<last3>
  if (isExternal) {
    const createdAt = booking.created_at ? new Date(booking.created_at) : null;
    const yyyy = createdAt ? String(createdAt.getFullYear()) : '0000';
    const mm = createdAt ? String(createdAt.getMonth() + 1).padStart(2, '0') : '00';
    const dd = createdAt ? String(createdAt.getDate()).padStart(2, '0') : '00';
    const suffix = booking.id ? booking.id.slice(-3).toUpperCase() : 'XXX';
    return `EXT-${yyyy}${mm}${dd}-${suffix}`;
  }

  // Resident/internal reference: amenity-date-slot-id
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
 * GET /bookings/availability/:amenityType/range?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Check available slots for a date range (batch for calendar view)
 */
bookingsRouter.get('/availability/:amenityType/range', async (c) => {
  const amenityType = c.req.param('amenityType');
  const startDate = c.req.query('start');
  const endDate = c.req.query('end');

  if (!amenityType || !startDate || !endDate) {
    return c.json({ error: 'amenityType, start, and end are required' }, 400);
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return c.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
  }

  // Validate date range (max 400 days = ~13 months)
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff > 400) {
    return c.json({ error: 'Date range too large. Maximum 400 days' }, 400);
  }

  if (end < start) {
    return c.json({ error: 'End date must be after start date' }, 400);
  }

  // Fetch closures for date range
  const closures = await c.env.DB.prepare(
    `SELECT date, slot FROM amenity_closures
     WHERE amenity_type = ? AND date BETWEEN ? AND ?`
  ).bind(amenityType, startDate, endDate).all();

  // Build closures map: date -> Set of closed slots
  const closuresMap = new Map<string, Set<string>>();
  for (const closure of closures.results || []) {
    const cl = closure as any;
    if (!closuresMap.has(cl.date)) {
      closuresMap.set(cl.date, new Set());
    }
    closuresMap.get(cl.date)!.add(cl.slot);
  }

  // Fetch confirmed bookings for date range
  const confirmedBookings = await c.env.DB.prepare(
    `SELECT date, slot FROM bookings
     WHERE amenity_type = ? AND date BETWEEN ? AND ?
       AND booking_status = 'confirmed'
       AND deleted_at IS NULL`
  ).bind(amenityType, startDate, endDate).all();

  // Build bookings map: date -> Set of booked slots
  const bookingsMap = new Map<string, Set<string>>();
  for (const booking of confirmedBookings.results || []) {
    const b = booking as any;
    if (!bookingsMap.has(b.date)) {
      bookingsMap.set(b.date, new Set());
    }
    bookingsMap.get(b.date)!.add(b.slot);
  }

  // Build availability response for each date in range
  const available: Array<{ date: string; available_slots: string[] }> = [];
  const allSlots = ['AM', 'PM', 'FULL_DAY'];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const closedSlots = closuresMap.get(dateStr) || new Set();
    const bookedSlots = bookingsMap.get(dateStr) || new Set();

    const availableSlots = allSlots.filter(
      slot => !closedSlots.has(slot) && !bookedSlots.has(slot)
    );

    available.push({
      date: dateStr,
      available_slots: availableSlots,
    });
  }

  return c.json({
    data: {
      amenity_type: amenityType,
      start_date: startDate,
      end_date: endDate,
      available,
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
  const customer = await getResidentCustomer(c.env.DB, auth.user.userId);
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
      id, user_id, household_id, workflow, amenity_type, date, slot,
      base_rate, duration_hours, day_multiplier, season_multiplier, resident_discount, amount,
      pricing_calculated_at, booking_status, event_type, purpose, attendee_count,
      created_at, created_by, created_ip, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    bookingId,
    customer.id,
    customer.household_id,
    'resident',
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
    'submitted', // unified start status
    data.data.event_type || null,
    data.data.purpose || null,
    data.data.attendee_count || null,
    now,
    auth.user.userId,
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
      id, customer_id, workflow, amenity_type, date, slot,
      base_rate, duration_hours, day_multiplier, season_multiplier, resident_discount, amount,
      pricing_calculated_at, booking_status, event_type, purpose, attendee_count,
      created_at, created_by_customer_id, created_ip, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    bookingId,
    customerId,
    'external',
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
    'submitted', // unified start status
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
  const bookings = (result.results || []).map((b: any) => ({
    ...b,
    reference_number: generateReferenceNumber(b),
  }));

  return c.json({
    data: {
      bookings,
      total: bookings.length,
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

  if (!auth.user && !auth.guest) {
    return c.json({ error: 'Authentication required' }, 401);
  }

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
 * Update booking status (admin/staff only) (legacy)
 */
bookingsRouter.put('/:id/status', async (c) => {
  const auth = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const normalizedBody = {
    ...body,
    status: (() => {
      const legacyMap: Record<string, string> = {
        inquiry_submitted: 'submitted',
        pending_approval: 'submitted',
        pending_resident: 'submitted',
        pending_payment: 'payment_due',
        awaiting_resident_payment: 'payment_due',
        pending_verification: 'payment_review',
      };
      return legacyMap[body?.status] || body?.status;
    })(),
  };
  const data = updateStatusSchema.safeParse(normalizedBody);

  if (!data.success) {
    return c.json({ error: 'Invalid input', details: data.error.flatten() }, 400);
  }

  const { status, rejection_reason, admin_notes } = data.data;

  // Check current status
  const currentBooking = await c.env.DB.prepare(
    'SELECT booking_status, amount, user_id, customer_id, amenity_type, date, slot FROM bookings WHERE id = ?'
  ).bind(id).first() as any;

  if (!currentBooking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  // Allow no-op updates (useful for UI retries / idempotency)
  if (currentBooking.booking_status === status) {
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
  }

  // Validate status transition
  const validTransitions: Record<string, string[]> = {
    submitted: ['payment_due', 'confirmed', 'rejected', 'cancelled'],
    payment_due: ['payment_review', 'cancelled'],
    payment_review: ['confirmed', 'payment_due', 'cancelled'],
    confirmed: ['cancelled', 'no_show'],
    rejected: [],
    cancelled: [],
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
         approved_at = CASE WHEN ? IN ('payment_due', 'confirmed') THEN datetime('now') ELSE approved_at END,
         approved_by = CASE WHEN ? IN ('payment_due', 'confirmed') THEN ? ELSE approved_by END,
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
 * POST /bookings/:id/action
 * Apply an explicit admin action (admin/staff only)
 */
bookingsRouter.post('/:id/action', async (c) => {
  const auth = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const data = bookingActionSchema.safeParse(body);

  if (!data.success) {
    return c.json({ error: 'Invalid input', details: data.error.flatten() }, 400);
  }

  const {
    action,
    payment_amount,
    payment_method,
    receipt_number,
    rejection_reason,
    admin_notes,
  } = data.data;

  const currentBooking = await c.env.DB.prepare(
    `SELECT
      booking_status,
      amount,
      amount_paid,
      payment_status,
      payment_method,
      receipt_number,
      proof_of_payment_url,
      amenity_type,
      date,
      slot
     FROM bookings
     WHERE id = ? AND deleted_at IS NULL`
  ).bind(id).first() as any;

  if (!currentBooking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  const fromStatus = currentBooking.booking_status as string;
  let nextStatus: string | null = null;
  let clearProofUrl = false;
  let nextAmountPaid: number = Number(currentBooking.amount_paid || 0);
  let nextPaymentStatus: string = (currentBooking.payment_status as string) || 'unpaid';
  let nextPaymentMethod: string | null = currentBooking.payment_method ?? null;
  let nextReceiptNumber: string | null = currentBooking.receipt_number ?? null;

  if (action === 'approve') {
    if (fromStatus !== 'submitted') {
      return c.json({ error: `Cannot approve from ${fromStatus}` }, 400);
    }
    nextStatus = (currentBooking.amount || 0) > 0 ? 'payment_due' : 'confirmed';
  } else if (action === 'confirm_payment') {
    if (fromStatus !== 'payment_review') {
      return c.json({ error: `Cannot confirm payment from ${fromStatus}` }, 400);
    }
    nextStatus = 'confirmed';
  } else if (action === 'record_payment') {
    if (fromStatus !== 'confirmed') {
      return c.json({ error: `Cannot record payment from ${fromStatus}` }, 400);
    }
    nextStatus = 'confirmed';
  } else if (action === 'request_new_proof') {
    if (fromStatus !== 'payment_review') {
      return c.json({ error: `Cannot request new proof from ${fromStatus}` }, 400);
    }
    nextStatus = 'payment_due';
    clearProofUrl = true;
  } else if (action === 'reject') {
    if (!['submitted', 'payment_due', 'payment_review'].includes(fromStatus)) {
      return c.json({ error: `Cannot reject from ${fromStatus}` }, 400);
    }
    nextStatus = 'rejected';
  } else if (action === 'mark_no_show') {
    if (fromStatus !== 'confirmed') {
      return c.json({ error: `Cannot mark no-show from ${fromStatus}` }, 400);
    }
    nextStatus = 'no_show';
  }

  if (!nextStatus) {
    return c.json({ error: 'Invalid action' }, 400);
  }

  const isPaymentAction = action === 'confirm_payment' || action === 'record_payment';
  if (isPaymentAction) {
    const totalAmount = Number(currentBooking.amount || 0);
    const alreadyPaid = Number(currentBooking.amount_paid || 0);
    const remaining = Math.max(0, totalAmount - alreadyPaid);

    const appliedPayment =
      typeof payment_amount === 'number'
        ? payment_amount
        : remaining; // default to "full remaining"

    if (appliedPayment < 0) {
      return c.json({ error: 'payment_amount must be >= 0' }, 400);
    }

    nextAmountPaid = Math.min(totalAmount, alreadyPaid + appliedPayment);

    if (nextAmountPaid <= 0) nextPaymentStatus = 'unpaid';
    else if (nextAmountPaid < totalAmount) nextPaymentStatus = 'partial';
    else nextPaymentStatus = 'paid';

    if (payment_method) nextPaymentMethod = payment_method;
    if (receipt_number) nextReceiptNumber = receipt_number;
  }

  await c.env.DB.prepare(
    `UPDATE bookings
     SET booking_status = ?,
         amount_paid = ?,
         payment_status = ?,
         payment_method = ?,
         receipt_number = ?,
         rejection_reason = ?,
         admin_notes = ?,
         proof_of_payment_url = CASE WHEN ? THEN NULL ELSE proof_of_payment_url END,
         approved_at = CASE WHEN ? IN ('payment_due', 'confirmed') THEN datetime('now') ELSE approved_at END,
         approved_by = CASE WHEN ? IN ('payment_due', 'confirmed') THEN ? ELSE approved_by END,
         updated_at = datetime('now'),
         updated_by = ?
     WHERE id = ?`
  ).bind(
    nextStatus,
    nextAmountPaid,
    nextPaymentStatus,
    nextPaymentMethod,
    nextReceiptNumber,
    nextStatus === 'rejected' ? (rejection_reason || 'No reason provided') : null,
    admin_notes || null,
    clearProofUrl ? 1 : 0,
    nextStatus,
    nextStatus,
    auth.userId,
    auth.userId,
    id
  ).run();

  if (nextStatus === 'confirmed' && fromStatus !== 'confirmed') {
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
      if (error.message.includes('UNIQUE constraint')) {
        await c.env.DB.prepare(
          `UPDATE bookings SET booking_status = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(fromStatus, id).run();

        return c.json({
          error: 'Slot is no longer available (already booked)',
          conflict: true,
        }, 409);
      }
      throw error;
    }
  }

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

  return c.json({
    data: {
      booking,
      transition: { from: fromStatus, to: nextStatus, action },
    },
  });
});

/**
 * PUT /bookings/:id/cancel
 * Cancel booking (owner only)
 */
bookingsRouter.put('/:id/cancel', async (c) => {
  const auth = await getAuthOrGuest(c.req.raw, c.env);
  const id = c.req.param('id');

  if (!auth.user && !auth.guest) {
    return c.json({ error: 'Authentication required' }, 401);
  }

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
 * DELETE /bookings/:id
 * Soft-delete booking (admin/staff only)
 */
bookingsRouter.delete('/:id', async (c) => {
  const auth = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  const booking = await c.env.DB.prepare(
    'SELECT booking_status, deleted_at FROM bookings WHERE id = ?'
  ).bind(id).first() as any;

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  if (booking.deleted_at) {
    return c.json({ success: true, already_deleted: true });
  }

  await c.env.DB.prepare(
    `UPDATE bookings
     SET deleted_at = datetime('now'),
         deleted_by = ?,
         updated_at = datetime('now'),
         updated_by = ?
     WHERE id = ?`
  ).bind(auth.userId, auth.userId, id).run();

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

  if (!auth.user && !auth.guest) {
    return c.json({ error: 'Authentication required' }, 401);
  }

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

  if (booking.booking_status !== 'payment_due') {
    return c.json({ error: 'Payment proof can only be uploaded when payment is due' }, 400);
  }

  // Update booking
  await c.env.DB.prepare(
    `UPDATE bookings
     SET proof_of_payment_url = ?,
         booking_status = 'payment_review',
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
 * POST /bookings/:id/proof-file
 * Upload payment proof file (owner/admin/staff)
 */
bookingsRouter.post('/:id/proof-file', async (c) => {
  const auth = await getAuthOrGuest(c.req.raw, c.env);
  const id = c.req.param('id');

  if (!auth.user && !auth.guest) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const booking = await c.env.DB.prepare(
    'SELECT booking_status, customer_id, user_id FROM bookings WHERE id = ? AND deleted_at IS NULL'
  ).bind(id).first() as any;

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  const isAdmin = auth.user?.role === 'admin' || auth.user?.role === 'staff';
  const isOwner = auth.user?.userId === booking.user_id;
  const isGuestOwner = auth.guest?.customerId === booking.customer_id;

  if (!isAdmin && !isOwner && !isGuestOwner) {
    return c.json({ error: 'Access denied' }, 403);
  }

  if (booking.booking_status !== 'payment_due') {
    return c.json({ error: 'Payment proof can only be uploaded when payment is due' }, 400);
  }

  const form = await c.req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return c.json({ error: 'file is required' }, 400);
  }

  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'File size must be less than 5MB' }, 400);
  }

  const ext = (() => {
    const name = file.name || '';
    const dot = name.lastIndexOf('.');
    if (dot === -1) return '';
    return name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '');
  })();

  const objectKey = `booking-proofs/${id}/${crypto.randomUUID()}${ext}`;
  const contentType = file.type || 'application/octet-stream';

  await c.env.R2.put(objectKey, file.stream(), {
    httpMetadata: { contentType },
    customMetadata: {
      filename: file.name || 'payment-proof',
      uploaded_by: auth.user?.userId || auth.guest?.customerId || 'unknown',
    },
  });

  await c.env.DB.prepare(
    `UPDATE bookings
     SET proof_of_payment_url = ?,
         booking_status = 'payment_review',
         updated_at = datetime('now')
     WHERE id = ?`
  ).bind(objectKey, id).run();

  return c.json({ success: true });
});

/**
 * GET /bookings/:id/proof
 * Download/view payment proof (admin/staff only)
 */
bookingsRouter.get('/:id/proof', async (c) => {
  const auth = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);

  if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const booking = await c.env.DB.prepare(
    'SELECT proof_of_payment_url FROM bookings WHERE id = ? AND deleted_at IS NULL'
  ).bind(id).first() as any;

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  const key = booking.proof_of_payment_url as string | null;
  if (!key) {
    return c.json({ error: 'No payment proof uploaded' }, 404);
  }

  const obj = await c.env.R2.get(key);
  if (!obj) {
    return c.json({ error: 'Payment proof missing from storage' }, 404);
  }

  const filename =
    obj.customMetadata?.filename ||
    `payment-proof-${id}`;
  const safeFilename = filename.replace(/[^\w.\- ()]/g, '_');

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Content-Disposition', `inline; filename="${safeFilename}"`);

  return new Response(obj.body, { headers });
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
