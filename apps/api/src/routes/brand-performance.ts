import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { createProjectRepository } from "../repositories";
import { visibilityQueries, brandSentimentQueries } from "@llm-boost/db";

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

  const checks = await visibilityQueries(db).getSentimentSummary(projectId);

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
