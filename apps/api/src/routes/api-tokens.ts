import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { apiTokenQueries, userQueries, projectQueries } from "@llm-boost/db";
import {
  type PlanTier,
  ALL_TOKEN_SCOPES,
  type TokenScope,
} from "@llm-boost/shared";
import {
  createApiTokenService,
  type ApiTokenRepository,
} from "../services/api-token-service";
import { handleServiceError } from "../services/errors";

export const tokenRoutes = new Hono<AppEnv>();

tokenRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// Helper -- build service from context
// ---------------------------------------------------------------------------

function buildService(c: {
  get(key: "db"): ReturnType<typeof import("@llm-boost/db").createDb>;
}) {
  const db = c.get("db");
  return createApiTokenService({
    apiTokens: apiTokenQueries(db) as unknown as ApiTokenRepository,
    projects: { getById: (id: string) => projectQueries(db).getById(id) },
  });
}

// ---------------------------------------------------------------------------
// POST / -- Create an API token
// ---------------------------------------------------------------------------

tokenRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    projectId?: string;
    name: string;
    type?: "api" | "mcp";
    scopes?: TokenScope[];
    expiresAt?: string;
  }>();

  const tokenType = body.type ?? "api";

  if (!body.name || !["api", "mcp"].includes(tokenType)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "name is required and type must be 'api' or 'mcp'",
        },
      },
      422,
    );
  }

  // For MCP tokens, auto-assign all scopes; for API tokens, use provided scopes
  const scopes: TokenScope[] =
    tokenType === "mcp" ? [...ALL_TOKEN_SCOPES] : (body.scopes ?? []);

  if (tokenType === "api" && scopes.length === 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "scopes are required for API tokens",
        },
      },
      422,
    );
  }

  // Validate scopes
  const invalidScopes = scopes.filter(
    (s) => !(ALL_TOKEN_SCOPES as readonly string[]).includes(s),
  );
  if (invalidScopes.length > 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid scopes: ${invalidScopes.join(", ")}`,
        },
      },
      422,
    );
  }

  // Look up user plan
  const db = c.get("db");
  const uq = userQueries(db);
  const user = await uq.getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      401,
    );
  }

  const service = buildService(c);

  try {
    const result = await service.create({
      userId,
      userPlan: user.plan as PlanTier,
      projectId: body.projectId ?? null,
      type: tokenType,
      name: body.name,
      scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });

    const t = result.token;
    return c.json(
      {
        data: {
          id: t.id,
          name: t.name,
          prefix: t.tokenPrefix,
          type: t.type,
          scopes: t.scopes,
          projectId: t.projectId,
          lastUsedAt: t.lastUsedAt,
          createdAt: t.createdAt,
          expiresAt: t.expiresAt,
          plaintext: result.plainToken,
        },
      },
      201,
    );
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET / -- List user's API tokens
// ---------------------------------------------------------------------------

tokenRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const service = buildService(c);

  try {
    const tokens = await service.list(userId);
    return c.json({
      data: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        prefix: t.tokenPrefix,
        type: t.type,
        scopes: t.scopes,
        projectId: t.projectId,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
      })),
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id -- Revoke an API token
// ---------------------------------------------------------------------------

tokenRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const tokenId = c.req.param("id");
  const service = buildService(c);

  try {
    const token = await service.revoke(userId, tokenId);
    return c.json({ data: token });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
