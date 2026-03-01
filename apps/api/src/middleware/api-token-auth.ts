import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";
import { apiTokenQueries, userQueries, projectQueries } from "@llm-boost/db";
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";
import { createApiTokenService } from "../services/api-token-service";

/**
 * API token authentication middleware for v1 routes.
 *
 * - Extracts `Authorization: Bearer llmb_...` header
 * - Authenticates via ApiTokenService (hash lookup)
 * - Enforces per-token KV rate limiting based on the user's plan
 * - Sets `tokenCtx` on the context for downstream route handlers
 */
export const apiTokenAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid Authorization header",
        },
      },
      401,
    );
  }

  const rawToken = authHeader.slice("Bearer ".length).trim();

  if (!rawToken || !rawToken.startsWith("llmb_")) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API token format",
        },
      },
      401,
    );
  }

  // Authenticate token via service
  const db = c.get("db");
  const service = createApiTokenService({
    apiTokens: apiTokenQueries(db) as any,
    projects: { getById: (id: string) => projectQueries(db).getById(id) },
  });

  const tokenCtx = await service.authenticate(rawToken);

  if (!tokenCtx) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired API token",
        },
      },
      401,
    );
  }

  // KV-based rate limiting per token
  const uq = userQueries(db);
  const user = await uq.getById(tokenCtx.userId);

  if (!user) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Token owner not found",
        },
      },
      401,
    );
  }

  // Check user status
  const status = user.status ?? "active";
  if (status !== "active") {
    return c.json(
      {
        error: {
          code: "ACCOUNT_SUSPENDED",
          message:
            status === "banned"
              ? "Your account has been permanently banned."
              : "Your account has been suspended.",
        },
      },
      403,
    );
  }

  const plan = user.plan as PlanTier;
  const limits = PLAN_LIMITS[plan];
  const rateLimit = limits.apiRateLimit;

  if (rateLimit > 0) {
    const kvKey = `ratelimit:token:${tokenCtx.tokenId}`;
    const current = Number(await c.env.KV.get(kvKey)) || 0;

    c.header("X-RateLimit-Limit", String(rateLimit));
    c.header(
      "X-RateLimit-Remaining",
      String(Math.max(0, rateLimit - current - 1)),
    );

    if (current >= rateLimit) {
      c.header("Retry-After", "60");
      return c.json(
        {
          error: {
            code: "RATE_LIMIT",
            message: "API rate limit exceeded. Try again in 60 seconds.",
          },
        },
        429,
      );
    }

    await c.env.KV.put(kvKey, String(current + 1), {
      expirationTtl: 60,
    });
  }

  c.set("tokenCtx", tokenCtx);
  await next();
});
