import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  CollectEventSchema,
  PLAN_LIMITS,
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

analyticsRoutes.post(
  "/analytics/collect",
  cors({ origin: "*" }),
  async (c) => {
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

    // Classify traffic source
    const traffic = classifyTraffic(data.ua || null, data.ref || null);

    // Parse URL for domain + path
    let domain = "";
    let path = "/";
    try {
      const parsed = new URL(data.url);
      domain = parsed.hostname;
      path = parsed.pathname;
    } catch {
      domain = project.domain ?? "";
    }

    // Non-blocking insert
    c.executionCtx.waitUntil(
      analyticsQueries(db).insertEvent({
        projectId: data.pid,
        event: "pageview",
        domain,
        path,
        referrer: data.ref || null,
        userAgent: data.ua || null,
        sourceType: traffic.sourceType,
        aiProvider: traffic.aiProvider ?? null,
        country: null,
        botScore: null,
        metadata: {},
      }),
    );

    return c.body(null, 204);
  },
);

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

    type SummaryResponse = {
      totalPageviews: number;
      aiTraffic: { referral: number; bot: number; total: number };
      retentionDays: number;
      byProvider?: Record<string, number>;
      topPages?: Awaited<ReturnType<typeof queries.getTopPages>>;
    };

    const response: SummaryResponse = {
      totalPageviews,
      aiTraffic: {
        referral: aiReferral,
        bot: aiBot,
        total: aiReferral + aiBot,
      },
      retentionDays,
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
