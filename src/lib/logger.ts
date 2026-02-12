/**
 * Frontend Logging Utility
 *
 * Client-side logging that respects user privacy and can integrate
 * with monitoring services in production.
 */

export enum LogLevel {
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
  DEBUG = "DEBUG",
}

export interface LogContext {
  userId?: string;
  action?: string;
  component?: string;
  endpoint?: string;
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
  };
}

class Logger {
  private isDevelopment: boolean;
  private minLogLevel: LogLevel;

  constructor() {
    this.isDevelopment = import.meta.env?.DEV ?? false;
    this.minLogLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    return levels.indexOf(level) >= levels.indexOf(this.minLogLevel);
  }

  private formatLogEntry(
    level: LogLevel,
    message: string,
    error?: Error | unknown,
    context?: LogContext,
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
          ...(this.isDevelopment && error.stack && { stack: error.stack }),
        };
      } else {
        entry.error = {
          name: "Unknown",
          message: String(error),
        };
      }
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    const { level, message } = entry;

    switch (level) {
      case LogLevel.ERROR:
        console.error(message, entry.context, entry.error);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.context);
        break;
      case LogLevel.INFO:
        console.info(message, entry.context);
        break;
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.log(message, entry.context);
        }
        break;
    }

    // In production, send to monitoring service
    if (!this.isDevelopment && level === LogLevel.ERROR) {
      this.sendToMonitoring(entry);
    }
  }

  private sendToMonitoring(entry: LogEntry): void {
    // Integration point for Sentry, DataDog, etc.
    // For example: Sentry.captureException(entry.error);
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.captureException(entry.error, {
        level: "error",
        extra: entry.context,
      });
    }
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const entry = this.formatLogEntry(LogLevel.ERROR, message, error, context);
    this.output(entry);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const entry = this.formatLogEntry(
      LogLevel.WARN,
      message,
      undefined,
      context,
    );
    this.output(entry);
  }

  /**
   * Log an informational message
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const entry = this.formatLogEntry(
      LogLevel.INFO,
      message,
      undefined,
      context,
    );
    this.output(entry);
  }

  /**
   * Log a debug message (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const entry = this.formatLogEntry(
      LogLevel.DEBUG,
      message,
      undefined,
      context,
    );
    this.output(entry);
  }

  /**
   * Create a child logger with preset context (future feature)
   */
  withContext(_presetContext: LogContext): Logger {
    // For future: merge preset context with each log
    const child = new Logger();
    return child;
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience exports
export const logError = logger.error.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logDebug = logger.debug.bind(logger);
