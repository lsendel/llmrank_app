import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  CollectEventSchema,
  FIRST_PARTY_PROJECT_ID,
  classifyTraffic,
} from "@llm-boost/shared";
import { analyticsQueries, projectQueries, userQueries } from "@llm-boost/db";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";

export const analyticsRoutes = new Hono<AppEnv>();

// ─── Snippet JS serving ──────────────────────────────────────────────────────

analyticsRoutes.get("/s/analytics.js", (c) => {
  const js = `(function(){var s=document.currentScript;if(!s)return;var p=s.getAttribute("data-project");if(!p)return;var d=JSON.stringify({pid:p,url:location.href,ref:document.referrer,ua:navigator.userAgent});var u=s.src.replace("/s/analytics.js","/analytics/collect");try{var b=new Blob([d],{type:"application/json"});navigator.sendBeacon(u,b)}catch(e){fetch(u,{method:"POST",body:d,headers:{"Content-Type":"application/json"},keepalive:true}).catch(function(){})}})();`;
  return c.text(js, 200, {
    "Content-Type": "application/javascript",
    "Cache-Control": "public, max-age=3600",
  });
});

// ─── Public beacon endpoint ──────────────────────────────────────────────────

analyticsRoutes.options("/analytics/collect", cors({ origin: "*" }), (c) =>
  c.body(null, 204),
);

analyticsRoutes.post("/analytics/collect", cors({ origin: "*" }), async (c) => {
  // Always return 204 — don't leak info to callers
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.body(null, 204);
  }

  const parsed = CollectEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.body(null, 204);
  }

  const data = parsed.data;
  const db = c.get("db");

  // Check project exists and has analytics snippet enabled
  const project = await projectQueries(db).getById(data.pid);
  if (!project || !project.analyticsSnippetEnabled) {
    return c.body(null, 204);
  }

  // Parse URL for domain + path
  let domain: string;
  let path = "/";
  try {
    const parsed = new URL(data.url);
    domain = parsed.hostname;
    path = parsed.pathname;
  } catch {
    domain = project.domain ?? "";
  }

  // Classify traffic source
  const { sourceType, aiProvider } = classifyTraffic(
    data.ua || null,
    data.ref || null,
  );

  // Non-blocking insert
  c.executionCtx.waitUntil(
    analyticsQueries(db).insertEvent({
      projectId: data.pid,
      event: "pageview",
      domain,
      path,
      referrer: data.ref || null,
      userAgent: data.ua || null,
      sourceType,
      aiProvider: aiProvider ?? null,
      country: null,
      botScore: null,
      metadata: {},
    }),
  );

  return c.body(null, 204);
});

// ─── GET /analytics/:projectId/summary — Dashboard summary (auth required) ───

analyticsRoutes.get(
  "/analytics/:projectId/summary",
  authMiddleware,
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId");

    // Project ownership check
    const project = await projectQueries(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    // Plan-based retention
    const user = await userQueries(db).getById(userId);
    const plan = user?.plan ?? "free";
    // Use 7 days for free, 30 days for starter, 90 days for pro+
    const retentionDays = plan === "free" ? 7 : plan === "starter" ? 30 : 90;

    const queries = analyticsQueries(db);
    const summary = await queries.getSummary(projectId, retentionDays);

    // Aggregate totals
    let totalPageviews = 0;
    let aiReferral = 0;
    let aiBot = 0;
    const byProvider: Record<string, number> = {};

    for (const row of summary) {
      totalPageviews += row.total;
      if (row.sourceType === "ai_referral") {
        aiReferral += row.total;
        if (row.aiProvider && row.aiProvider !== "none") {
          byProvider[row.aiProvider] =
            (byProvider[row.aiProvider] ?? 0) + row.total;
        }
      } else if (row.sourceType === "ai_bot") {
        aiBot += row.total;
      }
    }

    // ── Trend calculation: compare current period vs previous period ──
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - retentionDays);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - retentionDays);

    const toDateStr = (d: Date) => d.toISOString().split("T")[0];

    const previousSummary = await queries.getSummaryForRange(
      projectId,
      toDateStr(previousStart),
      toDateStr(currentStart),
    );

    let prevPageviews = 0;
    let prevAiTraffic = 0;
    for (const row of previousSummary) {
      prevPageviews += row.total;
      if (row.sourceType === "ai_referral" || row.sourceType === "ai_bot") {
        prevAiTraffic += row.total;
      }
    }

    const pctChange = (current: number, previous: number): number | null => {
      if (previous === 0) return null;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };

    const aiTrafficTotal = aiReferral + aiBot;

    type SummaryResponse = {
      totalPageviews: number;
      aiTraffic: { referral: number; bot: number; total: number };
      retentionDays: number;
      trend: {
        pageviewsTrend: number | null;
        aiTrafficTrend: number | null;
      };
      byProvider?: Record<string, number>;
      topPages?: Awaited<ReturnType<typeof queries.getTopPages>>;
    };

    const response: SummaryResponse = {
      totalPageviews,
      aiTraffic: {
        referral: aiReferral,
        bot: aiBot,
        total: aiTrafficTotal,
      },
      retentionDays,
      trend: {
        pageviewsTrend: pctChange(totalPageviews, prevPageviews),
        aiTrafficTrend: pctChange(aiTrafficTotal, prevAiTraffic),
      },
    };

    // Free plan: totals only (no byProvider, no topPages)
    if (plan !== "free") {
      response.byProvider = byProvider;
      response.topPages = await queries.getTopPages(projectId, retentionDays);
    }

    return c.json({ data: response });
  },
);

// ─── GET /analytics/:projectId/ai-traffic — AI traffic by day (paid only) ───

analyticsRoutes.get(
  "/analytics/:projectId/ai-traffic",
  authMiddleware,
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId");

    // Project ownership check
    const project = await projectQueries(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    // Paid plans only
    const user = await userQueries(db).getById(userId);
    const plan = user?.plan ?? "free";
    if (plan === "free") {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: "Upgrade to access AI traffic trends",
          },
        },
        403,
      );
    }

    const retentionDays = plan === "starter" ? 30 : 90;
    const rows = await analyticsQueries(db).getAiTrafficByDay(
      projectId,
      retentionDays,
    );

    return c.json({ data: rows });
  },
);

// ─── GET /analytics/:projectId/verify-snippet — Snippet verification ─────────

analyticsRoutes.get(
  "/analytics/:projectId/verify-snippet",
  authMiddleware,
  async (c) => {
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

    const domain = project.domain;
    const siteUrl = domain.startsWith("http") ? domain : `https://${domain}`;

    try {
      const res = await fetch(siteUrl, {
        headers: { "User-Agent": "LLMRank-Snippet-Verifier/1.0" },
        redirect: "follow",
      });

      if (!res.ok) {
        return c.json({
          data: {
            installed: false,
            hasSnippet: false,
            hasProjectId: false,
            reason: `Site returned HTTP ${res.status}`,
          },
        });
      }

      const html = await res.text();
      const hasSnippet = html.includes("api.llmrank.app/s/analytics.js");
      const hasProjectId = html.includes(projectId);

      return c.json({
        data: {
          installed: hasSnippet && hasProjectId,
          hasSnippet,
          hasProjectId,
          reason: !hasSnippet
            ? "Snippet script tag not found in page HTML"
            : !hasProjectId
              ? "Snippet found but project ID doesn't match"
              : "Snippet correctly installed",
        },
      });
    } catch (err) {
      return c.json({
        data: {
          installed: false,
          hasSnippet: false,
          hasProjectId: false,
          reason: `Could not fetch site: ${err instanceof Error ? err.message : "unknown error"}`,
        },
      });
    }
  },
);

// ─── GET /analytics/internal/summary — Admin endpoint ───────────────────────

analyticsRoutes.get(
  "/analytics/internal/summary",
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const db = c.get("db");
    const rows = await analyticsQueries(db).getSummary(
      FIRST_PARTY_PROJECT_ID,
      30,
    );

    let totalPageviews = 0;
    let aiTotal = 0;
    const byProvider: Record<string, number> = {};

    for (const row of rows) {
      totalPageviews += row.total;
      if (row.sourceType === "ai_referral" || row.sourceType === "ai_bot") {
        aiTotal += row.total;
        if (row.aiProvider && row.aiProvider !== "none") {
          byProvider[row.aiProvider] =
            (byProvider[row.aiProvider] ?? 0) + row.total;
        }
      }
    }

    return c.json({
      data: {
        totalPageviews,
        aiTotal,
        byProvider,
        windowDays: 30,
      },
    });
  },
);
