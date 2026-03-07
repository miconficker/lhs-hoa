/**
 * Sentry Error Tracking Configuration
 *
 * Integrates Sentry for client-side error tracking and monitoring.
 * Captures unhandled errors, promise rejections, and provides breadcrumbs.
 */

import * as Sentry from "@sentry/browser";
import { BrowserProfilingIntegration } from "@sentry/browser";

// Only initialize in production or when explicitly enabled
const shouldInitSentry =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_SENTRY === "true";

if (shouldInitSentry && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || "latest",

    // Set sample rate for tracing (1.0 = 100% of transactions)
    tracesSampleRate: parseFloat(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0.1",
    ),

    // Set sample rate for session replay (1.0 = 100% of sessions)
    replaysSessionSampleRate: parseFloat(
      import.meta.env.VITE_SENTRY_REPLAYS_SAMPLE_RATE || "0.1",
    ),
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Performance monitoring
    integrations: [
      new BrowserProfilingIntegration(),
      new Sentry.Replay(),
      new Sentry.BrowserTracing({
        // Trace frontend navigation and user interactions
        tracePropagationTargets: [
          "localhost",
          /^https:\/\/your-production-domain\.com/,
          /^\//,
        ],
      }),
    ],

    // Filter out noise from development
    beforeSend(event, hint) {
      // Don't send errors in development
      if (
        import.meta.env.DEV &&
        import.meta.env.VITE_ENABLE_SENTRY !== "true"
      ) {
        return null;
      }

      // Filter out specific error types
      const error = hint.originalException;

      // Ignore network errors that are user's connection issues
      if (
        error instanceof TypeError &&
        error.message.includes("Failed to fetch")
      ) {
        return null;
      }

      return event;
    },

    // Attach user context when available
    initialScope: (scope) => {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      if (user) {
        scope.setUser({
          id: user.id,
          email: user.email,
          role: user.role,
        });
      }
      return scope;
    },

    // Custom tags for filtering
    tags: {
      framework: "vite",
      runtime: "browser",
    },
  });

  console.info("Sentry initialized for error tracking");
}

/**
 * Manually capture an exception and send to Sentry
 */
export const captureException = (
  error: Error,
  context?: Record<string, unknown>,
) => {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("custom", context);
    }
    Sentry.captureException(error);
  });
};

/**
 * Manually capture a message and send to Sentry
 */
export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = "info",
) => {
  Sentry.captureMessage(message, level);
};

/**
 * Set user context for error tracking
 */
export const setUser = (user: { id: string; email: string; role?: string }) => {
  Sentry.setUser(user);
};

/**
 * Clear user context (e.g., on logout)
 */
export const clearUser = () => {
  Sentry.setUser(null);
};

/**
 * Add a breadcrumb for tracking user actions
 */
export const addBreadcrumb = (breadcrumb: Sentry.Breadcrumb) => {
  Sentry.addBreadcrumb(breadcrumb);
};

/**
 * Start a performance transaction
 */
export const startTransaction = (name: string, op: string) => {
  return Sentry.startTransaction({ name, op });
};

export { Sentry };
