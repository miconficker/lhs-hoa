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
  const result = createHouseholdSchema.partial().safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { address, block, lot, latitude, longitude, map_marker_x, map_marker_y, owner_id } = result.data;

  // Check if household exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM households WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'Household not found' }, 404);
  }

  // Verify owner exists if provided
  if (owner_id) {
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
  if (owner_id !== undefined) {
    updates.push('owner_id = ?');
    values.push(owner_id || null);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  values.push(id);
  await c.env.DB.prepare(
    `UPDATE households SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  // Get updated household
  const household = await c.env.DB.prepare(
    'SELECT * FROM households WHERE id = ?'
  ).bind(id).first() as any;

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
        u.email as owner_email
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
