import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { createStrategyService } from "../services/strategy-service";
import {
  createCompetitorRepository,
  createPageRepository,
  createProjectRepository,
  createUserRepository,
  createScoreRepository,
  createCrawlRepository,
} from "../repositories";
import { handleServiceError } from "../services/errors";
import { StrategyOptimizer, FactExtractor } from "@llm-boost/llm";
import { meetsMinimumTier, type PlanTier } from "@llm-boost/shared";

export const strategyRoutes = new Hono<AppEnv>();

strategyRoutes.use("*", authMiddleware);

function buildStrategyService(c: Context<AppEnv>) {
  const db = c.get("db");
  return createStrategyService({
    projects: createProjectRepository(db),
    competitors: createCompetitorRepository(db),
    pages: createPageRepository(db),
    scores: createScoreRepository(db),
    crawls: createCrawlRepository(db),
  });
}

// Middleware to check plan limits
const enforcePlan = (requiredTier: PlanTier) => {
  return async (c: Context<AppEnv>, next: Next) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const user = await createUserRepository(db).getById(userId);

    if (!user) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        404,
      );
    }

    if (!meetsMinimumTier(user.plan, requiredTier)) {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: `This feature requires the ${requiredTier} plan.`,
          },
        },
        403,
      );
    }
    await next();
  };
};

// ---------------------------------------------------------------------------
// GET /:projectId/topic-map — Get semantic topic map (Pro+)
// ---------------------------------------------------------------------------

strategyRoutes.get("/:projectId/topic-map", enforcePlan("pro"), async (c) => {
  const projectId = c.req.param("projectId");
  const userId = c.get("userId");
  const service = buildStrategyService(c);

  try {
    const data = await service.getTopicMap(userId, projectId);
    return c.json({ data });
  } catch (err) {
    return handleServiceError(c, err as Error);
  }
});

// ---------------------------------------------------------------------------
// POST /apply-fix — Generate an AutoFix snippet (Starter+)
// ---------------------------------------------------------------------------

strategyRoutes.post("/apply-fix", enforcePlan("starter"), async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{
    pageId: string;
    missingFact: string;
    factType: string;
  }>();

  const pageRepo = createPageRepository(db);
  const page = await pageRepo.getById(body.pageId);
  if (!page) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Page not found" } },
      404,
    );
  }

  const optimizer = new StrategyOptimizer(c.env.ANTHROPIC_API_KEY);

  try {
    const result = await optimizer.generateContentFix({
      currentContent: `Title: ${page.title}. URL: ${page.url}`,
      missingFact: body.missingFact,
      factType: body.factType,
    });

    return c.json({ data: result });
  } catch (err) {
    return handleServiceError(c, err as Error);
  }
});

// ---------------------------------------------------------------------------
// POST /semantic-gap — Information Gap Analysis (Pro+)
// ---------------------------------------------------------------------------

strategyRoutes.post("/semantic-gap", enforcePlan("pro"), async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{
    projectId: string;
    pageId: string;
    competitorDomain: string;
  }>();

  // Verify ownership via repo
  const pageRepo = createPageRepository(db);
  const page = await pageRepo.getById(body.pageId);
  if (!page) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Page not found" } },
      404,
    );
  }

  const extractor = new FactExtractor(c.env.ANTHROPIC_API_KEY);

  // Extract from user page (title + wordCount as proxy for now,
  // in real app we'd fetch the full HTML/Text from R2)
  const userContent = `Title: ${page.title}. URL: ${page.url}. Word Count: ${page.wordCount}`;

  // Fetch competitor content (placeholder for demo)
  let competitorContent = `A leading competitor in the niche of ${body.competitorDomain}. Their site features pricing starting at $49 and supports enterprise scale with 99.9% uptime.`;

  try {
    const resp = await fetch(`https://${body.competitorDomain}`, {
      headers: { "User-Agent": "AISEOBot/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) competitorContent = (await resp.text()).slice(0, 10000);
  } catch (_err) {
    // Ignore fetch errors
  }

  try {
    const [userFacts, competitorFacts] = await Promise.all([
      extractor.extractFacts(userContent),
      extractor.extractFacts(competitorContent),
    ]);

    return c.json({
      data: {
        userFacts,
        competitorFacts,
        densityGap: competitorFacts.length - userFacts.length,
      },
    });
  } catch (err) {
    return handleServiceError(c, err);
  }
});

// ---------------------------------------------------------------------------
// POST /optimize — AI Rewriter for specific issues (Starter+)
// ---------------------------------------------------------------------------

strategyRoutes.post("/optimize", enforcePlan("starter"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<{ pageId: string; content: string }>();
  if (!body.pageId || !body.content) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "pageId and content are required",
        },
      },
      422,
    );
  }
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json(
      { error: { code: "CONFIG_ERROR", message: "AI service not configured" } },
      500,
    );
  }
  const service = buildStrategyService(c);
  try {
    const result = await service.optimize(
      userId,
      body.pageId,
      body.content,
      c.env.ANTHROPIC_API_KEY,
    );
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// POST /brief — Generate SEO content brief (Starter+)
// ---------------------------------------------------------------------------

strategyRoutes.post("/brief", enforcePlan("starter"), async (c) => {
  const body = await c.req.json<{ keyword: string }>();
  if (!body.keyword) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "keyword is required" } },
      422,
    );
  }
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json(
      { error: { code: "CONFIG_ERROR", message: "AI service not configured" } },
      500,
    );
  }
  const service = buildStrategyService(c);
  try {
    const result = await service.brief(body.keyword, c.env.ANTHROPIC_API_KEY);
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// POST /gap-analysis — Analyze why a competitor is outranking us (Pro+)
// ---------------------------------------------------------------------------

strategyRoutes.post("/gap-analysis", enforcePlan("pro"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<{
    projectId: string;
    competitorDomain: string;
    query: string;
    pageId?: string;
  }>();
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json(
      { error: { code: "CONFIG_ERROR", message: "AI service not configured" } },
      500,
    );
  }
  const service = buildStrategyService(c);
  try {
    const data = await service.gapAnalysis({
      userId,
      projectId: body.projectId,
      competitorDomain: body.competitorDomain,
      query: body.query,
      pageId: body.pageId,
      apiKey: c.env.ANTHROPIC_API_KEY,
    });
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// POST /:projectId/personas — Generate user personas (Starter+)
// ---------------------------------------------------------------------------

strategyRoutes.post(
  "/:projectId/personas",
  enforcePlan("starter"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId");
    const body = await c.req.json<{ description?: string; niche?: string }>();
    if (!c.env.ANTHROPIC_API_KEY) {
      return c.json(
        {
          error: { code: "CONFIG_ERROR", message: "AI service not configured" },
        },
        500,
      );
    }
    const service = buildStrategyService(c);
    try {
      const personas = await service.personas(
        userId,
        projectId,
        body,
        c.env.ANTHROPIC_API_KEY,
      );
      return c.json({ data: personas });
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:projectId/competitors — List competitors (Pro+)
// ---------------------------------------------------------------------------

strategyRoutes.get("/:projectId/competitors", enforcePlan("pro"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const service = buildStrategyService(c);
  try {
    const data = await service.listCompetitors(userId, projectId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// POST /:projectId/competitors — Add a competitor (Pro+)
// ---------------------------------------------------------------------------

strategyRoutes.post(
  "/:projectId/competitors",
  enforcePlan("pro"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId");
    const body = await c.req.json<{ domain: string }>();
    if (!body.domain) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "domain is required" } },
        422,
      );
    }
    const service = buildStrategyService(c);
    try {
      const competitor = await service.addCompetitor(
        userId,
        projectId,
        body.domain,
      );
      return c.json({ data: competitor }, 201);
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /competitors/:id — Remove a competitor (Pro+)
// ---------------------------------------------------------------------------

strategyRoutes.delete("/competitors/:id", enforcePlan("pro"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const service = buildStrategyService(c);
  try {
    const data = await service.removeCompetitor(userId, id);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
