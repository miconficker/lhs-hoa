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
import { messagesRouter } from './routes/messages';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './lib/logger';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
  ALLOWED_ORIGINS: string;
};

const app = new Hono<{ Bindings: Env }>();

// Error handler middleware (must be first)
app.use('/*', errorHandler);

// CORS middleware
app.use('/*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8788', 'http://localhost:5173'];
  const origin = c.req.header('Origin');

  return cors({
    origin: origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    credentials: true,
  })(c, next);
});

// Health check
app.get('/', (c) => c.json({ message: 'Laguna Hills HOA API' }));
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Public GeoJSON endpoint for the map - generates from database (lot_polygon column)
app.get('/api/data/lots.geojson', async (c) => {
  try {
    // Get all lots with ownership and polygon data from database
    const lots = await c.env.DB.prepare(`
      SELECT
        h.id as path_id,
        h.street,
        h.block,
        h.lot,
        h.lot_size_sqm,
        h.lot_status,
        h.lot_type,
        h.owner_id,
        h.lot_label,
        h.lot_description,
        h.lot_polygon,
        u.email as owner_email
      FROM households h
      LEFT JOIN users u ON h.owner_id = u.id
      ORDER BY h.street, h.block, h.lot
    `).all();

    // Generate GeoJSON features from database
    const features = (lots.results || [])
      .filter((lot: any) => lot.lot_polygon) // Only include lots with polygon data
      .map((lot: any) => {
        let geometry: any = null;

        // Parse lot_polygon JSON
        try {
          const polygon = JSON.parse(lot.lot_polygon);
          geometry = {
            type: 'Polygon',
            coordinates: [polygon], // GeoJSON Polygon expects array of rings
          };
        } catch {
          // Invalid polygon data, skip this lot
          return null;
        }

        return {
          type: 'Feature',
          id: lot.path_id,
          geometry,
          properties: {
            path_id: lot.path_id,
            block_number: lot.block || null,
            lot_number: lot.lot || null,
            lot_size_sqm: lot.lot_size_sqm || null,
            status: lot.lot_status || 'vacant_lot',
            lot_type: lot.lot_type || 'residential',
            owner_user_id: lot.owner_id || null,
            owner_email: lot.owner_email || null,
            lot_label: lot.lot_label || null,
            lot_description: lot.lot_description || null,
          },
        };
      })
      .filter((feature: any) => feature !== null); // Remove null entries

    return c.json({
      type: 'FeatureCollection',
      features,
    });
  } catch (error) {
    logger.error('Error generating lots GeoJSON', error, {
      endpoint: '/api/data/lots.geojson',
      method: 'GET',
    });
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
app.route('/api/messages', messagesRouter);

// 404 handler - must be last
app.notFound(notFoundHandler);

export default app;
