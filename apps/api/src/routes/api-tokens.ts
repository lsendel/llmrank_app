import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { apiTokenQueries, userQueries, projectQueries } from "@llm-boost/db";
import type { PlanTier } from "@llm-boost/shared";
import {
  createApiTokenService,
  type TokenScope,
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
    apiTokens: apiTokenQueries(db),
    projects: { getById: (id: string) => projectQueries(db).getById(id) },
  });
}

// ---------------------------------------------------------------------------
// POST / -- Create an API token
// ---------------------------------------------------------------------------

tokenRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    projectId: string;
    name: string;
    scopes: TokenScope[];
    expiresAt?: string;
  }>();

  if (!body.projectId || !body.name || !body.scopes?.length) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId, name, and scopes are required",
        },
      },
      422,
    );
  }

  // Validate scopes
  const validScopes: TokenScope[] = [
    "metrics:read",
    "scores:read",
    "visibility:read",
  ];
  const invalidScopes = body.scopes.filter((s) => !validScopes.includes(s));
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
      projectId: body.projectId,
      name: body.name,
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });

    return c.json(
      {
        data: {
          ...result.token,
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
    return c.json({ data: tokens });
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
