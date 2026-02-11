import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const reservationSchema = z.object({
  household_id: z.string(),
  amenity_type: z.enum(['clubhouse', 'pool', 'basketball-court']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
  slot: z.enum(['AM', 'PM']),
  purpose: z.string().optional(),
});

const updateReservationSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
});

export const reservationsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Helper function to check if a user belongs to a household
// A user belongs to a household if they are:
// 1. The owner of the household (households.owner_user_id)
// 2. A resident in the household (residents.user_id)
async function userBelongsToHousehold(
  db: D1Database,
  userId: string,
  householdId: string
): Promise<boolean> {
  // Check if user is the owner
  const ownerCheck = await db.prepare(
    'SELECT id FROM households WHERE id = ? AND owner_user_id = ?'
  ).bind(householdId, userId).first();

  if (ownerCheck) {
    return true;
  }

  // Check if user is a resident
  const residentCheck = await db.prepare(
    'SELECT id FROM residents WHERE household_id = ? AND user_id = ?'
  ).bind(householdId, userId).first();

  return !!residentCheck;
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

  if (!['clubhouse', 'pool', 'basketball-court'].includes(amenityType)) {
    return c.json({ error: 'Invalid amenity_type' }, 400);
  }

  // Get all confirmed/pending reservations for the date range and amenity
  const query = `
    SELECT date, slot
    FROM reservations
    WHERE amenity_type = ?
      AND date BETWEEN ? AND ?
      AND status IN ('pending', 'confirmed')
  `;

  const reservations = await c.env.DB.prepare(query)
    .bind(amenityType, startDate, endDate)
    .all();

  // Build availability map
  const availability: Record<string, { am_available: boolean; pm_available: boolean }> = {};

  // Parse dates and initialize all as available
  const start = new Date(startDate);
  const end = new Date(endDate);
  const currentDate = new Date(start);

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    availability[dateStr] = { am_available: true, pm_available: true };
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Mark unavailable slots based on existing reservations
  for (const row of reservations.results || []) {
    const dateStr = row.date as string;
    const slot = row.slot as string;

    if (availability[dateStr]) {
      if (slot === 'AM') {
        availability[dateStr].am_available = false;
      } else if (slot === 'PM') {
        availability[dateStr].pm_available = false;
      }
    }
  }

  // Convert to array format
  const availabilityList = Object.entries(availability).map(([date, slots]) => ({
    date,
    amenity_type: amenityType as 'clubhouse' | 'pool' | 'basketball-court',
    am_available: slots.am_available,
    pm_available: slots.pm_available,
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
  if (authUser.role !== 'admin' && authUser.role !== 'staff') {
    const belongsToHousehold = await userBelongsToHousehold(c.env.DB, authUser.id, householdId);
    if (!belongsToHousehold) {
      return c.json({ error: 'Forbidden - you do not have access to this household' }, 403);
    }
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

  // Check permission - users can only view their own household's reservations
  if (authUser.role !== 'admin' && authUser.role !== 'staff') {
    const belongsToHousehold = await userBelongsToHousehold(c.env.DB, authUser.id, reservation.household_id as string);
    if (!belongsToHousehold) {
      return c.json({ error: 'Forbidden - you do not have access to this reservation' }, 403);
    }
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

  // Non-admin users can only create reservations for their own household
  if (authUser.role !== 'admin' && authUser.role !== 'staff') {
    const belongsToHousehold = await userBelongsToHousehold(c.env.DB, authUser.id, household_id);
    if (!belongsToHousehold) {
      return c.json({ error: 'Forbidden - you can only create reservations for your own household' }, 403);
    }
  }

  // Check for double-booking - prevent same date/slot/amenity
  const existingReservation = await c.env.DB.prepare(
    `SELECT id FROM reservations
     WHERE amenity_type = ?
       AND date = ?
       AND slot = ?
       AND status IN ('pending', 'confirmed')`
  ).bind(amenity_type, date, slot).first();

  if (existingReservation) {
    return c.json({
      error: 'This slot is already booked. Please select a different date or time slot.'
    }, 409);
  }

  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO reservations (id, household_id, amenity_type, date, slot, purpose, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`
  ).bind(id, household_id, amenity_type, date, slot, purpose || null).run();

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
    // For cancellation, allow users to cancel their own household's reservations
    if (body.status === 'cancelled') {
      const belongsToHousehold = await userBelongsToHousehold(c.env.DB, authUser.id, existing.household_id as string);
      if (!belongsToHousehold) {
        return c.json({ error: 'Forbidden - you can only cancel your own household reservations' }, 403);
      }
    } else {
      return c.json({ error: 'Forbidden - only admin/staff can change reservation status' }, 403);
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
