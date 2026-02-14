import type { Context, Next } from "hono";
import type { AppEnv } from "../index";

interface RateLimitOptions {
  /** Maximum requests in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Key prefix for KV storage */
  keyPrefix: string;
}

/**
 * KV-based rate limiter middleware for Cloudflare Workers.
 * Uses sliding window counter stored in KV with TTL expiration.
 * Adds standard X-RateLimit-* headers to responses.
 */
export function rateLimit(options: RateLimitOptions) {
  return async (c: Context<AppEnv>, next: Next) => {
    const userId = c.get("userId");
    const key = `${options.keyPrefix}:${userId}`;

    const current = Number(await c.env.KV.get(key)) || 0;

    c.header("X-RateLimit-Limit", String(options.limit));
    c.header(
      "X-RateLimit-Remaining",
      String(Math.max(0, options.limit - current - 1)),
    );

    if (current >= options.limit) {
      c.header("Retry-After", String(options.windowSeconds));
      return c.json(
        {
          error: {
            code: "RATE_LIMIT",
            message: `Rate limit exceeded. Try again in ${options.windowSeconds} seconds.`,
          },
        },
        429,
      );
    }

    await c.env.KV.put(key, String(current + 1), {
      expirationTtl: options.windowSeconds,
    });

    await next();
  };
}
