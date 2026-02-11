import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest, hashPassword } from '../lib/auth';
import type { User, UserRole } from '../types';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
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

// Helper: Create notification
async function createNotification(
  db: D1Database,
  userId: string,
  type: string,
  title: string,
  content: string,
  link?: string
): Promise<void> {
  const notificationId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, content, link)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(notificationId, userId, type, title, content, link || null).run();
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

  try {
    // Check if user exists and get their email
    const existing = await c.env.DB.prepare(
      'SELECT id, email FROM users WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return c.json({ error: 'User not found' }, 404);
    }

    const userEmail = existing.email as string;

    // Clear foreign key references first (in order of dependencies)
    // 1. Dues rates created_by
    await c.env.DB.prepare('UPDATE dues_rates SET created_by = NULL WHERE created_by = ?').bind(id).run();
    // 2. Installment plans - delete plans where user is the debtor, clear approved_by
    await c.env.DB.prepare('DELETE FROM installment_payments WHERE plan_id IN (SELECT id FROM installment_plans WHERE user_id = ?)').bind(id).run();
    await c.env.DB.prepare('DELETE FROM installment_plans WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('UPDATE installment_plans SET approved_by = NULL WHERE approved_by = ?').bind(id).run();
    // 3. Poll votes recorded_by
    await c.env.DB.prepare('UPDATE poll_votes SET recorded_by = NULL WHERE recorded_by = ?').bind(id).run();
    // 4. Pre-approved emails - clear invited_by and deactivate if it's the user's own email
    await c.env.DB.prepare('UPDATE pre_approved_emails SET invited_by = NULL WHERE invited_by = ?').bind(id).run();
    await c.env.DB.prepare('UPDATE pre_approved_emails SET is_active = 0 WHERE email = ?').bind(userEmail).run();
    // 5. Household owner
    await c.env.DB.prepare('UPDATE households SET owner_id = NULL WHERE owner_id = ?').bind(id).run();
    // 6. Residents user reference
    await c.env.DB.prepare('UPDATE residents SET user_id = NULL WHERE user_id = ?').bind(id).run();
    // 7. Service request assignee
    await c.env.DB.prepare('UPDATE service_requests SET assigned_to = NULL WHERE assigned_to = ?').bind(id).run();
    // 8. Announcement creator
    await c.env.DB.prepare('UPDATE announcements SET created_by = NULL WHERE created_by = ?').bind(id).run();
    // 9. Document uploader
    await c.env.DB.prepare('UPDATE documents SET uploaded_by = NULL WHERE uploaded_by = ?').bind(id).run();
    // 10. Event creator
    await c.env.DB.prepare('UPDATE events SET created_by = NULL WHERE created_by = ?').bind(id).run();
    // 11. Payment received_by
    await c.env.DB.prepare('UPDATE payments SET received_by = NULL WHERE received_by = ?').bind(id).run();
    // 12. Poll creator
    await c.env.DB.prepare('UPDATE polls SET created_by = NULL WHERE created_by = ?').bind(id).run();
    // 13. Delete payment demands
    await c.env.DB.prepare('DELETE FROM payment_demands WHERE user_id = ?').bind(id).run();
    // 14. Delete notifications
    await c.env.DB.prepare('DELETE FROM notifications WHERE user_id = ?').bind(id).run();

    // Finally delete the user
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
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
      h.street,
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
    ORDER BY h.street, h.block, h.lot
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
    street || null,
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
    values.push(street || null);
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
        h.address,
        h.owner_id as owner_user_id,
        h.lot_status,
        h.lot_type,
        h.lot_size_sqm,
        h.lot_label,
        h.lot_description,
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
 * PUT /api/admin/lots/:lotId/polygon
 * Update lot polygon geometry (admin only)
 * Stores GeoJSON polygon coordinates for the lot boundary
 */
adminRouter.put('/lots/:lotId/polygon', async (c) => {
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
  const { lot_polygon } = body;

  // Verify lot exists
  const lot = await c.env.DB.prepare(
    'SELECT id FROM households WHERE id = ?'
  ).bind(lotId).first();

  if (!lot) {
    return c.json({ error: 'Lot not found' }, 404);
  }

  // Validate polygon is an array of coordinate pairs
  if (lot_polygon !== null && lot_polygon !== undefined) {
    if (!Array.isArray(lot_polygon)) {
      return c.json({ error: 'Invalid lot_polygon: must be an array' }, 400);
    }
    // Validate each coordinate is [lng, lat] pair
    for (const coord of lot_polygon) {
      if (!Array.isArray(coord) || coord.length !== 2 ||
          typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
        return c.json({ error: 'Invalid lot_polygon: each coordinate must be [number, number]' }, 400);
      }
    }
  }

  try {
    // Store polygon as JSON string
    await c.env.DB.prepare(
      'UPDATE households SET lot_polygon = ? WHERE id = ?'
    ).bind(lot_polygon ? JSON.stringify(lot_polygon) : null, lotId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating lot polygon:', error);
    return c.json({ error: 'Failed to update lot polygon' }, 500);
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
        const street = lot.properties.street || null;
        const address =
          lot.properties.block_number && lot.properties.lot_number
            ? `${street ? street + ', ' : ''}Block ${lot.properties.block_number}, Lot ${lot.properties.lot_number}`
            : `Lot ${lotId}`;

        if (exists) {
          // Update existing
          await c.env.DB.prepare(
            `UPDATE households
             SET address = ?, street = ?, block = ?, lot = ?, lot_status = ?, lot_size_sqm = ?, owner_id = ?
             WHERE id = ?`
          ).bind(
            address,
            street,
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
            `INSERT INTO households (id, address, street, block, lot, lot_status, lot_size_sqm, owner_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            lotId,
            address,
            street,
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

    if (!rate_per_sqm || !effective_date) {
      return c.json({ error: 'rate_per_sqm and effective_date are required' }, 400);
    }

    // year is now optional metadata for historical reference
    const year = body.year;

    // Check if rate already exists for this effective_date
    const existing = await c.env.DB.prepare(
      'SELECT id FROM dues_rates WHERE effective_date = ?'
    ).bind(effective_date).first();

    if (existing) {
      return c.json({ error: 'Dues rate already exists for this effective_date' }, 409);
    }

    const id = generateId();
    await c.env.DB.prepare(
      `INSERT INTO dues_rates (id, rate_per_sqm, year, effective_date, created_by)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, rate_per_sqm, year || null, effective_date, authUser.userId).run();

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

    // Get the dues rate that was effective on the demand date
    // This ensures historical accuracy when creating demands for past years
    const rateResult = await c.env.DB.prepare(`
      SELECT rate_per_sqm FROM dues_rates
      WHERE effective_date <= ?
      ORDER BY effective_date DESC
      LIMIT 1
    `).bind(demand_sent_date).first();

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
// ADMIN: Payment Verification (/admin/payments/verify/*)
// =============================================================================

/**
 * GET /api/admin/payments/verify
 * Get pending verification queue (admin only)
 */
adminRouter.get('/payments/verify', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const status = c.req.query('status') || 'pending';
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const verifications = await c.env.DB.prepare(`
      SELECT
        pvq.id as queue_id,
        pvq.payment_id,
        pvq.user_id,
        pvq.household_id,
        pvq.payment_type,
        pvq.amount,
        pvq.reference_number,
        pvq.status,
        pvq.rejection_reason,
        pvq.created_at,
        pvq.proof_uploaded_at,
        pp.file_url,
        pp.file_name,
        u.email as user_email,
        u.first_name,
        u.last_name,
        h.address as household_address,
        p.payment_category
      FROM payment_verification_queue pvq
      LEFT JOIN payment_proofs pp ON pvq.payment_id = pp.payment_id
      LEFT JOIN users u ON pvq.user_id = u.id
      LEFT JOIN households h ON pvq.household_id = h.id
      LEFT JOIN payments p ON pvq.payment_id = p.id
      WHERE pvq.status = ?
      ORDER BY pvq.created_at ASC
      LIMIT ? OFFSET ?
    `).bind(status, limit, offset).all();

    // Get count
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM payment_verification_queue
      WHERE status = ?
    `).bind(status).first();

    return c.json({
      verifications: verifications.results || [],
      total: (countResult?.count as number) || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error fetching verification queue:', error);
    return c.json({ error: 'Failed to fetch verification queue' }, 500);
  }
});

/**
 * PUT /api/admin/payments/:paymentId/verify
 * Approve or reject payment proof (admin only)
 */
adminRouter.put('/payments/:paymentId/verify', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const paymentId = c.req.param('paymentId');
    const body = await c.req.json();
    const { action, rejection_reason } = body; // action: 'approve' | 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return c.json({ error: 'Invalid action. Use "approve" or "reject"' }, 400);
    }

    if (action === 'reject' && !rejection_reason) {
      return c.json({ error: 'rejection_reason is required when rejecting' }, 400);
    }

    // Verify payment exists and is pending
    const verification = await c.env.DB.prepare(`
      SELECT * FROM payment_verification_queue
      WHERE payment_id = ? AND status = 'pending'
    `).bind(paymentId).first();

    if (!verification) {
      return c.json({ error: 'Verification not found or already processed' }, 404);
    }

    if (action === 'approve') {
      // Update verification queue
      await c.env.DB.prepare(`
        UPDATE payment_verification_queue
        SET status = 'approved', updated_at = datetime('now')
        WHERE payment_id = ?
      `).bind(paymentId).run();

      // Update payment status
      await c.env.DB.prepare(`
        UPDATE payments
        SET status = 'completed', verification_status = 'verified', paid_at = datetime('now')
        WHERE id = ?
      `).bind(paymentId).run();

      // Update proof as verified
      await c.env.DB.prepare(`
        UPDATE payment_proofs
        SET verified = 1, verified_by = ?, verified_at = datetime('now')
        WHERE payment_id = ?
      `).bind(authUser.userId, paymentId).run();

      // Update related records based on payment type
      const payment = await c.env.DB.prepare(
        'SELECT * FROM payments WHERE id = ?'
      ).bind(paymentId).first();

      if (payment) {
        const paymentType = (payment as any).payment_category;

        // For vehicle passes - update vehicle registration status
        if (paymentType === 'vehicle_pass') {
          await c.env.DB.prepare(`
            UPDATE vehicle_registrations
            SET payment_status = 'paid', status = 'pending_approval'
            WHERE household_id = ? AND status = 'pending_payment'
          `).bind((payment as any).household_id).run();
        }

        // For employee IDs - update employee status
        if (paymentType === 'employee_id') {
          await c.env.DB.prepare(`
            UPDATE household_employees
            SET status = 'active', issued_date = DATE('now')
            WHERE household_id = ? AND status = 'pending'
          `).bind((payment as any).household_id).run();
        }

        // For employee IDs - update employee status
        if (paymentType === 'employee_id') {
          await c.env.DB.prepare(`
            UPDATE household_employees
            SET status = 'active', issued_date = DATE('now')
            WHERE household_id = ? AND status = 'pending'
          `).bind((payment as any).household_id).run();
        }

        // For dues - update payment demand status
        if (paymentType === 'dues') {
          await c.env.DB.prepare(`
            UPDATE payment_demands
            SET status = 'paid', paid_date = DATE('now')
            WHERE user_id = ? AND year = CAST(? AS INTEGER) AND status = 'pending'
          `).bind(verification.user_id, (payment as any).period).run();
        }

        // Notify resident of approval
        const paymentTypeLabel = paymentType === 'dues' ? 'HOA Dues' : paymentType === 'vehicle_pass' ? 'Vehicle Pass' : 'Employee ID';
        await createNotification(
          c.env.DB,
          verification.user_id,
          'payment_verified',
          'Payment Verified',
          `Your ${paymentTypeLabel.toLowerCase()} payment of PHP ${((payment as any).amount as number).toFixed(2)} has been verified and approved.`,
          `/payments`
        );
      }

    } else {
      // Reject
      await c.env.DB.prepare(`
        UPDATE payment_verification_queue
        SET status = 'rejected', rejection_reason = ?, updated_at = datetime('now')
        WHERE payment_id = ?
      `).bind(rejection_reason, paymentId).run();

      await c.env.DB.prepare(`
        UPDATE payments
        SET verification_status = 'pending'
        WHERE id = ?
      `).bind(paymentId).run();

      // Notify resident of rejection
      await createNotification(
        c.env.DB,
        verification.user_id,
        'payment_rejected',
        'Payment Rejected',
        `Your payment proof was rejected. Reason: ${rejection_reason}. Please re-upload a corrected proof.`,
        `/payments`
      );
    }

    return c.json({ message: `Payment ${action}d successfully` });

  } catch (error) {
    console.error('Error verifying payment:', error);
    return c.json({ error: 'Failed to verify payment' }, 500);
  }
});

/**
 * GET /api/admin/payments/settings
 * Get payment settings (bank details, late fee config)
 */
adminRouter.get('/payments/settings', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  // Get late fee config from database
  const lateFeeConfig = await c.env.DB.prepare(`
    SELECT * FROM late_fee_config WHERE id = 'default'
  `).first();

  // Bank details are currently hardcoded (could be moved to DB later)
  const bankDetails = {
    bank_name: 'BPI',
    account_name: 'Laguna Hills HOA',
    account_number: '1234-5678-90',
  };

  const gcashDetails = {
    name: 'Laguna Hills HOA',
    number: '0917-XXX-XXXX',
  };

  return c.json({
    bank_details: bankDetails,
    gcash_details: gcashDetails,
    late_fee_config: lateFeeConfig ? {
      rate_percent: (lateFeeConfig as any).rate_percent,
      grace_period_days: (lateFeeConfig as any).grace_period_days,
      max_months: (lateFeeConfig as any).max_months,
    } : {
      rate_percent: 1,
      grace_period_days: 30,
      max_months: 12,
    },
  });
});

/**
 * PUT /api/admin/payments/settings
 * Update payment settings (admin only)
 */
adminRouter.put('/payments/settings', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const body = await c.req.json();
    const { late_fee_config } = body;

    if (late_fee_config) {
      const { rate_percent, grace_period_days, max_months } = late_fee_config;

      // Validate inputs
      if (rate_percent !== undefined && (rate_percent < 0 || rate_percent > 100)) {
        return c.json({ error: 'rate_percent must be between 0 and 100' }, 400);
      }
      if (grace_period_days !== undefined && grace_period_days < 0) {
        return c.json({ error: 'grace_period_days must be non-negative' }, 400);
      }
      if (max_months !== undefined && max_months < 0) {
        return c.json({ error: 'max_months must be non-negative' }, 400);
      }

      // Update late fee config in database
      await c.env.DB.prepare(`
        UPDATE late_fee_config
        SET rate_percent = COALESCE(?, rate_percent),
            grace_period_days = COALESCE(?, grace_period_days),
            max_months = COALESCE(?, max_months),
            updated_at = datetime('now')
        WHERE id = 'default'
      `).bind(
        rate_percent,
        grace_period_days,
        max_months
      ).run();
    }

    // Return updated settings
    const updatedConfig = await c.env.DB.prepare(`
      SELECT * FROM late_fee_config WHERE id = 'default'
    `).first();

    return c.json({
      message: 'Settings updated successfully',
      settings: {
        bank_details: body.bank_details || {
          bank_name: 'BPI',
          account_name: 'Laguna Hills HOA',
          account_number: '1234-5678-90',
        },
        gcash_details: body.gcash_details || {
          name: 'Laguna Hills HOA',
          number: '0917-XXX-XXXX',
        },
        late_fee_config: updatedConfig ? {
          rate_percent: (updatedConfig as any).rate_percent,
          grace_period_days: (updatedConfig as any).grace_period_days,
          max_months: (updatedConfig as any).max_months,
        } : late_fee_config,
      },
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

// =============================================================================
// ADMIN: Pass Management (/admin/pass-management/*)
// =============================================================================

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
    <div class="footer">${employee.street ? employee.street + ', ' : ''}Block ${employee.block || '?'} Lot ${employee.lot || '?'}</div>
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
 */
adminRouter.get('/pass-management/vehicles', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { status, payment_status, pass_type, household_id, search } = c.req.query();

    let query = `
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
    `;

    const conditions: string[] = [];
    const values: any[] = [];

    if (status) {
      conditions.push('vr.status = ?');
      values.push(status);
    }

    if (payment_status) {
      conditions.push('vr.payment_status = ?');
      values.push(payment_status);
    }

    if (pass_type) {
      conditions.push('vr.pass_type = ?');
      values.push(pass_type);
    }

    if (household_id) {
      conditions.push('vr.household_id = ?');
      values.push(household_id);
    }

    if (search) {
      conditions.push('(vr.plate_number LIKE ? OR u.first_name || \' \' || u.last_name LIKE ?)');
      values.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY vr.created_at DESC';

    const vehicles = await c.env.DB.prepare(query).bind(...values).all();

    return c.json({ vehicles: vehicles.results || [] });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return c.json({ error: 'Failed to fetch vehicles' }, 500);
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

    // Check RFID uniqueness
    const existing = await c.env.DB.prepare(
      'SELECT id FROM vehicle_registrations WHERE rfid_code = ? AND id != ?'
    ).bind(rfid_code, id).first();

    if (existing) {
      return c.json({ error: 'RFID code already in use' }, 409);
    }

    // Update vehicle with RFID
    await c.env.DB.prepare(`
      UPDATE vehicle_registrations
      SET rfid_code = ?, updated_at = ?
      WHERE id = ?
    `).bind(rfid_code, new Date().toISOString(), id).run();

    // Auto-approve if pass_type is rfid or both
    if (vehicle.pass_type === 'rfid' || (vehicle.pass_type === 'both' && vehicle.sticker_number)) {
      await c.env.DB.prepare(`
        UPDATE vehicle_registrations
        SET status = 'active', issued_date = DATE('now')
        WHERE id = ?
      `).bind(id).run();
    }

    const updated = await c.env.DB.prepare(`
      SELECT vr.*, h.address as household_address
      FROM vehicle_registrations vr
      JOIN households h ON vr.household_id = h.id
      WHERE vr.id = ?
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

    // Check sticker uniqueness
    const existing = await c.env.DB.prepare(
      'SELECT id FROM vehicle_registrations WHERE sticker_number = ? AND id != ?'
    ).bind(sticker_number, id).first();

    if (existing) {
      return c.json({ error: 'Sticker number already in use' }, 409);
    }

    // Update vehicle with sticker
    await c.env.DB.prepare(`
      UPDATE vehicle_registrations
      SET sticker_number = ?, updated_at = ?
      WHERE id = ?
    `).bind(sticker_number, new Date().toISOString(), id).run();

    // Auto-approve if pass_type is sticker or both
    if (vehicle.pass_type === 'sticker' || (vehicle.pass_type === 'both' && vehicle.rfid_code)) {
      await c.env.DB.prepare(`
        UPDATE vehicle_registrations
        SET status = 'active', issued_date = DATE('now')
        WHERE id = ?
      `).bind(id).run();
    }

    const updated = await c.env.DB.prepare(`
      SELECT vr.*, h.address as household_address
      FROM vehicle_registrations vr
      JOIN households h ON vr.household_id = h.id
      WHERE vr.id = ?
    `).bind(id).first();

    return c.json({ vehicle: updated });
  } catch (error) {
    console.error('Error assigning sticker:', error);
    return c.json({ error: 'Failed to assign sticker' }, 500);
  }
});

/**
 * POST /api/admin/pass-management/vehicles/:id/record-payment
 * Record in-person payment for vehicle pass (admin only)
 */
adminRouter.post('/pass-management/vehicles/:id/record-payment', async (c) => {
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

    // Verify vehicle exists
    const vehicle = await c.env.DB.prepare(
      'SELECT * FROM vehicle_registrations WHERE id = ?'
    ).bind(id).first() as any;

    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    // Update payment info
    await c.env.DB.prepare(`
      UPDATE vehicle_registrations
      SET payment_status = 'paid',
          amount_paid = ?,
          payment_method = ?,
          payment_reference = ?,
          status = 'pending_approval',
          updated_at = ?
      WHERE id = ?
    `).bind(amount, method, reference_number || null, new Date().toISOString(), id).run();

    // Create payment record
    const paymentId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO payments (id, household_id, amount, currency, method, reference_number, status, payment_category, period, received_by)
       VALUES (?, ?, ?, 'PHP', ?, ?, 'completed', 'vehicle_pass', DATE('now'), ?)`
    ).bind(paymentId, vehicle.household_id, amount, method, reference_number || null, authUser.userId).run();

    const updated = await c.env.DB.prepare(`
      SELECT vr.*, h.address as household_address
      FROM vehicle_registrations vr
      JOIN households h ON vr.household_id = h.id
      WHERE vr.id = ?
    `).bind(id).first();

    return c.json({ vehicle: updated, payment_id: paymentId });
  } catch (error) {
    console.error('Error recording payment:', error);
    return c.json({ error: 'Failed to record payment' }, 500);
  }
});

// =============================================================================
// ADMIN: Pass Fee Management
// =============================================================================

/**
 * GET /api/admin/pass-management/fees
 * Get current fee structure (admin only)
 */
adminRouter.get('/pass-management/fees', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const fees = await c.env.DB.prepare(`
      SELECT * FROM pass_fees
      WHERE effective_date <= DATE('now')
      ORDER BY effective_date DESC
    `).all();

    // Get latest fee for each type
    const feeMap: Record<string, any> = {};
    for (const fee of fees.results || []) {
      const feeType = fee.fee_type as string;
      if (!feeMap[feeType]) {
        feeMap[feeType] = fee;
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
 */
adminRouter.put('/pass-management/fees', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const body = await c.req.json();
    const { fees } = body;

    if (!Array.isArray(fees)) {
      return c.json({ error: 'fees must be an array' }, 400);
    }

    const effective_date = new Date().toISOString().split('T')[0];
    const updated = [];

    for (const feeData of fees) {
      const { fee_type, amount } = feeData;

      if (!fee_type || amount === undefined) {
        continue;
      }

      if (!['sticker', 'rfid', 'both'].includes(fee_type)) {
        continue;
      }

      const id = generateId();
      await c.env.DB.prepare(
        `INSERT INTO pass_fees (id, fee_type, amount, effective_date)
         VALUES (?, ?, ?, ?)`
      ).bind(id, fee_type, amount, effective_date).run();

      const fee = await c.env.DB.prepare(
        'SELECT * FROM pass_fees WHERE id = ?'
      ).bind(id).first();

      updated.push(fee);
    }

    return c.json({ fees: updated });
  } catch (error) {
    console.error('Error updating pass fees:', error);
    return c.json({ error: 'Failed to update pass fees' }, 500);
  }
});

// =============================================================================
// ADMIN: Lot Polygon Import
// =============================================================================

/**
 * POST /api/admin/lots/import-polygons
 * Import lot polygons from static GeoJSON file to database (admin only)
 * One-time import to migrate from file-based to database-first architecture
 */
adminRouter.post('/lots/import-polygons', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    // Fetch the static GeoJSON file
    const url = new URL(c.req.raw.url);
    const geoUrl = `${url.origin}/data/lots.geojson`;
    const response = await fetch(geoUrl);

    if (!response.ok) {
      return c.json({ error: 'Failed to fetch GeoJSON file' }, 500);
    }

    const geojson = await response.json() as {
      type: string;
      features: Array<{
        id?: string;
        properties: {
          path_id: string;
        };
        geometry: {
          type: string;
          coordinates: number[][][];
        };
      }>;
    };

    if (geojson.type !== 'FeatureCollection' || !geojson.features) {
      return c.json({ error: 'Invalid GeoJSON format' }, 400);
    }

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const feature of geojson.features) {
      try {
        const lotId = feature.id || feature.properties?.path_id;
        if (!lotId) {
          skipped++;
          continue;
        }

        // Verify lot exists in database
        const lot = await c.env.DB.prepare(
          'SELECT id FROM households WHERE id = ?'
        ).bind(lotId).first();

        if (!lot) {
          errors.push(`Lot ${lotId}: not found in database`);
          skipped++;
          continue;
        }

        // Extract polygon coordinates
        if (feature.geometry?.type === 'Polygon' && feature.geometry?.coordinates) {
          const polygon = feature.geometry.coordinates[0]; // Outer ring
          const polygonJson = JSON.stringify(polygon);

          // Update lot_polygon in database
          await c.env.DB.prepare(
            'UPDATE households SET lot_polygon = ? WHERE id = ?'
          ).bind(polygonJson, lotId).run();

          updated++;
        } else {
          errors.push(`Lot ${lotId}: no polygon geometry found`);
          skipped++;
        }
      } catch (error) {
        errors.push(`${feature.id || feature.properties?.path_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return c.json({
      success: true,
      results: {
        total: geojson.features.length,
        updated,
        skipped,
        errors: errors.length,
        errorDetails: errors.slice(0, 20), // Return first 20 errors
      },
    });
  } catch (error) {
    console.error('Error importing lot polygons:', error);
    return c.json({ error: 'Failed to import lot polygons' }, 500);
  }
});
