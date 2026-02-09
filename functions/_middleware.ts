/**
 * Cloudflare Pages Functions Middleware
 *
 * This middleware proxies API requests to the Cloudflare Worker backend.
 * The worker handles all /api/* routes, while static files are served by Pages.
 */

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: {
    WORKER_URL?: string;
  };
}) {
  const url = new URL(context.request.url);

  // Proxy all /api/* requests to the worker
  if (url.pathname.startsWith('/api/')) {
    const workerUrl = context.env.WORKER_URL || 'https://laguna-hills-hoa-api.your-subdomain.workers.dev';

    // Build the target URL
    const targetUrl = `${workerUrl}${url.pathname}${url.search}`;

    // Copy all headers except host
    const headers = new Headers();
    for (const [key, value] of context.request.headers.entries()) {
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    }

    // Forward the request to the worker
    return fetch(targetUrl, {
      method: context.request.method,
      headers,
      body: context.request.body,
      // @ts-ignore - redirect mode is valid
      redirect: 'manual',
    });
  }

  // For non-API routes, continue with normal Pages handling (static files)
  return context.next();
}
