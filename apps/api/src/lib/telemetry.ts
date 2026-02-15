import { PostHog } from "posthog-node";

let client: PostHog | null = null;

/**
 * Returns a lazily-initialised PostHog client (singleton).
 *
 * On Cloudflare Workers with `nodejs_compat` enabled, `posthog-node` works
 * correctly for capture calls. The client batches events internally and we
 * flush explicitly via `flushPostHog()` at the end of each request (using
 * `ctx.waitUntil`).
 */
export function getPostHog(apiKey?: string): PostHog | null {
  if (!apiKey) return null;
  if (!client) {
    client = new PostHog(apiKey, {
      host: "https://us.i.posthog.com",
      // Disable automatic flushing — we call flush() explicitly via
      // ctx.waitUntil() so events are sent before the isolate hibernates.
      flushAt: 20,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Fire-and-forget server-side event capture.
 *
 * Events are queued in memory and flushed by `flushPostHog()` at the end of
 * the request (see cron / route handlers).
 */
export function trackServer(
  apiKey: string | undefined,
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  const ph = getPostHog(apiKey);
  if (!ph) return;
  ph.capture({ distinctId, event, properties });
}

/**
 * Flush all pending events. Call this inside `ctx.waitUntil()` to ensure
 * events are delivered before the Worker isolate is evicted.
 *
 * Uses `flush()` instead of `shutdown()` to avoid the known shutdown-hang
 * issue on Cloudflare Workers. A manual timeout prevents indefinite waits.
 */
export async function flushPostHog(): Promise<void> {
  if (!client) return;
  try {
    await Promise.race([
      client.flush(),
      new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
    ]);
  } catch {
    // Swallow errors — telemetry must never break the request
  }
}

/**
 * Gracefully shut down the client (for long-running processes like the
 * report-service). Wraps shutdown in a timeout to prevent hangs.
 */
export async function shutdownPostHog(): Promise<void> {
  if (!client) return;
  try {
    await Promise.race([
      client._shutdown(5_000),
      new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
    ]);
  } catch {
    // Swallow errors
  }
  client = null;
}
