import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest, hashPassword } from '../lib/auth';
import type { User, UserRole } from '../types';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

// Helper function to check if user is admin
async function requireAdmin(c: any, env: Env): Promise<{ userId: string } | null> {
  const authUser = await getUserFromRequest(c.req.raw, env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return null;
  }
  return authUser;
}

export const adminRouter = new Hono<{ Bindings: Env }>();

// Helper function to generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

// ==================== User Management ====================

// List all users
adminRouter.get('/users', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const users = await c.env.DB.prepare(`
    SELECT
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.role,
      u.phone,
      u.created_at,
      COUNT(DISTINCT h.id) as household_count,
      GROUP_CONCAT(DISTINCT h.address) as household_addresses
    FROM users u
    LEFT JOIN households h ON h.owner_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();

  return c.json({ users: users.results });
});

// Create new user
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'resident', 'staff', 'guest']),
  phone: z.string().optional(),
});

adminRouter.post('/users', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const body = await c.req.json();
  const result = createUserSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { email, password, role, phone } = result.data;

  // Check if user exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  // Create user
  const userId = generateId();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, email, passwordHash, role, phone || null).run();

  // Get created user
  const user = await c.env.DB.prepare(
    'SELECT id, email, role, phone, created_at FROM users WHERE id = ?'
  ).bind(userId).first() as any;

  return c.json({ user }, 201);
});

// Update user
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'resident', 'staff', 'guest']).optional(),
  phone: z.string().optional(),
});

adminRouter.put('/users/:id', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const result = updateUserSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { email, password, role, phone } = result.data;

  // Check if user exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (email) {
    // Check if email is taken by another user
    const emailExists = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND id != ?'
    ).bind(email, id).first();
    if (emailExists) {
      return c.json({ error: 'Email already in use' }, 409);
    }
    updates.push('email = ?');
    values.push(email);
  }

  if (password) {
    const passwordHash = await hashPassword(password);
    updates.push('password_hash = ?');
    values.push(passwordHash);
  }

  if (role) {
    updates.push('role = ?');
    values.push(role);
  }

  if (phone !== undefined) {
    updates.push('phone = ?');
    values.push(phone || null);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  values.push(id);
  await c.env.DB.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  // Get updated user
  const user = await c.env.DB.prepare(
    'SELECT id, email, role, phone, created_at FROM users WHERE id = ?'
  ).bind(id).first() as any;

  return c.json({ user });
});

// Delete user
adminRouter.delete('/users/:id', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');

  // Prevent deleting yourself
  if (id === authUser.userId) {
    return c.json({ error: 'Cannot delete your own account' }, 400);
  }

  // Check if user exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});

// ==================== Household Management ====================

// List all households with residents
adminRouter.get('/households', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const households = await c.env.DB.prepare(`
    SELECT
      h.id,
      h.address,
      h.block,
      h.lot,
      h.latitude,
      h.longitude,
      h.map_marker_x,
      h.map_marker_y,
      h.owner_id,
      h.created_at,
      u.email as owner_email,
      GROUP_CONCAT(
        json_object(
          'id', r.id,
          'first_name', r.first_name,
          'last_name', r.last_name,
          'is_primary', r.is_primary,
          'user_id', r.user_id
        )
      ) as residents
    FROM households h
    LEFT JOIN users u ON h.owner_id = u.id
    LEFT JOIN residents r ON h.id = r.household_id
    GROUP BY h.id
    ORDER BY h.block, h.lot
  `).all();

  // Parse residents JSON
  const householdsWithResidents = households.results.map((h: any) => ({
    ...h,
    residents: h.residents ? JSON.parse(`[${h.residents}]`) : [],
  }));

  return c.json({ households: householdsWithResidents });
});

// Create household
const createHouseholdSchema = z.object({
  address: z.string().min(1),
  block: z.string().optional(),
  lot: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  map_marker_x: z.number().optional(),
  map_marker_y: z.number().optional(),
  owner_id: z.string().optional(),
  residents: z.array(z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    is_primary: z.boolean().default(false),
    user_id: z.string().optional(),
  })).optional(),
});

adminRouter.post('/households', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const body = await c.req.json();
  const result = createHouseholdSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { address, block, lot, latitude, longitude, map_marker_x, map_marker_y, owner_id, residents } = result.data;

  // Verify owner exists if provided
  if (owner_id) {
    const owner = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(owner_id).first();
    if (!owner) {
      return c.json({ error: 'Owner not found' }, 404);
    }
  }

  // Create household
  const householdId = generateId();

  await c.env.DB.prepare(`
    INSERT INTO households (id, address, block, lot, latitude, longitude, map_marker_x, map_marker_y, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    householdId,
    address,
    block || null,
    lot || null,
    latitude || null,
    longitude || null,
    map_marker_x || null,
    map_marker_y || null,
    owner_id || null
  ).run();

  // Create residents if provided
  if (residents && residents.length > 0) {
    for (const resident of residents) {
      const residentId = generateId();
      await c.env.DB.prepare(`
        INSERT INTO residents (id, household_id, user_id, first_name, last_name, is_primary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        residentId,
        householdId,
        resident.user_id || null,
        resident.first_name,
        resident.last_name,
        resident.is_primary ? 1 : 0
      ).run();
    }
  }

  // Get created household
  const household = await c.env.DB.prepare(
    'SELECT * FROM households WHERE id = ?'
  ).bind(householdId).first() as any;

  return c.json({ household }, 201);
});

// Update household
adminRouter.put('/households/:id', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();

  console.log('[Admin] PUT /households/:id - Request body:', JSON.stringify(body));

  // Allow both owner_id and owner_email (for consistency with import endpoint)
  const updateHouseholdSchema = createHouseholdSchema.partial().extend({
    owner_email: z.string().email().optional(),
  });

  const result = updateHouseholdSchema.safeParse(body);

  if (!result.success) {
    console.log('[Admin] Validation failed:', result.error.flatten());
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { address, block, lot, latitude, longitude, map_marker_x, map_marker_y, owner_id, owner_email } = result.data;

  console.log('[Admin] Parsed data - owner_email:', owner_email, 'owner_id:', owner_id);

  // Check if household exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM households WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'Household not found' }, 404);
  }

  // Convert owner_email to owner_id if provided
  let finalOwnerId = owner_id;
  if (owner_email) {
    const owner = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(owner_email).first();
    if (!owner) {
      return c.json({ error: 'Owner not found with provided email' }, 404);
    }
    finalOwnerId = owner.id as string;
    console.log('[Admin] Converted owner_email to owner_id:', finalOwnerId);
  } else if (owner_id !== undefined) {
    // Verify owner exists if owner_id is provided
    const owner = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(owner_id).first();
    if (!owner) {
      return c.json({ error: 'Owner not found' }, 404);
    }
  }

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (address) {
    updates.push('address = ?');
    values.push(address);
  }
  if (block !== undefined) {
    updates.push('block = ?');
    values.push(block || null);
  }
  if (lot !== undefined) {
    updates.push('lot = ?');
    values.push(lot || null);
  }
  if (latitude !== undefined) {
    updates.push('latitude = ?');
    values.push(latitude || null);
  }
  if (longitude !== undefined) {
    updates.push('longitude = ?');
    values.push(longitude || null);
  }
  if (map_marker_x !== undefined) {
    updates.push('map_marker_x = ?');
    values.push(map_marker_x || null);
  }
  if (map_marker_y !== undefined) {
    updates.push('map_marker_y = ?');
    values.push(map_marker_y || null);
  }
  if (finalOwnerId !== undefined) {
    updates.push('owner_id = ?');
    values.push(finalOwnerId || null);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  values.push(id);
  console.log('[Admin] Executing UPDATE with values:', values);

  await c.env.DB.prepare(
    `UPDATE households SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  // Get updated household
  const household = await c.env.DB.prepare(
    'SELECT * FROM households WHERE id = ?'
  ).bind(id).first() as any;

  console.log('[Admin] Updated household:', household);

  return c.json({ household });
});

// Delete household
adminRouter.delete('/households/:id', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');

  // Check if household exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM households WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'Household not found' }, 404);
  }

  // Delete associated residents first
  await c.env.DB.prepare('DELETE FROM residents WHERE household_id = ?').bind(id).run();

  // Delete household
  await c.env.DB.prepare('DELETE FROM households WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});

// ==================== Bulk Import ====================

const importSchema = z.object({
  households: z.array(z.object({
    address: z.string().min(1),
    block: z.string().optional(),
    lot: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    map_marker_x: z.number().optional(),
    map_marker_y: z.number().optional(),
    owner_email: z.string().email().optional(),
    residents: z.array(z.object({
      first_name: z.string().min(1),
      last_name: z.string().min(1),
      is_primary: z.boolean().default(false),
    })).default([]),
  })),
});

adminRouter.post('/households/import', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const body = await c.req.json();
  const result = importSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { households } = result.data;
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (let i = 0; i < households.length; i++) {
    const householdData = households[i];

    try {
      // Find owner by email if provided
      let owner_id: string | null = null;
      if (householdData.owner_email) {
        const owner = await c.env.DB.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind(householdData.owner_email).first();

        if (owner) {
          owner_id = owner.id as string;
        }
      }

      // Create household
      const householdId = generateId();

      await c.env.DB.prepare(`
        INSERT INTO households (id, address, block, lot, latitude, longitude, map_marker_x, map_marker_y, owner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        householdId,
        householdData.address,
        householdData.block || null,
        householdData.lot || null,
        householdData.latitude || null,
        householdData.longitude || null,
        householdData.map_marker_x || null,
        householdData.map_marker_y || null,
        owner_id
      ).run();

      // Create residents
      if (householdData.residents && householdData.residents.length > 0) {
        for (const resident of householdData.residents) {
          const residentId = generateId();
          await c.env.DB.prepare(`
            INSERT INTO residents (id, household_id, first_name, last_name, is_primary)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
            residentId,
            householdId,
            resident.first_name,
            resident.last_name,
            resident.is_primary ? 1 : 0
          ).run();
        }
      }

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return c.json({ results });
});

// ==================== Statistics ====================

adminRouter.get('/stats', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  // Get various counts
  const userCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first() as any;
  const householdCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM households').first() as any;
  const residentCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM residents').first() as any;

  // Get users by role
  const usersByRole = await c.env.DB.prepare(`
    SELECT role, COUNT(*) as count
    FROM users
    GROUP BY role
  `).all();

  // Get households by block
  const householdsByBlock = await c.env.DB.prepare(`
    SELECT block, COUNT(*) as count
    FROM households
    WHERE block IS NOT NULL
    GROUP BY block
    ORDER BY block
  `).all();

  // Get pending service requests
  const pendingRequests = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM service_requests
    WHERE status = 'pending'
  `).first() as any;

  // Get upcoming reservations
  const upcomingReservations = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM reservations
    WHERE date >= DATE('now')
    AND status IN ('pending', 'confirmed')
  `).first() as any;

  // Get unpaid payments
  const unpaidPayments = await c.env.DB.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
    FROM payments
    WHERE status = 'pending'
  `).first() as any;

  return c.json({
    stats: {
      users: {
        total: userCount.count,
        byRole: usersByRole.results,
      },
      households: {
        total: householdCount.count,
        byBlock: householdsByBlock.results,
      },
      residents: residentCount.count,
      serviceRequests: {
        pending: pendingRequests.count,
      },
      reservations: {
        upcoming: upcomingReservations.count,
      },
      payments: {
        unpaid: unpaidPayments.count,
        unpaidAmount: unpaidPayments.total_amount,
      },
    },
  });
});

// =============================================================================
// ADMIN: Lot Ownership Management
// =============================================================================

/**
 * GET /api/admin/lots/ownership
 * Get all lots with ownership information (admin only)
 */
adminRouter.get('/lots/ownership', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    // Get lots with owner information
    const lots = await c.env.DB.prepare(`
      SELECT
        h.id as lot_id,
        h.block as block_number,
        h.lot as lot_number,
        h.address,
        h.owner_id as owner_user_id,
        h.lot_status,
        h.lot_size_sqm,
        u.email as owner_email,
        CASE
          WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL THEN u.first_name || ' ' || u.last_name
          WHEN u.first_name IS NOT NULL THEN u.first_name
          ELSE u.email
        END as owner_name
      FROM households h
      LEFT JOIN users u ON h.owner_id = u.id
      ORDER BY
        CAST(h.block AS INTEGER) ASC,
        CAST(h.lot AS INTEGER) ASC
    `).all();

    return c.json({ lots: lots.results || [] });
  } catch (error) {
    console.error('Error fetching lot ownership:', error);
    return c.json({ error: 'Failed to fetch lot ownership' }, 500);
  }
});

/**
 * PUT /api/admin/lots/:lotId/owner
 * Assign or change owner for a lot (admin only)
 */
adminRouter.put('/lots/:lotId/owner', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const lotId = c.req.param('lotId');

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  const { owner_user_id } = body;

  if (!owner_user_id) {
    return c.json({ error: 'owner_user_id is required' }, 400);
  }

  try {
    // Verify lot exists
    const lot = await c.env.DB.prepare(
      'SELECT id FROM households WHERE id = ?'
    ).bind(lotId).first();

    if (!lot) {
      return c.json({ error: 'Lot not found' }, 404);
    }

    // Verify owner exists
    const owner = await c.env.DB.prepare(
      'SELECT id, role FROM users WHERE id = ?'
    ).bind(owner_user_id).first();

    if (!owner) {
      return c.json({ error: 'Owner not found' }, 404);
    }

    // Update lot owner
    await c.env.DB.prepare(
      'UPDATE households SET owner_id = ? WHERE id = ?'
    ).bind(owner_user_id, lotId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating lot owner:', error);
    return c.json({ error: 'Failed to update lot owner' }, 500);
  }
});

/**
 * PUT /api/admin/lots/:lotId/status
 * Update lot status (admin only)
 */
adminRouter.put('/lots/:lotId/status', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const lotId = c.req.param('lotId');
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  const { lot_status } = body;

  if (!lot_status || !['built', 'vacant_lot', 'under_construction'].includes(lot_status)) {
    return c.json({ error: 'Invalid lot_status' }, 400);
  }

  // Verify lot exists
  const lot = await c.env.DB.prepare(
    'SELECT id FROM households WHERE id = ?'
  ).bind(lotId).first();

  if (!lot) {
    return c.json({ error: 'Lot not found' }, 404);
  }

  try {
    await c.env.DB.prepare(
      'UPDATE households SET lot_status = ? WHERE id = ?'
    ).bind(lot_status, lotId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating lot status:', error);
    return c.json({ error: 'Failed to update lot status' }, 500);
  }
});

/**
 * PUT /api/admin/lots/:lotId/size
 * Update lot size (admin only)
 */
adminRouter.put('/lots/:lotId/size', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const lotId = c.req.param('lotId');
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  const { lot_size_sqm } = body;

  // Verify lot exists
  const lot = await c.env.DB.prepare(
    'SELECT id FROM households WHERE id = ?'
  ).bind(lotId).first();

  if (!lot) {
    return c.json({ error: 'Lot not found' }, 404);
  }

  // Allow null (clearing the value)
  if (lot_size_sqm !== null && lot_size_sqm !== undefined && (typeof lot_size_sqm !== 'number' || lot_size_sqm < 0)) {
    return c.json({ error: 'Invalid lot_size_sqm' }, 400);
  }

  try {
    await c.env.DB.prepare(
      'UPDATE households SET lot_size_sqm = ? WHERE id = ?'
    ).bind(lot_size_sqm ?? null, lotId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating lot size:', error);
    return c.json({ error: 'Failed to update lot size' }, 500);
  }
});

/**
 * GET /api/admin/homeowners
 * Get list of all homeowners for dropdown (admin only)
 */
adminRouter.get('/homeowners', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    // Get all users with resident role, plus developer account
    const homeowners = await c.env.DB.prepare(`
      SELECT
        id,
        email,
        role
      FROM users
      WHERE role IN ('resident', 'admin')
      ORDER BY role DESC, email ASC
    `).all();

    return c.json({ homeowners: homeowners.results || [] });
  } catch (error) {
    console.error('Error fetching homeowners:', error);
    return c.json({ error: 'Failed to fetch homeowners' }, 500);
  }
});

/**
 * PUT /api/admin/lots/batch/owner
 * Batch assign owner to multiple lots (admin only)
 */
adminRouter.put('/lots/batch/owner', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  // Note: D1 doesn't support transactions, so batch updates are done with Promise.all
  // If some updates fail partway through, partial updates may occur
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  const { lot_ids, owner_user_id } = body;

  if (!Array.isArray(lot_ids) || lot_ids.length === 0) {
    return c.json({ error: 'lot_ids must be a non-empty array' }, 400);
  }

  if (!owner_user_id) {
    return c.json({ error: 'owner_user_id is required' }, 400);
  }

  try {
    // Verify owner exists
    const owner = await c.env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(owner_user_id).first();

    if (!owner) {
      return c.json({ error: 'Owner not found' }, 404);
    }

    // Batch update using individual statements (SQLite doesn't support array in IN clause with binding)
    const results = await Promise.all(
      lot_ids.map(lotId =>
        c.env.DB.prepare('UPDATE households SET owner_id = ? WHERE id = ?')
          .bind(owner_user_id, lotId)
          .run()
      )
    );

    return c.json({ success: true, count: lot_ids.length });
  } catch (error) {
    console.error('Error batch updating lot owner:', error);
    return c.json({ error: 'Failed to batch update lot owner' }, 500);
  }
});

/**
 * POST /api/admin/sync-lots
 * Sync lots from GeoJSON to database (admin only)
 * This endpoint reads the lots.geojson file and upserts household records
 */
adminRouter.post('/sync-lots', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    // Read GeoJSON file from R2 or public folder
    // Since we're in a Worker, we'll need to fetch from a public URL
    const geoUrl = 'https://laguna-hills-hoa.pages.dev/data/lots.geojson';
    const response = await fetch(geoUrl);

    if (!response.ok) {
      return c.json({ error: 'Failed to fetch GeoJSON data' }, 500);
    }

    const geojson = (await response.json()) as {
      type: string;
      features: Array<{
        id?: string;
        properties: {
          path_id: string;
          lot_number: string | null;
          block_number: string | null;
          area_sqm: number | null;
          status: string;
          owner_user_id: string;
          lot_size_sqm: number | null;
        };
      }>;
    };

    if (geojson.type !== 'FeatureCollection' || !geojson.features) {
      return c.json({ error: 'Invalid GeoJSON format' }, 400);
    }

    // Get existing household IDs
    const existingResult = await c.env.DB.prepare('SELECT id FROM households').all();
    const existingIds = new Set(existingResult.results.map((r: any) => r.id));

    // Ensure developer-owner user exists
    const developerCheck = await c.env.DB.prepare(
      "SELECT id FROM users WHERE id = 'developer-owner'"
    ).first();

    if (!developerCheck) {
      // Create developer-owner user
      const passwordHash =
        '$2a$10$YQl7ZWK3WK3L3WK3L3WK3OeWK3L3WK3L3WK3L3WK3L3WK3L3WK3L3';
      await c.env.DB.prepare(
        "INSERT INTO users (id, email, password_hash, role) VALUES ('developer-owner', 'developer@lagunahills.com', ?, 'resident')"
      ).bind(passwordHash).run();
    }

    // Sync lots
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const lot of geojson.features) {
      try {
        const lotId = lot.id || lot.properties.path_id;
        const exists = existingIds.has(lotId);

        // Generate address
        const address =
          lot.properties.block_number && lot.properties.lot_number
            ? `Block ${lot.properties.block_number}, Lot ${lot.properties.lot_number}`
            : `Lot ${lotId}`;

        if (exists) {
          // Update existing
          await c.env.DB.prepare(
            `UPDATE households
             SET address = ?, block = ?, lot = ?, lot_status = ?, lot_size_sqm = ?, owner_id = ?
             WHERE id = ?`
          ).bind(
            address,
            lot.properties.block_number || null,
            lot.properties.lot_number || null,
            lot.properties.lot_status || lot.properties.status || 'vacant_lot',
            lot.properties.lot_size_sqm ?? null,
            lot.properties.owner_user_id || 'developer-owner',
            lotId
          ).run();
          updated++;
        } else {
          // Insert new
          await c.env.DB.prepare(
            `INSERT INTO households (id, address, block, lot, lot_status, lot_size_sqm, owner_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            lotId,
            address,
            lot.properties.block_number || null,
            lot.properties.lot_number || null,
            lot.properties.lot_status || lot.properties.status || 'vacant_lot',
            lot.properties.lot_size_sqm ?? null,
            lot.properties.owner_user_id || 'developer-owner'
          ).run();
          inserted++;
          existingIds.add(lotId);
        }
      } catch (error) {
        errors.push(`${lot.id || lot.properties.path_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return c.json({
      success: true,
      results: {
        inserted,
        updated,
        errors: errors.length,
        errorDetails: errors.slice(0, 10), // Return first 10 errors
      },
    });
  } catch (error) {
    console.error('Error syncing lots:', error);
    return c.json({ error: 'Failed to sync lots' }, 500);
  }
});

// =============================================================================
// ADMIN: Dues Rates Management
// =============================================================================

/**
 * GET /api/admin/dues-rates
 * Get all dues rates (admin only)
 */
adminRouter.get('/dues-rates', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const rates = await c.env.DB.prepare(`
      SELECT
        dr.id,
        dr.rate_per_sqm,
        dr.year,
        dr.effective_date,
        dr.created_at,
        u.email as created_by_email
      FROM dues_rates dr
      LEFT JOIN users u ON dr.created_by = u.id
      ORDER BY dr.year DESC, dr.effective_date DESC
    `).all();

    return c.json({ dues_rates: rates.results || [] });
  } catch (error) {
    console.error('Error fetching dues rates:', error);
    return c.json({ error: 'Failed to fetch dues rates' }, 500);
  }
});

/**
 * POST /api/admin/dues-rates
 * Create new dues rate (admin only)
 */
adminRouter.post('/dues-rates', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const body = await c.req.json();
    const { rate_per_sqm, year, effective_date } = body;

    if (!rate_per_sqm || !year || !effective_date) {
      return c.json({ error: 'rate_per_sqm, year, and effective_date are required' }, 400);
    }

    // Check if rate already exists for this year
    const existing = await c.env.DB.prepare(
      'SELECT id FROM dues_rates WHERE year = ?'
    ).bind(year).first();

    if (existing) {
      return c.json({ error: 'Dues rate already exists for this year' }, 409);
    }

    const id = generateId();
    await c.env.DB.prepare(
      `INSERT INTO dues_rates (id, rate_per_sqm, year, effective_date, created_by)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, rate_per_sqm, year, effective_date, authUser.userId).run();

    const newRate = await c.env.DB.prepare(
      `SELECT * FROM dues_rates WHERE id = ?`
    ).bind(id).first();

    return c.json({ dues_rate: newRate }, 201);
  } catch (error) {
    console.error('Error creating dues rate:', error);
    return c.json({ error: 'Failed to create dues rate' }, 500);
  }
});

/**
 * PUT /api/admin/dues-rates/:id
 * Update dues rate (admin only)
 */
adminRouter.put('/dues-rates/:id', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const { rate_per_sqm, effective_date } = body;

    // Verify rate exists
    const existing = await c.env.DB.prepare(
      'SELECT * FROM dues_rates WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return c.json({ error: 'Dues rate not found' }, 404);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (rate_per_sqm !== undefined) {
      updates.push('rate_per_sqm = ?');
      values.push(rate_per_sqm);
    }

    if (effective_date !== undefined) {
      updates.push('effective_date = ?');
      values.push(effective_date);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    values.push(id);
    await c.env.DB.prepare(
      `UPDATE dues_rates SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    const updated = await c.env.DB.prepare(
      'SELECT * FROM dues_rates WHERE id = ?'
    ).bind(id).first();

    return c.json({ dues_rate: updated });
  } catch (error) {
    console.error('Error updating dues rate:', error);
    return c.json({ error: 'Failed to update dues rate' }, 500);
  }
});

/**
 * DELETE /api/admin/dues-rates/:id
 * Delete dues rate (admin only)
 */
adminRouter.delete('/dues-rates/:id', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');

  try {
    // Verify rate exists
    const existing = await c.env.DB.prepare(
      'SELECT * FROM dues_rates WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return c.json({ error: 'Dues rate not found' }, 404);
    }

    // Delete the rate
    await c.env.DB.prepare('DELETE FROM dues_rates WHERE id = ?').bind(id).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting dues rate:', error);
    return c.json({ error: 'Failed to delete dues rate' }, 500);
  }
});

/**
 * GET /api/admin/dues-rates/active
 * Get current active dues rate (admin only)
 */
adminRouter.get('/dues-rates/active', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const currentYear = new Date().getFullYear();
    const active = await c.env.DB.prepare(`
      SELECT * FROM dues_rates
      WHERE year <= ? AND effective_date <= DATE('now')
      ORDER BY year DESC, effective_date DESC
      LIMIT 1
    `).bind(currentYear).first();

    return c.json({ active_rate: active || null });
  } catch (error) {
    console.error('Error fetching active dues rate:', error);
    return c.json({ error: 'Failed to fetch active dues rate' }, 500);
  }
});

// =============================================================================
// ADMIN: Payment Demands Management
// =============================================================================

/**
 * POST /api/admin/payment-demands/create
 * Create payment demands for all users for a given year (admin only)
 */
adminRouter.post('/payment-demands/create', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const body = await c.req.json();
    const { year, demand_sent_date, due_date } = body;

    if (!year || !demand_sent_date || !due_date) {
      return c.json({ error: 'year, demand_sent_date, and due_date are required' }, 400);
    }

    // Get current active dues rate
    const rateResult = await c.env.DB.prepare(`
      SELECT rate_per_sqm FROM dues_rates
      WHERE year <= ? AND effective_date <= DATE('now')
      ORDER BY year DESC, effective_date DESC
      LIMIT 1
    `).bind(year).first();

    if (!rateResult) {
      return c.json({ error: 'No active dues rate found for this year' }, 400);
    }

    const rate_per_sqm = rateResult.rate_per_sqm;

    // Get all lots with owners
    const lots = await c.env.DB.prepare(`
      SELECT
        h.id as lot_id,
        h.owner_id,
        h.lot_size_sqm,
        u.id as user_id,
        u.email as user_email
      FROM households h
      INNER JOIN users u ON h.owner_id = u.id
      WHERE h.owner_id IS NOT NULL
    `).all();

    const results = {
      created: 0,
      skipped: 0,
      total_amount: 0,
      errors: [] as string[]
    };

    for (const lot of lots.results || []) {
      try {
        const lotSize = lot.lot_size_sqm || 0;
        const amountDue = lotSize * rate_per_sqm;

        // Check if demand already exists
        const existing = await c.env.DB.prepare(
          'SELECT id FROM payment_demands WHERE user_id = ? AND year = ?'
        ).bind(lot.user_id, year).first();

        if (existing) {
          results.skipped++;
          continue;
        }

        const demandId = generateId();
        await c.env.DB.prepare(
          `INSERT INTO payment_demands (id, user_id, year, demand_sent_date, due_date, amount_due)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(demandId, lot.user_id, year, demand_sent_date, due_date, amountDue).run();

        results.created++;
        results.total_amount += amountDue;
      } catch (error) {
        results.errors.push(`Lot ${lot.lot_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return c.json({ results });
  } catch (error) {
    console.error('Error creating payment demands:', error);
    return c.json({ error: 'Failed to create payment demands' }, 500);
  }
});

/**
 * GET /api/admin/payment-demands
 * Get all payment demands with filtering (admin only)
 */
adminRouter.get('/payment-demands', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { year, status } = c.req.query();

    let query = `
      SELECT
        pd.id,
        pd.user_id,
        pd.year,
        pd.demand_sent_date,
        pd.due_date,
        pd.amount_due,
        pd.status,
        pd.paid_date,
        pd.created_at,
        u.email as user_email,
        u.first_name || ' ' || u.last_name as user_name
      FROM payment_demands pd
      INNER JOIN users u ON pd.user_id = u.id
    `;

    const conditions: string[] = [];
    const values: any[] = [];

    if (year) {
      conditions.push('pd.year = ?');
      values.push(year);
    }

    if (status) {
      conditions.push('pd.status = ?');
      values.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY pd.year DESC, pd.demand_sent_date DESC';

    const demands = await c.env.DB.prepare(query).bind(...values).all();

    return c.json({ payment_demands: demands.results || [] });
  } catch (error) {
    console.error('Error fetching payment demands:', error);
    return c.json({ error: 'Failed to fetch payment demands' }, 500);
  }
});

/**
 * POST /api/admin/payments/in-person
 * Record an in-person payment (admin only)
 */
adminRouter.post('/payments/in-person', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const body = await c.req.json();
    const { user_id, amount, method, check_number, period, lot_ids } = body;

    if (!user_id || !amount || !method || !period) {
      return c.json({ error: 'user_id, amount, method, and period are required' }, 400);
    }

    // Verify user exists
    const user = await c.env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(user_id).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Calculate late fees if overdue (1% per month)
    const paymentDate = new Date();
    const dueDate = new Date(period + '-01-31'); // Due Jan 31 of the year
    const monthsLate = Math.max(0, Math.floor((paymentDate.getTime() - dueDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));
    const lateFeeAmount = monthsLate > 0 ? amount * 0.01 * monthsLate : 0;

    const paymentId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO payments (id, household_id, amount, currency, method, status, period, late_fee_amount, late_fee_months, received_by)
       VALUES (?, ?, ?, 'PHP', ?, 'completed', ?, ?, ?, ?)`
    ).bind(
      paymentId,
      user_id, // Using user_id as household_id for in-person payments
      amount,
      method === 'cash' ? 'cash' : 'in-person',
      period,
      lateFeeAmount,
      monthsLate,
      authUser.userId
    ).run();

    const payment = await c.env.DB.prepare(
      'SELECT * FROM payments WHERE id = ?'
    ).bind(paymentId).first();

    // Update payment demand status if exists
    await c.env.DB.prepare(
      `UPDATE payment_demands SET status = 'paid', paid_date = DATE('now')
       WHERE user_id = ? AND year = ? AND status = 'pending'`
    ).bind(user_id, parseInt(period)).run();

    return c.json({ payment, late_fees: lateFeeAmount }, 201);
  } catch (error) {
    console.error('Error recording in-person payment:', error);
    return c.json({ error: 'Failed to record payment' }, 500);
  }
});
