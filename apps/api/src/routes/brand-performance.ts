import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { createProjectRepository, createUserRepository } from "../repositories";
import { visibilityQueries, brandSentimentQueries } from "@llm-boost/db";
import { resolveLocaleForPlan } from "../lib/visibility-locale";

export const brandPerformanceRoutes = new Hono<AppEnv>();

brandPerformanceRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET /:projectId/sentiment — Latest brand sentiment
// ---------------------------------------------------------------------------

brandPerformanceRoutes.get("/:projectId/sentiment", async (c) => {
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

  const checks = await visibilityQueries(db).getSentimentSummary(projectId, {
    ...(localeResolution.locale.region
      ? { region: localeResolution.locale.region }
      : {}),
    ...(localeResolution.locale.language
      ? { language: localeResolution.locale.language }
      : {}),
  });

  if (checks.length === 0) {
    return c.json({
      data: {
        overallSentiment: null,
        sentimentScore: null,
        distribution: { positive: 0, neutral: 0, negative: 0 },
        recentDescriptions: [],
        providerBreakdown: {},
        sampleSize: 0,
      },
    });
  }

  // Calculate sentiment distribution
  const distribution = { positive: 0, neutral: 0, negative: 0 };
  const providerSentiments: Record<
    string,
    { positive: number; neutral: number; negative: number; total: number }
  > = {};

  for (const check of checks) {
    const s = check.sentiment as "positive" | "neutral" | "negative";
    if (s in distribution) distribution[s]++;

    const provider = check.llmProvider;
    if (!providerSentiments[provider]) {
      providerSentiments[provider] = {
        positive: 0,
        neutral: 0,
        negative: 0,
        total: 0,
      };
    }
    providerSentiments[provider].total++;
    if (s in providerSentiments[provider]) {
      providerSentiments[provider][s]++;
    }
  }

  // Calculate overall sentiment score: -1 to +1
  const total = checks.length;
  const sentimentScore =
    (distribution.positive - distribution.negative) / total;

  // Determine overall sentiment
  const overallSentiment =
    sentimentScore > 0.2
      ? "positive"
      : sentimentScore < -0.2
        ? "negative"
        : Math.abs(distribution.positive - distribution.negative) < total * 0.1
          ? "mixed"
          : "neutral";

  // Extract recent brand descriptions
  const recentDescriptions = checks
    .filter((c) => c.brandDescription)
    .slice(0, 5)
    .map((c) => ({
      description: c.brandDescription!,
      provider: c.llmProvider,
      checkedAt: c.checkedAt,
    }));

  return c.json({
    data: {
      overallSentiment,
      sentimentScore: Math.round(sentimentScore * 100) / 100,
      distribution,
      recentDescriptions,
      providerBreakdown: providerSentiments,
      sampleSize: total,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /:projectId/sentiment/history — Weekly sentiment trend
// ---------------------------------------------------------------------------

brandPerformanceRoutes.get("/:projectId/sentiment/history", async (c) => {
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

  const snapshots = await brandSentimentQueries(db).getHistory(projectId, 12);
  return c.json({ data: snapshots });
});

// ---------------------------------------------------------------------------
// GET /:projectId/perception — Provider-level brand perception breakdown
// ---------------------------------------------------------------------------

brandPerformanceRoutes.get("/:projectId/perception", async (c) => {
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
  const checks = await visibilityQueries(db).getSentimentSummary(projectId, {
    ...(localeResolution.locale.region
      ? { region: localeResolution.locale.region }
      : {}),
    ...(localeResolution.locale.language
      ? { language: localeResolution.locale.language }
      : {}),
  });

  if (checks.length === 0) {
    return c.json({ data: [] });
  }

  const byProvider = new Map<
    string,
    {
      provider: string;
      sampleSize: number;
      distribution: { positive: number; neutral: number; negative: number };
      descriptions: string[];
    }
  >();

  for (const check of checks) {
    const provider = check.llmProvider;
    const sentiment = check.sentiment as "positive" | "neutral" | "negative";
    const current = byProvider.get(provider) ?? {
      provider,
      sampleSize: 0,
      distribution: { positive: 0, neutral: 0, negative: 0 },
      descriptions: [],
    };

    current.sampleSize += 1;
    if (sentiment in current.distribution) {
      current.distribution[sentiment] += 1;
    }
    if (
      check.brandDescription &&
      current.descriptions.length < 3 &&
      !current.descriptions.includes(check.brandDescription)
    ) {
      current.descriptions.push(check.brandDescription);
    }

    byProvider.set(provider, current);
  }

  const data = Array.from(byProvider.values()).map((item) => {
    const sentimentScore =
      item.sampleSize > 0
        ? (item.distribution.positive - item.distribution.negative) /
          item.sampleSize
        : 0;
    const overallSentiment =
      sentimentScore > 0.2
        ? "positive"
        : sentimentScore < -0.2
          ? "negative"
          : "neutral";

    return {
      provider: item.provider,
      sampleSize: item.sampleSize,
      overallSentiment,
      sentimentScore: Math.round(sentimentScore * 100) / 100,
      distribution: item.distribution,
      descriptions: item.descriptions,
    };
  });

  return c.json({ data });
});
