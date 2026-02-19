import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  savedKeywordQueries,
  userQueries,
  projectQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS, validateKeyword } from "@llm-boost/shared";
import { handleServiceError } from "../services/errors";

export const keywordRoutes = new Hono<AppEnv>();
keywordRoutes.use("*", authMiddleware);

// List saved keywords for a project
keywordRoutes.get("/:projectId", async (c) => {
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

  const keywords = await savedKeywordQueries(db).listByProject(projectId);
  return c.json({ data: keywords });
});

// Add keyword manually
keywordRoutes.post("/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  try {
    const project = await projectQueries(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const user = await userQueries(db).getById(userId);
    const limits = PLAN_LIMITS[user?.plan ?? "free"];
    const count = await savedKeywordQueries(db).countByProject(projectId);

    if (count >= limits.savedKeywordsPerProject) {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: `Your plan allows ${limits.savedKeywordsPerProject} saved keywords per project.`,
          },
        },
        403,
      );
    }

    const body = await c.req.json();
    const validation = validateKeyword(body.keyword);
    if (!validation.valid) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: validation.reason } },
        422,
      );
    }

    const keyword = await savedKeywordQueries(db).create({
      projectId,
      keyword: body.keyword,
      source: "user_added",
      funnelStage: body.funnelStage,
      personaId: body.personaId,
    });

    return c.json({ data: keyword }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// Batch create keywords (from visibility gaps)
keywordRoutes.post("/:projectId/batch", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  try {
    const project = await projectQueries(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const user = await userQueries(db).getById(userId);
    const limits = PLAN_LIMITS[user?.plan ?? "free"];
    const count = await savedKeywordQueries(db).countByProject(projectId);

    const body = await c.req.json<{ keywords: string[] }>();
    const keywords = (body.keywords ?? []).filter(
      (kw) => validateKeyword(kw).valid,
    );

    // Enforce plan limit
    const remaining = Math.max(0, limits.savedKeywordsPerProject - count);
    if (remaining === 0) {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: `Your plan allows ${limits.savedKeywordsPerProject} saved keywords per project.`,
          },
        },
        403,
      );
    }

    // Deduplicate against existing keywords
    const existing = await savedKeywordQueries(db).listByProject(projectId);
    const existingSet = new Set(existing.map((k) => k.keyword.toLowerCase()));
    const newKeywords = keywords
      .filter((kw) => !existingSet.has(kw.toLowerCase()))
      .slice(0, remaining);

    if (newKeywords.length === 0) {
      return c.json({ data: [] });
    }

    const created = await savedKeywordQueries(db).createMany(
      newKeywords.map((keyword) => ({
        projectId,
        keyword,
        source: "auto_discovered" as const,
      })),
    );

    return c.json({ data: created }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// Delete keyword
keywordRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  try {
    const deleted = await savedKeywordQueries(db).remove(id);
    if (!deleted) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Keyword not found" } },
        404,
      );
    }
    return c.body(null, 204);
  } catch (error) {
    return handleServiceError(c, error);
  }
});
