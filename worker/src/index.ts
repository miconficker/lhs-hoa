import { Hono } from 'hono';
import { cors } from 'hono/cors';

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

app.get('/', (c) => {
  return c.json({ message: 'Laguna Hills HOA API' });
});

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
