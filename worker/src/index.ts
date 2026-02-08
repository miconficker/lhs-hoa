import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth';
import { dashboardRouter } from './routes/dashboard';
import { announcementsRouter } from './routes/announcements';
import { eventsRouter } from './routes/events';
import { serviceRequestsRouter } from './routes/service-requests';
import { householdsRouter } from './routes/households';
import { paymentsRouter } from './routes/payments';
import { reservationsRouter } from './routes/reservations';
import { pollsRouter } from './routes/polls';
import { documentsRouter } from './routes/documents';
import { adminRouter } from './routes/admin';
import { notificationsRouter } from './routes/notifications';
import { passManagementRouter } from './routes/pass-management';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({ message: 'Laguna Hills HOA API' }));
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Public GeoJSON endpoint for the map - always returns live data from database
app.get('/api/data/lots.geojson', async (c) => {
  try {
    // Get all lots with ownership info from database
    const lots = await c.env.DB.prepare(`
      SELECT
        h.id as path_id,
        h.block,
        h.lot,
        h.lot_size_sqm,
        h.lot_status,
        h.owner_id,
        h.lot_label,
        h.lot_description,
        u.email as owner_email
      FROM households h
      LEFT JOIN users u ON h.owner_id = u.id
      ORDER BY h.block, h.lot
    `).all();

    // Read the original GeoJSON to get geometries
    // In production, this would be cached or served from CDN
    let originalGeojson: any;
    try {
      const response = await fetch('http://localhost:5173/data/lots.geojson');
      if (response.ok) {
        originalGeojson = await response.json();
      } else {
        throw new Error('Failed to fetch GeoJSON');
      }
    } catch {
      // Fallback to empty feature collection
      originalGeojson = { type: 'FeatureCollection', features: [] };
    }

    // Create a map of database lots by path_id
    const dbLotsMap = new Map(
      (lots.results || []).map((lot: any) => [lot.path_id, lot])
    );

    // Merge database data with original geometries
    const features = originalGeojson.features.map((feature: any) => {
      const dbLot = dbLotsMap.get(feature.properties?.path_id || feature.id);

      if (dbLot) {
        return {
          ...feature,
          properties: {
            ...feature.properties,
            block_number: dbLot.block || null,
            lot_number: dbLot.lot || null,
            lot_size_sqm: dbLot.lot_size_sqm || null,
            status: dbLot.lot_status || 'vacant_lot',
            owner_user_id: dbLot.owner_id || null,
            owner_email: dbLot.owner_email || null,
            lot_label: dbLot.lot_label || null,
            lot_description: dbLot.lot_description || null,
          },
        };
      }

      return feature;
    });

    return c.json({
      type: 'FeatureCollection',
      features,
    });
  } catch (error) {
    console.error('Error generating lots GeoJSON:', error);
    return c.json({ type: 'FeatureCollection', features: [] }, 500);
  }
});

// API routes
app.route('/api/auth', authRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/announcements', announcementsRouter);
app.route('/api/events', eventsRouter);
app.route('/api/service-requests', serviceRequestsRouter);
app.route('/api/households', householdsRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/reservations', reservationsRouter);
app.route('/api/polls', pollsRouter);
app.route('/api/documents', documentsRouter);
app.route('/api/notifications', notificationsRouter);
app.route('/api/admin', adminRouter);
app.route('/api/pass-requests', passManagementRouter);

export default app;
