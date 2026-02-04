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
    ORDER BY h.block, h.lot
  `).all();

  return c.json({ households: households.results });
});

// Get single household
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

// Get map data (households with coordinates)
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
