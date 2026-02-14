import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  createCompetitorRepository,
  createProjectRepository,
  createUserRepository,
  createVisibilityRepository,
} from "../repositories";
import { createVisibilityService } from "../services/visibility-service";
import { handleServiceError } from "../services/errors";
import { rateLimit } from "../middleware/rate-limit";

export const visibilityRoutes = new Hono<AppEnv>();

visibilityRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// POST /check — Run visibility check
// ---------------------------------------------------------------------------

visibilityRoutes.post(
  "/check",
  rateLimit({ limit: 5, windowSeconds: 60, keyPrefix: "rl:vis" }),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");

    const body = await c.req.json<{
      projectId: string;
      query: string;
      providers: string[];
    }>();

    if (!body.projectId || !body.query || !body.providers?.length) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "projectId, query, and providers are required",
          },
        },
        422,
      );
    }

    const service = createVisibilityService({
      projects: createProjectRepository(db),
      users: createUserRepository(db),
      visibility: createVisibilityRepository(db),
      competitors: createCompetitorRepository(db),
    });

    try {
      const stored = await service.runCheck({
        userId,
        projectId: body.projectId,
        query: body.query,
        providers: body.providers,
        apiKeys: {
          chatgpt: c.env.OPENAI_API_KEY,
          claude: c.env.ANTHROPIC_API_KEY,
          perplexity: c.env.PERPLEXITY_API_KEY,
          gemini: c.env.GOOGLE_API_KEY,
        },
      });
      return c.json({ data: stored }, 201);
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:projectId — List visibility results
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const data = await service.listForProject(userId, projectId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:projectId/trends — Weekly share-of-voice trends
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/trends", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const data = await service.getTrends(userId, projectId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
