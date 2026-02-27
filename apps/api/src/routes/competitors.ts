import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { handleServiceError } from "../services/errors";
import { createAuditService } from "../services/audit-service";
import { createCompetitorBenchmarkService } from "../services/competitor-benchmark-service";
import { computeNextBenchmarkAt } from "../services/competitor-monitor-service";
import {
  competitorBenchmarkQueries,
  competitorQueries,
  competitorEventQueries,
  userQueries,
  projectQueries,
  crawlQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS, resolveEffectivePlan } from "@llm-boost/shared";

export const competitorRoutes = new Hono<AppEnv>();
competitorRoutes.use("*", authMiddleware);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/competitors/benchmark — Trigger benchmark of a competitor domain
competitorRoutes.post("/benchmark", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json<{
    projectId?: string;
    competitorDomain?: string;
  }>();

  if (
    !body.projectId ||
    !UUID_RE.test(body.projectId) ||
    !body.competitorDomain
  ) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId (uuid) and competitorDomain are required",
        },
      },
      422,
    );
  }

  // Normalize domain (strip protocol and trailing slash)
  let domain = body.competitorDomain.trim().toLowerCase();
  try {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    domain = new URL(url).hostname;
  } catch {
    return c.json(
      {
        error: { code: "INVALID_DOMAIN", message: "Invalid competitor domain" },
      },
      422,
    );
  }

  try {
    const user = await userQueries(db).getById(userId);
    const project = await projectQueries(db).getById(body.projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const limits = PLAN_LIMITS[user?.plan ?? "free"];
    if (limits.competitorsPerProject === 0) {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: "Competitor benchmarking requires a paid plan.",
          },
        },
        403,
      );
    }

    const service = createCompetitorBenchmarkService({
      competitorBenchmarks: competitorBenchmarkQueries(db),
      competitors: competitorQueries(db),
    });

    const benchmark = await service.benchmarkCompetitor({
      projectId: body.projectId,
      competitorDomain: domain,
      competitorLimit: limits.competitorsPerProject,
    });

    createAuditService(db)
      .emitEvent({
        action: "competitor.added",
        actorId: userId,
        resourceType: "competitor",
        resourceId: benchmark.id,
        metadata: { projectId: body.projectId, domain },
      })
      .catch(() => {});

    return c.json({ data: benchmark }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/competitors?projectId=xxx — Get competitor comparisons for a project
competitorRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId query parameter required",
        },
      },
      422,
    );
  }

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  // Get the project's latest crawl scores for comparison
  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  let projectScores = {
    overall: 0,
    technical: 0,
    content: 0,
    aiReadiness: 0,
    performance: 0,
    letterGrade: "F",
  };

  if (latestCrawl?.summaryData) {
    // summaryData is a jsonb field containing aggregated scores
    const summary = latestCrawl.summaryData as any;
    projectScores = {
      overall: summary.overallScore ?? 0,
      technical: summary.technicalScore ?? 0,
      content: summary.contentScore ?? 0,
      aiReadiness: summary.aiReadinessScore ?? 0,
      performance: summary.performanceScore ?? 0,
      letterGrade: summary.letterGrade ?? "F",
    };
  }

  const service = createCompetitorBenchmarkService({
    competitorBenchmarks: competitorBenchmarkQueries(db),
    competitors: competitorQueries(db),
  });

  const comparison = await service.getComparison({
    projectId,
    projectScores,
  });

  return c.json({ data: { projectScores, competitors: comparison } });
});

// GET /api/competitors/feed — Activity feed of competitor events
competitorRoutes.get("/feed", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId query parameter required",
        },
      },
      422,
    );
  }

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const user = await userQueries(db).getById(userId);
  const effectivePlan = resolveEffectivePlan({
    plan: user?.plan ?? "free",
    trialEndsAt: user?.trialEndsAt ?? null,
  });
  const limits = PLAN_LIMITS[effectivePlan];

  if (limits.competitorFeedLimit === 0) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: "Competitor activity feed is not available on your plan.",
        },
      },
      403,
    );
  }

  const limit = Math.min(
    Number(c.req.query("limit") ?? 20),
    Number.isFinite(limits.competitorFeedLimit)
      ? limits.competitorFeedLimit
      : 100,
  );
  const offset = Number(c.req.query("offset") ?? 0);
  const type = c.req.query("type");
  const severity = c.req.query("severity");
  const domain = c.req.query("domain");

  const eventQueries = competitorEventQueries(db);
  const [data, total] = await Promise.all([
    eventQueries.listByProject(projectId, {
      limit,
      offset,
      eventType: type,
      severity,
      domain,
    }),
    eventQueries.countByProject(projectId),
  ]);

  return c.json({
    data,
    total,
    hasMore: offset + data.length < total,
  });
});

// GET /api/competitors/trends — Score trends for a competitor domain
competitorRoutes.get("/trends", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");
  const domain = c.req.query("domain");

  if (!projectId || !domain) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId and domain query parameters are required",
        },
      },
      422,
    );
  }

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const user = await userQueries(db).getById(userId);
  const effectivePlan = resolveEffectivePlan({
    plan: user?.plan ?? "free",
    trialEndsAt: user?.trialEndsAt ?? null,
  });
  const limits = PLAN_LIMITS[effectivePlan];

  if (limits.competitorTrendDays === 0) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: "Competitor trend data is not available on your plan.",
        },
      },
      403,
    );
  }

  const since = new Date();
  since.setDate(since.getDate() - limits.competitorTrendDays);

  const benchmarks = await competitorBenchmarkQueries(db).listByDomain(
    projectId,
    domain,
    { since },
  );

  const data = benchmarks.map((b) => ({
    date: b.crawledAt,
    overallScore: b.overallScore,
    technicalScore: b.technicalScore,
    contentScore: b.contentScore,
    aiReadinessScore: b.aiReadinessScore,
    performanceScore: b.performanceScore,
    letterGrade: b.letterGrade,
  }));

  return c.json({ data });
});

// GET /api/competitors/cadence — Content publishing cadence per competitor
competitorRoutes.get("/cadence", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId query parameter required",
        },
      },
      422,
    );
  }

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const competitors = await competitorQueries(db).listByProject(projectId);
  const eventQueries = competitorEventQueries(db);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const data = await Promise.all(
    competitors.map(async (comp) => {
      const [weekEvents, monthEvents] = await Promise.all([
        eventQueries.listByProject(projectId, {
          domain: comp.domain,
          eventType: "new_pages_detected",
          since: oneWeekAgo,
          limit: 1000,
        }),
        eventQueries.listByProject(projectId, {
          domain: comp.domain,
          eventType: "new_pages_detected",
          since: oneMonthAgo,
          limit: 1000,
        }),
      ]);

      return {
        domain: comp.domain,
        competitorId: comp.id,
        newPagesLastWeek: weekEvents.length,
        newPagesLastMonth: monthEvents.length,
      };
    }),
  );

  return c.json({ data });
});

// GET /api/competitors/comparison/:projectId — Structured comparison table
competitorRoutes.get("/comparison/:projectId", async (c) => {
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

  const competitors = await competitorQueries(db).listByProject(projectId);
  const benchmarks =
    await competitorBenchmarkQueries(db).listByProject(projectId);

  const comparison = {
    ownDomain: project.domain,
    competitors: competitors.map((comp) => {
      const benchmark = benchmarks.find(
        (b) => b.competitorDomain === comp.domain,
      );
      return {
        id: comp.id,
        domain: comp.domain,
        source: comp.source ?? "user_added",
        overallScore: benchmark?.overallScore ?? null,
        letterGrade: benchmark?.letterGrade ?? null,
        technicalScore: benchmark?.technicalScore ?? null,
        contentScore: benchmark?.contentScore ?? null,
        aiReadinessScore: benchmark?.aiReadinessScore ?? null,
        performanceScore: benchmark?.performanceScore ?? null,
        issueCount: benchmark?.issueCount ?? null,
        crawledAt: benchmark?.crawledAt ?? null,
      };
    }),
  };

  return c.json({ data: comparison });
});

// PATCH /api/competitors/:id/monitoring — Update monitoring settings
competitorRoutes.patch("/:id/monitoring", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const competitorId = c.req.param("id");

  if (!UUID_RE.test(competitorId)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid competitor ID",
        },
      },
      422,
    );
  }

  const body = await c.req.json<{
    frequency?: string;
  }>();

  const validFrequencies = ["daily", "weekly", "monthly", "off"];
  if (!body.frequency || !validFrequencies.includes(body.frequency)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "frequency is required and must be one of: daily, weekly, monthly, off",
        },
      },
      422,
    );
  }

  try {
    const competitor = await competitorQueries(db).getById(competitorId);
    if (!competitor) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Competitor not found" } },
        404,
      );
    }

    // Verify project ownership
    const project = await projectQueries(db).getById(competitor.projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Competitor not found" } },
        404,
      );
    }

    // Check plan allows the requested frequency
    const user = await userQueries(db).getById(userId);
    const effectivePlan = resolveEffectivePlan({
      plan: user?.plan ?? "free",
      trialEndsAt: user?.trialEndsAt ?? null,
    });
    const limits = PLAN_LIMITS[effectivePlan];

    if (
      body.frequency === "daily" &&
      !limits.competitorMonitoringFrequency.includes("daily")
    ) {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: "Daily monitoring frequency requires an Agency plan.",
          },
        },
        403,
      );
    }

    const isOff = body.frequency === "off";
    const nextBenchmarkAt = isOff
      ? null
      : computeNextBenchmarkAt(body.frequency);

    const updated = await competitorQueries(db).updateMonitoring(competitorId, {
      monitoringEnabled: !isOff,
      monitoringFrequency: body.frequency,
      nextBenchmarkAt,
    });

    return c.json({ data: updated });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
