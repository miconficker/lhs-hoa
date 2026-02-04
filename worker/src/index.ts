import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth';

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

// Auth routes
app.route('/api/auth', authRouter);

export default app;
