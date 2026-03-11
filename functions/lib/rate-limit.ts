/**
 * Rate limiting utility for Cloudflare Workers D1
 *
 * Provides rate limiting using a simple D1-based counter approach.
 * Each IP address has a rolling window limit for requests.
 */

interface RateLimitEntry {
  ip_address: string;
  request_count: number;
  window_start: number;
  window_end: number;
}

export interface RateLimitConfig {
  /** Maximum requests allowed within the time window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check if a request should be rate limited
 * @param db D1 database instance
 * @param ip Client IP address
 * @param config Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  db: D1Database,
  ip: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / 1000) - config.windowSeconds;
  const windowEnd = Math.floor(now / 1000);

  // Clean up old entries
  await db.prepare(`
    DELETE FROM rate_limits
    WHERE window_end < ?
  `).bind(windowStart).run();

  // Get current count for this IP
  const current = await db.prepare(`
    SELECT request_count, window_end
    FROM rate_limits
    WHERE ip_address = ? AND window_end >= ?
    ORDER BY window_end DESC
    LIMIT 1
  `).bind(ip, windowStart).first() as RateLimitEntry | null;

  let requestCount = 1;
  let windowStartTime = windowStart;

  if (current) {
    requestCount = current.request_count + 1;
    windowStartTime = current.window_start;
  }

  // Check if limit exceeded
  const allowed = requestCount <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - requestCount);

  // Update or create rate limit entry
  if (current) {
    await db.prepare(`
      UPDATE rate_limits
      SET request_count = ?
      WHERE ip_address = ? AND window_end = ?
    `).bind(requestCount, ip, current.window_end).run();
  } else {
    await db.prepare(`
      INSERT INTO rate_limits (ip_address, request_count, window_start, window_end)
      VALUES (?, ?, ?, ?)
    `).bind(ip, requestCount, windowStartTime, windowEnd).run();
  }

  return {
    allowed,
    remaining,
    resetAt: new Date((windowStartTime + config.windowSeconds) * 1000),
  };
}

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Search endpoints: 30 requests per minute
  search: { maxRequests: 30, windowSeconds: 60 } as RateLimitConfig,

  // Admin operations: 100 requests per minute
  admin: { maxRequests: 100, windowSeconds: 60 } as RateLimitConfig,

  // Authentication: 10 requests per minute (prevents brute force)
  auth: { maxRequests: 10, windowSeconds: 60 } as RateLimitConfig,

  // General API: 200 requests per minute
  general: { maxRequests: 200, windowSeconds: 60 } as RateLimitConfig,
};

/**
 * Get client IP address from request
 */
export function getClientIp(request: Request): string {
  // Check Cloudflare-specific headers first
  const cfConnectingIp = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIp) return cfConnectingIp;

  // Check X-Forwarded-For header
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    // Take the first IP (original client)
    return xForwardedFor.split(',')[0].trim();
  }

  // Fallback to remote address
  // Note: In Cloudflare Workers, this might not be available
  return 'unknown';
}
