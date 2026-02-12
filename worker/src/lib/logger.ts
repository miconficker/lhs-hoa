/**
 * Centralized Logging Utility for Cloudflare Workers
 *
 * Replaces console.error(), console.warn(), console.log() with structured logging
 * that includes context, log levels, and environment-aware output.
 *
 * Usage:
 *   import { logger } from '../lib/logger';
 *
 *   logger.error('Error deleting user', error, { userId, context: 'admin_delete' });
 *   logger.warn('Rate limit approaching', { userId, requests: 99 });
 *   logger.info('User login successful', { userId });
 *   logger.debug('Cache hit', { key });
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  action?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  private isDevelopment = false;
  private minLogLevel: LogLevel;

  constructor() {
    // Detect environment from Cloudflare Workers or fallback
    this.isDevelopment = typeof globalThis.process !== 'undefined';
    this.minLogLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.minLogLevel);
  }

  private formatLogEntry(
    level: LogLevel,
    message: string,
    error?: Error | unknown,
    context?: LogContext
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
    };

    if (error) {
      if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: error.message,
          ...(error.stack && { stack: this.sanitizeStack(error.stack) }),
        };
      } else {
        entry.error = {
          name: 'Unknown',
          message: String(error),
        };
      }
    }

    return entry;
  }

  private sanitizeStack(stack: string): string {
    // Remove potentially sensitive paths from stack traces
    return stack
      .split('\n')
      .map((line) => line.replace(/\/.*\/worker\//, '/worker/'))
      .join('\n');
  }

  private output(entry: LogEntry): void {
    // In production, this could send to external monitoring (Sentry, DataDog, etc.)
    // For now, use appropriate console methods with structured output
    const { level, message, ...rest } = entry;

    const formatted = JSON.stringify({
      level,
      message,
      ...rest,
    });

    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.INFO:
        console.log(formatted);
        break;
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.log(formatted);
        }
        break;
    }
  }

  /**
   * Log an error message
   * @param message - Human-readable error description
   * @param error - Error object or unknown value
   * @param context - Additional context for the error
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const entry = this.formatLogEntry(LogLevel.ERROR, message, error, context);
    this.output(entry);
  }

  /**
   * Log a warning message
   * @param message - Warning description
   * @param context - Additional context
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const entry = this.formatLogEntry(LogLevel.WARN, message, undefined, context);
    this.output(entry);
  }

  /**
   * Log an informational message
   * @param message - Info description
   * @param context - Additional context
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry = this.formatLogEntry(LogLevel.INFO, message, undefined, context);
    this.output(entry);
  }

  /**
   * Log a debug message (development only)
   * @param message - Debug description
   * @param context - Additional context
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry = this.formatLogEntry(LogLevel.DEBUG, message, undefined, context);
    this.output(entry);
  }

  /**
   * Create a child logger with preset context
   * Useful for request-specific logging
   */
  withContext(presetContext: LogContext): Logger {
    const child = new Logger();
    child['presetContext'] = presetContext;
    return child;
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience exports for backward compatibility during migration
export const logError = logger.error.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logDebug = logger.debug.bind(logger);
