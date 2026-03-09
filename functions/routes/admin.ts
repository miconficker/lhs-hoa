import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest, hashPassword } from '../lib/auth';
import type { User, UserRole } from '../types';
import { timeBlocksRouter } from './admin/time-blocks';
import { externalRentalsRouter } from './admin/external-rentals';

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

// Mount sub-routers
adminRouter.route('/time-blocks', timeBlocksRouter);
adminRouter.route('/external-rentals', externalRentalsRouter);

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
  // address is auto-generated from street, block, lot
  street: z.string().optional(),
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

  const { street, block, lot, latitude, longitude, map_marker_x, map_marker_y, owner_id, residents } = result.data;

  // Auto-generate address from street, block, lot
  const generatedAddress = `${street || ''}${street ? ', ' : ''}Block ${block || '?'}, Lot ${lot || '?'}`;

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
    INSERT INTO households (id, address, street, block, lot, latitude, longitude, map_marker_x, map_marker_y, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    householdId,
    generatedAddress,
    street ?? null,
    block ?? null,
    lot ?? null,
    latitude ?? null,
    longitude ?? null,
    map_marker_x ?? null,
    map_marker_y ?? null,
    owner_id ?? null
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

  const { street, block, lot, latitude, longitude, map_marker_x, map_marker_y, owner_id, owner_email, residents } = result.data;

  console.log('[Admin] Parsed data - owner_email:', owner_email, 'owner_id:', owner_id, 'residents:', residents);

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

  // If street, block, or lot is being updated, also update address
  const needsAddressUpdate = street !== undefined || block !== undefined || lot !== undefined;
  if (needsAddressUpdate) {
    // Get existing values to generate new address
    const existing = await c.env.DB.prepare(
      'SELECT street, block, lot FROM households WHERE id = ?'
    ).bind(id).first() as any;

    const finalStreet = street !== undefined ? street : (existing?.street || '');
    const finalBlock = block !== undefined ? block : (existing?.block || '');
    const finalLot = lot !== undefined ? lot : (existing?.lot || '');

    const generatedAddress = `${finalStreet || ''}${finalStreet ? ', ' : ''}Block ${finalBlock || '?'}, Lot ${finalLot || '?'}`;
    updates.push('address = ?');
    values.push(generatedAddress);
  }

  if (street !== undefined) {
    updates.push('street = ?');
    values.push(street ?? null);
  }
  if (block !== undefined) {
    updates.push('block = ?');
    values.push(block ?? null);
  }
  if (lot !== undefined) {
    updates.push('lot = ?');
    values.push(lot ?? null);
  }
  if (latitude !== undefined) {
    updates.push('latitude = ?');
    values.push(latitude ?? null);
  }
  if (longitude !== undefined) {
    updates.push('longitude = ?');
    values.push(longitude ?? null);
  }
  if (map_marker_x !== undefined) {
    updates.push('map_marker_x = ?');
    values.push(map_marker_x ?? null);
  }
  if (map_marker_y !== undefined) {
    updates.push('map_marker_y = ?');
    values.push(map_marker_y ?? null);
  }
  if (finalOwnerId !== undefined) {
    updates.push('owner_id = ?');
    values.push(finalOwnerId ?? null);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  values.push(id);
  console.log('[Admin] Executing UPDATE with values:', values);

  await c.env.DB.prepare(
    `UPDATE households SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  // Handle residents update
  // First, delete all existing residents for this household
  await c.env.DB.prepare('DELETE FROM residents WHERE household_id = ?').bind(id).run();

  // Then insert new residents if provided
  if (residents && residents.length > 0) {
    for (const resident of residents) {
      const residentId = generateId();
      await c.env.DB.prepare(`
        INSERT INTO residents (id, household_id, user_id, first_name, last_name, is_primary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        residentId,
        id,
        resident.user_id || null,
        resident.first_name,
        resident.last_name,
        resident.is_primary ? 1 : 0
      ).run();
    }
  }

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
        h.street,
        h.address,
        h.owner_id as owner_user_id,
        h.lot_status,
        h.lot_type,
        h.lot_size_sqm,
        h.lot_label,
        h.lot_description,
        h.household_group_id,
        h.is_primary_lot,
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
 * Pass empty string for owner_user_id to remove ownership (HOA-owned lot)
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

  // Allow empty string to remove ownership (HOA-owned lots)
  if (owner_user_id === undefined) {
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

    // If owner_user_id is provided (not empty), verify owner exists
    if (owner_user_id) {
      const owner = await c.env.DB.prepare(
        'SELECT id, role FROM users WHERE id = ?'
      ).bind(owner_user_id).first();

      if (!owner) {
        return c.json({ error: 'Owner not found' }, 404);
      }
    }

    // Update lot owner (NULL for HOA-owned/common areas)
    await c.env.DB.prepare(
      'UPDATE households SET owner_id = ? WHERE id = ?'
    ).bind(owner_user_id || null, lotId).run();

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
 * PUT /api/admin/lots/:lotId/type
 * Update lot type (admin only)
 */
adminRouter.put('/lots/:lotId/type', async (c) => {
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
  const { lot_type } = body;

  if (!lot_type || !['residential', 'resort', 'commercial', 'community', 'utility', 'open_space'].includes(lot_type)) {
    return c.json({ error: 'Invalid lot_type' }, 400);
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
      'UPDATE households SET lot_type = ? WHERE id = ?'
    ).bind(lot_type, lotId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating lot type:', error);
    return c.json({ error: 'Failed to update lot type' }, 500);
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
 * PUT /api/admin/lots/:lotId/label
 * Update lot label (admin only)
 * Used for naming community areas like "Clubhouse", "Water Tower", etc.
 */
adminRouter.put('/lots/:lotId/label', async (c) => {
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
  const { lot_label } = body;

  // Verify lot exists
  const lot = await c.env.DB.prepare(
    'SELECT id FROM households WHERE id = ?'
  ).bind(lotId).first();

  if (!lot) {
    return c.json({ error: 'Lot not found' }, 404);
  }

  // Allow null (clearing the label) or string
  if (lot_label !== null && lot_label !== undefined && typeof lot_label !== 'string') {
    return c.json({ error: 'Invalid lot_label' }, 400);
  }

  try {
    await c.env.DB.prepare(
      'UPDATE households SET lot_label = ? WHERE id = ?'
    ).bind(lot_label || null, lotId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating lot label:', error);
    return c.json({ error: 'Failed to update lot label' }, 500);
  }
});

/**
 * PUT /api/admin/lots/:lotId/description
 * Update lot description (admin only)
 * Used for describing community areas, amenities, etc.
 */
adminRouter.put('/lots/:lotId/description', async (c) => {
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
  const { lot_description } = body;

  // Verify lot exists
  const lot = await c.env.DB.prepare(
    'SELECT id FROM households WHERE id = ?'
  ).bind(lotId).first();

  if (!lot) {
    return c.json({ error: 'Lot not found' }, 404);
  }

  // Allow null (clearing the description) or string
  if (lot_description !== null && lot_description !== undefined && typeof lot_description !== 'string') {
    return c.json({ error: 'Invalid lot_description' }, 400);
  }

  try {
    await c.env.DB.prepare(
      'UPDATE households SET lot_description = ? WHERE id = ?'
    ).bind(lot_description || null, lotId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating lot description:', error);
    return c.json({ error: 'Failed to update lot description' }, 500);
  }
});

/**
 * PUT /api/admin/lots/:lotId/street
 * Update lot street name (admin only)
 */
adminRouter.put('/lots/:lotId/street', async (c) => {
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
  const { street } = body;

  // Verify lot exists
  const lot = await c.env.DB.prepare(
    'SELECT id, block, lot FROM households WHERE id = ?'
  ).bind(lotId).first();

  if (!lot) {
    return c.json({ error: 'Lot not found' }, 404);
  }

  // Update street (and regenerate address)
  const finalStreet = street !== undefined ? street : null;
  const generatedAddress = `${finalStreet || ''}${finalStreet ? ', ' : ''}Block ${lot.block || '?'}, Lot ${lot.lot || '?'}`;

  await c.env.DB.prepare(
    'UPDATE households SET street = ?, address = ? WHERE id = ?'
  ).bind(finalStreet, generatedAddress, lotId).run();

  return c.json({ success: true });
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
 * POST /api/admin/households/merge
 * Merge multiple lots into one household group
 */
adminRouter.post('/households/merge', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { primary_lot_id, lot_ids_to_merge } = await c.req.json();

    if (!primary_lot_id || !lot_ids_to_merge || !Array.isArray(lot_ids_to_merge)) {
      return c.json({ error: 'primary_lot_id and lot_ids_to_merge array required' }, 400);
    }

    if (lot_ids_to_merge.length === 0) {
      return c.json({ error: 'At least one lot to merge required' }, 400);
    }

    // Validate all lots exist
    const allLotIds = [primary_lot_id, ...lot_ids_to_merge];
    const placeholders = allLotIds.map(() => '?').join(',');
    const lots = await c.env.DB.prepare(
      `SELECT id, owner_id, block, lot, address FROM households WHERE id IN (${placeholders})`
    ).bind(...allLotIds).all();

    if (lots.results.length !== allLotIds.length) {
      return c.json({ error: 'One or more lots not found' }, 404);
    }

    // Validate all lots have same owner
    const primaryLot = lots.results.find((l: any) => l.id === primary_lot_id);
    if (!primaryLot) {
      return c.json({ error: 'Primary lot not found' }, 404);
    }

    const ownerId = primaryLot.owner_id;
    const hasDifferentOwner = lots.results.some((l: any) => l.owner_id !== ownerId);
    if (hasDifferentOwner) {
      return c.json({ error: 'All lots must have the same owner' }, 400);
    }

    // Generate group ID
    const household_group_id = crypto.randomUUID();

    // Update lots - set is_primary_lot = 1 for primary, 0 for others
    const updates = await Promise.all(
      allLotIds.map(lotId =>
        c.env.DB.prepare(`
          UPDATE households
          SET household_group_id = ?,
              is_primary_lot = CASE WHEN id = ? THEN 1 ELSE 0 END
          WHERE id = ?
        `).bind(household_group_id, primary_lot_id, lotId).run()
      )
    );

    return c.json({
      household_group_id,
      merged_count: allLotIds.length,
      lots: lots.results.map((l: any) => ({ lot_id: l.id, address: l.address }))
    });
  } catch (error) {
    console.error('Error merging lots:', error);
    return c.json({ error: 'Failed to merge lots' }, 500);
  }
});

/**
 * POST /api/admin/households/unmerge
 * Remove a lot from a merged group
 */
adminRouter.post('/households/unmerge', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { lot_id } = await c.req.json();

    if (!lot_id) {
      return c.json({ error: 'lot_id required' }, 400);
    }

    // Update lot to remove from group
    await c.env.DB.prepare(`
      UPDATE households
      SET household_group_id = NULL,
          is_primary_lot = 1
      WHERE id = ?
    `).bind(lot_id).run();

    return c.json({ success: true, lot_id });
  } catch (error) {
    console.error('Error unmerging lot:', error);
    return c.json({ error: 'Failed to unmerge lot' }, 500);
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
    // Use dynamic origin to work in both local and production
    const url = new URL(c.req.raw.url);
    const geoUrl = `${url.origin}/data/lots.geojson`;
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
            lot.properties.status || 'vacant_lot',
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
            lot.properties.status || 'vacant_lot',
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
// ADMIN: Reservations Management
// =============================================================================

/**
 * GET /api/admin/reservations
 * Get all reservations with household information (admin only)
 */
adminRouter.get('/reservations', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const reservations = await c.env.DB.prepare(`
      SELECT
        r.id,
        r.household_id,
        r.amenity_type,
        r.date,
        r.slot,
        r.purpose,
        r.status,
        r.created_at,
        h.address as household_address,
        h.street as household_street,
        h.block as household_block,
        h.lot as household_lot,
        u.email as household_email
      FROM reservations r
      LEFT JOIN households h ON r.household_id = h.id
      LEFT JOIN users u ON h.owner_id = u.id
      ORDER BY r.date DESC, r.slot ASC
    `).all();

    return c.json({ reservations: reservations.results || [] });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return c.json({ error: 'Failed to fetch reservations' }, 500);
  }
});

/**
 * PUT /api/admin/reservations/:id/status
 * Update reservation status (admin only)
 */
adminRouter.put('/reservations/:id/status', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const { status } = body;

  if (!status || !['pending', 'confirmed', 'cancelled'].includes(status)) {
    return c.json({ error: 'Invalid status. Must be pending, confirmed, or cancelled' }, 400);
  }

  try {
    await c.env.DB.prepare(
      'UPDATE reservations SET status = ? WHERE id = ?'
    ).bind(status, id).run();

    const reservation = await c.env.DB.prepare(
      'SELECT * FROM reservations WHERE id = ?'
    ).bind(id).first();

    if (!reservation) {
      return c.json({ error: 'Reservation not found' }, 404);
    }

    return c.json({ reservation });
  } catch (error) {
    console.error('Error updating reservation status:', error);
    return c.json({ error: 'Failed to update reservation status' }, 500);
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
        const lotSize = (lot.lot_size_sqm as number) || 0;
        const amountDue = lotSize * (rate_per_sqm as number);

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

// =============================================================================
// ADMIN: Pass Management (/admin/pass-management/*)
// =============================================================================

// -----------------------------------------------------------------------------
// Pass Types Management
// -----------------------------------------------------------------------------

/**
 * GET /api/admin/pass-management/pass-types
 * Get all pass types (admin only)
 */
adminRouter.get('/pass-management/pass-types', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const passTypes = await c.env.DB.prepare(`
      SELECT * FROM pass_types WHERE is_active = 1 ORDER BY category, code
    `).all();

    return c.json({ pass_types: passTypes.results || [] });
  } catch (error) {
    console.error('Error fetching pass types:', error);
    return c.json({ error: 'Failed to fetch pass types' }, 500);
  }
});

/**
 * GET /api/admin/pass-management/stats
 * Get pass management statistics (admin only)
 */
adminRouter.get('/pass-management/stats', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    // Employee stats
    const employeeStats = await c.env.DB.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM household_employees
      GROUP BY status
    `).all();

    // Vehicle stats
    const vehicleStats = await c.env.DB.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM vehicle_registrations
      GROUP BY status
    `).all();

    // Payment status stats
    const paymentStats = await c.env.DB.prepare(`
      SELECT
        payment_status,
        COUNT(*) as count,
        COALESCE(SUM(amount_due), 0) as total_due,
        COALESCE(SUM(amount_paid), 0) as total_paid
      FROM vehicle_registrations
      GROUP BY payment_status
    `).all();

    // Pass type distribution
    const passTypeStats = await c.env.DB.prepare(`
      SELECT
        pass_type,
        COUNT(*) as count,
        COALESCE(SUM(amount_due), 0) as total_revenue
      FROM vehicle_registrations
      WHERE payment_status = 'paid'
      GROUP BY pass_type
    `).all();

    // Pending approvals
    const pendingEmployees = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM household_employees WHERE status = 'pending'
    `).first();

    const pendingVehicles = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM vehicle_registrations WHERE status = 'pending_approval'
    `).first();

    // Expiring soon (next 30 days)
    const expiringEmployees = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM household_employees
      WHERE expiry_date BETWEEN DATE('now') AND DATE('now', '+30 days')
      AND status = 'active'
    `).first();

    return c.json({
      stats: {
        employees: {
          byStatus: employeeStats.results || [],
          pending: (pendingEmployees?.count as number) || 0,
          expiringSoon: (expiringEmployees?.count as number) || 0,
        },
        vehicles: {
          byStatus: vehicleStats.results || [],
          pendingApproval: (pendingVehicles?.count as number) || 0,
        },
        payments: {
          byStatus: paymentStats.results || [],
        },
        passTypes: passTypeStats.results || [],
      },
    });
  } catch (error) {
    console.error('Error fetching pass stats:', error);
    return c.json({ error: 'Failed to fetch pass statistics' }, 500);
  }
});

// =============================================================================
// ADMIN: Employee Management
// =============================================================================

/**
 * GET /api/admin/pass-management/employees
 * Get all employees with optional filters (admin only)
 */
adminRouter.get('/pass-management/employees', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { status, employee_type, household_id, search } = c.req.query();

    let query = `
      SELECT
        he.*,
        h.address as household_address,
        h.block,
        h.lot,
        u.email as owner_email,
        u.first_name || ' ' || u.last_name as owner_name
      FROM household_employees he
      JOIN households h ON he.household_id = h.id
      LEFT JOIN users u ON h.owner_id = u.id
    `;

    const conditions: string[] = [];
    const values: any[] = [];

    if (status) {
      conditions.push('he.status = ?');
      values.push(status);
    }

    if (employee_type) {
      conditions.push('he.employee_type = ?');
      values.push(employee_type);
    }

    if (household_id) {
      conditions.push('he.household_id = ?');
      values.push(household_id);
    }

    if (search) {
      conditions.push('(he.full_name LIKE ? OR he.id_number LIKE ?)');
      values.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY he.created_at DESC';

    const employees = await c.env.DB.prepare(query).bind(...values).all();

    return c.json({ employees: employees.results || [] });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return c.json({ error: 'Failed to fetch employees' }, 500);
  }
});

/**
 * POST /api/admin/pass-management/employees
 * Create employee pass on behalf of household (admin only)
 * Updated for unified pass system - uses pass_type_id and payment fields
 */
adminRouter.post('/pass-management/employees', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const body = await c.req.json();
    const { household_id, full_name, employee_type, photo, expiry_date } = body;

    if (!household_id || !full_name || !employee_type) {
      return c.json({ error: 'Missing required fields: household_id, full_name, employee_type' }, 400);
    }

    // Verify household exists
    const household = await c.env.DB.prepare(`
      SELECT id, address FROM households WHERE id = ?
    `).bind(household_id).first();

    if (!household) {
      return c.json({ error: 'Household not found' }, 404);
    }

    // Validate employee_type
    const validTypes = ['driver', 'housekeeper', 'caretaker', 'other'];
    if (!validTypes.includes(employee_type)) {
      return c.json({ error: `Invalid employee_type. Must be one of: ${validTypes.join(', ')}` }, 400);
    }

    // Generate unique ID number
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    const idNumber = `EMP-${timestamp}-${random}`.toUpperCase();

    // Get current employee ID fee
    const feeResult = await c.env.DB.prepare(`
      SELECT amount FROM pass_fees WHERE pass_type_id = 'pt-employee'
      ORDER BY effective_date DESC LIMIT 1
    `).first();
    const feeAmount = feeResult?.amount ? Number(feeResult.amount) : 100;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Handle photo if provided (base64 string or R2 storage)
    let photoUrl: string | undefined;
    if (photo) {
      // Assuming photo is base64 data URL
      const matches = photo.match(/^data:image\/(\w+);base64,(.+)$/);
      if (matches) {
        const [_, format, base64Data] = matches;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const key = `employee-photos/${id}.${format}`;
        await c.env.R2.put(key, bytes);
        photoUrl = `r2://${key}`;
      }
    }

    await c.env.DB.prepare(`
      INSERT INTO household_employees (id, household_id, full_name, employee_type, id_number, photo_url, pass_type_id, amount_due, amount_paid, payment_status, status, issued_date, created_at, updated_at${expiry_date ? ', expiry_date' : ''})
      VALUES (?, ?, ?, ?, ?, ?, 'pt-employee', ?, 0, 'unpaid', 'active', ?, ?${expiry_date ? ', ?' : ''})
    `).bind(
      id,
      household_id,
      full_name,
      employee_type,
      idNumber,
      photoUrl || null,
      feeAmount,
      now,
      now,
      ...(expiry_date ? [expiry_date] : [])
    ).run();

    const employee = await c.env.DB.prepare(`
      SELECT he.*, h.address as household_address
      FROM household_employees he
      JOIN households h ON he.household_id = h.id
      WHERE he.id = ?
    `).bind(id).first();

    return c.json({ employee }, 201);
  } catch (error) {
    console.error('Error creating employee:', error);
    return c.json({ error: 'Failed to create employee' }, 500);
  }
});

/**
 * GET /api/admin/pass-management/employees/:id
 * Get employee details (admin only)
 */
adminRouter.get('/pass-management/employees/:id', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');

    const employee = await c.env.DB.prepare(`
      SELECT
        he.*,
        h.address as household_address,
        h.block,
        h.lot,
        u.email as owner_email,
        u.first_name || ' ' || u.last_name as owner_name,
        u.phone as owner_phone
      FROM household_employees he
      JOIN households h ON he.household_id = h.id
      LEFT JOIN users u ON h.owner_id = u.id
      WHERE he.id = ?
    `).bind(id).first();

    if (!employee) {
      return c.json({ error: 'Employee not found' }, 404);
    }

    return c.json({ employee });
  } catch (error) {
    console.error('Error fetching employee:', error);
    return c.json({ error: 'Failed to fetch employee' }, 500);
  }
});

/**
 * GET /api/admin/pass-management/employees/:id/print
 * Generate ID card for printing (admin only)
 */
adminRouter.get('/pass-management/employees/:id/print', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');

    const employee = await c.env.DB.prepare(`
      SELECT
        he.*,
        h.address as household_address,
        h.block,
        h.lot
      FROM household_employees he
      JOIN households h ON he.household_id = h.id
      WHERE he.id = ?
    `).bind(id).first() as any;

    if (!employee) {
      return c.json({ error: 'Employee not found' }, 404);
    }

    // Generate HTML for ID card
    const idCardHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ID Card - ${employee.full_name}</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
    .id-card {
      width: 3.375in;
      height: 2.125in;
      border: 1px solid #000;
      padding: 15px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .header {
      text-align: center;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .content {
      display: flex;
      gap: 15px;
      flex: 1;
    }
    .photo {
      width: 100px;
      height: 120px;
      background: #fff;
      border: 2px solid #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
      font-size: 12px;
    }
    .details {
      flex: 1;
      font-size: 11px;
      line-height: 1.4;
    }
    .details strong { font-size: 12px; }
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 10px;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="id-card">
    <div class="header">LAGUNA HILLS HOA</div>
    <div class="content">
      <div class="photo">
        ${employee.photo_url
          ? `<img src="${employee.photo_url}" style="width:100%;height:100%;object-fit:cover;" />`
          : 'NO PHOTO'}
      </div>
      <div class="details">
        <strong>${employee.full_name.toUpperCase()}</strong><br>
        ID: ${employee.id_number}<br>
        Type: ${employee.employee_type.toUpperCase()}<br>
        Authorized Personnel<br>
        ${employee.issued_date ? `Issued: ${employee.issued_date}` : ''}<br>
        ${employee.expiry_date ? `Expires: ${employee.expiry_date}` : ''}
      </div>
    </div>
    <div class="footer">Block ${employee.block || '?'} Lot ${employee.lot || '?'}</div>
  </div>
</body>
</html>
    `;

    return c.html(idCardHtml);
  } catch (error) {
    console.error('Error generating ID card:', error);
    return c.json({ error: 'Failed to generate ID card' }, 500);
  }
});

/**
 * PUT /api/admin/pass-management/employees/:id/status
 * Approve/revoke employee ID (admin only)
 */
adminRouter.put('/pass-management/employees/:id/status', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { status, issued_date, expiry_date, notes } = body;

    if (!status || !['pending', 'active', 'revoked', 'expired'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    // Verify employee exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM household_employees WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return c.json({ error: 'Employee not found' }, 404);
    }

    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const values: any[] = [status, new Date().toISOString()];

    if (issued_date !== undefined) {
      updates.push('issued_date = ?');
      values.push(issued_date);
    }

    if (expiry_date !== undefined) {
      updates.push('expiry_date = ?');
      values.push(expiry_date);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    values.push(id);
    await c.env.DB.prepare(
      `UPDATE household_employees SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    const updated = await c.env.DB.prepare(`
      SELECT he.*, h.address as household_address
      FROM household_employees he
      JOIN households h ON he.household_id = h.id
      WHERE he.id = ?
    `).bind(id).first();

    return c.json({ employee: updated });
  } catch (error) {
    console.error('Error updating employee status:', error);
    return c.json({ error: 'Failed to update employee status' }, 500);
  }
});

// =============================================================================
// ADMIN: Vehicle Management
// =============================================================================

/**
 * GET /api/admin/pass-management/vehicles
 * Get all vehicles with optional filters (admin only)
 * Updated for unified pass system - uses vehicles_with_passes_view
 */
adminRouter.get('/pass-management/vehicles', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { status, payment_status, household_id, search } = c.req.query();

    // Use the new view for unified pass system
    let query = `
      SELECT
        v.id,
        v.household_id,
        v.household_address,
        v.plate_number,
        v.make,
        v.model,
        v.color,
        v.vehicle_status as status,
        v.pass_type,
        v.sticker_pass_id,
        v.sticker_number,
        v.sticker_amount_due,
        v.sticker_amount_paid,
        v.sticker_payment_status,
        v.sticker_issued_date,
        v.sticker_expiry_date,
        v.rfid_pass_id,
        v.rfid_code,
        v.rfid_amount_due,
        v.rfid_amount_paid,
        v.rfid_payment_status,
        v.total_amount_due,
        v.total_amount_paid,
        v.total_balance_due,
        v.created_at,
        v.updated_at,
        h.block,
        h.lot,
        u.email as owner_email,
        u.first_name || ' ' || u.last_name as owner_name,
        u.phone as owner_phone
      FROM vehicles_with_passes_view v
      JOIN households h ON v.household_id = h.id
      LEFT JOIN users u ON h.owner_id = u.id
    `;

    const conditions: string[] = [];
    const values: any[] = [];

    if (status) {
      conditions.push('v.vehicle_status = ?');
      values.push(status);
    }

    if (payment_status) {
      // For unified system, check overall payment status
      if (payment_status === 'paid') {
        conditions.push('(v.sticker_payment_status = ? OR v.rfid_payment_status = ?)');
        values.push('paid', 'paid');
      } else {
        conditions.push('(v.sticker_payment_status = ? OR v.rfid_payment_status = ?)');
        values.push(payment_status, payment_status);
      }
    }

    if (household_id) {
      conditions.push('v.household_id = ?');
      values.push(household_id);
    }

    if (search) {
      conditions.push('(v.plate_number LIKE ? OR u.first_name || \' \' || u.last_name LIKE ?)');
      values.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY v.created_at DESC';

    const vehicles = await c.env.DB.prepare(query).bind(...values).all();

    return c.json({ vehicles: vehicles.results || [] });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return c.json({ error: 'Failed to fetch vehicles' }, 500);
  }
});

/**
 * POST /api/admin/pass-management/vehicles
 * Create vehicle registration on behalf of household (admin only)
 * Updated for unified pass system - uses checkboxes for pass types
 */
adminRouter.post('/pass-management/vehicles', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const body = await c.req.json();
    // Support both old format (pass_type) and new format (has_sticker, has_rfid)
    const { household_id, plate_number, make, model, color, pass_type, has_sticker, has_rfid } = body;

    if (!household_id || !plate_number || !make || !model || !color) {
      return c.json({ error: 'Missing required fields: household_id, plate_number, make, model, color' }, 400);
    }

    // Verify household exists
    const household = await c.env.DB.prepare(`
      SELECT id, address FROM households WHERE id = ?
    `).bind(household_id).first();

    if (!household) {
      return c.json({ error: 'Household not found' }, 404);
    }

    // Determine which passes to create (backward compatible)
    let createSticker = has_sticker || false;
    let createRfid = has_rfid || false;

    // Handle legacy pass_type format
    if (pass_type) {
      const validPassTypes = ['sticker', 'rfid', 'both'];
      if (!validPassTypes.includes(pass_type)) {
        return c.json({ error: `Invalid pass_type. Must be one of: ${validPassTypes.join(', ')}` }, 400);
      }
      if (pass_type === 'sticker') createSticker = true;
      if (pass_type === 'rfid') createRfid = true;
      if (pass_type === 'both') {
        createSticker = true;
        createRfid = true;
      }
    }

    // At least one pass type must be selected
    if (!createSticker && !createRfid) {
      return c.json({ error: 'At least one pass type must be selected' }, 400);
    }

    // Convert plate number to uppercase
    const normalizedPlate = plate_number.toUpperCase();

    // Create vehicle registration
    const vehicleId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Set pass_type for backward compatibility
    const legacyPassType = createSticker && createRfid ? 'both' : createSticker ? 'sticker' : 'rfid';

    await c.env.DB.prepare(`
      INSERT INTO vehicle_registrations (id, household_id, plate_number, make, model, color, pass_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?)
    `).bind(
      vehicleId,
      household_id,
      normalizedPlate,
      make,
      model,
      color,
      legacyPassType,
      now,
      now
    ).run();

    // Create sticker pass if requested
    if (createSticker) {
      const stickerFee = await c.env.DB.prepare(`
        SELECT amount FROM pass_fees WHERE pass_type_id = 'pt-sticker'
        ORDER BY effective_date DESC LIMIT 1
      `).first();
      const feeAmount = stickerFee?.amount ? Number(stickerFee.amount) : 500;

      // Stickers expire at end of current year
      await c.env.DB.prepare(`
        INSERT INTO vehicle_passes (id, vehicle_id, pass_type_id, identifier, amount_due, amount_paid, payment_status, status, issued_date, expiry_date, created_at, updated_at)
        VALUES (?, ?, 'pt-sticker', ?, ?, 0, 'unpaid', 'active', DATE('now'), DATE('now', 'start of year', '+1 year', '-1 day'), ?, ?)
      `).bind(
        crypto.randomUUID(),
        vehicleId,
        `ST-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        feeAmount,
        now,
        now
      ).run();
    }

    // Create RFID pass if requested
    if (createRfid) {
      const rfidFee = await c.env.DB.prepare(`
        SELECT amount FROM pass_fees WHERE pass_type_id = 'pt-rfid'
        ORDER BY effective_date DESC LIMIT 1
      `).first();
      const feeAmount = rfidFee?.amount ? Number(rfidFee.amount) : 800;

      // RFID passes don't expire
      await c.env.DB.prepare(`
        INSERT INTO vehicle_passes (id, vehicle_id, pass_type_id, identifier, amount_due, amount_paid, payment_status, status, issued_date, created_at, updated_at)
        VALUES (?, ?, 'pt-rfid', ?, ?, 0, 'unpaid', 'active', DATE('now'), ?, ?)
      `).bind(
        crypto.randomUUID(),
        vehicleId,
        `RF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        feeAmount,
        now,
        now
      ).run();
    }

    // Get vehicle with passes using the view
    const vehicle = await c.env.DB.prepare(`
      SELECT * FROM vehicles_with_passes_view WHERE id = ?
    `).bind(vehicleId).first();

    return c.json({ vehicle }, 201);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    return c.json({ error: 'Failed to create vehicle' }, 500);
  }
});

/**
 * GET /api/admin/pass-management/vehicles/:id
 * Get vehicle details (admin only)
 */
adminRouter.get('/pass-management/vehicles/:id', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');

    const vehicle = await c.env.DB.prepare(`
      SELECT
        vr.*,
        h.address as household_address,
        h.block,
        h.lot,
        u.email as owner_email,
        u.first_name || ' ' || u.last_name as owner_name,
        u.phone as owner_phone
      FROM vehicle_registrations vr
      JOIN households h ON vr.household_id = h.id
      LEFT JOIN users u ON h.owner_id = u.id
      WHERE vr.id = ?
    `).bind(id).first();

    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    return c.json({ vehicle });
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return c.json({ error: 'Failed to fetch vehicle' }, 500);
  }
});

/**
 * PUT /api/admin/pass-management/vehicles/:id/status
 * Approve/cancel vehicle registration (admin only)
 */
adminRouter.put('/pass-management/vehicles/:id/status', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { status, notes } = body;

    if (!status || !['pending_payment', 'pending_approval', 'active', 'cancelled', 'expired'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    // Verify vehicle exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM vehicle_registrations WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const values: any[] = [status, new Date().toISOString()];

    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    // Set issued_date when activating
    if (status === 'active') {
      updates.push('issued_date = DATE("now")');
    }

    values.push(id);
    await c.env.DB.prepare(
      `UPDATE vehicle_registrations SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    const updated = await c.env.DB.prepare(`
      SELECT vr.*, h.address as household_address
      FROM vehicle_registrations vr
      JOIN households h ON vr.household_id = h.id
      WHERE vr.id = ?
    `).bind(id).first();

    return c.json({ vehicle: updated });
  } catch (error) {
    console.error('Error updating vehicle status:', error);
    return c.json({ error: 'Failed to update vehicle status' }, 500);
  }
});

/**
 * PUT /api/admin/pass-management/vehicles/:id/assign-rfid
 * Assign RFID code to vehicle (admin only)
 * Updated for unified pass system - works with vehicle_passes table
 */
adminRouter.put('/pass-management/vehicles/:id/assign-rfid', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { rfid_code } = body;

    if (!rfid_code) {
      return c.json({ error: 'rfid_code is required' }, 400);
    }

    // Verify vehicle exists
    const vehicle = await c.env.DB.prepare(
      'SELECT * FROM vehicle_registrations WHERE id = ?'
    ).bind(id).first() as any;

    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    // Check if vehicle has RFID pass
    const existingPass = await c.env.DB.prepare(
      'SELECT id FROM vehicle_passes WHERE vehicle_id = ? AND pass_type_id = ?'
    ).bind(id, 'pt-rfid').first();

    if (!existingPass) {
      return c.json({ error: 'Vehicle does not have an RFID pass. Please add one first.' }, 400);
    }

    // Check RFID uniqueness
    const existing = await c.env.DB.prepare(
      'SELECT id FROM vehicle_passes WHERE identifier = ? AND id != ?'
    ).bind(rfid_code, existingPass.id).first();

    if (existing) {
      return c.json({ error: 'RFID code already in use' }, 409);
    }

    // Update vehicle_pass with RFID code
    await c.env.DB.prepare(`
      UPDATE vehicle_passes
      SET identifier = ?, updated_at = ?
      WHERE id = ?
    `).bind(rfid_code, new Date().toISOString(), existingPass.id).run();

    // Also update legacy field for backward compatibility
    await c.env.DB.prepare(`
      UPDATE vehicle_registrations
      SET rfid_code = ?, updated_at = ?
      WHERE id = ?
    `).bind(rfid_code, new Date().toISOString(), id).run();

    // Auto-approve if all assigned passes have codes
    const passes = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM vehicle_passes WHERE vehicle_id = ? AND identifier IS NOT NULL'
    ).bind(id).first() as any;

    const totalPasses = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM vehicle_passes WHERE vehicle_id = ?'
    ).bind(id).first() as any;

    if (passes.count === totalPasses.count) {
      await c.env.DB.prepare(`
        UPDATE vehicle_registrations
        SET status = 'active', issued_date = DATE('now')
        WHERE id = ?
      `).bind(id).run();
    }

    const updated = await c.env.DB.prepare(`
      SELECT * FROM vehicles_with_passes_view WHERE id = ?
    `).bind(id).first();

    return c.json({ vehicle: updated });
  } catch (error) {
    console.error('Error assigning RFID:', error);
    return c.json({ error: 'Failed to assign RFID' }, 500);
  }
});

/**
 * PUT /api/admin/pass-management/vehicles/:id/assign-sticker
 * Assign sticker number to vehicle (admin only)
 * Updated for unified pass system - works with vehicle_passes table
 */
adminRouter.put('/pass-management/vehicles/:id/assign-sticker', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { sticker_number } = body;

    if (!sticker_number) {
      return c.json({ error: 'sticker_number is required' }, 400);
    }

    // Verify vehicle exists
    const vehicle = await c.env.DB.prepare(
      'SELECT * FROM vehicle_registrations WHERE id = ?'
    ).bind(id).first() as any;

    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    // Check if vehicle has sticker pass
    const existingPass = await c.env.DB.prepare(
      'SELECT id FROM vehicle_passes WHERE vehicle_id = ? AND pass_type_id = ?'
    ).bind(id, 'pt-sticker').first();

    if (!existingPass) {
      return c.json({ error: 'Vehicle does not have a sticker pass. Please add one first.' }, 400);
    }

    // Check sticker uniqueness
    const existing = await c.env.DB.prepare(
      'SELECT id FROM vehicle_passes WHERE identifier = ? AND id != ?'
    ).bind(sticker_number, existingPass.id).first();

    if (existing) {
      return c.json({ error: 'Sticker number already in use' }, 409);
    }

    // Update vehicle_pass with sticker number
    await c.env.DB.prepare(`
      UPDATE vehicle_passes
      SET identifier = ?, updated_at = ?
      WHERE id = ?
    `).bind(sticker_number, new Date().toISOString(), existingPass.id).run();

    // Also update legacy field for backward compatibility
    await c.env.DB.prepare(`
      UPDATE vehicle_registrations
      SET sticker_number = ?, updated_at = ?
      WHERE id = ?
    `).bind(sticker_number, new Date().toISOString(), id).run();

    // Auto-approve if all assigned passes have codes
    const passes = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM vehicle_passes WHERE vehicle_id = ? AND identifier IS NOT NULL'
    ).bind(id).first() as any;

    const totalPasses = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM vehicle_passes WHERE vehicle_id = ?'
    ).bind(id).first() as any;

    if (passes.count === totalPasses.count) {
      await c.env.DB.prepare(`
        UPDATE vehicle_registrations
        SET status = 'active', issued_date = DATE('now')
        WHERE id = ?
      `).bind(id).run();
    }

    const updated = await c.env.DB.prepare(`
      SELECT * FROM vehicles_with_passes_view WHERE id = ?
    `).bind(id).first();

    return c.json({ vehicle: updated });
  } catch (error) {
    console.error('Error assigning sticker:', error);
    return c.json({ error: 'Failed to assign sticker' }, 500);
  }
});

/**
 * POST /api/admin/pass-management/vehicles/:id/replace-rfid
 * Replace damaged RFID card with new one (admin only)
 * Old RFID is marked as 'replaced', new RFID is created with unpaid status
 */
adminRouter.post('/pass-management/vehicles/:id/replace-rfid', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { notes } = body;

    // Verify vehicle exists
    const vehicle = await c.env.DB.prepare(
      'SELECT * FROM vehicle_registrations WHERE id = ?'
    ).bind(id).first() as any;

    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    // Check if vehicle has an active RFID pass
    const existingRfid = await c.env.DB.prepare(
      'SELECT * FROM vehicle_passes WHERE vehicle_id = ? AND pass_type_id = ? AND status = ?'
    ).bind(id, 'pt-rfid', 'active').first() as any;

    if (!existingRfid) {
      return c.json({ error: 'Vehicle does not have an active RFID pass to replace' }, 400);
    }

    // Get current RFID fee
    const fee = await c.env.DB.prepare(
      'SELECT amount FROM pass_fees WHERE pass_type_id = ? ORDER BY effective_date DESC LIMIT 1'
    ).bind('pt-rfid').first() as any;

    const rfidFee = fee?.amount || 800;

    // Mark old RFID as replaced
    await c.env.DB.prepare(`
      UPDATE vehicle_passes
      SET status = 'replaced', notes = ?, updated_at = ?
      WHERE id = ?
    `).bind(notes || 'Replaced due to damage', new Date().toISOString(), existingRfid.id).run();

    // Create new RFID pass
    const newRfidId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const newRfidCode = `RF-${Date.now()}`;

    await c.env.DB.prepare(`
      INSERT INTO vehicle_passes (id, vehicle_id, pass_type_id, identifier, amount_due, amount_paid, payment_status, status, issued_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 'unpaid', 'active', DATE('now'), ?, ?)
    `).bind(newRfidId, id, 'pt-rfid', newRfidCode, rfidFee, timestamp, timestamp).run();

    // Update legacy rfid_code field
    await c.env.DB.prepare(`
      UPDATE vehicle_registrations
      SET rfid_code = ?, updated_at = ?
      WHERE id = ?
    `).bind(newRfidCode, timestamp, id).run();

    const updated = await c.env.DB.prepare(`
      SELECT * FROM vehicles_with_passes_view WHERE id = ?
    `).bind(id).first();

    return c.json({
      vehicle: updated,
      new_rfid_pass: {
        id: newRfidId,
        identifier: newRfidCode,
        amount_due: rfidFee,
        payment_status: 'unpaid',
      },
    });
  } catch (error) {
    console.error('Error replacing RFID:', error);
    return c.json({ error: 'Failed to replace RFID' }, 500);
  }
});

/**
 * DELETE /api/admin/pass-management/vehicles/:id
 * Permanently delete vehicle registration (admin only)
 * This is a hard delete - removes the vehicle and all associated passes
 */
adminRouter.delete('/pass-management/vehicles/:id', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');

    // Verify vehicle exists
    const vehicle = await c.env.DB.prepare(
      'SELECT id, status FROM vehicle_registrations WHERE id = ?'
    ).bind(id).first();

    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    // Warning: only allow deletion of cancelled or pending vehicles
    // Active vehicles should be cancelled first
    if (vehicle.status === 'active') {
      return c.json({
        error: 'Cannot delete active vehicle. Please cancel it first.',
      }, 400);
    }

    // Delete vehicle (cascades to vehicle_passes via ON DELETE CASCADE)
    await c.env.DB.prepare('DELETE FROM vehicle_registrations WHERE id = ?')
      .bind(id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return c.json({ error: 'Failed to delete vehicle' }, 500);
  }
});

/**
 * POST /api/admin/pass-management/vehicles/:id/record-payment
 * Record in-person payment for vehicle pass (admin only)
 * Updated for unified pass system - works with specific vehicle_pass
 */
adminRouter.post('/pass-management/vehicles/:id/record-payment', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { amount, method, reference_number, pass_type } = body;

    if (!amount || !method) {
      return c.json({ error: 'amount and method are required' }, 400);
    }

    if (!['gcash', 'paymaya', 'instapay', 'cash', 'in-person'].includes(method)) {
      return c.json({ error: 'Invalid payment method' }, 400);
    }

    // Verify vehicle exists
    const vehicle = await c.env.DB.prepare(
      'SELECT * FROM vehicle_registrations WHERE id = ?'
    ).bind(id).first() as any;

    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    // Determine which pass to pay (sticker, rfid, or both)
    let passTypeIds: string[] = [];
    if (pass_type === 'sticker' || (!pass_type && vehicle.pass_type === 'sticker')) {
      passTypeIds.push('pt-sticker');
    }
    if (pass_type === 'rfid' || (!pass_type && vehicle.pass_type === 'rfid')) {
      passTypeIds.push('pt-rfid');
    }
    if (pass_type === 'both' || (!pass_type && vehicle.pass_type === 'both')) {
      passTypeIds.push('pt-sticker');
      passTypeIds.push('pt-rfid');
    }

    if (passTypeIds.length === 0) {
      return c.json({ error: 'No valid pass type found for this vehicle' }, 400);
    }

    // Get all passes for this vehicle
    const passes = await c.env.DB.prepare(
      `SELECT id, amount_due, amount_paid FROM vehicle_passes WHERE vehicle_id = ? AND pass_type_id IN (${passTypeIds.map(() => '?').join(',')})`
    ).bind(id, ...passTypeIds).all() as any[];

    if (!passes.results || passes.results.length === 0) {
      return c.json({ error: 'No passes found for this vehicle' }, 404);
    }

    const now = new Date().toISOString();
    let totalPaid = 0;

    // Update each pass with payment
    for (const pass of passes.results) {
      const paymentAmount = Math.min(amount - totalPaid, pass.amount_due - pass.amount_paid);
      if (paymentAmount > 0) {
        const newAmountPaid = pass.amount_paid + paymentAmount;
        const paymentStatus = newAmountPaid >= pass.amount_due ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid';

        await c.env.DB.prepare(`
          UPDATE vehicle_passes
          SET amount_paid = ?, payment_status = ?, updated_at = ?
          WHERE id = ?
        `).bind(newAmountPaid, paymentStatus, now, pass.id).run();

        totalPaid += paymentAmount;
      }
    }

    // Update vehicle status based on payment
    const allPasses = await c.env.DB.prepare(
      'SELECT payment_status FROM vehicle_passes WHERE vehicle_id = ?'
    ).bind(id).all() as any[];

    const allPaid = allPasses.results?.every((p: any) => p.payment_status === 'paid');
    if (allPaid) {
      await c.env.DB.prepare(`
        UPDATE vehicle_registrations
        SET status = 'active', issued_date = DATE('now'), updated_at = ?
        WHERE id = ?
      `).bind(now, id).run();
    }

    // Create payment record for the first pass (for tracking)
    const firstPass = passes.results[0];
    const paymentId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO payments (id, household_id, amount, currency, method, reference_number, status, payment_category, period, received_by, pass_type_id, vehicle_pass_id)
       VALUES (?, ?, ?, 'PHP', ?, ?, 'completed', 'vehicle_pass', DATE('now'), ?, ?, ?)`
    ).bind(paymentId, vehicle.household_id, totalPaid, method, reference_number || null, authUser.userId, passTypeIds[0], firstPass.id).run();

    const updated = await c.env.DB.prepare(`
      SELECT * FROM vehicles_with_passes_view WHERE id = ?
    `).bind(id).first();

    return c.json({ vehicle: updated, payment_id: paymentId, amount_paid: totalPaid });
  } catch (error) {
    console.error('Error recording payment:', error);
    return c.json({ error: 'Failed to record payment' }, 500);
  }
});

/**
 * POST /api/admin/pass-management/employees/:id/record-payment
 * Record in-person payment for employee pass (admin only)
 * New endpoint for unified payment system
 */
adminRouter.post('/pass-management/employees/:id/record-payment', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { amount, method, reference_number } = body;

    if (!amount || !method) {
      return c.json({ error: 'amount and method are required' }, 400);
    }

    if (!['gcash', 'paymaya', 'instapay', 'cash', 'in-person'].includes(method)) {
      return c.json({ error: 'Invalid payment method' }, 400);
    }

    // Verify employee exists
    const employee = await c.env.DB.prepare(
      'SELECT * FROM household_employees WHERE id = ?'
    ).bind(id).first() as any;

    if (!employee) {
      return c.json({ error: 'Employee not found' }, 404);
    }

    const now = new Date().toISOString();
    const newAmountPaid = (employee.amount_paid || 0) + amount;
    const paymentStatus = newAmountPaid >= (employee.amount_due || 0) ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid';

    // Update employee payment status
    await c.env.DB.prepare(`
      UPDATE household_employees
      SET amount_paid = ?, payment_status = ?, updated_at = ?
      WHERE id = ?
    `).bind(newAmountPaid, paymentStatus, now, id).run();

    // Create payment record
    const paymentId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO payments (id, household_id, amount, currency, method, reference_number, status, payment_category, period, received_by, pass_type_id, employee_pass_id)
       VALUES (?, ?, ?, 'PHP', ?, ?, 'completed', 'employee_id', DATE('now'), ?, ?, ?)`
    ).bind(paymentId, employee.household_id, amount, method, reference_number || null, authUser.userId, employee.pass_type_id || 'pt-employee', id).run();

    const updated = await c.env.DB.prepare(`
      SELECT he.*, h.address as household_address
      FROM household_employees he
      JOIN households h ON he.household_id = h.id
      WHERE he.id = ?
    `).bind(id).first();

    return c.json({ employee: updated, payment_id: paymentId, amount_paid: amount });
  } catch (error) {
    console.error('Error recording employee payment:', error);
    return c.json({ error: 'Failed to record payment' }, 500);
  }
});

// =============================================================================
// ADMIN: Pass Fee Management
// =============================================================================

/**
 * GET /api/admin/pass-management/fees
 * Get current fee structure (admin only)
 * Updated for unified pass system - uses pass_type_id
 */
adminRouter.get('/pass-management/fees', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    // Get fees with pass type details
    const fees = await c.env.DB.prepare(`
      SELECT pf.*, pt.code as pass_type_code, pt.name as pass_type_name, pt.category
      FROM pass_fees pf
      JOIN pass_types pt ON pt.id = pf.pass_type_id
      WHERE pf.effective_date <= DATE('now')
      ORDER BY pf.pass_type_id, pf.effective_date DESC
    `).all();

    // Get latest fee for each pass type
    const feeMap: Record<string, any> = {};
    for (const fee of fees.results || []) {
      const passTypeId = fee.pass_type_id as string;
      if (!feeMap[passTypeId]) {
        feeMap[passTypeId] = fee;
      }
    }

    return c.json({ fees: Object.values(feeMap) });
  } catch (error) {
    console.error('Error fetching pass fees:', error);
    return c.json({ error: 'Failed to fetch pass fees' }, 500);
  }
});

/**
 * PUT /api/admin/pass-management/fees
 * Update fee structure (admin only)
 * Updated for unified pass system - uses pass_type_id
 */
adminRouter.put('/pass-management/fees', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const body = await c.req.json();
    const { sticker_fee, rfid_fee, employee_fee } = body;

    const now = new Date();
    const effective_date = now.toISOString().split('T')[0];
    const timestamp = now.toISOString();
    const updated = [];

    // Update sticker fee if provided
    if (sticker_fee !== undefined) {
      const id = `fee-sticker-${Date.now()}`;
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO pass_fees (id, pass_type_id, amount, effective_date, created_at, updated_at)
         VALUES (?, 'pt-sticker', ?, ?, ?, ?)`
      ).bind(id, sticker_fee, effective_date, timestamp, timestamp).run();

      const fee = await c.env.DB.prepare(`
        SELECT pf.*, pt.code as pass_type_code, pt.name as pass_type_name
        FROM pass_fees pf
        JOIN pass_types pt ON pt.id = pf.pass_type_id
        WHERE pf.id = ?
      `).bind(id).first();

      updated.push(fee);
    }

    // Update RFID fee if provided
    if (rfid_fee !== undefined) {
      const id = `fee-rfid-${Date.now()}`;
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO pass_fees (id, pass_type_id, amount, effective_date, created_at, updated_at)
         VALUES (?, 'pt-rfid', ?, ?, ?, ?)`
      ).bind(id, rfid_fee, effective_date, timestamp, timestamp).run();

      const fee = await c.env.DB.prepare(`
        SELECT pf.*, pt.code as pass_type_code, pt.name as pass_type_name
        FROM pass_fees pf
        JOIN pass_types pt ON pt.id = pf.pass_type_id
        WHERE pf.id = ?
      `).bind(id).first();

      updated.push(fee);
    }

    // Update employee fee if provided (new for unified system)
    if (employee_fee !== undefined) {
      const id = `fee-employee-${Date.now()}`;
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO pass_fees (id, pass_type_id, amount, effective_date, created_at, updated_at)
         VALUES (?, 'pt-employee', ?, ?, ?, ?)`
      ).bind(id, employee_fee, effective_date, timestamp, timestamp).run();

      const fee = await c.env.DB.prepare(`
        SELECT pf.*, pt.code as pass_type_code, pt.name as pass_type_name
        FROM pass_fees pf
        JOIN pass_types pt ON pt.id = pf.pass_type_id
        WHERE pf.id = ?
      `).bind(id).first();

      updated.push(fee);
    }

    if (updated.length === 0) {
      return c.json({ error: 'No fees provided to update' }, 400);
    }

    return c.json({ fees: updated });
  } catch (error) {
    console.error('Error updating pass fees:', error);
    return c.json({ error: 'Failed to update pass fees' }, 500);
  }
});

/**
 * GET /api/admin/pass-management/rfid-replacement-requests
 * Get all RFID replacement requests (admin only)
 */
adminRouter.get('/pass-management/rfid-replacement-requests', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { status } = c.req.query();
    const conditions: string[] = [];
    const values: any[] = [];

    if (status) {
      conditions.push('r.status = ?');
      values.push(status);
    }

    let query = `
      SELECT
        r.*,
        v.plate_number,
        v.make,
        v.model,
        v.color,
        h.address as household_address,
        h.block,
        h.lot,
        req.email as requester_email,
        req.first_name || ' ' || req.last_name as requester_name
      FROM rfid_replacement_requests r
      JOIN vehicle_registrations v ON v.id = r.vehicle_id
      JOIN households h ON h.id = r.household_id
      LEFT JOIN users req ON req.id = r.requested_by
    `;

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY r.created_at DESC';

    const requests = await c.env.DB.prepare(query).bind(...values).all();

    return c.json({ requests: requests.results || [] });
  } catch (error) {
    console.error('Error fetching replacement requests:', error);
    return c.json({ error: 'Failed to fetch replacement requests' }, 500);
  }
});

/**
 * PUT /api/admin/pass-management/rfid-replacement-requests/:id/approve
 * Approve RFID replacement request (admin only)
 * Creates new RFID pass and marks old one as replaced
 */
adminRouter.put('/pass-management/rfid-replacement-requests/:id/approve', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { admin_notes } = body;

    // Get the request
    const request = await c.env.DB.prepare(`
      SELECT * FROM rfid_replacement_requests WHERE id = ?
    `).bind(id).first() as any;

    if (!request) {
      return c.json({ error: 'Request not found' }, 404);
    }

    if (request.status !== 'pending') {
      return c.json({ error: 'Request is not pending' }, 400);
    }

    // Get current RFID fee
    const fee = await c.env.DB.prepare(`
      SELECT amount FROM pass_fees WHERE pass_type_id = 'pt-rfid'
      ORDER BY effective_date DESC LIMIT 1
    `).first() as any;
    const rfidFee = fee?.amount || 800;

    // Mark old RFID as replaced
    await c.env.DB.prepare(`
      UPDATE vehicle_passes
      SET status = 'replaced', notes = 'Replaced via request #' || ?, updated_at = ?
      WHERE id = ?
    `).bind(id, new Date().toISOString(), request.old_rfid_pass_id).run();

    // Create new RFID pass
    const newRfidId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const newRfidCode = `RF-${Date.now()}`;

    await c.env.DB.prepare(`
      INSERT INTO vehicle_passes (id, vehicle_id, pass_type_id, identifier, amount_due, amount_paid, payment_status, status, issued_date, created_at, updated_at)
      VALUES (?, ?, 'pt-rfid', ?, ?, 0, 'unpaid', 'active', DATE('now'), ?, ?)
    `).bind(newRfidId, request.vehicle_id, newRfidCode, rfidFee, timestamp, timestamp).run();

    // Update legacy rfid_code field
    await c.env.DB.prepare(`
      UPDATE vehicle_registrations
      SET rfid_code = ?, updated_at = ?
      WHERE id = ?
    `).bind(newRfidCode, timestamp, request.vehicle_id).run();

    // Update request status
    await c.env.DB.prepare(`
      UPDATE rfid_replacement_requests
      SET status = 'completed', admin_notes = ?, new_rfid_pass_id = ?, updated_at = ?
      WHERE id = ?
    `).bind(admin_notes || '', newRfidId, timestamp, id).run();

    return c.json({
      success: true,
      new_rfid_pass: {
        id: newRfidId,
        identifier: newRfidCode,
        amount_due: rfidFee,
        payment_status: 'unpaid',
      }
    });
  } catch (error) {
    console.error('Error approving replacement request:', error);
    return c.json({ error: 'Failed to approve replacement request' }, 500);
  }
});

/**
 * PUT /api/admin/pass-management/rfid-replacement-requests/:id/reject
 * Reject RFID replacement request (admin only)
 */
adminRouter.put('/pass-management/rfid-replacement-requests/:id/reject', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { reason } = body;

    if (!reason) {
      return c.json({ error: 'Rejection reason is required' }, 400);
    }

    // Update request status
    await c.env.DB.prepare(`
      UPDATE rfid_replacement_requests
      SET status = 'rejected', admin_notes = ?, updated_at = ?
      WHERE id = ?
    `).bind(reason, new Date().toISOString(), id).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error rejecting replacement request:', error);
    return c.json({ error: 'Failed to reject replacement request' }, 500);
  }
});
