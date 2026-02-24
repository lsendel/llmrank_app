import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { createProjectRepository, createUserRepository } from "../repositories";
import { aiPromptQueries, savedKeywordQueries } from "@llm-boost/db";
import { discoverPrompts } from "@llm-boost/llm";

export const promptResearchRoutes = new Hono<AppEnv>();

promptResearchRoutes.use("*", authMiddleware);

const PROMPT_LIMITS: Record<string, number> = {
  free: 3,
  starter: 20,
  pro: 100,
  agency: 999999,
};

// ---------------------------------------------------------------------------
// POST /:projectId/discover — Run AI prompt discovery
// ---------------------------------------------------------------------------

promptResearchRoutes.post("/:projectId/discover", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await createProjectRepository(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const user = await createUserRepository(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const limit = PROMPT_LIMITS[user.plan] ?? 3;
  const existing = await aiPromptQueries(db).countByProject(projectId);
  if (existing >= limit) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: `Your ${user.plan} plan allows up to ${limit} discovered prompts. Delete some or upgrade.`,
        },
      },
      403,
    );
  }

  const remaining = limit - existing;

  // Get project context for better prompt generation
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const industry = String(settings.industry ?? "general");
  const siteDescription = String(
    settings.description ?? `Website at ${project.domain}`,
  );

  // Get existing keywords for context
  const keywords = await savedKeywordQueries(db)
    .listByProject(projectId)
    .catch(() => []);
  const existingKeywords = Array.isArray(keywords)
    ? keywords.map((k: { keyword: string }) => k.keyword).slice(0, 20)
    : [];

  // Get competitors
  const competitors = (settings.competitors ?? []) as string[];

  const discovered = await discoverPrompts(c.env.ANTHROPIC_API_KEY, {
    domain: project.domain,
    industry,
    siteDescription,
    existingKeywords,
    competitors,
    count: Math.min(remaining, 20),
  });

  if (discovered.length === 0) {
    return c.json({ data: [] });
  }

  // Store in DB
  const rows = discovered.map((p) => ({
    projectId,
    prompt: p.prompt,
    category: p.category,
    estimatedVolume: p.estimatedVolume,
    difficulty: p.difficulty,
    intent: p.intent,
    source: "discovered" as const,
  }));

  const stored = await aiPromptQueries(db).create(rows);
  return c.json({ data: stored });
});

// ---------------------------------------------------------------------------
// GET /:projectId — List discovered prompts
// ---------------------------------------------------------------------------

promptResearchRoutes.get("/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await createProjectRepository(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const user = await createUserRepository(db).getById(userId);
  const plan = user?.plan ?? "free";
  const limit = PROMPT_LIMITS[plan] ?? 3;

  const prompts = await aiPromptQueries(db).listByProject(projectId, {
    limit,
  });
  return c.json({ data: prompts, meta: { limit, plan } });
});

// ---------------------------------------------------------------------------
// DELETE /:projectId/:promptId — Remove a prompt
// ---------------------------------------------------------------------------

promptResearchRoutes.delete("/:projectId/:promptId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const promptId = c.req.param("promptId");

  const project = await createProjectRepository(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  await aiPromptQueries(db).deleteById(promptId, projectId);
  return c.json({ success: true });
});
