import { Hono } from 'hono';

import { logger } from '../lib/logger';import { z } from 'zod';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  getUserFromRequest,
  getGoogleAccessToken,
  getGoogleUserInfo,
  getGoogleAuthUrl
} from '../lib/auth';
import type { User, UserRole, PreApprovedEmail } from '../types';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'resident', 'staff', 'guest']),
  phone: z.string().optional(),
});

export const authRouter = new Hono<{ Bindings: Env }>();

// Helper function to generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

// Register new user
authRouter.post('/register', async (c) => {
  const body = await c.req.json();
  const result = registerSchema.safeParse(body);

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

  const token = await generateToken(user.id, user.role, c.env.JWT_SECRET);

  return c.json({ user, token }, 201);
});

// Login
authRouter.post('/login', async (c) => {
  const body = await c.req.json();
  const result = loginSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  const { email, password } = result.data;

  // Get user
  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, role, phone, created_at FROM users WHERE email = ?'
  ).bind(email).first() as any;

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Verify password
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await generateToken(user.id, user.role, c.env.JWT_SECRET);

  // Remove password_hash from response
  const { password_hash, ...userResponse } = user;

  return c.json({ user: userResponse, token });
});

// Get current user
authRouter.get('/me', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, role, phone, created_at FROM users WHERE id = ?'
  ).bind(authUser.userId).first() as any;

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

// Get Google OAuth URL
authRouter.get('/google/url', async (c) => {
  const url = getGoogleAuthUrl(
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_REDIRECT_URI,
  );
  return c.json({ url });
});

// Google OAuth callback
authRouter.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error) {
    // OAuth was denied or failed - redirect to frontend with error
    return c.redirect(`${new URL(c.req.url).origin}/login?error=oauth_failed&message=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return c.redirect(`${new URL(c.req.url).origin}/login?error=no_code`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await getGoogleAccessToken(
      code,
      c.env.GOOGLE_CLIENT_ID,
      c.env.GOOGLE_CLIENT_SECRET,
      c.env.GOOGLE_REDIRECT_URI
    );

    // Fetch user info from Google
    const googleUser = await getGoogleUserInfo(tokenResponse.access_token);

    // Check if email is pre-approved
    const preApproved = await c.env.DB.prepare(
      'SELECT * FROM pre_approved_emails WHERE email = ? AND is_active = 1'
    ).bind(googleUser.email).first() as PreApprovedEmail | null;

    if (!preApproved) {
      return c.redirect(
        `${new URL(c.req.url).origin}/login?error=not_approved&message=${encodeURIComponent('Email not found in approved list. Please contact your HOA admin.')}`
      );
    }

    // Check if user already exists
    let user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(googleUser.email).first() as any;

    if (!user) {
      // Create new user from Google data
      const userId = crypto.randomUUID();
      const nameParts = googleUser.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      await c.env.DB.prepare(
        'INSERT INTO users (id, email, password_hash, role, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(userId, googleUser.email, null, preApproved.role, null, new Date().toISOString()).run();

      user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(userId).first() as any;

      // Mark as accepted in pre_approved_emails
      await c.env.DB.prepare(
        'UPDATE pre_approved_emails SET accepted_at = ? WHERE id = ?'
      ).bind(new Date().toISOString(), preApproved.id).run();
    }

    // Generate JWT token
    const token = await generateToken(user.id, user.role, c.env.JWT_SECRET);

    // Redirect to frontend with token
    return c.redirect(`${new URL(c.req.url).origin}/login?token=${token}&provider=google`);

  } catch (err) {
    logger.error('Google OAuth error', err, { action: 'google_oauth' });
    return c.redirect(
      `${new URL(c.req.url).origin}/login?error=oauth_error&message=${encodeURIComponent('Failed to complete login')}`
    );
  }
});

// Whitelist management endpoints

// Add email to whitelist (admin only)
authRouter.post('/whitelist', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const whitelistSchema = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'resident', 'staff', 'guest']),
    household_id: z.string().optional(),
  });

  const body = await c.req.json();
  const result = whitelistSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { email, role, household_id } = result.data;

  // Check if email already exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM pre_approved_emails WHERE email = ?'
  ).bind(email).first();

  if (existing) {
    return c.json({ error: 'Email already in whitelist' }, 409);
  }

  // Add to whitelist
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO pre_approved_emails (id, email, role, household_id, invited_by, invited_at, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).bind(id, email, role, household_id || null, authUser.userId, new Date().toISOString()).run();

  const entry = await c.env.DB.prepare(
    'SELECT * FROM pre_approved_emails WHERE id = ?'
  ).bind(id).first() as PreApprovedEmail;

  return c.json({ entry }, 201);
});

// List all whitelist entries (admin only)
authRouter.get('/whitelist', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const entries = await c.env.DB.prepare(
    'SELECT * FROM pre_approved_emails ORDER BY invited_at DESC'
  ).all() as any;

  return c.json({ entries: entries.results || entries });
});

// Remove email from whitelist (admin only)
authRouter.delete('/whitelist/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  await c.env.DB.prepare(
    'DELETE FROM pre_approved_emails WHERE id = ?'
  ).bind(id).run();

  return c.json({ success: true });
});
