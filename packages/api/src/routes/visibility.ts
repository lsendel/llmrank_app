import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  projectQueries,
  userQueries,
  visibilityChecks,
  visibilityQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS, ERROR_CODES } from "@llm-boost/shared";
import { VisibilityChecker } from "@llm-boost/llm";
import { eq, desc, and, sql } from "drizzle-orm";

export const visibilityRoutes = new Hono<AppEnv>();

visibilityRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// POST /check — Run visibility check
// ---------------------------------------------------------------------------

visibilityRoutes.post("/check", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json<{
    projectId: string;
    query: string;
    providers: string[];
    competitors?: string[];
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

  // Verify project ownership
  const project = await projectQueries(db).getById(body.projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  // Check visibility check limits
  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const limits = PLAN_LIMITS[user.plan];
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const usedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(visibilityChecks)
    .where(
      and(
        eq(visibilityChecks.projectId, body.projectId),
        sql`${visibilityChecks.checkedAt} >= ${thisMonth.toISOString()}`,
      ),
    );

  const used = Number(usedCount[0]?.count ?? 0);
  if (used + body.providers.length > limits.visibilityChecks) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: `Visibility check limit reached (${used}/${limits.visibilityChecks} this month)`,
        },
      },
      429,
    );
  }

  // Run visibility checks
  const checker = new VisibilityChecker();
  const results = await checker.checkAllProviders({
    query: body.query,
    targetDomain: project.domain,
    competitors: body.competitors ?? [],
    providers: body.providers,
    apiKeys: {
      chatgpt: c.env.OPENAI_API_KEY,
      claude: c.env.ANTHROPIC_API_KEY,
      perplexity: c.env.PERPLEXITY_API_KEY,
      gemini: c.env.GOOGLE_API_KEY,
    },
  });

  // Store results
  const stored = await db
    .insert(visibilityChecks)
    .values(
      results.map((r) => ({
        projectId: body.projectId,
        llmProvider: r.provider as
          | "chatgpt"
          | "claude"
          | "perplexity"
          | "gemini"
          | "copilot",
        query: r.query,
        responseText: r.responseText,
        brandMentioned: r.brandMentioned,
        urlCited: r.urlCited,
        citationPosition: r.citationPosition,
        competitorMentions: r.competitorMentions,
      })),
    )
    .returning();

  return c.json({ data: stored }, 201);
});

// ---------------------------------------------------------------------------
// GET /:projectId — List visibility results
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const results = await db.query.visibilityChecks.findMany({
    where: eq(visibilityChecks.projectId, projectId),
    orderBy: [desc(visibilityChecks.checkedAt)],
    limit: 100,
  });

  return c.json({ data: results });
});

// ---------------------------------------------------------------------------
// GET /:projectId/trends — Weekly share-of-voice trends
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/trends", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const trends = await visibilityQueries(db).getTrends(projectId);

  return c.json({ data: trends });
});
