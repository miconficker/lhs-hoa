import { Hono } from 'hono';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const householdsRouter = new Hono<{ Bindings: Env }>();

// Get all households with resident info
householdsRouter.get('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const households = await c.env.DB.prepare(`
    SELECT
      h.*,
      GROUP_CONCAT(r.first_name || ' ' || r.last_name, ', ') as resident_names
    FROM households h
    LEFT JOIN residents r ON h.id = r.household_id
    GROUP BY h.id
    ORDER BY
      CAST(h.block AS INTEGER) ASC,
      CAST(h.lot AS INTEGER) ASC
  `).all();

  // Group merged lots
  const grouped = (households.results || []).reduce((acc: any[], lot: any) => {
    if (lot.household_group_id) {
      const existing = acc.find(g => g.household_group_id === lot.household_group_id);
      if (existing) {
        existing.merged_lots.push(lot.id);
        existing.addresses.push(lot.address);
      } else {
        acc.push({
          ...lot,
          merged_lots: [lot.id],
          addresses: [lot.address],
        });
      }
    } else {
      acc.push({
        ...lot,
        merged_lots: [],
        addresses: [lot.address],
      });
    }
    return acc;
  }, []);

  // Format addresses for merged lots
  const formatted = grouped.map((h: any) => {
    if (h.merged_lots.length > 0) {
      h.address = h.addresses.join(' + ');
    }
    delete h.addresses;
    return h;
  });

  return c.json({ households: formatted });
});

// =============================================================================
// SPECIFIC ROUTES (must come before /:id to prevent path conflicts)
// =============================================================================

/**
 * GET /api/households/my-lots
 * Get current user's lots with dues calculation (authenticated users only)
 * NOTE: This route MUST come before /:id to prevent 'my-lots' being matched as an id
 */
householdsRouter.get('/my-lots', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Get current active dues rate
    const currentYear = new Date().getFullYear();
    const rateResult = await c.env.DB.prepare(`
      SELECT rate_per_sqm FROM dues_rates
      WHERE year <= ? AND effective_date <= DATE('now')
      ORDER BY year DESC, effective_date DESC
      LIMIT 1
    `).bind(currentYear).first();

    const ratePerSqm = rateResult?.rate_per_sqm || 0;

    // Get user's lots
    const lots = await c.env.DB.prepare(`
      SELECT
        h.id as lot_id,
        h.block,
        h.lot,
        h.address,
        h.lot_status,
        h.lot_type,
        h.lot_size_sqm,
        h.household_group_id,
        h.is_primary_lot,
        h.created_at
      FROM households h
      WHERE h.owner_id = ?
      ORDER BY
        CAST(h.block AS INTEGER) ASC,
        CAST(h.lot AS INTEGER) ASC
    `).bind(authUser.userId).all();

    // Get payment demands for this user
    const demands = await c.env.DB.prepare(`
      SELECT year, status, amount_due, due_date FROM payment_demands
      WHERE user_id = ?
      ORDER BY year DESC
    `).bind(authUser.userId).all();

    // Calculate summary
    const totalLots = lots.results?.length || 0;
    const totalSqm = lots.results?.reduce((sum, lot) => sum + (lot.lot_size_sqm || 0), 0) || 0;
    const annualDuesTotal = totalSqm * ratePerSqm;

    // Find unpaid periods
    const unpaidPeriods: string[] = [];
    for (const demand of demands.results || []) {
      if (demand.status === 'pending' || demand.status === 'suspended') {
        unpaidPeriods.push(demand.year.toString());
      }
    }

    // Check voting eligibility (can vote if no unpaid periods past 30 days)
    const today = new Date();
    let votingStatus: 'eligible' | 'suspended' = 'eligible';
    for (const demand of demands.results || []) {
      if (demand.status === 'pending' || demand.status === 'suspended') {
        const dueDate = new Date(demand.due_date);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysOverdue >= 30) {
          votingStatus = 'suspended';
          break;
        }
      }
    }

    // Group lots by household_group_id
    const groupedLots = (lots.results || []).reduce((acc: any[], lot: any) => {
      if (lot.household_group_id) {
        const existing = acc.find(g => g.household_group_id === lot.household_group_id);
        if (existing) {
          existing.merged_lots.push(lot.lot_id);
          existing.annual_dues += (lot.lot_size_sqm || 0) * ratePerSqm;
          existing.lot_size_sqm += lot.lot_size_sqm || 0;
          existing.address = `${existing.block}-${existing.lot} + ${lot.block}-${lot.lot}`;
        } else {
          acc.push({
            ...lot,
            merged_lots: [lot.lot_id],
            is_primary_lot: true,
            annual_dues: (lot.lot_size_sqm || 0) * ratePerSqm,
          });
        }
      } else {
        acc.push({
          ...lot,
          merged_lots: [],
          annual_dues: (lot.lot_size_sqm || 0) * ratePerSqm,
        });
      }
      return acc;
    }, []);

    const totalProperties = groupedLots.length;

    // Build my lots list with annual dues
    const myLots = groupedLots.map((lot: any) => ({
      lot_id: lot.lot_id,
      block: lot.block,
      lot: lot.lot,
      address: lot.address,
      lot_status: lot.lot_status || 'vacant_lot',
      lot_type: lot.lot_type || 'residential',
      lot_size_sqm: lot.lot_size_sqm,
      annual_dues: lot.annual_dues,
      payment_status: 'current', // TODO: Calculate per-lot based on payment demands
      household_group_id: lot.household_group_id,
      is_primary_lot: lot.is_primary_lot,
      merged_lots: lot.merged_lots,
    }));

    // Return response with properties directly (not nested in 'summary')
    return c.json({
      total_lots: totalLots,
      total_properties: totalProperties,
      total_sqm: totalSqm,
      annual_dues_total: annualDuesTotal,
      unpaid_periods: unpaidPeriods,
      voting_status: votingStatus,
      rate_per_sqm: ratePerSqm,
      lots: myLots,
    });
  } catch (error) {
    console.error('Error fetching my lots:', error);
    return c.json({ error: 'Failed to fetch my lots' }, 500);
  }
});

/**
 * GET /api/households/lots
 * Get all lots with public information only (lot_status, lot_type)
 * For map display - non-admin users see limited info
 * NOTE: This route MUST come before /:id to prevent 'lots' being matched as an id
 */
householdsRouter.get('/lots', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const lots = await c.env.DB.prepare(`
      SELECT
        h.id as lot_id,
        h.block,
        h.lot,
        h.lot_status,
        h.lot_type
      FROM households h
      ORDER BY
        CAST(h.block AS INTEGER) ASC,
        CAST(h.lot AS INTEGER) ASC
    `).all();

    return c.json({ lots: lots.results || [] });
  } catch (error) {
    console.error('Error fetching lots:', error);
    return c.json({ error: 'Failed to fetch lots' }, 500);
  }
});

/**
 * GET /api/households/map/locations
 * Get map data (households with coordinates)
 * NOTE: This route MUST come before /:id to prevent 'map' being matched as an id
 */
householdsRouter.get('/map/locations', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
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
      GROUP_CONCAT(r.first_name || ' ' || r.last_name, ', ') as resident_names,
      CASE
        WHEN COUNT(r.id) = 0 THEN 'vacant'
        WHEN h.owner_id IS NOT NULL THEN 'owned'
        ELSE 'rented'
      END as status
    FROM households h
    LEFT JOIN residents r ON h.id = r.household_id
    WHERE (h.latitude IS NOT NULL AND h.longitude IS NOT NULL)
       OR (h.map_marker_x IS NOT NULL AND h.map_marker_y IS NOT NULL)
    GROUP BY h.id
    ORDER BY h.block, h.lot
  `).all();

  return c.json({ households: households.results });
});

// =============================================================================
// PARAMETERIZED ROUTES (must come after specific routes)
// =============================================================================

/**
 * GET /api/households/:id
 * Get single household
 */
householdsRouter.get('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  const household = await c.env.DB.prepare(`
    SELECT
      h.*,
      GROUP_CONCAT(r.first_name || ' ' || r.last_name, ', ') as resident_names
    FROM households h
    LEFT JOIN residents r ON h.id = r.household_id
    WHERE h.id = ?
    GROUP BY h.id
  `).bind(id).first();

  if (!household) {
    return c.json({ error: 'Household not found' }, 404);
  }

  return c.json({ household });
});
