import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  createCompetitorRepository,
  createProjectRepository,
  createUserRepository,
  createVisibilityRepository,
} from "../repositories";
import { aiPromptQueries, savedKeywordQueries } from "@llm-boost/db";
import { discoverPrompts } from "@llm-boost/llm";
import { createVisibilityService } from "../services/visibility-service";
import { ServiceError } from "../services/errors";
import { resolveLocaleForPlan } from "../lib/visibility-locale";

export const promptResearchRoutes = new Hono<AppEnv>();

promptResearchRoutes.use("*", authMiddleware);

const PROMPT_LIMITS: Record<string, number> = {
  free: 3,
  starter: 20,
  pro: 100,
  agency: 999999,
};

const DEFAULT_PROMPT_CHECK_PROVIDERS = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
] as const;

const ALLOWED_PROMPT_CHECK_PROVIDERS = new Set([
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
  "copilot",
  "gemini_ai_mode",
  "grok",
]);

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
// POST /:projectId/check — Run visibility checks for a specific prompt
// ---------------------------------------------------------------------------

promptResearchRoutes.post("/:projectId/check", async (c) => {
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

  const body = await c.req.json<{
    promptId?: string;
    prompt?: string;
    providers?: string[];
    region?: string;
    language?: string;
  }>();

  const user = await createUserRepository(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const localeResolution = resolveLocaleForPlan({
    plan: user.plan,
    region: body.region,
    language: body.language,
  });
  if ("error" in localeResolution) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: localeResolution.error,
        },
      },
      422,
    );
  }

  let promptId = body.promptId;
  let promptText = body.prompt?.trim();

  if (promptId && !promptText) {
    const storedPrompt = await aiPromptQueries(db).getById(projectId, promptId);
    if (!storedPrompt) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Prompt not found" } },
        404,
      );
    }
    promptText = storedPrompt.prompt;
  }

  if (!promptText) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Provide either promptId or prompt text.",
        },
      },
      422,
    );
  }

  const providersInput =
    body.providers?.filter((provider) =>
      ALLOWED_PROMPT_CHECK_PROVIDERS.has(provider),
    ) ?? [];
  const providers =
    providersInput.length > 0
      ? providersInput
      : [...DEFAULT_PROMPT_CHECK_PROVIDERS];

  const visibility = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const rows = await visibility.runCheck({
      userId,
      projectId,
      query: promptText,
      providers,
      apiKeys: {
        chatgpt: c.env.OPENAI_API_KEY,
        claude: c.env.ANTHROPIC_API_KEY,
        perplexity: c.env.PERPLEXITY_API_KEY,
        gemini: c.env.GOOGLE_API_KEY,
        copilot: c.env.BING_API_KEY,
        gemini_ai_mode: c.env.GOOGLE_API_KEY,
        grok: c.env.XAI_API_KEY,
      },
      anthropicApiKey: c.env.ANTHROPIC_API_KEY,
      region: localeResolution.locale.region,
      language: localeResolution.locale.language,
    });

    const yourMentioned = rows.some((row) => row.brandMentioned);
    const competitorsMentioned = Array.from(
      new Set(
        rows.flatMap((row) =>
          (
            (row.competitorMentions as Array<{
              domain: string;
              mentioned: boolean;
            }> | null) ?? []
          )
            .filter((mention) => mention.mentioned)
            .map((mention) => mention.domain),
        ),
      ),
    );

    if (promptId) {
      const updated = await aiPromptQueries(db).updateTracking(
        promptId,
        projectId,
        {
          yourMentioned,
          competitorsMentioned,
        },
      );
      if (!updated) {
        // Prompt could have been deleted concurrently; continue returning check data.
        promptId = undefined;
      }
    }

    return c.json({
      data: {
        prompt: promptText,
        ...(promptId ? { promptId } : {}),
        checkCount: rows.length,
        yourMentioned,
        competitorsMentioned,
        checks: rows,
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        error.status as 400 | 401 | 403 | 404 | 409 | 422 | 429,
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to run prompt check";
    return c.json(
      {
        error: {
          code: "CHECK_FAILED",
          message,
        },
      },
      500,
    );
  }
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
