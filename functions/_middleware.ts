/**
 * Cloudflare Pages Functions - API Middleware
 *
 * This file handles all /api/* requests using Hono framework.
 * The frontend static files are served automatically by Cloudflare Pages.
 */

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
  ALLOWED_ORIGINS?: string;
};

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS configuration - secure, explicit allowlist
// Add your custom domain here when you get one
app.use('/*', cors({
  origin: (origin) => {
    // Allow no origin (same-origin requests like server-side)
    if (!origin) return true;

    // Development: allow localhost
    if (origin.includes('localhost')) return true;

    // Production: explicit allowlist
    const allowedOrigins = [
      'https://lhs-hoa.pages.dev',
      // Add custom domain here when ready:
      // 'https://your-custom-domain.com',
    ];

    return allowedOrigins.includes(origin);
  },
  credentials: true,
}));

// Health check
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
    // Use relative URL to fetch from static assets within the same Pages project
    let originalGeojson: any;
    try {
      // Get the origin from the current request and use relative path
      const url = new URL(c.req.raw.url);
      const geojsonUrl = `${url.origin}/data/lots.geojson`;
      const response = await fetch(geojsonUrl);
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

// Export for Cloudflare Pages Functions
export default app;

// Also export as a fetch handler for Pages Functions
export async function onRequest(context: any): Promise<Response> {
  const url = new URL(context.request.url);

  // Only handle API routes - let static assets pass through
  if (!url.pathname.startsWith('/api/')) {
    // Call next() to continue to static assets
    return context.next();
  }

  return app.fetch(context.request, context.env);
}
