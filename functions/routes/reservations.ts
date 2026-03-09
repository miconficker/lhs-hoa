import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const reservationSchema = z.object({
  household_id: z.string(),
  amenity_type: z.enum(['clubhouse', 'pool', 'basketball-court', 'tennis-court']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
  slot: z.enum(['AM', 'PM', 'FULL_DAY']),
  purpose: z.string().optional(),
});

const updateReservationSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
});

export const reservationsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Get all reservations (with optional filters)
reservationsRouter.get('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.query('household_id');
  const amenityType = c.req.query('amenity_type');
  const date = c.req.query('date');
  const status = c.req.query('status');

  // Non-admin users can only see their own household's reservations
  const isOwnRequests = authUser.role !== 'admin' && authUser.role !== 'staff';

  let query = 'SELECT * FROM reservations WHERE 1=1';
  const params: any[] = [];

  if (householdId) {
    // Only admin/staff can filter by specific household_id
    if (authUser.role === 'admin' || authUser.role === 'staff') {
      query += ' AND household_id = ?';
      params.push(householdId);
    } else if (isOwnRequests) {
      // Regular users can only see their own
      // For now, return empty - should be enhanced with user-household relation
      return c.json({ reservations: [] });
    }
  } else if (isOwnRequests) {
    // If not admin/staff and no household filter, return empty
    // Users should use the /my endpoint
    return c.json({ reservations: [] });
  }

  if (amenityType) {
    query += ' AND amenity_type = ?';
    params.push(amenityType);
  }
  if (date) {
    query += ' AND date = ?';
    params.push(date);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY date ASC, slot ASC';

  const reservations = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ reservations: reservations.results });
});

// Check availability for a date range and amenity type
reservationsRouter.get('/availability', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');
  const amenityType = c.req.query('amenity_type');

  if (!startDate || !endDate) {
    return c.json({ error: 'start_date and end_date are required' }, 400);
  }

  if (!amenityType) {
    return c.json({ error: 'amenity_type is required' }, 400);
  }

  if (!['clubhouse', 'pool', 'basketball-court', 'tennis-court'].includes(amenityType)) {
    return c.json({ error: 'Invalid amenity_type' }, 400);
  }

  // Get all confirmed/pending reservations for the date range and amenity
  const reservationsQuery = `
    SELECT date, slot
    FROM reservations
    WHERE amenity_type = ?
      AND date BETWEEN ? AND ?
      AND status IN ('pending', 'confirmed')
  `;

  const reservations = await c.env.DB.prepare(reservationsQuery)
    .bind(amenityType, startDate, endDate)
    .all();

  // Get time blocks for the date range and amenity
  const timeBlocksQuery = `
    SELECT date, slot, reason
    FROM time_blocks
    WHERE amenity_type = ?
      AND date BETWEEN ? AND ?
  `;

  const timeBlocks = await c.env.DB.prepare(timeBlocksQuery)
    .bind(amenityType, startDate, endDate)
    .all();

  // Get external rentals for the date range and amenity
  const externalRentalsQuery = `
    SELECT date, slot, renter_name
    FROM external_rentals
    WHERE amenity_type = ?
      AND date BETWEEN ? AND ?
  `;

  const externalRentals = await c.env.DB.prepare(externalRentalsQuery)
    .bind(amenityType, startDate, endDate)
    .all();

  // Build availability map
  const availability: Record<string, {
    am_available: boolean;
    pm_available: boolean;
    am_blocked: boolean;
    pm_blocked: boolean;
    block_reason?: string;
  }> = {};

  // Parse dates and initialize all as available
  const start = new Date(startDate);
  const end = new Date(endDate);
  const currentDate = new Date(start);

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    availability[dateStr] = {
      am_available: true,
      pm_available: true,
      am_blocked: false,
      pm_blocked: false
    };
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Mark unavailable slots based on existing reservations
  for (const row of reservations.results || []) {
    const dateStr = row.date as string;
    const slot = row.slot as string;

    if (availability[dateStr]) {
      if (slot === 'AM' || slot === 'FULL_DAY') {
        availability[dateStr].am_available = false;
      }
      if (slot === 'PM' || slot === 'FULL_DAY') {
        availability[dateStr].pm_available = false;
      }
    }
  }

  // Mark blocked slots based on time blocks
  for (const row of timeBlocks.results || []) {
    const dateStr = row.date as string;
    const slot = row.slot as string;
    const reason = row.reason as string;

    if (availability[dateStr]) {
      if (slot === 'AM' || slot === 'FULL_DAY') {
        availability[dateStr].am_available = false;
        availability[dateStr].am_blocked = true;
        if (!availability[dateStr].block_reason) {
          availability[dateStr].block_reason = reason;
        }
      }
      if (slot === 'PM' || slot === 'FULL_DAY') {
        availability[dateStr].pm_available = false;
        availability[dateStr].pm_blocked = true;
        if (!availability[dateStr].block_reason) {
          availability[dateStr].block_reason = reason;
        }
      }
    }
  }

  // Mark unavailable slots based on external rentals
  for (const row of externalRentals.results || []) {
    const dateStr = row.date as string;
    const slot = row.slot as string;
    const renterName = row.renter_name as string;

    if (availability[dateStr]) {
      if (slot === 'AM' || slot === 'FULL_DAY') {
        availability[dateStr].am_available = false;
        availability[dateStr].am_blocked = true;
        if (!availability[dateStr].block_reason) {
          availability[dateStr].block_reason = `External rental: ${renterName}`;
        }
      }
      if (slot === 'PM' || slot === 'FULL_DAY') {
        availability[dateStr].pm_available = false;
        availability[dateStr].pm_blocked = true;
        if (!availability[dateStr].block_reason) {
          availability[dateStr].block_reason = `External rental: ${renterName}`;
        }
      }
    }
  }

  // Convert to array format
  const availabilityList = Object.entries(availability).map(([date, slots]) => ({
    date,
    amenity_type: amenityType as 'clubhouse' | 'pool' | 'basketball-court' | 'tennis-court',
    am_available: slots.am_available,
    pm_available: slots.pm_available,
    am_blocked: slots.am_blocked,
    pm_blocked: slots.pm_blocked,
    block_reason: slots.block_reason,
  }));

  return c.json({ availability: availabilityList });
});

// Get my reservations
reservationsRouter.get('/my/:householdId', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');

  // Check permission - users can only view their own household's reservations
  // For now, allow access - should be enhanced with user-household relation
  if (authUser.role !== 'admin' && authUser.role !== 'staff') {
    // TODO: Verify user belongs to this household
  }

  const reservations = await c.env.DB.prepare(
    `SELECT * FROM reservations
     WHERE household_id = ?
     ORDER BY date DESC, created_at DESC`
  ).bind(householdId).all();

  return c.json({ reservations: reservations.results });
});

// Get single reservation
reservationsRouter.get('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  const reservation = await c.env.DB.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(id).first();

  if (!reservation) {
    return c.json({ error: 'Reservation not found' }, 404);
  }

  // Check permission
  if (authUser.role !== 'admin' && authUser.role !== 'staff') {
    // TODO: Check if user belongs to the household
    // For now, allow access
  }

  return c.json({ reservation });
});

// Create reservation
reservationsRouter.post('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = reservationSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { household_id, amenity_type, date, slot, purpose } = result.data;

  // Check for existing reservation by same household (including cancelled ones)
  const existingHouseholdReservation = await c.env.DB.prepare(
    `SELECT id, status FROM reservations
     WHERE household_id = ?
       AND amenity_type = ?
       AND date = ?
       AND slot = ?`
  ).bind(household_id, amenity_type, date, slot).first();

  // If there's an existing cancelled reservation, delete it first
  if (existingHouseholdReservation && existingHouseholdReservation.status === 'cancelled') {
    await c.env.DB.prepare(
      'DELETE FROM reservations WHERE id = ?'
    ).bind(existingHouseholdReservation.id).run();
  }
  // If there's an active reservation, reject the request
  else if (existingHouseholdReservation) {
    return c.json({
      error: 'You already have a reservation for this amenity, date, and time slot.'
    }, 409);
  }

  // Check for double-booking - prevent same date/slot/amenity by ANY household
  const existingReservation = await c.env.DB.prepare(
    `SELECT id FROM reservations
     WHERE amenity_type = ?
       AND date = ?
       AND slot = ?
       AND status IN ('pending', 'confirmed')`
  ).bind(amenity_type, date, slot).first();

  if (existingReservation) {
    return c.json({
      error: 'This slot is already booked by another household. Please select a different date or time slot.'
    }, 409);
  }

  // Check for time blocks
  const timeBlock = await c.env.DB.prepare(
    `SELECT reason FROM time_blocks
     WHERE amenity_type = ?
       AND date = ?
       AND slot IN (?, 'FULL_DAY')`
  ).bind(amenity_type, date, slot).first();

  if (timeBlock) {
    return c.json({
      error: `This slot is blocked: ${timeBlock.reason}. Please select a different date or time slot.`
    }, 409);
  }

  // Check for external rentals
  const externalRental = await c.env.DB.prepare(
    `SELECT renter_name FROM external_rentals
     WHERE amenity_type = ?
       AND date = ?
       AND slot IN (?, 'FULL_DAY')`
  ).bind(amenity_type, date, slot).first();

  if (externalRental) {
    return c.json({
      error: `This slot is reserved for an external rental. Please select a different date or time slot.`
    }, 409);
  }

  const id = generateId();

  try {
    await c.env.DB.prepare(
      `INSERT INTO reservations (id, household_id, amenity_type, date, slot, purpose, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(id, household_id, amenity_type, date, slot, purpose || null).run();
  } catch (error: any) {
    // Handle UNIQUE constraint violation (shouldn't happen after our checks, but just in case)
    if (error.message?.includes('UNIQUE constraint failed')) {
      return c.json({
        error: 'This time slot is no longer available. Please refresh and try again.'
      }, 409);
    }
    throw error;
  }

  const reservation = await c.env.DB.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(id).first();

  return c.json({ reservation }, 201);
});

// Update reservation (status)
reservationsRouter.put('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateReservationSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Invalid input', details: parseResult.error.flatten() }, 400);
  }

  // Get existing reservation
  const existing = await c.env.DB.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'Reservation not found' }, 404);
  }

  // Check permission - admin/staff can update any, users can only cancel their own
  if (authUser.role !== 'admin' && authUser.role !== 'staff') {
    // For cancellation, allow users to cancel their own reservations
    if (body.status === 'cancelled') {
      // TODO: Verify user belongs to the household
      // For now, allow
    } else {
      return c.json({ error: 'Forbidden' }, 403);
    }
  }

  const { status } = parseResult.data;

  await c.env.DB.prepare(
    'UPDATE reservations SET status = ? WHERE id = ?'
  ).bind(status, id).run();

  const reservation = await c.env.DB.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(id).first();

  return c.json({ reservation });
});

// Delete reservation (admin only)
reservationsRouter.delete('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  await c.env.DB.prepare('DELETE FROM reservations WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});
