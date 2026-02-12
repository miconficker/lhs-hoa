/**
 * Centralized Error Handling Middleware
 *
 * Provides consistent error responses across all API routes
 * with proper HTTP status codes and structured error format
 */

import type { Context, Next } from 'hono';
import { logger, type LogContext } from '../lib/logger';

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}

export enum ErrorCode {
  // Auth errors (4xx)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Validation errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Resource errors (4xx)
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Business logic errors (4xx)
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Create typed error responses
 */
export const errorResponses = {
  unauthorized(message = 'Unauthorized', details?: unknown): AppError {
    return new AppError(401, ErrorCode.UNAUTHORIZED, message, details);
  },

  forbidden(message = 'Forbidden', details?: unknown): AppError {
    return new AppError(403, ErrorCode.FORBIDDEN, message, details);
  },

  invalidToken(message = 'Invalid or expired token', details?: unknown): AppError {
    return new AppError(401, ErrorCode.INVALID_TOKEN, message, details);
  },

  validation(message = 'Validation failed', details?: unknown): AppError {
    return new AppError(400, ErrorCode.VALIDATION_ERROR, message, details);
  },

  notFound(resource = 'Resource', details?: unknown): AppError {
    return new AppError(404, ErrorCode.NOT_FOUND, `${resource} not found`, details);
  },

  conflict(message = 'Resource conflict', details?: unknown): AppError {
    return new AppError(409, ErrorCode.CONFLICT, message, details);
  },

  internal(message = 'Internal server error', details?: unknown): AppError {
    return new AppError(500, ErrorCode.INTERNAL_ERROR, message, details);
  },

  database(message = 'Database error', details?: unknown): AppError {
    return new AppError(500, ErrorCode.DATABASE_ERROR, message, details);
  },
};

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Error Handler Middleware
 *
 * Catches all errors thrown in route handlers and returns
 * consistent error responses with appropriate status codes
 */
export const errorHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    const requestId = generateRequestId();

    // Handle our custom AppError
    if (error instanceof AppError) {
      const response: ErrorResponse = {
        error: error.message,
        code: error.code,
        requestId,
      };

      if (error.details !== undefined) {
        response.details = error.details;
      }

      return c.json(response, error.statusCode);
    }

    // Handle Zod validation errors
    if (error && typeof error === 'object' && 'issues' in error) {
      const response: ErrorResponse = {
        error: 'Validation failed',
        code: ErrorCode.VALIDATION_ERROR,
        details: error,
        requestId,
      };
      return c.json(response, 400);
    }

    // Handle standard JavaScript errors
    if (error instanceof Error) {
      // Log unexpected errors (in production, this would go to monitoring)
      const logContext: LogContext = {
        requestId,
        endpoint: c.req.path,
        method: c.req.method,
        statusCode: 500,
      };
      logger.error('Unhandled error in error handler', error, logContext);

      const response: ErrorResponse = {
        error: 'An unexpected error occurred',
        code: ErrorCode.INTERNAL_ERROR,
        requestId,
      };

      // Include stack trace in development only
      if (c.env?.ENVIRONMENT === 'development') {
        response.details = {
          message: error.message,
          stack: error.stack,
        };
      }

      return c.json(response, 500);
    }

    // Handle unknown errors
    const logContext: LogContext = {
      requestId,
      endpoint: c.req.path,
      method: c.req.method,
      statusCode: 500,
    };
    logger.error('Unknown error in error handler', error, logContext);

    const response: ErrorResponse = {
      error: 'An unexpected error occurred',
      code: ErrorCode.INTERNAL_ERROR,
      requestId,
    };

    return c.json(response, 500);
  }
};

/**
 * Not Found Handler
 *
 * Handles requests to undefined routes
 */
export const notFoundHandler = (c: Context) => {
  const requestId = generateRequestId();

  const response: ErrorResponse = {
    error: `Route not found: ${c.req.method} ${c.req.path}`,
    code: ErrorCode.NOT_FOUND,
    requestId,
  };

  return c.json(response, 404);
};
