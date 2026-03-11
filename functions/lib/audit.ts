/**
 * Audit logging utility for security monitoring
 * Tracks user actions for compliance and security analysis
 */

export interface AuditLogEntry {
  userId?: string;
  userEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an audit event to the database
 * @param db D1 database instance
 * @param entry Audit log entry
 */
export async function logAuditEvent(
  db: D1Database,
  entry: AuditLogEntry
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO audit_logs (
        user_id, user_email, action, resource_type, resource_id,
        ip_address, user_agent, success, error_message, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entry.userId || null,
      entry.userEmail || null,
      entry.action,
      entry.resourceType || null,
      entry.resourceId || null,
      entry.ipAddress || null,
      entry.userAgent || null,
      entry.success ? 1 : 0,
      entry.errorMessage || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null
    ).run();
  } catch (error) {
    // Don't throw - audit logging failures shouldn't break the application
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Audit action types
 */
export const AUDIT_ACTIONS = {
  // Search actions
  SEARCH_USERS: 'search.users',
  SEARCH_HOUSEHOLDS: 'search.households',
  SEARCH_LOTS: 'search.lots',

  // Authentication
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGOUT: 'auth.logout',

  // Admin operations
  USER_CREATED: 'admin.user.created',
  USER_UPDATED: 'admin.user.updated',
  USER_DELETED: 'admin.user.deleted',
  HOUSEHOLD_UPDATED: 'admin.household.updated',
  LOT_UPDATED: 'admin.lot.updated',

  // Data access
  DATA_EXPORTED: 'data.exported',
  REPORT_GENERATED: 'report.generated',
} as const;

/**
 * Extract user agent from request headers
 */
export function getUserAgent(request: Request): string {
  const ua = request.headers.get('User-Agent');
  return ua || 'unknown';
}

/**
 * Sanitize error messages for logging (remove sensitive data)
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    // Remove potential sensitive data (tokens, passwords, etc.)
    return error
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+/gi, '[REDACTED_TOKEN]')
      .replace(/password["']?\s*[:=]\s*["']?[^"'}\s]+/gi, '[REDACTED]');
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
