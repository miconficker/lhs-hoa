import { Hono } from 'hono';
import { z } from 'zod';
import { hashPassword, verifyPassword, generateToken, getUserFromRequest, getGoogleAccessToken, getGoogleUserInfo, getGoogleAuthUrl } from '../lib/auth';
import type { User, UserRole } from '../types';

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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
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

// Change or set password
authRouter.post('/change-password', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = changePasswordSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { currentPassword, newPassword } = result.data;

  // Get user with password hash
  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash FROM users WHERE id = ?'
  ).bind(authUser.userId).first() as any;

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Check if user has a password (Google SSO users have password_hash = null)
  const hasPassword = user.password_hash !== null;

  if (hasPassword) {
    // Verify current password for users who already have one
    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return c.json({ error: 'Current password is incorrect' }, 401);
    }
  } else {
    // For users without password (Google SSO users), verify they provided currentPassword
    // This allows us to ensure they intentionally want to set a password
    if (!currentPassword) {
      return c.json({
        error: 'To set a password, you must provide your current password. If you signed up with Google SSO and don\'t have a password yet, you can set one by entering any password in the current password field.',
        requiresPassword: true
      }, 400);
    }
    // For initial password setup, we accept any non-empty currentPassword as confirmation
    // The real security comes from being already logged in with a valid JWT token
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);

  // Update password
  await c.env.DB.prepare(
    'UPDATE users SET password_hash = ? WHERE id = ?'
  ).bind(newPasswordHash, user.id).run();

  return c.json({
    message: hasPassword ? 'Password changed successfully' : 'Password set successfully',
    wasInitialSetup: !hasPassword
  });
});

// Google OAuth endpoints

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
    return c.redirect(`${new URL(c.req.raw.url).origin}/login?error=oauth_failed&message=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return c.redirect(`${new URL(c.req.raw.url).origin}/login?error=no_code`);
  }

  try {
    console.log('[Google OAuth] Starting OAuth callback, code received:', !!code);

    // Exchange code for access token
    console.log('[Google OAuth] Exchanging code for token...');
    const tokenResponse = await getGoogleAccessToken(
      code,
      c.env.GOOGLE_CLIENT_ID,
      c.env.GOOGLE_CLIENT_SECRET,
      c.env.GOOGLE_REDIRECT_URI
    );
    console.log('[Google OAuth] Got access token:', !!tokenResponse.access_token);

    // Fetch user info from Google
    console.log('[Google OAuth] Fetching user info...');
    const googleUser = await getGoogleUserInfo(tokenResponse.access_token);
    console.log('[Google OAuth] Got user email:', googleUser.email);

    // Check if email is pre-approved
    console.log('[Google OAuth] Checking whitelist for email:', googleUser.email);
    const preApproved = await c.env.DB.prepare(
      'SELECT * FROM pre_approved_emails WHERE email = ? AND is_active = 1'
    ).bind(googleUser.email).first();
    console.log('[Google OAuth] Whitelist check result:', !!preApproved);

    if (!preApproved) {
      return c.redirect(
        `${new URL(c.req.raw.url).origin}/login?error=not_approved&message=${encodeURIComponent('Email not found in approved list. Please contact your HOA admin.')}`
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
    return c.redirect(`${new URL(c.req.raw.url).origin}/login?token=${token}&provider=google`);

  } catch (err: any) {
    console.error('Google OAuth error:', err);
    const errorMessage = err?.message || String(err);
    return c.redirect(
      `${new URL(c.req.raw.url).origin}/login?error=oauth_error&message=${encodeURIComponent(errorMessage)}&details=${encodeURIComponent(JSON.stringify(err))}`
    );
  }
});

// Whitelist management endpoints for Google OAuth

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
  ).bind(id).first();

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
  ).all();

  return c.json({ entries: entries.results || [] });
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
