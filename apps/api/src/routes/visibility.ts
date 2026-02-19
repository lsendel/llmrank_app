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
import { computeAIVisibilityScore } from "@llm-boost/scoring";
import {
  enrichmentQueries,
  crawlQueries,
  scoreQueries,
  scheduledVisibilityQueryQueries,
  discoveredLinkQueries,
} from "@llm-boost/db";
import { PLATFORM_REQUIREMENTS, validateKeyword } from "@llm-boost/shared";

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
      keywordIds: string[];
      providers: string[];
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
// GET /:projectId/gaps — Content gaps where competitors are cited but user isn't
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/gaps", async (c) => {
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
    const checks = await service.listForProject(userId, projectId);

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

// ---------------------------------------------------------------------------
// GET /:projectId/ai-score — Compute AI Visibility Score
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/ai-score", async (c) => {
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
    const checks = await service.listForProject(userId, projectId);
    const project = await createProjectRepository(db).getById(projectId);
    if (!project) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    // LLM Mention Rate: % of checks where brand is mentioned (excluding gemini_ai_mode)
    const llmChecks = checks.filter(
      (ch) => ch.llmProvider !== "gemini_ai_mode",
    );
    const llmMentionRate =
      llmChecks.length > 0
        ? llmChecks.filter((ch) => ch.brandMentioned).length / llmChecks.length
        : 0;

    // AI Search Presence: % of gemini_ai_mode checks where brand is mentioned
    const aiChecks = checks.filter((ch) => ch.llmProvider === "gemini_ai_mode");
    const aiSearchPresenceRate =
      aiChecks.length > 0
        ? aiChecks.filter((ch) => ch.brandMentioned).length / aiChecks.length
        : 0;

    // Share of Voice: ratio of user mentions to total (user + competitor) mentions
    let totalCompetitorMentions = 0;
    const totalUserMentions = llmChecks.filter(
      (ch) => ch.brandMentioned,
    ).length;
    for (const check of llmChecks) {
      const mentions = (check.competitorMentions ?? []) as Array<{
        mentioned: boolean;
      }>;
      totalCompetitorMentions += mentions.filter((m) => m.mentioned).length;
    }
    const totalMentions = totalUserMentions + totalCompetitorMentions;
    const shareOfVoice =
      totalMentions > 0 ? totalUserMentions / totalMentions : 0;

    // Backlink Authority: normalized from referring domains (cap at 50 for max score)
    const blQueries = discoveredLinkQueries(db);
    const blSummary = await blQueries.getSummary(project.domain);
    const backlinkAuthoritySignal = Math.min(
      1,
      blSummary.referringDomains / 50,
    );

    const score = computeAIVisibilityScore({
      llmMentionRate,
      aiSearchPresenceRate,
      shareOfVoice,
      backlinkAuthoritySignal,
    });

    return c.json({
      data: {
        ...score,
        meta: {
          totalChecks: checks.length,
          llmChecks: llmChecks.length,
          aiModeChecks: aiChecks.length,
          referringDomains: blSummary.referringDomains,
        },
      },
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:projectId/ai-score/trend — AI Visibility Score with period comparison
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/ai-score/trend", async (c) => {
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
    const checks = await service.listForProject(userId, projectId);
    const project = await createProjectRepository(db).getById(projectId);
    if (!project) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const currentChecks = checks.filter(
      (ch) => new Date(ch.checkedAt) >= oneWeekAgo,
    );
    const previousChecks = checks.filter(
      (ch) =>
        new Date(ch.checkedAt) >= twoWeeksAgo &&
        new Date(ch.checkedAt) < oneWeekAgo,
    );

    function computeInputs(
      subset: typeof checks,
    ): import("@llm-boost/scoring").AIVisibilityInput {
      const llm = subset.filter((ch) => ch.llmProvider !== "gemini_ai_mode");
      const ai = subset.filter((ch) => ch.llmProvider === "gemini_ai_mode");
      const llmMentionRate =
        llm.length > 0
          ? llm.filter((ch) => ch.brandMentioned).length / llm.length
          : 0;
      const aiSearchPresenceRate =
        ai.length > 0
          ? ai.filter((ch) => ch.brandMentioned).length / ai.length
          : 0;
      const userMentions = llm.filter((ch) => ch.brandMentioned).length;
      let compMentions = 0;
      for (const ch of llm) {
        const mentions = (ch.competitorMentions ?? []) as Array<{
          mentioned: boolean;
        }>;
        compMentions += mentions.filter((m) => m.mentioned).length;
      }
      const total = userMentions + compMentions;
      const shareOfVoice = total > 0 ? userMentions / total : 0;

      return {
        llmMentionRate,
        aiSearchPresenceRate,
        shareOfVoice,
        backlinkAuthoritySignal: 0,
      };
    }

    const blSummary = await discoveredLinkQueries(db).getSummary(
      project.domain,
    );
    const backlinkAuth = Math.min(1, blSummary.referringDomains / 50);

    const currentInput = {
      ...computeInputs(currentChecks),
      backlinkAuthoritySignal: backlinkAuth,
    };
    const previousInput = {
      ...computeInputs(previousChecks),
      backlinkAuthoritySignal: backlinkAuth,
    };

    const current = computeAIVisibilityScore(currentInput);
    const previous =
      previousChecks.length > 0
        ? computeAIVisibilityScore(previousInput)
        : null;

    const delta = previous ? current.overall - previous.overall : 0;

    return c.json({
      data: {
        current,
        previous,
        delta,
        direction: delta > 0 ? "up" : delta < 0 ? "down" : "stable",
        period: "weekly",
        meta: {
          currentChecks: currentChecks.length,
          previousChecks: previousChecks.length,
          referringDomains: blSummary.referringDomains,
        },
      },
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:projectId/recommendations — Prioritized action items
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/recommendations", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  try {
    const project = await createProjectRepository(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const checks =
      await createVisibilityRepository(db).listByProject(projectId);

    // 1. Compute gaps
    const queryMap = new Map<
      string,
      { userMentioned: boolean; competitorsCited: Array<{ domain: string }> }
    >();
    for (const check of checks) {
      const entry = queryMap.get(check.query) ?? {
        userMentioned: false,
        competitorsCited: [],
      };
      if (check.brandMentioned) entry.userMentioned = true;
      const mentions = (check.competitorMentions ?? []) as Array<{
        domain: string;
        mentioned: boolean;
      }>;
      for (const m of mentions) {
        if (
          m.mentioned &&
          !entry.competitorsCited.some((c2) => c2.domain === m.domain)
        ) {
          entry.competitorsCited.push({ domain: m.domain });
        }
      }
      queryMap.set(check.query, entry);
    }
    const gaps = [...queryMap.entries()]
      .filter(([, v]) => !v.userMentioned && v.competitorsCited.length > 0)
      .map(([query, v]) => ({ query, competitorsCited: v.competitorsCited }));

    // 2. Platform failures (from latest crawl)
    const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
    const platformFailures: Array<{
      platform: string;
      label: string;
      issueCode: string;
      importance: "critical" | "important" | "recommended";
    }> = [];
    const issuePageUrls: Record<string, string[]> = {};
    if (latestCrawl) {
      const issues = await scoreQueries(db).getIssuesByJob(latestCrawl.id);
      const issueCodes = new Set(issues.map((i) => i.code));
      // Group page URLs by issue code
      for (const issue of issues) {
        const url = (issue as { pageUrl?: string | null }).pageUrl;
        if (url) {
          if (!issuePageUrls[issue.code]) issuePageUrls[issue.code] = [];
          if (!issuePageUrls[issue.code].includes(url)) {
            issuePageUrls[issue.code].push(url);
          }
        }
      }
      for (const [platform, platformChecks] of Object.entries(
        PLATFORM_REQUIREMENTS,
      )) {
        for (const check of platformChecks) {
          if (issueCodes.has(check.issueCode)) {
            platformFailures.push({ platform, ...check });
          }
        }
      }
    }

    // 3. Trends (current vs previous week per provider)
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const providerTrends: Array<{
      provider: string;
      currentRate: number;
      previousRate: number;
    }> = [];
    const providers = new Set(checks.map((ch) => ch.llmProvider));
    for (const provider of providers) {
      const current = checks.filter(
        (ch) =>
          ch.llmProvider === provider && new Date(ch.checkedAt) >= oneWeekAgo,
      );
      const previous = checks.filter(
        (ch) =>
          ch.llmProvider === provider &&
          new Date(ch.checkedAt) >= twoWeeksAgo &&
          new Date(ch.checkedAt) < oneWeekAgo,
      );
      if (current.length > 0 && previous.length > 0) {
        providerTrends.push({
          provider,
          currentRate:
            current.filter((ch) => ch.brandMentioned).length / current.length,
          previousRate:
            previous.filter((ch) => ch.brandMentioned).length / previous.length,
        });
      }
    }

    const { generateRecommendations } =
      await import("../services/recommendations-service");
    const recommendations = generateRecommendations({
      gaps,
      platformFailures,
      issueCodesPresent: new Set(),
      issuePageUrls,
      trends: providerTrends,
      providersUsed: providers,
      projectId,
    });

    return c.json({ data: recommendations });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// POST /:projectId/discover-keywords — Suggest keywords to track
// ---------------------------------------------------------------------------

visibilityRoutes.post(
  "/:projectId/discover-keywords",
  rateLimit({ limit: 3, windowSeconds: 60, keyPrefix: "rl:vis-discover" }),
  async (c) => {
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

    const { createKeywordDiscoveryService } =
      await import("../services/keyword-discovery-service");

    const service = createKeywordDiscoveryService({
      projects: createProjectRepository(db),
      enrichments: {
        async listByJobAndProvider(jobId: string, provider: string) {
          return enrichmentQueries(db).listByJobAndProvider(
            jobId,
            provider as any,
          );
        },
      },
      schedules: {
        async listByProject(pid: string) {
          return scheduledVisibilityQueryQueries(db).listByProject(pid);
        },
      },
      crawls: {
        async getLatestByProject(pid: string) {
          return crawlQueries(db).getLatestByProject(pid);
        },
      },
      llm: {
        async generateKeywords(domain: string, context: string) {
          return suggestKeywords(c.env.ANTHROPIC_API_KEY, domain, context);
        },
      },
    });

    try {
      const result = await service.discover(userId, projectId);

      // Persist discovered keywords
      const { savedKeywordQueries: savedKwQueries } =
        await import("@llm-boost/db");
      const { PLAN_LIMITS } = await import("@llm-boost/shared");
      const kwRepo = savedKwQueries(db);
      const existingCount = await kwRepo.countByProject(projectId);
      const user = await createUserRepository(db).getById(userId);
      const limits = PLAN_LIMITS[user?.plan ?? "free"];
      const remainingSlots = Math.max(
        0,
        limits.savedKeywordsPerProject - existingCount,
      );

      if (remainingSlots > 0 && result.llmKeywords?.length > 0) {
        const toSave = result.llmKeywords
          .slice(0, remainingSlots)
          .map((kw: string) => ({
            projectId,
            keyword: kw,
            source: "auto_discovered" as const,
          }));
        await kwRepo.createMany(toSave);
      }

      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:projectId/suggest-keywords — AI-powered keyword suggestions
// ---------------------------------------------------------------------------

visibilityRoutes.post(
  "/:projectId/suggest-keywords",
  rateLimit({ limit: 10, windowSeconds: 60, keyPrefix: "rl:vis-suggest" }),
  async (c) => {
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

    // Get existing keywords to avoid duplicates
    const { savedKeywordQueries: savedKwQueries } =
      await import("@llm-boost/db");
    const existing = await savedKwQueries(db).listByProject(projectId);
    const existingSet = new Set(existing.map((k) => k.keyword.toLowerCase()));

    const context =
      existing.length > 0
        ? `Existing keywords (avoid duplicates): ${existing.map((k) => k.keyword).join(", ")}`
        : "";

    const suggestions = await suggestKeywords(
      c.env.ANTHROPIC_API_KEY,
      project.domain,
      context,
    );

    // Filter out duplicates and invalid keywords
    const fresh = suggestions
      .filter((kw: string) => !existingSet.has(kw.toLowerCase()))
      .filter((kw: string) => validateKeyword(kw).valid)
      .slice(0, 10);

    return c.json({ data: fresh });
  },
);
