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

export default app;
