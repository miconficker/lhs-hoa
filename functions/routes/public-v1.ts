/**
 * Public API v1 - External Booking System
 *
 * SECURITY: This layer uses DTOs to abstract database structure from public responses.
 * No internal column names or implementation details are exposed.
 *
 * Rate Limits:
 * - Status check: 30/minute per IP
 * - Availability: 60/minute per IP
 * - Pricing: 30/minute per IP
 * - Booking creation: 3/hour per IP
 * - Proof upload: 10/hour per IP
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { applyCascadingBlockLogic } from '../lib/slot-availability';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '../lib/rate-limit';
import {
  toPublicBookingMinimal,
  toPublicBookingInfo,
  toPublicBookingDetail,
  toPublicAmenity,
  toPublicAvailability,
  toPublicPricing,
  toPublicPaymentDetails,
  toPublicNotification,
  toPublicPhaseInfo,
  publicSuccess,
  publicError,
  formatTimeOfDay,
  isValidReferenceNumber,
  isValidUUID,
  type PublicBookingStatus,
  type PublicAmenityType,
  type PublicTimeSlot,
  type PublicEventType
} from '../lib/public-api-dtos';
import {
  generateReferenceNumber,
  storeReferenceMapping,
  lookupBookingByReference,
  isValidReferenceNumber as validateRef,
  isNewFormatReference,
  isLegacyFormatReference,
  generateLegacyReference
} from '../lib/reference-numbers';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
};

export const publicV1Router = new Hono<{ Bindings: Env }>();

// =============================================================================
// Rate Limit Configuration
// =============================================================================

const RATE_LIMITS = {
  STATUS_CHECK: { maxRequests: 30, windowSeconds: 60 },      // 30/minute
  AVAILABILITY: { maxRequests: 60, windowSeconds: 60 },      // 60/minute
  PRICING: { maxRequests: 30, windowSeconds: 60 },           // 30/minute
  BOOKING_CREATE: { maxRequests: 3, windowSeconds: 3600 },   // 3/hour
  PROOF_UPLOAD: { maxRequests: 10, windowSeconds: 3600 },    // 10/hour
  VERIFICATION: { maxRequests: 10, windowSeconds: 300 },     // 10/5min
};

// =============================================================================
// Validation Schemas
// =============================================================================

const bookingRequestSchema = z.object({
  amenity_type: z.enum(['clubhouse', 'pool']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(['AM', 'PM', 'FULL_DAY']),
  guest_first_name: z.string().min(1).max(100),
  guest_last_name: z.string().min(1).max(100),
  guest_email: z.string().email(),
  guest_phone: z.string().min(10).max(20).optional(),
  event_type: z.enum(['wedding', 'birthday', 'meeting', 'sports', 'other']),
  attendees: z.number().int().positive().max(500),
  purpose: z.string().max(500).nullable().optional(),
  proof_of_payment_url: z.string().url().optional(),
});

const proofUploadSchema = z.object({
  proof_url: z.string().url(),
});

const verifyOwnershipSchema = z.object({
  email_or_phone: z.string().min(1).max(100),
});

// =============================================================================
// Error Response Helpers
// =============================================================================

function serviceUnavailable() {
  return Response.json(
    publicError('Service temporarily unavailable. Please try again later.'),
    { status: 503 }
  );
}

function badRequest(message: string, details?: any) {
  return Response.json(
    { ...publicError(message), ...(details && { details }) },
    { status: 400 }
  );
}

function notFound(message: string = 'Resource not found') {
  return Response.json(
    publicError(message),
    { status: 404 }
  );
}

function conflict(message: string) {
  return Response.json(
    publicError(message),
    { status: 409 }
  );
}

function tooManyRequests(message: string = 'Too many requests. Please try again later.') {
  return Response.json(
    publicError(message),
    { status: 429 }
  );
}

function unauthorized(message: string = 'Unauthorized') {
  return Response.json(
    publicError(message),
    { status: 401 }
  );
}

// =============================================================================
// GET /api/v1/public/amenities - List bookable amenities
// =============================================================================

publicV1Router.get('/amenities', async (c) => {
  try {
    const amenities: PublicAmenityType[] = ['clubhouse', 'pool'];
    const data = amenities.map(toPublicAmenity);

    return c.json(publicSuccess({ amenities: data }));
  } catch (error) {
    console.error('[PUBLIC_API] Amenities error:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// GET /api/v1/public/availability/:amenityType - Check availability
// =============================================================================

publicV1Router.get('/availability/:amenityType', async (c) => {
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(
    c.env.DB,
    clientIp,
    RATE_LIMITS.AVAILABILITY,
    'public-availability'
  );

  if (!rateLimitResult.allowed) {
    throw tooManyRequests();
  }

  const amenityType = c.req.param('amenityType');
  const startDate = c.req.query('start') || new Date().toISOString().split('T')[0];
  const endDate = c.req.query('end') ||
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const blockedSet = new Set<string>();

    // Get confirmed bookings (only confirmed bookings block slots)
    const confirmedBookings = await c.env.DB.prepare(
      `SELECT date, slot FROM bookings
       WHERE amenity_type = ? AND date BETWEEN ? AND ?
       AND booking_status = 'confirmed'
       AND deleted_at IS NULL`
    ).bind(amenityType, startDate, endDate).all();

    for (const b of (confirmedBookings.results || [])) {
      blockedSet.add(`${b.date}-${b.slot}`);
    }

    // Get amenity closures
    const closures = await c.env.DB.prepare(
      `SELECT date, slot FROM amenity_closures
       WHERE amenity_type = ? AND date BETWEEN ? AND ?`
    ).bind(amenityType, startDate, endDate).all();

    for (const cl of (closures.results || [])) {
      blockedSet.add(`${cl.date}-${cl.slot}`);
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
        available.push(toPublicAvailability(dateStr, slots));
      }

      current.setDate(current.getDate() + 1);
    }

    return c.json(publicSuccess({ available }));
  } catch (error) {
    console.error('[PUBLIC_API] Availability check failed:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// GET /api/v1/public/pricing/:amenityType - Get pricing with multipliers
// =============================================================================

publicV1Router.get('/pricing/:amenityType', async (c) => {
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(
    c.env.DB,
    clientIp,
    RATE_LIMITS.PRICING,
    'public-pricing'
  );

  if (!rateLimitResult.allowed) {
    throw tooManyRequests();
  }

  const amenityType = c.req.param('amenityType');
  const date = c.req.query('date');
  const slot = c.req.query('slot') || 'FULL_DAY';
  const isResident = c.req.query('resident') === 'true';

  if (!date) {
    throw badRequest('Date parameter required');
  }

  try {
    // Get base rate
    const baseRateResult = await c.env.DB.prepare(
      `SELECT setting_value FROM system_settings WHERE setting_key = ?`
    ).bind(`external_pricing_${amenityType}_hourly`).first();

    const baseRate = parseFloat(baseRateResult?.setting_value as string) || 500;

    // Get multipliers
    const dayMultipliersResult = await c.env.DB.prepare(
      `SELECT setting_value FROM system_settings WHERE setting_key = ?`
    ).bind('external_pricing_day_multipliers').first();

    const dayMultipliers = JSON.parse(
      dayMultipliersResult?.setting_value as string ||
      '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}'
    );

    const seasonMultipliersResult = await c.env.DB.prepare(
      `SELECT setting_value FROM system_settings WHERE setting_key = ?`
    ).bind('external_pricing_season_multipliers').first();

    const seasonMultipliers = JSON.parse(
      seasonMultipliersResult?.setting_value as string ||
      '{"peak": 1.3, "off_peak": 1.0}'
    );

    const peakMonthsResult = await c.env.DB.prepare(
      `SELECT setting_value FROM system_settings WHERE setting_key = ?`
    ).bind('external_pricing_peak_months').first();

    const peakMonths = (peakMonthsResult?.setting_value as string || '12,1,2,3,4,5')
      .split(',').map(Number);

    const holidaysResult = await c.env.DB.prepare(
      `SELECT setting_value FROM system_settings WHERE setting_key = ?`
    ).bind('external_pricing_holidays_2026').first();

    const holidays = (holidaysResult?.setting_value as string || '')
      .split(',').map(s => s.trim());

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

    const durations: Record<string, number> = { AM: 4, PM: 4, FULL_DAY: 9 };
    const duration = durations[slot] || 9;

    const total = baseRate * duration * dayMultiplier * seasonMultiplier;

    const discountResult = await c.env.DB.prepare(
      `SELECT setting_value FROM system_settings WHERE setting_key = ?`
    ).bind('external_pricing_resident_discount_percent').first();

    const discountPercent = parseFloat(discountResult?.setting_value as string || '0.50');
    const finalPrice = isResident ? total * (1 - discountPercent) : total;

    const dayType = isHoliday ? 'holiday' : isWeekend ? 'weekend' : 'weekday';
    const seasonType = isPeak ? 'peak' : 'off_peak';

    const pricing = toPublicPricing(
      baseRate,
      duration,
      dayType,
      dayMultiplier,
      seasonType,
      seasonMultiplier,
      isResident ? discountPercent : 0,
      Math.round(finalPrice)
    );

    return c.json(publicSuccess({ pricing }));
  } catch (error) {
    console.error('[PUBLIC_API] Pricing calculation failed:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// GET /api/v1/public/payment-details - Get payment info
// =============================================================================

publicV1Router.get('/payment-details', async (c) => {
  try {
    const gcashNumberResult = await c.env.DB.prepare(
      `SELECT setting_value FROM system_settings WHERE setting_key = ?`
    ).bind('payment_gcash_number').first();

    const gcashNameResult = await c.env.DB.prepare(
      `SELECT setting_value FROM system_settings WHERE setting_key = ?`
    ).bind('payment_gcash_name').first();

    const bankNameResult = await c.env.DB.prepare(
      `SELECT setting_value FROM system_settings WHERE setting_key = ?`
    ).bind('payment_bank_name').first();

    const accountNameResult = await c.env.DB.prepare(
      `SELECT setting_value FROM system_settings WHERE setting_key = ?`
    ).bind('payment_account_name').first();

    const accountNumberResult = await c.env.DB.prepare(
      `SELECT setting_value FROM system_settings WHERE setting_key = ?`
    ).bind('payment_account_number').first();

    const paymentDetails = toPublicPaymentDetails(
      gcashNumberResult?.setting_value || '0917-XXX-XXXX',
      gcashNameResult?.setting_value || 'Laguna Hills HOA',
      bankNameResult?.setting_value || 'BPI',
      accountNameResult?.setting_value || 'Laguna Hills HOA Association',
      accountNumberResult?.setting_value || 'XXXX-XXXX-XXXX'
    );

    return c.json(publicSuccess({ paymentDetails }));
  } catch (error) {
    console.error('[PUBLIC_API] Payment details error:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// Helper: Calculate pricing (shared between inquiries and bookings)
// =============================================================================

async function calculatePricing(
  db: D1Database,
  amenityType: string,
  date: string,
  slot: string
): Promise<{ baseRate: number; duration: number; dayMultiplier: number; seasonMultiplier: number; amount: number }> {
  const pricingResponse = await db.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = ?`
  ).bind(`external_pricing_${amenityType}_hourly`).first();

  const baseRate = parseFloat(pricingResponse?.setting_value as string) || 500;
  const durations: Record<string, number> = { AM: 4, PM: 4, FULL_DAY: 9 };

  const dayMultipliersResult = await db.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = ?`
  ).bind('external_pricing_day_multipliers').first();

  const dayMultipliers = JSON.parse(
    dayMultipliersResult?.setting_value as string ||
    '{"weekday": 1.0, "weekend": 1.2, "holiday": 1.5}'
  );

  const seasonMultipliersResult = await db.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = ?`
  ).bind('external_pricing_season_multipliers').first();

  const seasonMultipliers = JSON.parse(
    seasonMultipliersResult?.setting_value as string ||
    '{"peak": 1.3, "off_peak": 1.0}'
  );

  const peakMonthsResult = await db.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = ?`
  ).bind('external_pricing_peak_months').first();

  const peakMonths = (peakMonthsResult?.setting_value as string || '12,1,2,3,4,5')
    .split(',').map(Number);

  const holidaysResult = await db.prepare(
    `SELECT setting_value FROM system_settings WHERE setting_key = ?`
  ).bind('external_pricing_holidays_2026').first();

  const holidays = (holidaysResult?.setting_value as string || '')
    .split(',').map(s => s.trim());

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
  const duration = durations[slot] || 9;
  const amount = Math.round(baseRate * duration * dayMultiplier * seasonMultiplier);

  return { baseRate, duration, dayMultiplier, seasonMultiplier, amount };
}

// =============================================================================
// Helper: IP retention date (90 days from now)
// =============================================================================

function getIPRetentionDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return date.toISOString().split('T')[0];
}

// =============================================================================
// POST /api/v1/public/inquiries - Submit inquiry (creates customer + booking)
// =============================================================================

publicV1Router.post('/inquiries', async (c) => {
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(
    c.env.DB,
    clientIp,
    RATE_LIMITS.BOOKING_CREATE,
    'public-inquiry'
  );

  if (!rateLimitResult.allowed) {
    throw tooManyRequests();
  }

  const body = await c.req.json();
  const result = bookingRequestSchema.safeParse(body);

  if (!result.success) {
    throw badRequest('Invalid input', result.error.flatten());
  }

  const data = result.data;

  try {
    // Calculate pricing
    const pricing = await calculatePricing(
      c.env.DB,
      data.amenity_type,
      data.date,
      data.slot
    );

    // Generate IDs and reference number
    const customerId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();
    const referenceNumber = generateReferenceNumber();
    const now = new Date();
    const nowStr = now.toISOString();

    // Check if customer exists by email
    let existingCustomer = await c.env.DB.prepare(
      'SELECT id FROM customers WHERE email = ?'
    ).bind(data.guest_email).first();

    let finalCustomerId = customerId;
    if (existingCustomer) {
      finalCustomerId = existingCustomer.id as string;
      await c.env.DB.prepare(
        'UPDATE customers SET updated_at = ?, last_booking_at = ? WHERE id = ?'
      ).bind(nowStr, nowStr, finalCustomerId).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO customers (id, first_name, last_name, email, phone, guest_notes, created_at, updated_at, created_ip, ip_retained_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        finalCustomerId,
        data.guest_first_name,
        data.guest_last_name,
        data.guest_email,
        data.guest_phone || null,
        data.purpose || null,
        nowStr,
        nowStr,
        clientIp,
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
      pricing.baseRate,
      pricing.duration,
      pricing.dayMultiplier,
      pricing.seasonMultiplier,
      pricing.amount,
      nowStr,
      'submitted',
      data.event_type,
      data.purpose || null,
      data.attendees,
      nowStr,
      finalCustomerId,
      clientIp
    ).run();

    // Store reference number mapping
    await storeReferenceMapping(c.env.DB, bookingId, referenceNumber);

    // Fetch created booking with customer info
    const booking = await c.env.DB.prepare(
      `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       WHERE b.id = ?`
    ).bind(bookingId).first();

    // Transform to DTO
    const inquiryInfo = toPublicBookingInfo(booking!, referenceNumber);

    return c.json(publicSuccess({ inquiry: inquiryInfo }), 201);
  } catch (error) {
    console.error('[PUBLIC_API] Inquiry creation failed:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// GET /api/v1/public/inquiries/:id/status - Check inquiry/booking status
// SECURITY: Returns minimal info without verification
// =============================================================================

publicV1Router.get('/inquiries/:id/status', async (c) => {
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(
    c.env.DB,
    clientIp,
    RATE_LIMITS.STATUS_CHECK,
    'public-status'
  );

  if (!rateLimitResult.allowed) {
    throw tooManyRequests();
  }

  const id = c.req.param('id');

  // Validate UUID format
  if (!isValidUUID(id)) {
    throw badRequest('Invalid booking ID format');
  }

  try {
    const booking = await c.env.DB.prepare(
      `SELECT b.*, c.first_name, c.last_name
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       WHERE b.id = ? AND b.deleted_at IS NULL`
    ).bind(id).first();

    if (!booking) {
      throw notFound('Inquiry not found');
    }

    // Get reference number from mapping table
    const refResult = await c.env.DB.prepare(
      `SELECT reference_number FROM reference_number_mappings WHERE booking_id = ?`
    ).bind(id).first();

    const referenceNumber = refResult?.reference_number as string || generateLegacyReference(id, booking.created_at as string);

    // Return minimal info without PII
    const minimal = toPublicBookingMinimal(booking, referenceNumber);

    return c.json(publicSuccess({ inquiry: minimal }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('[PUBLIC_API] Inquiry status check failed:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// POST /api/v1/public/inquiries/:id/verify - Verify ownership to get full details
// =============================================================================

publicV1Router.post('/inquiries/:id/verify', async (c) => {
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(
    c.env.DB,
    clientIp,
    RATE_LIMITS.VERIFICATION,
    'public-verify'
  );

  if (!rateLimitResult.allowed) {
    throw tooManyRequests();
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const result = verifyOwnershipSchema.safeParse(body);

  if (!result.success) {
    throw badRequest('Invalid input');
  }

  const emailOrPhone = result.data.email_or_phone.trim();

  try {
    const booking = await c.env.DB.prepare(
      `SELECT b.*, c.email, c.phone
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       WHERE b.id = ? AND b.deleted_at IS NULL`
    ).bind(id).first();

    if (!booking) {
      throw notFound('Booking not found');
    }

    const guestEmail = booking.email as string;
    const guestPhone = booking.phone as string;

    const isEmailMatch = emailOrPhone.toLowerCase() === guestEmail.toLowerCase();
    const isPhoneMatch = emailOrPhone.replace(/\D/g, '') === guestPhone.replace(/\D/g, '');

    if (!isEmailMatch && !isPhoneMatch) {
      throw unauthorized('The email or phone number does not match our records');
    }

    // Generate verification token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await c.env.DB.prepare(
      `INSERT INTO verification_tokens (token, booking_id, expires_at)
       VALUES (?, ?, ?)`
    ).bind(token, id, expiresAt.toISOString()).run();

    // Mask email and phone
    const maskEmail = (email: string): string => {
      const [local, domain] = email.split('@');
      if (!domain) return email;
      return `${local[0]}***@${domain}`;
    };

    const maskPhone = (phone: string): string => {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length < 5) return phone;
      const visible = cleaned.slice(-5);
      const hidden = cleaned.slice(0, -5).replace(/\d/g, '*');
      return `+63${hidden}${visible}`;
    };

    return c.json(publicSuccess({
      verified: true,
      token,
      masked_email: maskEmail(guestEmail),
      masked_phone: maskPhone(guestPhone)
    }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('[PUBLIC_API] Verification failed:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// GET /api/v1/public/inquiries/:id/details - Get full details after verification
// SECURITY: Requires valid verification token
// =============================================================================

publicV1Router.get('/inquiries/:id/details', async (c) => {
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(
    c.env.DB,
    clientIp,
    RATE_LIMITS.STATUS_CHECK,
    'public-details'
  );

  if (!rateLimitResult.allowed) {
    throw tooManyRequests();
  }

  const id = c.req.param('id');
  const token = c.req.header('X-Verification-Token');

  if (!token) {
    throw unauthorized('Verification token required');
  }

  try {
    // Verify token
    const tokenResult = await c.env.DB.prepare(
      `SELECT booking_id FROM verification_tokens
       WHERE token = ? AND expires_at > datetime('now')
       LIMIT 1`
    ).bind(token).first();

    if (!tokenResult || tokenResult.booking_id !== id) {
      throw unauthorized('Invalid or expired verification token');
    }

    // Delete used token
    await c.env.DB.prepare('DELETE FROM verification_tokens WHERE token = ?')
      .bind(token).run();

    const booking = await c.env.DB.prepare(
      `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       WHERE b.id = ? AND b.deleted_at IS NULL`
    ).bind(id).first();

    if (!booking) {
      throw notFound('Booking not found');
    }

    // Get reference number
    const refResult = await c.env.DB.prepare(
      `SELECT reference_number FROM reference_number_mappings WHERE booking_id = ?`
    ).bind(id).first();

    const referenceNumber = refResult?.reference_number as string || generateLegacyReference(id, booking.created_at as string);

    // Return full details
    const details = toPublicBookingDetail(booking, referenceNumber);

    return c.json(publicSuccess({ inquiry: details }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('[PUBLIC_API] Details fetch failed:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// POST /api/v1/public/bookings - Create booking request (direct booking)
// =============================================================================

publicV1Router.post('/bookings', async (c) => {
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(
    c.env.DB,
    clientIp,
    RATE_LIMITS.BOOKING_CREATE,
    'public-booking'
  );

  if (!rateLimitResult.allowed) {
    throw tooManyRequests();
  }

  const body = await c.req.json();
  const result = bookingRequestSchema.safeParse(body);

  if (!result.success) {
    throw badRequest('Invalid input', result.error.flatten());
  }

  const data = result.data;

  try {
    // Check if slot is available
    const blocked = await c.env.DB.prepare(
      `SELECT id FROM bookings
       WHERE amenity_type = ? AND date = ? AND slot = ?
       AND booking_status = 'confirmed'
       AND deleted_at IS NULL`
    ).bind(data.amenity_type, data.date, data.slot).first();

    if (blocked) {
      throw conflict('This time slot is already booked');
    }

    // Check amenity closures
    const closure = await c.env.DB.prepare(
      `SELECT id FROM amenity_closures
       WHERE amenity_type = ? AND date = ? AND slot = ?`
    ).bind(data.amenity_type, data.date, data.slot).first();

    if (closure) {
      throw conflict('This time slot is blocked');
    }

    // Calculate pricing
    const pricing = await calculatePricing(
      c.env.DB,
      data.amenity_type,
      data.date,
      data.slot
    );

    // Generate IDs and reference number
    const customerId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();
    const referenceNumber = generateReferenceNumber();
    const now = new Date();
    const nowStr = now.toISOString();

    // Check if customer exists
    let existingCustomer = await c.env.DB.prepare(
      'SELECT id FROM customers WHERE email = ?'
    ).bind(data.guest_email).first();

    let finalCustomerId = customerId;
    if (existingCustomer) {
      finalCustomerId = existingCustomer.id as string;
      await c.env.DB.prepare(
        'UPDATE customers SET updated_at = ?, last_booking_at = ? WHERE id = ?'
      ).bind(nowStr, nowStr, finalCustomerId).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO customers (id, first_name, last_name, email, phone, guest_notes, created_at, updated_at, created_ip, ip_retained_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        finalCustomerId,
        data.guest_first_name,
        data.guest_last_name,
        data.guest_email,
        data.guest_phone || null,
        data.purpose || null,
        nowStr,
        nowStr,
        clientIp,
        getIPRetentionDate()
      ).run();
    }

    // Create booking
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
      pricing.baseRate,
      pricing.duration,
      pricing.dayMultiplier,
      pricing.seasonMultiplier,
      pricing.amount,
      nowStr,
      data.proof_of_payment_url || null,
      'payment_due',
      data.event_type,
      data.purpose || null,
      data.attendees,
      nowStr,
      finalCustomerId,
      clientIp
    ).run();

    // Store reference number mapping
    await storeReferenceMapping(c.env.DB, bookingId, referenceNumber);

    // Fetch created booking
    const booking = await c.env.DB.prepare(
      `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       WHERE b.id = ?`
    ).bind(bookingId).first();

    const bookingInfo = toPublicBookingInfo(booking!, referenceNumber);

    return c.json(publicSuccess({ booking: bookingInfo }), 201);
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('[PUBLIC_API] Booking creation failed:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// POST /api/v1/public/bookings/:id/proof - Upload payment proof (URL)
// =============================================================================

publicV1Router.post('/bookings/:id/proof', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = proofUploadSchema.safeParse(body);

  if (!result.success) {
    throw badRequest('Invalid input');
  }

  const proofUrl = result.data.proof_url;
  const verificationToken = body.verification_token as string | undefined;

  // Verify ownership if token provided
  if (verificationToken) {
    const verifiedBookingId = await c.env.DB.prepare(
      `SELECT booking_id FROM verification_tokens
       WHERE token = ? AND expires_at > datetime('now')
       LIMIT 1`
    ).bind(verificationToken).first();

    if (!verifiedBookingId || verifiedBookingId.booking_id !== id) {
      throw unauthorized('Invalid or expired verification token');
    }

    // Delete used token
    await c.env.DB.prepare('DELETE FROM verification_tokens WHERE token = ?')
      .bind(verificationToken).run();
  }

  try {
    const booking = await c.env.DB.prepare(
      'SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL'
    ).bind(id).first();

    if (!booking) {
      throw notFound('Booking not found');
    }

    if (booking.booking_status === 'confirmed') {
      throw badRequest('Booking is already confirmed');
    }

    if (booking.booking_status === 'rejected') {
      throw badRequest('Booking has been rejected');
    }

    if (booking.booking_status !== 'payment_due') {
      throw badRequest('Payment proof can only be uploaded after approval');
    }

    await c.env.DB.prepare(
      `UPDATE bookings
       SET proof_of_payment_url = ?, booking_status = 'payment_review', updated_at = datetime('now')
       WHERE id = ?`
    ).bind(proofUrl, id).run();

    const updated = await c.env.DB.prepare(
      'SELECT * FROM bookings WHERE id = ?'
    ).bind(id).first();

    return c.json(publicSuccess({ uploaded: true }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('[PUBLIC_API] Proof upload failed:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// POST /api/v1/public/bookings/:id/proof-file - Upload payment proof file
// =============================================================================

publicV1Router.post('/bookings/:id/proof-file', async (c) => {
  const id = c.req.param('id');
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(
    c.env.DB,
    clientIp,
    RATE_LIMITS.PROOF_UPLOAD,
    'public-proof-file'
  );

  if (!rateLimitResult.allowed) {
    throw tooManyRequests();
  }

  const form = await c.req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    throw badRequest('file is required');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw badRequest('File size must be less than 5MB');
  }

  try {
    const booking = await c.env.DB.prepare(
      'SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL'
    ).bind(id).first() as any;

    if (!booking) {
      throw notFound('Booking not found');
    }

    if (booking.booking_status === 'confirmed') {
      throw badRequest('Booking is already confirmed');
    }

    if (booking.booking_status === 'rejected') {
      throw badRequest('Booking has been rejected');
    }

    if (booking.booking_status !== 'payment_due') {
      throw badRequest('Payment proof can only be uploaded after approval');
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

    await c.env.DB.prepare(
      `UPDATE bookings
       SET proof_of_payment_url = ?, booking_status = 'payment_review', updated_at = datetime('now')
       WHERE id = ?`
    ).bind(objectKey, id).run();

    return c.json(publicSuccess({ uploaded: true }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('[PUBLIC_API] Proof file upload failed:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// GET /api/v1/public/bookings/:id/status - Check booking status (minimal)
// =============================================================================

publicV1Router.get('/bookings/:id/status', async (c) => {
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(
    c.env.DB,
    clientIp,
    RATE_LIMITS.STATUS_CHECK,
    'public-booking-status'
  );

  if (!rateLimitResult.allowed) {
    throw tooManyRequests();
  }

  const id = c.req.param('id');

  if (!isValidUUID(id)) {
    throw badRequest('Invalid booking ID format');
  }

  try {
    const booking = await c.env.DB.prepare(
      `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       WHERE b.id = ? AND b.deleted_at IS NULL`
    ).bind(id).first();

    if (!booking) {
      throw notFound('Booking not found');
    }

    // Get reference number
    const refResult = await c.env.DB.prepare(
      `SELECT reference_number FROM reference_number_mappings WHERE booking_id = ?`
    ).bind(id).first();

    const referenceNumber = refResult?.reference_number as string || generateLegacyReference(id, booking.created_at as string);

    // Return minimal info
    const minimal = toPublicBookingMinimal(booking, referenceNumber);

    return c.json(publicSuccess({ booking: minimal }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('[PUBLIC_API] Booking status check failed:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// GET /api/v1/public/status/:identifier - Get status by reference number
// SECURITY: Minimal info without verification
// =============================================================================

publicV1Router.get('/status/:identifier', async (c) => {
  const clientIp = getClientIp(c.req.raw);
  const rateLimitResult = await checkRateLimit(
    c.env.DB,
    clientIp,
    RATE_LIMITS.STATUS_CHECK,
    'public-status-ref'
  );

  if (!rateLimitResult.allowed) {
    throw tooManyRequests();
  }

  const identifier = c.req.param('identifier');

  // Check if it's a reference number or UUID
  let bookingId: string | null = null;

  if (isNewFormatReference(identifier)) {
    // Look up by reference number
    bookingId = await lookupBookingByReference(c.env.DB, identifier);
  } else if (isValidUUID(identifier)) {
    bookingId = identifier;
  } else if (isLegacyFormatReference(identifier)) {
    // Legacy format: EXT-YYYYMMDD-XXX
    const match = identifier.match(/^EXT-(\d{4})(\d{2})(\d{2})-([a-zA-Z0-9]{3})$/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const day = parseInt(match[3]);
      const suffix = match[4].toLowerCase();

      const startDate = new Date(year, month, day).toISOString();
      const endDate = new Date(year, month, day + 1).toISOString();

      const bookings = await c.env.DB.prepare(
        `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
         FROM bookings b
         JOIN customers c ON b.customer_id = c.id
         WHERE b.created_at >= ? AND b.created_at < ? AND b.deleted_at IS NULL
         ORDER BY b.created_at ASC`
      ).bind(startDate, endDate).all();

      for (const b of (bookings.results || [])) {
        if ((b.id as string).slice(-3).toLowerCase() === suffix) {
          bookingId = b.id as string;
          break;
        }
      }
    }
  }

  if (!bookingId) {
    throw notFound('Booking not found. Please check your reference number.');
  }

  try {
    const booking = await c.env.DB.prepare(
      `SELECT b.*, c.first_name, c.last_name, c.email, c.phone
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       WHERE b.id = ? AND b.deleted_at IS NULL`
    ).bind(bookingId).first();

    if (!booking) {
      throw notFound('Booking not found');
    }

    // Get or create reference number
    let referenceNumber = identifier;
    if (isValidUUID(identifier)) {
      const refResult = await c.env.DB.prepare(
        `SELECT reference_number FROM reference_number_mappings WHERE booking_id = ?`
      ).bind(bookingId).first();

      referenceNumber = refResult?.reference_number as string || generateLegacyReference(bookingId, booking.created_at as string);
    }

    // Map status to phase
    const phaseMap: Record<string, { phase: number; name: string; desc: string; next: string }> = {
      submitted: {
        phase: 1,
        name: 'Submitted',
        desc: 'Your request has been submitted successfully. Our team will review it shortly.',
        next: 'Wait for approval. You will receive an update within 24-48 hours.'
      },
      payment_due: {
        phase: 2,
        name: 'Payment Required',
        desc: 'Your request has been approved! Please complete your payment to confirm your booking.',
        next: 'Upload proof of payment via the link provided, or contact admin for assistance.'
      },
      payment_review: {
        phase: 3,
        name: 'Verifying Payment',
        desc: 'Payment received! Our team is verifying your payment proof.',
        next: 'We will confirm your booking within 24-48 hours after verification.'
      },
      confirmed: {
        phase: 4,
        name: 'Confirmed',
        desc: 'Your booking has been confirmed! We look forward to hosting you.',
        next: 'Arrive 15 minutes before your scheduled time. Present your booking confirmation upon arrival.'
      },
      rejected: {
        phase: 0,
        name: 'Rejected',
        desc: 'Your request has been declined. This may be due to availability or other reasons.',
        next: 'You can submit a new request with different dates or contact us for more information.'
      },
      cancelled: {
        phase: 0,
        name: 'Cancelled',
        desc: 'This booking has been cancelled.',
        next: 'You can submit a new request if you would like to book again.'
      }
    };

    const status = booking.booking_status as string;
    const phaseInfo = phaseMap[status] || phaseMap.submitted;

    // Return minimal info with phase
    const minimal = toPublicBookingMinimal(booking, referenceNumber);

    return c.json(publicSuccess({
      booking: minimal,
      phase: toPublicPhaseInfo(
        mapBookingStatus(status) as any,
        phaseInfo.phase,
        phaseInfo.name,
        phaseInfo.desc,
        phaseInfo.next
      )
    }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('[PUBLIC_API] Status lookup failed:', error);
    throw serviceUnavailable();
  }
});

// Helper function for status mapping (inline to avoid circular dependency)
function mapBookingStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'submitted': 'submitted',
    'payment_due': 'payment_required',
    'payment_review': 'verifying_payment',
    'confirmed': 'confirmed',
    'rejected': 'rejected',
    'cancelled': 'cancelled'
  };
  return statusMap[status] || 'submitted';
}

// =============================================================================
// POST /api/v1/public/bookings/:id/verify - Verify ownership before proof upload
// =============================================================================

publicV1Router.post('/bookings/:id/verify', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = verifyOwnershipSchema.safeParse(body);

  if (!result.success) {
    throw badRequest('Invalid input');
  }

  const emailOrPhone = result.data.email_or_phone.trim();

  try {
    const booking = await c.env.DB.prepare(
      `SELECT b.*, c.email, c.phone
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       WHERE b.id = ? AND b.deleted_at IS NULL`
    ).bind(id).first();

    if (!booking) {
      throw notFound('Booking not found');
    }

    const guestEmail = booking.email as string;
    const guestPhone = booking.phone as string;

    const isEmailMatch = emailOrPhone.toLowerCase() === guestEmail.toLowerCase();
    const isPhoneMatch = emailOrPhone.replace(/\D/g, '') === guestPhone.replace(/\D/g, '');

    if (!isEmailMatch && !isPhoneMatch) {
      throw unauthorized('The email or phone number does not match our records');
    }

    // Generate verification token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await c.env.DB.prepare(
      `INSERT INTO verification_tokens (token, booking_id, expires_at)
       VALUES (?, ?, ?)`
    ).bind(token, id, expiresAt.toISOString()).run();

    const maskEmail = (email: string): string => {
      const [local, domain] = email.split('@');
      if (!domain) return email;
      return `${local[0]}***@${domain}`;
    };

    const maskPhone = (phone: string): string => {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length < 5) return phone;
      const visible = cleaned.slice(-5);
      const hidden = cleaned.slice(0, -5).replace(/\d/g, '*');
      return `+63${hidden}${visible}`;
    };

    return c.json(publicSuccess({
      verified: true,
      token,
      masked_email: maskEmail(guestEmail),
      masked_phone: maskPhone(guestPhone)
    }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('[PUBLIC_API] Verification failed:', error);
    throw serviceUnavailable();
  }
});

// =============================================================================
// GET /api/v1/public/bookings/:id/notifications - Get notifications for a booking
// SECURITY: Requires verification token
// =============================================================================

publicV1Router.get('/bookings/:id/notifications', async (c) => {
  const id = c.req.param('id');
  const token = c.req.header('X-Verification-Token');

  if (!token) {
    throw unauthorized('Verification token required');
  }

  try {
    // Verify token
    const tokenResult = await c.env.DB.prepare(
      `SELECT booking_id FROM verification_tokens
       WHERE token = ? AND expires_at > datetime('now')
       LIMIT 1`
    ).bind(token).first();

    if (!tokenResult || tokenResult.booking_id !== id) {
      throw unauthorized('Invalid or expired verification token');
    }

    const booking = await c.env.DB.prepare(
      `SELECT customer_id, user_id FROM bookings WHERE id = ? AND deleted_at IS NULL`
    ).bind(id).first();

    if (!booking) {
      throw notFound('Booking not found');
    }

    const notifications = await c.env.DB.prepare(
      `SELECT id, type, title, content, link, read, created_at, sent_at
       FROM notifications
       WHERE customer_id = ? OR user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`
    ).bind(booking.customer_id || '', booking.user_id || '').all();

    // Filter notifications relevant to this booking
    const filtered = (notifications.results || []).filter((n: any) =>
      !n.link || n.link.includes(id)
    );

    return c.json(publicSuccess({
      notifications: filtered.map(toPublicNotification),
      unread_count: filtered.filter((n: any) => !n.read).length
    }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('[PUBLIC_API] Notifications fetch failed:', error);
    throw serviceUnavailable();
  }
});
