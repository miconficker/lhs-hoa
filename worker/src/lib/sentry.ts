/**
 * Sentry Error Tracking for Cloudflare Workers
 *
 * Integrates Sentry for server-side error tracking and monitoring.
 * Captures unhandled exceptions in Worker routes and middleware.
 */

import { captureException, captureMessage, init, setUser, withScope } from "@sentry/cloudflare";

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
}

/**
 * Initialize Sentry for Cloudflare Workers
 *
 * Call this in your Worker's main entry point with the environment binding
 */
export const initSentry = (config: SentryConfig) => {
  // Only initialize if DSN is provided
  if (!config.dsn) {
    console.warn("Sentry DSN not provided, error tracking disabled");
    return;
  }

  init({
    dsn: config.dsn,
    environment: config.environment || "production",
    release: config.release || "latest",
    tracesSampleRate: config.tracesSampleRate || 0.1,

    // Integrations for Cloudflare Workers
    integrations: [],

    // Filter out noise
    beforeSend(event, hint) {
      // Filter out specific error types
      const error = hint.originalException;

      // Ignore 4xx errors that are expected client errors
      if (error instanceof Error) {
        // Don't send validation errors
        if (error.message.includes("VALIDATION_ERROR")) {
          return null;
        }
      }

      return event;
    },
  });

  console.info("Sentry initialized for Worker error tracking");
};

/**
 * Capture an exception with additional context
 */
export const captureExceptionWithContext = (
  error: Error | unknown,
  context?: {
    user?: { id: string; email?: string; role?: string };
    request?: { method: string; path: string; headers?: Record<string, string> };
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
) => {
  withScope((scope) => {
    // Add user context if provided
    if (context?.user) {
      scope.setUser(context.user);
    }

    // Add request context
    if (context?.request) {
      scope.setContext("request", {
        method: context.request.method,
        path: context.request.path,
        headers: context.request.headers,
      });
    }

    // Add tags for filtering
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    // Add extra data
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    captureException(error);
  });
};

/**
 * Capture a message with a specific severity level
 */
export const captureMessageWithContext = (
  message: string,
  level: "fatal" | "error" | "warning" | "log" | "info" | "debug" = "info",
  context?: Record<string, unknown>
) => {
  withScope((scope) => {
    if (context) {
      scope.setContext("custom", context);
    }
    captureMessage(message, level);
  });
};

/**
 * Wrap a route handler with Sentry error tracking
 */
export const withSentryTracking = (
  handler: (ctx: import("hono").Context, next?: import("hono").Next) => Promise<Response> | Response
) => {
  return async (ctx: import("hono").Context, next?: import("hono").Next) => {
    try {
      return await handler(ctx, next);
    } catch (error) {
      // Extract user info from request if available (from JWT)
      let userContext;
      const authHeader = ctx.req.header("Authorization");
      if (authHeader) {
        // User info will be extracted from JWT by auth middleware
        // We add it here as context for the error
        const userId = ctx.get("userId");
        if (userId) {
          userContext = { id: userId };
        }
      }

      // Capture exception with request context
      captureExceptionWithContext(error, {
        user: userContext,
        request: {
          method: ctx.req.method,
          path: ctx.req.path,
          headers: Object.fromEntries(ctx.req.header()),
        },
        tags: {
          runtime: "worker",
          route: ctx.req.path,
        },
      });

      // Re-throw to let error handler middleware handle response
      throw error;
    }
  };
};

/**
 * Set user context for authenticated requests
 */
export const setSentryUser = (user: { id: string; email?: string; role?: string }) => {
  setUser(user);
};

/**
 * Clear user context (e.g., on logout)
 */
export const clearSentryUser = () => {
  setUser(null);
};
