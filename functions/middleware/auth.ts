/**
 * Guest Session Middleware
 *
 * Handles guest authentication for external visitors using Google SSO.
 * Uses signed JWT state tokens instead of cookies for CSRF protection in stateless Workers.
 *
 * Key differences from resident auth:
 * - Guests use customer_id instead of user_id
 * - Sessions are stored in JWT tokens (no server-side session)
 * - State is signed with JWT_SECRET for CSRF protection
 */

import { SignJWT, jwtVerify } from 'jose';

export interface GuestSession {
  customerId: string;
  customerType: 'external';
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
  exp?: number; // JWT expiration
}

/**
 * Generate a signed OAuth state token for CSRF protection
 * Uses JWT signing instead of server-stored random strings
 */
export async function generateOAuthState(secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return await new SignJWT({ type: 'oauth_state' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m') // 10 minute window
    .sign(key);
}

/**
 * Verify an OAuth state token
 */
export async function verifyOAuthState(state: string, secret: string): Promise<boolean> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(state, key);
    return payload.type === 'oauth_state';
  } catch {
    return false;
  }
}

/**
 * Create a guest session JWT token
 */
export async function createGuestSession(
  customer: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    google_picture_url?: string;
  },
  secret: string
): Promise<string> {
  const key = new TextEncoder().encode(secret);

  return await new SignJWT({
    customerId: customer.id,
    customerType: 'external',
    email: customer.email,
    firstName: customer.first_name,
    lastName: customer.last_name,
    picture: customer.google_picture_url,
  } as GuestSession)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7 days for guest sessions
    .sign(key);
}

/**
 * Verify and parse a guest session token
 */
export async function verifyGuestSession(
  token: string,
  secret: string
): Promise<GuestSession | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    return payload as GuestSession;
  } catch {
    return null;
  }
}

/**
 * Extract guest session from request headers
 * Looks for guest_token cookie or Authorization header
 */
export async function getGuestSessionFromRequest(
  request: Request,
  secret: string
): Promise<GuestSession | null> {
  // Try cookie first
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const guestTokenCookie = cookies.find(c => c.startsWith('guest_token='));
    if (guestTokenCookie) {
      const token = guestTokenCookie.substring('guest_token='.length);
      return await verifyGuestSession(token, secret);
    }
  }

  // Try Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return await verifyGuestSession(token, secret);
  }

  return null;
}

/**
 * Helper to get client IP address from request
 * Respects X-Forwarded-For header for Cloudflare Workers
 */
export function getClientIp(request: Request): string {
  // Check X-Forwarded-For first (Cloudflare Workers)
  const forwardedFor = request.headers.get('X-Forwarded-For');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to CF-Connecting-IP (Cloudflare specific)
  const cfConnectingIp = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Last resort: return empty string (we'll handle this in the calling code)
  return '';
}
