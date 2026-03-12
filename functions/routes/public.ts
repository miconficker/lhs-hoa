import { Hono } from 'hono';
import { z } from 'zod';
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
  guest_name: z.string().min(1),
  guest_email: z.string().email(),
  guest_phone: z.string().min(10),
  event_type: z.enum(['wedding', 'birthday', 'meeting', 'sports', 'other']),
  attendees: z.number().int().positive().max(500),
  purpose: z.string().min(10),
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

  // Get blocked dates (confirmed bookings only) - handle missing table gracefully
  try {
    const blockedDates = await c.env.DB.prepare(
      `SELECT booking_date, slot FROM booking_blocked_dates
       WHERE amenity_type = ? AND booking_date BETWEEN ? AND ?`
    ).bind(amenityType, startDate, endDate).all();

    for (const d of (blockedDates.results || [])) {
      blockedSet.add(`${d.booking_date}-${d.slot}`);
    }
  } catch (e) {
    // Table might not exist yet - continue with empty blocked set
    console.warn('booking_blocked_dates table not available:', e);
  }

  // Check resident reservations - handle missing table gracefully
  try {
    const residentBlocked = await c.env.DB.prepare(
      `SELECT date, slot FROM reservations
       WHERE amenity_type = ? AND date BETWEEN ? AND ?
       AND status != 'cancelled'`
    ).bind(amenityType, startDate, endDate).all();

    for (const r of (residentBlocked.results || [])) {
      blockedSet.add(`${r.date}-${r.slot}`);
    }
  } catch (e) {
    console.warn('reservations table not available:', e);
  }

  // Check time blocks - handle missing table gracefully
  try {
    const timeBlocked = await c.env.DB.prepare(
      `SELECT date, slot FROM time_blocks
       WHERE amenity_type = ? AND date BETWEEN ? AND ?`
    ).bind(amenityType, startDate, endDate).all();

    for (const t of (timeBlocked.results || [])) {
      blockedSet.add(`${t.date}-${t.slot}`);
    }
  } catch (e) {
    console.warn('time_blocks table not available:', e);
  }

  // Generate available dates
  const available: any[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const slots = ['AM', 'PM', 'FULL_DAY'].filter(slot => !blockedSet.has(`${dateStr}-${slot}`));

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
    data: {
      gcash: {
        number: gcashNumber?.setting_value || '0917-XXX-XXXX',
        name: gcashName?.setting_value || 'Laguna Hills HOA',
      },
      bank_transfer: {
        bank_name: bankName?.setting_value || 'BPI',
        account_name: accountName?.setting_value || 'Laguna Hills HOA Association',
        account_number: accountNumber?.setting_value || 'XXXX-XXXX-XXXX',
      }
    }
  });
});

// POST /api/public/bookings - Create booking request
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
    `SELECT id FROM booking_blocked_dates
     WHERE amenity_type = ? AND booking_date = ? AND slot = ?`
  ).bind(data.amenity_type, data.date, data.slot).first();

  if (blocked) {
    return c.json({ error: 'This time slot is already booked.' }, 409);
  }

  // Check resident reservations
  const reserved = await c.env.DB.prepare(
    `SELECT id FROM reservations
     WHERE amenity_type = ? AND date = ? AND slot = ? AND status != 'cancelled'`
  ).bind(data.amenity_type, data.date, data.slot).first();

  if (reserved) {
    return c.json({ error: 'This time slot is already reserved.' }, 409);
  }

  // Check time blocks
  const timeBlocked = await c.env.DB.prepare(
    `SELECT id FROM time_blocks
     WHERE amenity_type = ? AND date = ? AND slot = ?`
  ).bind(data.amenity_type, data.date, data.slot).first();

  if (timeBlocked) {
    return c.json({ error: 'This time slot is blocked.' }, 409);
  }

  // Calculate pricing
  const pricingResponse = await c.env.DB.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'external_pricing_${data.amenity_type}_hourly'`
  ).first();

  const baseRate = parseFloat(pricingResponse?.setting_value as string) || 500;
  const durations: Record<string, number> = { AM: 4, PM: 4, FULL_DAY: 9 };
  const amount = baseRate * durations[data.slot]; // Simplified (no multipliers for now)

  // Generate booking ID and reference number
  const id = crypto.randomUUID();
  const now = new Date();
  const refNum = `EXT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

  // Get client IP
  const clientIP = getClientIp(c.req.raw);

  // Insert booking
  await c.env.DB.prepare(
    `INSERT INTO external_rentals (
      id, amenity_type, date, slot, amount, payment_status,
      guest_name, guest_email, guest_phone, guest_notes,
      proof_of_payment_url, booking_status, created_ip, ip_retained_until
    ) VALUES (?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, 'pending_payment', ?, ?)`
  ).bind(
    id, data.amenity_type, data.date, data.slot, amount,
    data.guest_name, data.guest_email, data.guest_phone, data.purpose,
    data.proof_of_payment_url || null,
    clientIP,
    getIPRetentionDate()
  ).run();

  // Fetch created booking
  const booking = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  return c.json({
    data: {
      booking: {
        ...booking,
        reference_number: refNum,
        time_of_day: formatTimeOfDay(booking.created_at as string),
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

  // Check if booking exists
  const booking = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
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

  // Update booking
  await c.env.DB.prepare(
    `UPDATE external_rentals
     SET proof_of_payment_url = ?, booking_status = 'pending_verification'
     WHERE id = ?`
  ).bind(result.data.proof_url, id).run();

  // TODO: Send email notification to admin

  const updated = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  return c.json({ data: { booking: updated } });
});

// GET /api/public/bookings/:id/status - Check booking status
publicRouter.get('/bookings/:id/status', async (c) => {
  const id = c.req.param('id');

  const booking = await c.env.DB.prepare(
    'SELECT * FROM external_rentals WHERE id = ?'
  ).bind(id).first();

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  return c.json({
    data: {
      booking: {
        id: booking.id,
        reference_number: `EXT-${new Date(booking.created_at as string).getFullYear()}${String(new Date(booking.created_at as string).getMonth() + 1).padStart(2, '0')}${String(new Date(booking.created_at as string).getDate()).padStart(2, '0')}-${id.slice(-3)}`,
        status: booking.booking_status,
        amenity_type: booking.amenity_type,
        date: booking.date,
        slot: booking.slot,
        amount: booking.amount,
        rejection_reason: booking.rejection_reason,
        admin_notes: booking.admin_notes,
        time_of_day: formatTimeOfDay(booking.created_at as string),
      }
    }
  });
});
