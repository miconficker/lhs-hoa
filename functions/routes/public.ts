import { Hono } from 'hono';
import { z } from 'zod';
import { applyCascadingBlockLogic } from '../lib/slot-availability';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '../lib/rate-limit';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
};

export const publicRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const bookingRequestSchema = z.object({
  amenity_type: z.enum(['clubhouse', 'pool']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(['AM', 'PM', 'FULL_DAY']),
  guest_first_name: z.string().min(1),
  guest_last_name: z.string().min(1),
  guest_email: z.string().email(),
  guest_phone: z.string().min(10).optional(), // Phone can be optional
  event_type: z.enum(['wedding', 'birthday', 'meeting', 'sports', 'other']),
  attendees: z.number().int().positive().max(500),
  // Purpose is optional; allow null for older clients.
  purpose: z.string().nullable().optional(),
  proof_of_payment_url: z.string().optional(),
});

const proofUploadSchema = z.object({
  proof_url: z.string().url(),
});

// Helper: Calculate IP retention date (90 days from now)
function getIPRetentionDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return date.toISOString().split('T')[0];
}

// Helper: Format time as "8:23 AM" or "2:15 PM"
function formatTimeOfDay(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// GET /api/public/amenities - List bookable amenities
publicRouter.get('/amenities', async (c) => {
  const amenities = [
    { amenity_type: 'clubhouse', name: 'Clubhouse', description: 'Perfect for weddings, parties, and meetings', capacity: 100, image: '/images/clubhouse.jpg' },
    { amenity_type: 'pool', name: 'Swimming Pool', description: 'Olympic-sized pool with kiddie area', capacity: 50, image: '/images/pool.jpg' },
  ];

  return c.json({ amenities });
});

// GET /api/public/availability/:amenityType - Check availability
publicRouter.get('/availability/:amenityType', async (c) => {
  const amenityType = c.req.param('amenityType');
  const startDate = c.req.query('start') || new Date().toISOString().split('T')[0];
  const endDate = c.req.query('end') || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const blockedSet = new Set<string>();

  // Get confirmed bookings from unified bookings table
  try {
    const confirmedBookings = await c.env.DB.prepare(
      `SELECT date, slot FROM bookings
       WHERE amenity_type = ? AND date BETWEEN ? AND ?
       AND booking_status = 'confirmed'
       AND deleted_at IS NULL`
    ).bind(amenityType, startDate, endDate).all();

    for (const b of (confirmedBookings.results || [])) {
      blockedSet.add(`${b.date}-${b.slot}`);
    }
  } catch (e) {
    console.warn('bookings table not available:', e);
  }

  // Get amenity closures
  try {
    const closures = await c.env.DB.prepare(
      `SELECT date, slot FROM amenity_closures
       WHERE amenity_type = ? AND date BETWEEN ? AND ?`
    ).bind(amenityType, startDate, endDate).all();

    for (const cl of (closures.results || [])) {
      blockedSet.add(`${cl.date}-${cl.slot}`);
    }
  } catch (e) {
    console.warn('amenity_closures table not available:', e);
  }

  // Organize blocked slots by date
  const blockedByDate = new Map<string, Set<string>>();
  for (const blocked of blockedSet) {
    const [date, slot] = blocked.split('-');
    if (!blockedByDate.has(date)) {
      blockedByDate.set(date, new Set());
    }
    blockedByDate.get(date)!.add(slot);
  }

  // Generate available dates
  const available: any[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const blockedSlots = blockedByDate.get(dateStr) || new Set();
    const cascadedBlocked = applyCascadingBlockLogic(blockedSlots);

    const slots = ['AM', 'PM', 'FULL_DAY'].filter(slot => !cascadedBlocked.has(slot));

    if (slots.length > 0) {
      available.push({ date: dateStr, available_slots: slots });
    }

    current.setDate(current.getDate() + 1);
  }

  return c.json({ available });
});

// GET /api/public/pricing/:amenityType - Get pricing with multipliers
publicRouter.get('/pricing/:amenityType', async (c) => {
  const amenityType = c.req.param('amenityType');
  const date = c.req.query('date');
  const slot = c.req.query('slot') || 'FULL_DAY';
  const isResident = c.req.query('resident') === 'true';

  if (!date) {
    return c.json({ error: 'Date parameter required' }, 400);
  }

  // Get base rate
  const baseRateResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = ?`
  ).bind(`external_pricing_${amenityType}_hourly`).first();

  const baseRate = parseFloat(baseRateResult?.setting_value as string) || 500;

  // Get day multipliers
  const dayMultipliersResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_day_multipliers'`
  ).first();

  const dayMultipliers = JSON.parse(dayMultipliersResult?.setting_value as string || '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}');

  // Get season multipliers
  const seasonMultipliersResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_season_multipliers'`
  ).first();

  const seasonMultipliers = JSON.parse(seasonMultipliersResult?.setting_value as string || '{"peak": 1.3, "off_peak": 1.0}');

  // Get peak months
  const peakMonthsResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_peak_months'`
  ).first();

  const peakMonths = (peakMonthsResult?.setting_value as string || '12,1,2,3,4,5').split(',').map(Number);

  // Get holidays
  const holidaysResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_holidays_2026'`
  ).first();

  const holidays = (holidaysResult?.setting_value as string || '').split(',').map(s => s.trim());

  // Calculate multipliers
  const bookingDate = new Date(date);
  const dayOfWeek = bookingDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = holidays.includes(date);
  const month = bookingDate.getMonth() + 1;
  const isPeak = peakMonths.includes(month);

  let dayMultiplier = dayMultipliers.weekday;
  if (isHoliday) dayMultiplier = dayMultipliers.holiday;
  else if (isWeekend) dayMultiplier = dayMultipliers.weekend;

  const seasonMultiplier = isPeak ? seasonMultipliers.peak : seasonMultipliers.off_peak;

  // Calculate duration
  const durations: Record<string, number> = { AM: 4, PM: 4, FULL_DAY: 9 };
  const duration = durations[slot] || 9;

  // Calculate total
  const total = baseRate * duration * dayMultiplier * seasonMultiplier;

  // Apply resident discount if applicable
  const discountResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_resident_discount_percent'`
  ).first();

  const discountPercent = parseFloat(discountResult?.setting_value as string || '0.50');
  const finalPrice = isResident ? total * (1 - discountPercent) : total;

  return c.json({
    base_rate: baseRate,
    duration,
    day_type: isHoliday ? 'holiday' : isWeekend ? 'weekend' : 'weekday',
    day_multiplier: dayMultiplier,
    season_type: isPeak ? 'peak' : 'off_peak',
    season_multiplier: seasonMultiplier,
    subtotal: total,
    resident_discount: isResident ? discountPercent : 0,
    final_price: Math.round(finalPrice),
  });
});

// GET /api/public/payment-details - Get payment info
publicRouter.get('/payment-details', async (c) => {
  const gcashNumber = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'payment_gcash_number'`
  ).first();

  const gcashName = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'payment_gcash_name'`
  ).first();

  const bankName = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'payment_bank_name'`
  ).first();

  const accountName = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'payment_account_name'`
  ).first();

  const accountNumber = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'payment_account_number'`
  ).first();

  return c.json({
    gcash: {
      number: gcashNumber?.setting_value || '0917-XXX-XXXX',
      name: gcashName?.setting_value || 'Laguna Hills HOA',
    },
    bank_transfer: {
      bank_name: bankName?.setting_value || 'BPI',
      account_name: accountName?.setting_value || 'Laguna Hills HOA Association',
      account_number: accountNumber?.setting_value || 'XXXX-XXXX-XXXX',
    }
  });
});

// POST /api/public/inquiries - Submit inquiry (creates customer + booking with status: "submitted")
publicRouter.post('/inquiries', async (c) => {
  // Rate limit check (max 3 inquiries per hour per IP)
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(c.env.DB, clientIp, { maxRequests: 3, windowSeconds: 3600 });

  if (!rateLimitResult.allowed) {
    return c.json({ error: 'Too many inquiry attempts. Please try again later.' }, 429);
  }

  const body = await c.req.json();
  const result = bookingRequestSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const data = result.data;

  // Calculate pricing (same as booking flow)
  const pricingResponse = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_${data.amenity_type}_hourly'`
  ).first();

  const baseRate = parseFloat(pricingResponse?.setting_value as string) || 500;
  const durations: Record<string, number> = { AM: 4, PM: 4, FULL_DAY: 9 };

  // Get day multipliers for accurate pricing
  const dayMultipliersResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_day_multipliers'`
  ).first();
  const dayMultipliers = JSON.parse(dayMultipliersResult?.setting_value as string || '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}');

  // Get season multipliers
  const seasonMultipliersResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_season_multipliers'`
  ).first();
  const seasonMultipliers = JSON.parse(seasonMultipliersResult?.setting_value as string || '{"peak": 1.3, "off_peak": 1.0}');

  // Get peak months
  const peakMonthsResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_peak_months'`
  ).first();
  const peakMonths = (peakMonthsResult?.setting_value as string || '12,1,2,3,4,5').split(',').map(Number);

  // Get holidays
  const holidaysResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_holidays_2026'`
  ).first();
  const holidays = (holidaysResult?.setting_value as string || '').split(',').map(s => s.trim());

  // Calculate multipliers
  const bookingDate = new Date(data.date);
  const dayOfWeek = bookingDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = holidays.includes(data.date);
  const month = bookingDate.getMonth() + 1;
  const isPeak = peakMonths.includes(month);

  let dayMultiplier = dayMultipliers.weekday;
  if (isHoliday) dayMultiplier = dayMultipliers.holiday;
  else if (isWeekend) dayMultiplier = dayMultipliers.weekend;

  const seasonMultiplier = isPeak ? seasonMultipliers.peak : seasonMultipliers.off_peak;
  const duration = durations[data.slot] || 9;
  const amount = Math.round(baseRate * duration * dayMultiplier * seasonMultiplier);

  // Generate IDs and reference number
  const customerId = crypto.randomUUID();
  const bookingId = crypto.randomUUID();
  const now = new Date();
  const nowStr = now.toISOString();
  const refNum = `EXT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

  // Get client IP
  const clientIP = getClientIp(c.req.raw);

  // First, create or find customer
  // Check if customer exists by email
  let existingCustomer = await c.env.DB.prepare(
    'SELECT id FROM customers WHERE email = ?'
  ).bind(data.guest_email).first();

  let finalCustomerId = customerId;
  if (existingCustomer) {
    finalCustomerId = existingCustomer.id as string;
    // Update existing customer's last_booking_at
    await c.env.DB.prepare(
      'UPDATE customers SET updated_at = ?, last_booking_at = ? WHERE id = ?'
    ).bind(nowStr, nowStr, finalCustomerId).run();
  } else {
    // Create new customer
    await c.env.DB.prepare(
      `INSERT INTO customers (id, first_name, last_name, email, phone, guest_notes, created_at, updated_at, created_ip, ip_retained_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      finalCustomerId,
      data.guest_first_name,
      data.guest_last_name,
      data.guest_email,
      data.guest_phone,
      data.purpose || null,
      nowStr,
      nowStr,
      clientIP,
      getIPRetentionDate()
    ).run();
  }

  // Create booking
  await c.env.DB.prepare(
    `INSERT INTO bookings (
      id, customer_id, workflow, amenity_type, date, slot,
      base_rate, duration_hours, day_multiplier, season_multiplier, amount, pricing_calculated_at,
      booking_status, event_type, purpose, attendee_count,
      created_at, created_by_customer_id, created_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    bookingId,
    finalCustomerId,
    'external',
    data.amenity_type,
    data.date,
    data.slot,
    baseRate,
    duration,
    dayMultiplier,
    seasonMultiplier,
    amount,
    nowStr,
    'submitted',
    data.event_type,
    data.purpose || null,
    data.attendees,
    nowStr,
    finalCustomerId,
    clientIP
  ).run();

  // Fetch created booking with customer info
  const booking = await c.env.DB.prepare(
    `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
     FROM bookings b
     JOIN customers c ON b.customer_id = c.id
     WHERE b.id = ?`
  ).bind(bookingId).first();

  return c.json({
    data: {
      inquiry: {
        id: booking?.id,
        reference_number: refNum,
        amenity_type: booking?.amenity_type,
        date: booking?.date,
        slot: booking?.slot,
        amount: booking?.amount,
        booking_status: booking?.booking_status,
        guest_first_name: booking?.first_name,
        guest_last_name: booking?.last_name,
        guest_email: booking?.email,
        guest_phone: booking?.phone,
        guest_notes: booking?.purpose,
        created_at: booking?.created_at,
        time_of_day: formatTimeOfDay(booking?.created_at as string),
      }
    }
  }, 201);
});

// GET /api/public/inquiries/:id/status - Check inquiry/booking status
publicRouter.get('/inquiries/:id/status', async (c) => {
  const id = c.req.param('id');

  const booking = await c.env.DB.prepare(
    `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
     FROM bookings b
     JOIN customers c ON b.customer_id = c.id
     WHERE b.id = ? AND b.deleted_at IS NULL`
  ).bind(id).first();

  if (!booking) {
    return c.json({ error: 'Inquiry not found' }, 404);
  }

  // Generate reference number
  const createdDate = new Date(booking.created_at as string);
  const refNum = `EXT-${createdDate.getFullYear()}${String(createdDate.getMonth() + 1).padStart(2, '0')}${String(createdDate.getDate()).padStart(2, '0')}-${booking.id.slice(-3)}`;

  // Map status to user-friendly message
  const statusMessages: Record<string, string> = {
    submitted: 'Your request is being reviewed.',
    payment_due: 'Approved! Please complete your payment to confirm your booking.',
    payment_review: 'Payment received. Your booking is being verified.',
    confirmed: 'Your booking is confirmed!',
    rejected: 'Your inquiry has been rejected.',
    cancelled: 'Your booking has been cancelled.',
  };

  // Determine next action based on status
  const nextActions: Record<string, { action: string; link?: string }> = {
    submitted: { action: 'Wait for approval' },
    payment_due: { action: 'Complete payment', link: `/external-rentals/inquiry/${id}/payment` },
    payment_review: { action: 'Wait for verification' },
    confirmed: { action: 'View booking details', link: `/external-rentals/confirmation/${id}` },
    rejected: { action: 'Submit new inquiry', link: '/external-rentals' },
    cancelled: { action: 'Submit new inquiry', link: '/external-rentals' },
  };

  return c.json({
    data: {
      inquiry: {
        id: booking.id,
        reference_number: refNum,
        amenity_type: booking.amenity_type,
        date: booking.date,
        slot: booking.slot,
        amount: booking.amount,
        booking_status: booking.booking_status,
        guest_first_name: booking.first_name,
        guest_last_name: booking.last_name,
        guest_email: booking.email,
        guest_phone: booking.phone,
        guest_notes: booking.purpose,
        rejection_reason: booking.rejection_reason,
        admin_notes: booking.admin_notes,
        created_at: booking.created_at,
      },
      status_message: statusMessages[booking.booking_status as string] || 'Unknown status',
      next_action: nextActions[booking.booking_status as string] || { action: 'Contact support' },
    }
  });
});

// POST /api/public/bookings - Create booking request (direct booking, not inquiry)
publicRouter.post('/bookings', async (c) => {
  // Rate limit check (max 3 bookings per hour per IP)
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(c.env.DB, clientIp, { maxRequests: 3, windowSeconds: 3600 });

  if (!rateLimitResult.allowed) {
    return c.json({ error: 'Too many booking attempts. Please try again later.' }, 429);
  }

  const body = await c.req.json();
  const result = bookingRequestSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const data = result.data;

  // Check if slot is actually available (confirmed bookings only)
  const blocked = await c.env.DB.prepare(
    `SELECT id FROM bookings
     WHERE amenity_type = ? AND date = ? AND slot = ?
     AND booking_status = 'confirmed'
     AND deleted_at IS NULL`
  ).bind(data.amenity_type, data.date, data.slot).first();

  if (blocked) {
    return c.json({ error: 'This time slot is already booked.' }, 409);
  }

  // Check amenity closures
  const closure = await c.env.DB.prepare(
    `SELECT id FROM amenity_closures
     WHERE amenity_type = ? AND date = ? AND slot = ?`
  ).bind(data.amenity_type, data.date, data.slot).first();

  if (closure) {
    return c.json({ error: 'This time slot is blocked.' }, 409);
  }

  // Calculate pricing
  const pricingResponse = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_${data.amenity_type}_hourly'`
  ).first();

  const baseRate = parseFloat(pricingResponse?.setting_value as string) || 500;
  const durations: Record<string, number> = { AM: 4, PM: 4, FULL_DAY: 9 };

  // Get day multipliers for accurate pricing
  const dayMultipliersResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_day_multipliers'`
  ).first();
  const dayMultipliers = JSON.parse(dayMultipliersResult?.setting_value as string || '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}');

  // Get season multipliers
  const seasonMultipliersResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_season_multipliers'`
  ).first();
  const seasonMultipliers = JSON.parse(seasonMultipliersResult?.setting_value as string || '{"peak": 1.3, "off_peak": 1.0}');

  // Get peak months
  const peakMonthsResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_peak_months'`
  ).first();
  const peakMonths = (peakMonthsResult?.setting_value as string || '12,1,2,3,4,5').split(',').map(Number);

  // Get holidays
  const holidaysResult = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_holidays_2026'`
  ).first();
  const holidays = (holidaysResult?.setting_value as string || '').split(',').map(s => s.trim());

  // Calculate multipliers
  const bookingDate = new Date(data.date);
  const dayOfWeek = bookingDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = holidays.includes(data.date);
  const month = bookingDate.getMonth() + 1;
  const isPeak = peakMonths.includes(month);

  let dayMultiplier = dayMultipliers.weekday;
  if (isHoliday) dayMultiplier = dayMultipliers.holiday;
  else if (isWeekend) dayMultiplier = dayMultipliers.weekend;

  const seasonMultiplier = isPeak ? seasonMultipliers.peak : seasonMultipliers.off_peak;
  const duration = durations[data.slot] || 9;
  const amount = Math.round(baseRate * duration * dayMultiplier * seasonMultiplier);

  // Generate IDs and reference number
  const customerId = crypto.randomUUID();
  const bookingId = crypto.randomUUID();
  const now = new Date();
  const nowStr = now.toISOString();
  const refNum = `EXT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

  // Get client IP
  const clientIP = getClientIp(c.req.raw);

  // First, create or find customer
  // Check if customer exists by email
  let existingCustomer = await c.env.DB.prepare(
    'SELECT id FROM customers WHERE email = ?'
  ).bind(data.guest_email).first();

  let finalCustomerId = customerId;
  if (existingCustomer) {
    finalCustomerId = existingCustomer.id as string;
    // Update existing customer's last_booking_at
    await c.env.DB.prepare(
      'UPDATE customers SET updated_at = ?, last_booking_at = ? WHERE id = ?'
    ).bind(nowStr, nowStr, finalCustomerId).run();
  } else {
    // Create new customer
    await c.env.DB.prepare(
      `INSERT INTO customers (id, first_name, last_name, email, phone, guest_notes, created_at, updated_at, created_ip, ip_retained_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      finalCustomerId,
      data.guest_first_name,
      data.guest_last_name,
      data.guest_email,
      data.guest_phone,
      data.purpose || null,
      nowStr,
      nowStr,
      clientIP,
      getIPRetentionDate()
    ).run();
  }

  // Create booking with status payment_due (direct booking flow)
  await c.env.DB.prepare(
    `INSERT INTO bookings (
      id, customer_id, workflow, amenity_type, date, slot,
      base_rate, duration_hours, day_multiplier, season_multiplier, amount, pricing_calculated_at,
      payment_status, proof_of_payment_url,
      booking_status, event_type, purpose, attendee_count,
      created_at, created_by_customer_id, created_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    bookingId,
    finalCustomerId,
    'external',
    data.amenity_type,
    data.date,
    data.slot,
    baseRate,
    duration,
    dayMultiplier,
    seasonMultiplier,
    amount,
    nowStr,
    data.proof_of_payment_url || null,
    'payment_due',
    data.event_type,
    data.purpose || null,
    data.attendees,
    nowStr,
    finalCustomerId,
    clientIP
  ).run();

  // Fetch created booking with customer info
  const booking = await c.env.DB.prepare(
    `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
     FROM bookings b
     JOIN customers c ON b.customer_id = c.id
     WHERE b.id = ?`
  ).bind(bookingId).first();

  return c.json({
    data: {
      booking: {
        id: booking?.id,
        reference_number: refNum,
        amenity_type: booking?.amenity_type,
        date: booking?.date,
        slot: booking?.slot,
        amount: booking?.amount,
        booking_status: booking?.booking_status,
        guest_first_name: booking?.first_name,
        guest_last_name: booking?.last_name,
        guest_email: booking?.email,
        guest_phone: booking?.phone,
        guest_notes: booking?.purpose,
        created_at: booking?.created_at,
        time_of_day: formatTimeOfDay(booking?.created_at as string),
      }
    }
  }, 201);
});

// POST /api/public/bookings/:id/proof - Upload payment proof
publicRouter.post('/bookings/:id/proof', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = proofUploadSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  const proofUrl = result.data.proof_url;
  const verificationToken = body.verification_token as string | undefined;

  // Verify ownership if token is provided
  if (verificationToken) {
    const verifiedBookingId = await verifyToken(c.env.DB, verificationToken);
    if (!verifiedBookingId || verifiedBookingId !== id) {
      return c.json({
        error: 'Invalid or expired verification token. Please verify again.'
      }, 401);
    }
  }

  // Check if booking exists
  const booking = await c.env.DB.prepare(
    'SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL'
  ).bind(id).first();

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  if (booking.booking_status === 'confirmed') {
    return c.json({ error: 'Booking is already confirmed' }, 400);
  }

  if (booking.booking_status === 'rejected') {
    return c.json({ error: 'Booking has been rejected' }, 400);
  }

  // Only allow proof upload for payment_due status
  if (booking.booking_status !== 'payment_due') {
    return c.json({
      error: 'Payment proof can only be uploaded after approval',
      current_status: booking.booking_status
    }, 400);
  }

  // Update booking
  await c.env.DB.prepare(
    `UPDATE bookings
     SET proof_of_payment_url = ?, booking_status = 'payment_review', updated_at = datetime('now')
     WHERE id = ?`
  ).bind(proofUrl, id).run();

  const updated = await c.env.DB.prepare(
    'SELECT * FROM bookings WHERE id = ?'
  ).bind(id).first();

  return c.json({ data: { booking: updated } });
});

// POST /api/public/bookings/:id/proof-file - Upload payment proof file
publicRouter.post('/bookings/:id/proof-file', async (c) => {
  const id = c.req.param('id');

  const form = await c.req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return c.json({ error: 'file is required' }, 400);
  }

  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'File size must be less than 5MB' }, 400);
  }

  // Check if booking exists
  const booking = await c.env.DB.prepare(
    'SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL'
  ).bind(id).first() as any;

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  if (booking.booking_status === 'confirmed') {
    return c.json({ error: 'Booking is already confirmed' }, 400);
  }

  if (booking.booking_status === 'rejected') {
    return c.json({ error: 'Booking has been rejected' }, 400);
  }

  // Only allow proof upload for payment_due status
  if (booking.booking_status !== 'payment_due') {
    return c.json({
      error: 'Payment proof can only be uploaded after approval',
      current_status: booking.booking_status
    }, 400);
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
      uploaded_via: 'public',
    },
  });

  // Update booking
  await c.env.DB.prepare(
    `UPDATE bookings
     SET proof_of_payment_url = ?, booking_status = 'payment_review', updated_at = datetime('now')
     WHERE id = ?`
  ).bind(objectKey, id).run();

  const updated = await c.env.DB.prepare(
    'SELECT * FROM bookings WHERE id = ?'
  ).bind(id).first();

  return c.json({ data: { booking: updated } });
});

// GET /api/public/bookings/:id/status - Check booking status
publicRouter.get('/bookings/:id/status', async (c) => {
  const id = c.req.param('id');

  const booking = await c.env.DB.prepare(
    `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
     FROM bookings b
     JOIN customers c ON b.customer_id = c.id
     WHERE b.id = ? AND b.deleted_at IS NULL`
  ).bind(id).first();

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  const createdDate = new Date(booking.created_at as string);
  const refNum = `EXT-${createdDate.getFullYear()}${String(createdDate.getMonth() + 1).padStart(2, '0')}${String(createdDate.getDate()).padStart(2, '0')}-${id.slice(-3)}`;

  return c.json({
    data: {
      booking: {
        id: booking.id,
        reference_number: refNum,
        status: booking.booking_status,
        amenity_type: booking.amenity_type,
        date: booking.date,
        slot: booking.slot,
        amount: booking.amount,
        rejection_reason: booking.rejection_reason,
        admin_notes: booking.admin_notes,
        time_of_day: formatTimeOfDay(booking.created_at as string),
        guest_first_name: booking.first_name,
        guest_last_name: booking.last_name,
        guest_email: booking.email,
        guest_phone: booking.phone,
      }
    }
  });
});

// GET /api/public/status/:identifier - Get booking status by UUID or reference number
// This is a public endpoint for checking status without authentication
publicRouter.get('/status/:identifier', async (c) => {
  const identifier = c.req.param('identifier');

  // Try to find by ID first (UUID), then by reference number
  let booking = await c.env.DB.prepare(
    `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
     FROM bookings b
     JOIN customers c ON b.customer_id = c.id
     WHERE b.id = ? AND b.deleted_at IS NULL`
  ).bind(identifier).first();

  // If not found by ID, try to find by reference number pattern
  if (!booking && identifier.startsWith('EXT-')) {
    // Reference number format: EXT-YYYYMMDD-XXX
    // Extract date part and search
    const match = identifier.match(/^EXT-(\d{4})(\d{2})(\d{2})-([a-zA-Z0-9]{3})$/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // 0-indexed
      const day = parseInt(match[3]);
      const suffix = match[4].toLowerCase();

      // Create date range for the query
      const startDate = new Date(year, month, day);
      const endDate = new Date(year, month, day + 1);

      // Query for bookings created on that date
      const bookings = await c.env.DB.prepare(
        `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
         FROM bookings b
         JOIN customers c ON b.customer_id = c.id
         WHERE b.created_at >= ? AND b.created_at < ? AND b.deleted_at IS NULL
         ORDER BY b.created_at ASC`
      ).bind(startDate.toISOString(), endDate.toISOString()).all();

      // Find the booking that matches the reference number suffix
      // The suffix is the last 3 characters of the booking ID
      for (const b of (bookings.results || [])) {
        const bookingId = b.id as string;
        if (bookingId.slice(-3).toLowerCase() === suffix) {
          booking = b;
          break;
        }
      }
    }
  }

  if (!booking) {
    return c.json({ error: 'Booking not found. Please check your reference number.' }, 404);
  }

  // Generate reference number
  const createdDate = new Date(booking.created_at as string);
  const refNum = `EXT-${createdDate.getFullYear()}${String(createdDate.getMonth() + 1).padStart(2, '0')}${String(createdDate.getDate()).padStart(2, '0')}-${(booking.id as string).slice(-3)}`;

  // Map status to phase information
  const phaseMap: Record<string, { phase: number; phase_name: string; description: string; next_step: string }> = {
    submitted: {
      phase: 1,
      phase_name: 'Submitted',
      description: 'Your request has been submitted successfully. Our team will review it shortly.',
      next_step: 'Wait for approval. You\'ll receive an update within 24-48 hours.'
    },
    payment_due: {
      phase: 2,
      phase_name: 'Payment Required',
      description: 'Your request has been approved! Please complete your payment to confirm your booking.',
      next_step: 'Upload proof of payment via the link provided, or contact admin for assistance.'
    },
    payment_review: {
      phase: 3,
      phase_name: 'Verifying Payment',
      description: 'Payment received! Our team is verifying your payment proof.',
      next_step: 'We\'ll confirm your booking within 24-48 hours after verification.'
    },
    confirmed: {
      phase: 4,
      phase_name: 'Confirmed',
      description: 'Your booking has been confirmed! We look forward to hosting you.',
      next_step: 'Arrive 15 minutes before your scheduled time. Present your booking confirmation upon arrival.'
    },
    rejected: {
      phase: 0,
      phase_name: 'Rejected',
      description: 'Your request has been declined. This may be due to availability or other reasons.',
      next_step: 'You can submit a new request with different dates or contact us for more information.'
    },
    cancelled: {
      phase: 0,
      phase_name: 'Cancelled',
      description: 'This booking has been cancelled.',
      next_step: 'You can submit a new request if you\'d like to book again.'
    }
  };

  const status = booking.booking_status as string;
  const phaseInfo = phaseMap[status] || phaseMap.submitted;

  return c.json({
    data: {
      booking: {
        id: booking.id,
        reference_number: refNum,
        amenity_type: booking.amenity_type,
        date: booking.date,
        slot: booking.slot,
        amount: booking.amount,
        booking_status: booking.booking_status,
        created_at: booking.created_at,
        guest_first_name: booking.first_name,
        guest_last_name: booking.last_name,
        guest_email: booking.email,
        guest_phone: booking.phone,
      },
      phase: phaseInfo.phase,
      phase_name: phaseInfo.phase_name,
      description: phaseInfo.description,
      next_step: phaseInfo.next_step,
      is_rejected: status === 'rejected',
      is_cancelled: status === 'cancelled',
    }
  });
});

// Helper: Generate a short-lived verification token
function generateVerificationToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Store verification token with 15-minute expiry
async function storeVerificationToken(
  db: D1Database,
  bookingId: string,
  token: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await db.prepare(
    `INSERT INTO verification_tokens (token, booking_id, expires_at)
     VALUES (?, ?, ?)`
  ).bind(token, bookingId, expiresAt.toISOString()).run();
}

// Helper: Verify token and get booking ID
async function verifyToken(
  db: D1Database,
  token: string
): Promise<string | null> {
  const result = await db.prepare(
    `SELECT booking_id FROM verification_tokens
     WHERE token = ? AND expires_at > datetime('now')
     LIMIT 1`
  ).bind(token).first();

  if (result) {
    // Delete used token
    await db.prepare('DELETE FROM verification_tokens WHERE token = ?')
      .bind(token).run();
    return result.booking_id as string;
  }
  return null;
}

// Helper: Mask email address (show first character and domain)
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local[0]}***@${domain}`;
}

// Helper: Mask phone number (show last 5 digits)
function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 5) return phone;
  const visible = cleaned.slice(-5);
  const hidden = cleaned.slice(0, -5).replace(/\d/g, '*');
  return `+63${hidden}${visible}`;
}

// Verification schema
const verifyOwnershipSchema = z.object({
  email_or_phone: z.string().min(1),
});

// POST /api/public/bookings/:id/verify - Verify ownership before proof upload
publicRouter.post('/bookings/:id/verify', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = verifyOwnershipSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  const emailOrPhone = result.data.email_or_phone.trim();

  // Check if booking exists
  const booking = await c.env.DB.prepare(
    `SELECT b.*, c.email, c.phone
     FROM bookings b
     JOIN customers c ON b.customer_id = c.id
     WHERE b.id = ? AND b.deleted_at IS NULL`
  ).bind(id).first();

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  // Verify ownership by matching email or phone
  const guestEmail = booking.email as string;
  const guestPhone = booking.phone as string;

  const isEmailMatch = emailOrPhone.toLowerCase() === guestEmail.toLowerCase();
  const isPhoneMatch = emailOrPhone.replace(/\D/g, '') === guestPhone.replace(/\D/g, '');

  if (!isEmailMatch && !isPhoneMatch) {
    return c.json({
      error: 'The email or phone number doesn\'t match our records.'
    }, 400);
  }

  // Generate and store verification token
  const token = generateVerificationToken();
  await storeVerificationToken(c.env.DB, id, token);

  return c.json({
    data: {
      verified: true,
      token: token,
      masked_email: maskEmail(guestEmail),
      masked_phone: maskPhone(guestPhone),
    }
  });
});
