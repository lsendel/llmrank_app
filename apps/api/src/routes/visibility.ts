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
import { suggestKeywords } from "@llm-boost/llm";
import {
  enrichmentQueries,
  crawlQueries,
  scoreQueries,
  scheduledVisibilityQueryQueries,
} from "@llm-boost/db";
import { PLATFORM_REQUIREMENTS, validateKeyword } from "@llm-boost/shared";
import { resolveLocaleForPlan } from "../lib/visibility-locale";
import { visibilityKeywordRoutes } from "./visibility/keywords";
import { visibilityRecommendationRoutes } from "./visibility/recommendations";
import { visibilityScoreRoutes } from "./visibility/score";

export const visibilityRoutes = new Hono<AppEnv>();

visibilityRoutes.use("*", authMiddleware);
visibilityRoutes.route("/", visibilityKeywordRoutes);
visibilityRoutes.route("/", visibilityRecommendationRoutes);
visibilityRoutes.route("/", visibilityScoreRoutes);

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
      keywordIds: string[];
      providers: string[];
      region?: string;
      language?: string;
    }>();

    if (
      !body.projectId ||
      !body.keywordIds?.length ||
      !body.providers?.length
    ) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "projectId, keywordIds, and providers are required",
          },
        },
        422,
      );
    }

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

    // Resolve keyword IDs to text from DB
    const { savedKeywordQueries: savedKwQueries } =
      await import("@llm-boost/db");
    const allKeywords = await savedKwQueries(db).listByProject(body.projectId);
    const keywordMap = new Map(allKeywords.map((k) => [k.id, k]));

    const resolvedKeywords = body.keywordIds
      .map((id) => keywordMap.get(id))
      .filter((k): k is NonNullable<typeof k> => k != null);

    if (resolvedKeywords.length === 0) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "No valid keywords found for the provided IDs",
          },
        },
        422,
      );
    }

    try {
      const service = createVisibilityService({
        projects: createProjectRepository(db),
        users: createUserRepository(db),
        visibility: createVisibilityRepository(db),
        competitors: createCompetitorRepository(db),
      });

      const allResults = [];
      for (const keyword of resolvedKeywords) {
        const stored = await service.runCheck({
          userId,
          projectId: body.projectId,
          query: keyword.keyword,
          keywordId: keyword.id,
          providers: body.providers,
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
        allResults.push(...stored);
      }

      return c.json({ data: allResults }, 201);
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
  const user = await createUserRepository(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const localeResolution = resolveLocaleForPlan({
    plan: user.plan,
    region: c.req.query("region") || undefined,
    language: c.req.query("language") || undefined,
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

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const data = await service.listForProject(
      userId,
      projectId,
      localeResolution.locale,
    );
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:projectId/cited-pages — Pages cited by AI platforms
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/cited-pages", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const user = await createUserRepository(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const localeResolution = resolveLocaleForPlan({
    plan: user.plan,
    region: c.req.query("region") || undefined,
    language: c.req.query("language") || undefined,
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

  const project = await createProjectRepository(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const { visibilityQueries } = await import("@llm-boost/db");
  const rows = await visibilityQueries(db).getCitedPages(
    projectId,
    localeResolution.locale,
  );
  return c.json({ data: rows });
});

// ---------------------------------------------------------------------------
// GET /:projectId/brand-performance — Weekly SoV and competitor comparison
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/brand-performance", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const user = await createUserRepository(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const localeResolution = resolveLocaleForPlan({
    plan: user.plan,
    region: c.req.query("region") || undefined,
    language: c.req.query("language") || undefined,
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

  const project = await createProjectRepository(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const checks = await createVisibilityRepository(db).listByProject(
    projectId,
    localeResolution.locale,
  );

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  const currentChecks = checks.filter(
    (ch) => new Date(ch.checkedAt) >= oneWeekAgo,
  );
  const previousChecks = checks.filter(
    (ch) =>
      new Date(ch.checkedAt) >= twoWeeksAgo &&
      new Date(ch.checkedAt) < oneWeekAgo,
  );

  type CompMention = {
    domain: string;
    mentioned: boolean;
    position: number | null;
  };

  function computeSov(subset: typeof checks) {
    const userMentions = subset.filter((ch) => ch.brandMentioned).length;
    const userCitations = subset.filter((ch) => ch.urlCited).length;
    const competitorCounts: Record<
      string,
      { mentions: number; citations: number; total: number }
    > = {};
    let totalCompMentions = 0;

    for (const ch of subset) {
      const mentions = (ch.competitorMentions ?? []) as CompMention[];
      for (const m of mentions) {
        if (!competitorCounts[m.domain]) {
          competitorCounts[m.domain] = { mentions: 0, citations: 0, total: 0 };
        }
        competitorCounts[m.domain].total++;
        if (m.mentioned) {
          competitorCounts[m.domain].mentions++;
          totalCompMentions++;
        }
      }
    }

    const totalMentions = userMentions + totalCompMentions;
    const sovPercent =
      totalMentions > 0
        ? Math.round((userMentions / totalMentions) * 1000) / 10
        : 0;
    const mentionRate =
      subset.length > 0
        ? Math.round((userMentions / subset.length) * 1000) / 10
        : 0;
    const citationRate =
      subset.length > 0
        ? Math.round((userCitations / subset.length) * 1000) / 10
        : 0;

    return {
      userMentions,
      sovPercent,
      mentionRate,
      citationRate,
      competitorCounts,
      totalMentions,
    };
  }

  const current = computeSov(currentChecks);
  const previous = computeSov(previousChecks);

  // Build competitor list
  const competitors = Object.entries(current.competitorCounts).map(
    ([domain, data]) => {
      const compSov =
        current.totalMentions > 0
          ? Math.round((data.mentions / current.totalMentions) * 1000) / 10
          : 0;
      const prevData = previous.competitorCounts[domain];
      const prevSov =
        prevData && previous.totalMentions > 0
          ? Math.round((prevData.mentions / previous.totalMentions) * 1000) / 10
          : 0;
      return {
        domain,
        mentionRate:
          data.total > 0
            ? Math.round((data.mentions / data.total) * 1000) / 10
            : 0,
        citationRate:
          data.total > 0
            ? Math.round((data.citations / data.total) * 1000) / 10
            : 0,
        sovPercent: compSov,
        trend: Math.round((compSov - prevSov) * 10) / 10,
      };
    },
  );
  competitors.sort((a, b) => b.sovPercent - a.sovPercent);

  // Top prompts: queries where you appear vs. competitors
  const queryMap = new Map<
    string,
    { yourMentioned: boolean; competitorsMentioned: Set<string> }
  >();
  for (const ch of currentChecks) {
    const entry = queryMap.get(ch.query) ?? {
      yourMentioned: false,
      competitorsMentioned: new Set<string>(),
    };
    if (ch.brandMentioned) entry.yourMentioned = true;
    const mentions = (ch.competitorMentions ?? []) as CompMention[];
    for (const m of mentions) {
      if (m.mentioned) entry.competitorsMentioned.add(m.domain);
    }
    queryMap.set(ch.query, entry);
  }
  const topPrompts = Array.from(queryMap.entries())
    .map(([query, data]) => ({
      query,
      yourMentioned: data.yourMentioned,
      competitorsMentioned: Array.from(data.competitorsMentioned),
    }))
    .slice(0, 10);

  // Week-over-week deltas
  const isoWeek = `${now.getFullYear()}-W${String(Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, "0")}`;

  return c.json({
    data: {
      period: isoWeek,
      yourBrand: {
        mentionRate: current.mentionRate,
        citationRate: current.citationRate,
        sovPercent: current.sovPercent,
        trend: Math.round((current.sovPercent - previous.sovPercent) * 10) / 10,
      },
      competitors,
      topPrompts,
      weekOverWeek: {
        mentionsDelta:
          Math.round((current.mentionRate - previous.mentionRate) * 10) / 10,
        sovDelta:
          Math.round((current.sovPercent - previous.sovPercent) * 10) / 10,
        citationsDelta:
          Math.round((current.citationRate - previous.citationRate) * 10) / 10,
      },
    },
  });
});

// ---------------------------------------------------------------------------
// GET /:projectId/source-opportunities — Competitors cited when you aren't
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/source-opportunities", async (c) => {
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

  // Plan gate: Pro+ only
  const user = await createUserRepository(db).getById(userId);
  if (!user || user.plan === "free" || user.plan === "starter") {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: "Source opportunities are available on Pro plans and above.",
        },
      },
      403,
    );
  }

  const localeResolution = resolveLocaleForPlan({
    plan: user.plan,
    region: c.req.query("region") || undefined,
    language: c.req.query("language") || undefined,
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

  const { visibilityQueries } = await import("@llm-boost/db");
  const rows = await visibilityQueries(db).getSourceOpportunities(
    projectId,
    localeResolution.locale,
  );
  return c.json({ data: rows });
});

// ---------------------------------------------------------------------------
// GET /:projectId/gaps — Content gaps where competitors are cited but user isn't
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/gaps", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const user = await createUserRepository(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const localeResolution = resolveLocaleForPlan({
    plan: user.plan,
    region: c.req.query("region") || undefined,
    language: c.req.query("language") || undefined,
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

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const checks = await service.listForProject(
      userId,
      projectId,
      localeResolution.locale,
    );

    // Group by query and find gaps: queries where user is NOT mentioned
    // but at least one competitor IS mentioned
    const queryMap = new Map<
      string,
      {
        query: string;
        providers: string[];
        userMentioned: boolean;
        userCited: boolean;
        competitorsCited: Array<{
          domain: string;
          position: number | null;
        }>;
      }
    >();

    for (const check of checks) {
      const existing = queryMap.get(check.query) ?? {
        query: check.query,
        providers: [],
        userMentioned: false,
        userCited: false,
        competitorsCited: [],
      };

      existing.providers.push(check.llmProvider);
      if (check.brandMentioned) existing.userMentioned = true;
      if (check.urlCited) existing.userCited = true;

      const mentions = (check.competitorMentions ?? []) as Array<{
        domain: string;
        mentioned: boolean;
        position: number | null;
      }>;
      for (const m of mentions) {
        if (
          m.mentioned &&
          !existing.competitorsCited.find((c2) => c2.domain === m.domain)
        ) {
          existing.competitorsCited.push({
            domain: m.domain,
            position: m.position,
          });
        }
      }

      queryMap.set(check.query, existing);
    }

    // Filter to gaps: user not mentioned, competitors are
    const gaps = Array.from(queryMap.values()).filter(
      (q) => !q.userMentioned && q.competitorsCited.length > 0,
    );

    return c.json({ data: gaps });
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
  const user = await createUserRepository(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const localeResolution = resolveLocaleForPlan({
    plan: user.plan,
    region: c.req.query("region") || undefined,
    language: c.req.query("language") || undefined,
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

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const data = await service.getTrends(
      userId,
      projectId,
      localeResolution.locale,
    );
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// AI score routes extracted into ./visibility/score

