import type { Context, Next } from "hono";
import type { AppEnv } from "../index";
import { trackMetric } from "../lib/observability";

/**
 * Middleware to automatically track request metrics
 */
export async function metricsMiddleware(c: Context<AppEnv>, next: Next) {
  const startTime = Date.now();
  const path = c.req.path;
  const method = c.req.method;

  // Execute the request
  await next();

  // Track metrics after response
  const duration = Date.now() - startTime;
  const status = c.res.status;

  // Track request duration
  trackMetric({
    name: "http_request_duration_ms",
    value: duration,
    tags: {
      method,
      path: path.replace(/\/[a-f0-9-]{36}/g, "/:id"), // Normalize UUIDs
      status: status.toString(),
      environment: process.env.NODE_ENV || "production",
    },
  });

  // Track error rates
  if (status >= 400) {
    trackMetric({
      name: "http_request_errors",
      value: 1,
      tags: {
        method,
        path: path.replace(/\/[a-f0-9-]{36}/g, "/:id"),
        status: status.toString(),
        error_class: status >= 500 ? "server_error" : "client_error",
      },
    });
  }

  // Track success rate
  if (status < 400) {
    trackMetric({
      name: "http_request_success",
      value: 1,
      tags: {
        method,
        path: path.replace(/\/[a-f0-9-]{36}/g, "/:id"),
      },
    });
  }
}
