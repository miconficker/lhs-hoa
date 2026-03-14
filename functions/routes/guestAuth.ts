// functions/routes/guestAuth.ts
import { Hono } from 'hono';
import { getGuestSessionFromRequest } from '../middleware/auth';

const guestAuthRouter = new Hono<{ Bindings: Env }>();

// Moved from authRouter:
guestAuthRouter.get('/auth/session', async (c) => {
  const guest = await getGuestSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!guest) return c.json({ guest: null });
  return c.json({ guest });
});

guestAuthRouter.post('/auth/logout', async (c) => {
  c.header('Set-Cookie', 'guest_token=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
  return c.json({ success: true });
});

guestAuthRouter.get('/auth/google', async (c) => {
  // ... existing Google OAuth URL generation
});

guestAuthRouter.get('/auth/google/callback', async (c) => {
  // ... existing callback handler
});

export { guestAuthRouter };