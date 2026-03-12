# Hybrid Analytics + AI Traffic Tracking — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hybrid analytics (GA4 + CF Web Analytics + server-side events) and an AI Traffic Analytics feature with customer tracking snippet and dashboard tab.

**Architecture:** Edge-first on Cloudflare Workers. Shared traffic classifier classifies every request at write time. Raw events stored in Postgres, aggregated into daily rollups by cron. Customer snippet posts beacons to a public collect endpoint.

**Tech Stack:** Hono, Drizzle ORM, Neon PostgreSQL, Next.js App Router, Zod, Cloudflare Workers (KV for rate limiting, cron for rollups), GA4 Measurement Protocol.

**Spec:** `docs/superpowers/specs/2026-03-12-analytics-ai-traffic-design.md`

---

## Chunk 1: Shared Foundation (Classifier + Schema + Queries)

### Task 1: Traffic Classifier

**Files:**

- Create: `packages/shared/src/utils/traffic-classifier.ts`
- Test: `packages/shared/src/__tests__/traffic-classifier.test.ts`

- [ ] **Step 1: Write failing tests for bot detection**

```typescript
// packages/shared/src/__tests__/traffic-classifier.test.ts
import { describe, it, expect } from "vitest";
import { classifyTraffic } from "../utils/traffic-classifier";

describe("classifyTraffic", () => {
  describe("AI bot detection (user-agent)", () => {
    it.each([
      ["GPTBot/1.0", "chatgpt"],
      ["Mozilla/5.0 ChatGPT-User/1.0", "chatgpt"],
      ["ClaudeBot/1.0", "claude"],
      ["Claude-Web/1.0", "claude"],
      ["PerplexityBot/1.0", "perplexity"],
      ["Mozilla/5.0 (compatible; Google-Extended)", "gemini"],
      ["Applebot-Extended/1.0", "apple_ai"],
      ["cohere-ai", "cohere"],
      ["Meta-ExternalAgent/1.0", "meta_ai"],
    ])("detects %s as ai_bot/%s", (ua, provider) => {
      const result = classifyTraffic(ua, null);
      expect(result.sourceType).toBe("ai_bot");
      expect(result.aiProvider).toBe(provider);
    });
  });

  describe("AI referral detection (referrer)", () => {
    it.each([
      ["https://chat.openai.com/share/abc", "chatgpt"],
      ["https://chatgpt.com/c/abc", "chatgpt"],
      ["https://claude.ai/chat/abc", "claude"],
      ["https://www.perplexity.ai/search/abc", "perplexity"],
      ["https://gemini.google.com/app/abc", "gemini"],
      ["https://bard.google.com/chat", "gemini"],
      ["https://you.com/search?q=test", "you"],
      ["https://phind.com/search?q=test", "phind"],
      ["https://copilot.microsoft.com/chat", "copilot"],
    ])("detects referrer %s as ai_referral/%s", (ref, provider) => {
      const result = classifyTraffic("Mozilla/5.0", ref);
      expect(result.sourceType).toBe("ai_referral");
      expect(result.aiProvider).toBe(provider);
    });
  });

  describe("standard traffic classification", () => {
    it("detects Google organic", () => {
      const result = classifyTraffic(
        "Mozilla/5.0",
        "https://www.google.com/search?q=test",
      );
      expect(result.sourceType).toBe("organic");
      expect(result.aiProvider).toBeNull();
    });

    it("detects Bing organic", () => {
      const result = classifyTraffic(
        "Mozilla/5.0",
        "https://www.bing.com/search?q=test",
      );
      expect(result.sourceType).toBe("organic");
    });

    it("detects social traffic from Twitter", () => {
      const result = classifyTraffic("Mozilla/5.0", "https://t.co/abc123");
      expect(result.sourceType).toBe("social");
    });

    it("detects social traffic from LinkedIn", () => {
      const result = classifyTraffic(
        "Mozilla/5.0",
        "https://www.linkedin.com/feed",
      );
      expect(result.sourceType).toBe("social");
    });

    it("classifies no referrer as direct", () => {
      const result = classifyTraffic("Mozilla/5.0", null);
      expect(result.sourceType).toBe("direct");
      expect(result.aiProvider).toBeNull();
    });

    it("classifies empty referrer as direct", () => {
      const result = classifyTraffic("Mozilla/5.0", "");
      expect(result.sourceType).toBe("direct");
    });

    it("classifies unknown referrer as other", () => {
      const result = classifyTraffic(
        "Mozilla/5.0",
        "https://some-random-site.com/page",
      );
      expect(result.sourceType).toBe("other");
    });
  });

  describe("edge cases", () => {
    it("bot UA takes priority over AI referrer", () => {
      const result = classifyTraffic("GPTBot/1.0", "https://claude.ai/chat");
      expect(result.sourceType).toBe("ai_bot");
      expect(result.aiProvider).toBe("chatgpt");
    });

    it("handles null UA and null referrer", () => {
      const result = classifyTraffic(null, null);
      expect(result.sourceType).toBe("direct");
      expect(result.aiProvider).toBeNull();
    });

    it("is case-insensitive for UA matching", () => {
      const result = classifyTraffic("gptbot/1.0", null);
      expect(result.sourceType).toBe("ai_bot");
      expect(result.aiProvider).toBe("chatgpt");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter shared test -- --run traffic-classifier`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the classifier**

```typescript
// packages/shared/src/utils/traffic-classifier.ts

export interface ClassificationResult {
  sourceType:
    | "organic"
    | "ai_referral"
    | "ai_bot"
    | "direct"
    | "social"
    | "other";
  aiProvider: string | null;
}

const AI_BOT_PATTERNS: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /gptbot|chatgpt-user/i, provider: "chatgpt" },
  { pattern: /claudebot|claude-web/i, provider: "claude" },
  { pattern: /perplexitybot/i, provider: "perplexity" },
  { pattern: /google-extended/i, provider: "gemini" },
  { pattern: /applebot-extended/i, provider: "apple_ai" },
  { pattern: /cohere-ai/i, provider: "cohere" },
  { pattern: /meta-externalagent/i, provider: "meta_ai" },
];

const AI_REFERRER_PATTERNS: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /chat\.openai\.com|chatgpt\.com/, provider: "chatgpt" },
  { pattern: /claude\.ai/, provider: "claude" },
  { pattern: /perplexity\.ai/, provider: "perplexity" },
  { pattern: /gemini\.google\.com|bard\.google\.com/, provider: "gemini" },
  { pattern: /\byou\.com/, provider: "you" },
  { pattern: /phind\.com/, provider: "phind" },
  { pattern: /copilot\.microsoft\.com/, provider: "copilot" },
];

const SEARCH_ENGINES =
  /google\.\w+\/search|bing\.com\/search|duckduckgo\.com|yahoo\.com\/search|baidu\.com\/s/;
const SOCIAL_PLATFORMS =
  /twitter\.com|x\.com|t\.co|linkedin\.com|facebook\.com|fb\.com|reddit\.com|youtube\.com/;

export function classifyTraffic(
  userAgent: string | null,
  referrer: string | null,
): ClassificationResult {
  // 1. Check UA for AI bots (highest priority)
  if (userAgent) {
    for (const { pattern, provider } of AI_BOT_PATTERNS) {
      if (pattern.test(userAgent)) {
        return { sourceType: "ai_bot", aiProvider: provider };
      }
    }
  }

  // 2. Check referrer for AI providers
  if (referrer) {
    for (const { pattern, provider } of AI_REFERRER_PATTERNS) {
      if (pattern.test(referrer)) {
        return { sourceType: "ai_referral", aiProvider: provider };
      }
    }

    // 3. Check for search engines
    if (SEARCH_ENGINES.test(referrer)) {
      return { sourceType: "organic", aiProvider: null };
    }

    // 4. Check for social platforms
    if (SOCIAL_PLATFORMS.test(referrer)) {
      return { sourceType: "social", aiProvider: null };
    }

    // 5. Has referrer but doesn't match anything
    return { sourceType: "other", aiProvider: null };
  }

  // 6. No referrer = direct
  return { sourceType: "direct", aiProvider: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter shared test -- --run traffic-classifier`
Expected: All tests PASS

- [ ] **Step 5: Export from shared package**

Add to `packages/shared/src/index.ts`:

```typescript
export {
  classifyTraffic,
  type ClassificationResult,
} from "./utils/traffic-classifier";
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/utils/traffic-classifier.ts packages/shared/src/__tests__/traffic-classifier.test.ts packages/shared/src/index.ts
git commit -m "feat: add AI traffic classifier utility"
```

---

### Task 2: Database Schema (enum + tables + project column)

**Files:**

- Modify: `packages/db/src/schema/enums.ts` (add `sourceTypeEnum` after line 233)
- Create: `packages/db/src/schema/analytics.ts`
- Modify: `packages/db/src/schema/projects.ts` (add `analyticsSnippetEnabled` column)
- Modify: `packages/db/src/index.ts` (export new schema)

- [ ] **Step 1: Add `sourceTypeEnum` to enums.ts**

Add after the `monitoringFrequencyEnum` block (line 233):

```typescript
export const sourceTypeEnum = pgEnum("source_type", [
  "organic",
  "ai_referral",
  "ai_bot",
  "direct",
  "social",
  "other",
]);
```

- [ ] **Step 2: Create analytics schema file**

```typescript
// packages/db/src/schema/analytics.ts
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sourceTypeEnum } from "./enums";
import { projects } from "./projects";

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    event: text("event").notNull(),
    domain: text("domain").notNull(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    sourceType: sourceTypeEnum("source_type").notNull().default("other"),
    aiProvider: text("ai_provider"),
    country: text("country"),
    botScore: integer("bot_score"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_analytics_events_project_created").on(t.projectId, t.createdAt),
    index("idx_analytics_events_source_created").on(t.sourceType, t.createdAt),
    index("idx_analytics_events_ai_provider_created").on(
      t.aiProvider,
      t.createdAt,
    ),
  ],
);

export const analyticsDailyRollups = pgTable(
  "analytics_daily_rollups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    date: date("date").notNull(),
    event: text("event").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    aiProvider: text("ai_provider").notNull().default("none"),
    country: text("country").notNull().default("unknown"),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("idx_analytics_rollups_unique").on(
      t.projectId,
      t.date,
      t.event,
      t.sourceType,
      t.aiProvider,
      t.country,
    ),
    index("idx_analytics_rollups_project_date").on(t.projectId, t.date),
  ],
);
```

- [ ] **Step 3: Add `analyticsSnippetEnabled` to projects table**

In `packages/db/src/schema/projects.ts`, add after `faviconUrl` (line 44):

```typescript
analyticsSnippetEnabled: boolean("analytics_snippet_enabled").notNull().default(false),
```

- [ ] **Step 4: Export analytics schema from barrel**

The DB barrel is `packages/db/src/schema.ts` (not `schema/index.ts`). Add the analytics re-export there:

```typescript
// packages/db/src/schema.ts — add at end:
export * from "./schema/analytics";
```

- [ ] **Step 5: Push schema to Neon**

Run:

```bash
export $(grep -v '^#' .env | xargs) && cd packages/db && npx drizzle-kit push
```

Expected: Tables `analytics_events`, `analytics_daily_rollups` created, `source_type` enum created, `analytics_snippet_enabled` column added to `projects`.

- [ ] **Step 6: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: All packages pass

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/enums.ts packages/db/src/schema/analytics.ts packages/db/src/schema/projects.ts packages/db/src/schema.ts
git commit -m "feat: add analytics database schema and sourceType enum"
```

---

### Task 3: Analytics Query Helpers

**Files:**

- Create: `packages/db/src/queries/analytics.ts`
- Modify: `packages/db/src/index.ts` (export queries)

- [ ] **Step 1: Create analytics queries**

```typescript
// packages/db/src/queries/analytics.ts
import { eq, and, gte, lte, lt, sql, desc } from "drizzle-orm";
import type { Database } from "../client";
import { analyticsEvents, analyticsDailyRollups } from "../schema/analytics";
import { FIRST_PARTY_PROJECT_ID } from "@llm-boost/shared";

export function analyticsQueries(db: Database) {
  return {
    async insertEvent(data: {
      projectId?: string | null;
      event: string;
      domain: string;
      path: string;
      referrer?: string | null;
      userAgent?: string | null;
      sourceType:
        | "organic"
        | "ai_referral"
        | "ai_bot"
        | "direct"
        | "social"
        | "other";
      aiProvider?: string | null;
      country?: string | null;
      botScore?: number | null;
      metadata?: Record<string, unknown>;
    }) {
      const [row] = await db
        .insert(analyticsEvents)
        .values({
          projectId: data.projectId ?? null,
          event: data.event,
          domain: data.domain,
          path: data.path,
          referrer: data.referrer ?? null,
          userAgent: data.userAgent ?? null,
          sourceType: data.sourceType,
          aiProvider: data.aiProvider ?? null,
          country: data.country ?? null,
          botScore: data.botScore ?? null,
          metadata: data.metadata ?? {},
        })
        .returning();
      return row;
    },

    async getSummary(projectId: string, days: number) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split("T")[0];

      const rows = await db
        .select({
          event: analyticsDailyRollups.event,
          sourceType: analyticsDailyRollups.sourceType,
          aiProvider: analyticsDailyRollups.aiProvider,
          total: sql<number>`sum(${analyticsDailyRollups.count})::int`,
        })
        .from(analyticsDailyRollups)
        .where(
          and(
            eq(analyticsDailyRollups.projectId, projectId),
            gte(analyticsDailyRollups.date, sinceStr),
          ),
        )
        .groupBy(
          analyticsDailyRollups.event,
          analyticsDailyRollups.sourceType,
          analyticsDailyRollups.aiProvider,
        );

      return rows;
    },

    async getAiTrafficByDay(projectId: string, days: number) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split("T")[0];

      return db
        .select({
          date: analyticsDailyRollups.date,
          sourceType: analyticsDailyRollups.sourceType,
          aiProvider: analyticsDailyRollups.aiProvider,
          count: analyticsDailyRollups.count,
        })
        .from(analyticsDailyRollups)
        .where(
          and(
            eq(analyticsDailyRollups.projectId, projectId),
            gte(analyticsDailyRollups.date, sinceStr),
            sql`${analyticsDailyRollups.sourceType} IN ('ai_bot', 'ai_referral')`,
          ),
        )
        .orderBy(desc(analyticsDailyRollups.date));
    },

    /**
     * Top pages by AI traffic. Queries raw events since rollups don't
     * include path dimension. Bounded by retention window (pruneOldEvents)
     * so data is only available within the retention period.
     */
    async getTopPages(projectId: string, days: number, limit = 10) {
      const since = new Date();
      since.setDate(since.getDate() - days);

      return db
        .select({
          path: analyticsEvents.path,
          totalVisits: sql<number>`count(*)::int`,
          aiVisits: sql<number>`count(*) filter (where ${analyticsEvents.sourceType} in ('ai_bot', 'ai_referral'))::int`,
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.projectId, projectId),
            gte(analyticsEvents.createdAt, since),
          ),
        )
        .groupBy(analyticsEvents.path)
        .orderBy(
          sql`count(*) filter (where ${analyticsEvents.sourceType} in ('ai_bot', 'ai_referral')) desc`,
        )
        .limit(limit);
    },

    async aggregateDay(targetDate: string) {
      await db.execute(sql`
        INSERT INTO analytics_daily_rollups (id, project_id, date, event, source_type, ai_provider, country, count)
        SELECT
          gen_random_uuid(),
          COALESCE(project_id, ${FIRST_PARTY_PROJECT_ID}::uuid),
          ${targetDate}::date,
          event,
          source_type,
          COALESCE(ai_provider, 'none'),
          COALESCE(country, 'unknown'),
          count(*)::int
        FROM analytics_events
        WHERE created_at >= ${targetDate}::date
          AND created_at < (${targetDate}::date + interval '1 day')
        GROUP BY project_id, event, source_type, ai_provider, country
        ON CONFLICT (project_id, date, event, source_type, ai_provider, country)
        DO UPDATE SET count = EXCLUDED.count
      `);
    },

    async pruneOldEvents(olderThanDays: number, batchSize = 5000) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);

      let deleted = batchSize;
      while (deleted >= batchSize) {
        const result = await db.execute(sql`
          DELETE FROM analytics_events
          WHERE id IN (
            SELECT id FROM analytics_events
            WHERE created_at < ${cutoff}
            LIMIT ${batchSize}
          )
        `);
        deleted = result.rowCount ?? 0;
      }
    },
  };
}
```

- [ ] **Step 2: Export from db package barrel**

Add to `packages/db/src/index.ts`:

```typescript
export { analyticsQueries } from "./queries/analytics";
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/queries/analytics.ts packages/db/src/index.ts
git commit -m "feat: add analytics query helpers (insert, summary, rollup, prune)"
```

---

### Task 4: Zod Schema + Shared Constants

**Files:**

- Create: `packages/shared/src/schemas/analytics.ts`
- Modify: `packages/shared/src/constants/plans.ts` (add analytics limits)
- Modify: `packages/shared/src/index.ts` (export new schema + constant)

- [ ] **Step 1: Create Zod schema for collect endpoint**

```typescript
// packages/shared/src/schemas/analytics.ts
import { z } from "zod";

export const CollectEventSchema = z.object({
  pid: z.string().uuid(),
  url: z.string().url(),
  ref: z.string().optional().default(""),
  ua: z.string().optional().default(""),
});

export type CollectEvent = z.infer<typeof CollectEventSchema>;
```

- [ ] **Step 2: Add analytics plan limits**

In `packages/shared/src/constants/plans.ts`, add these fields to the `PlanLimits` interface:

```typescript
analyticsRetentionDays: number;
analyticsSnippetProjects: number; // 0 = no snippet, -1 = unlimited
```

And add values to each tier in `PLAN_LIMITS`:

```typescript
// free
analyticsRetentionDays: 7,
analyticsSnippetProjects: 0,

// starter
analyticsRetentionDays: 30,
analyticsSnippetProjects: 1,

// pro
analyticsRetentionDays: 90,
analyticsSnippetProjects: -1,

// agency
analyticsRetentionDays: 90,
analyticsSnippetProjects: -1,
```

- [ ] **Step 3: Add FIRST_PARTY_PROJECT_ID constant**

Add to `packages/shared/src/constants/plans.ts` (or a new `analytics.ts` constants file):

```typescript
export const FIRST_PARTY_PROJECT_ID = "00000000-0000-0000-0000-000000000000";
```

- [ ] **Step 4: Export from shared barrel**

Add to `packages/shared/src/index.ts`:

```typescript
export { CollectEventSchema, type CollectEvent } from "./schemas/analytics";
export { FIRST_PARTY_PROJECT_ID } from "./constants/plans";
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schemas/analytics.ts packages/shared/src/constants/plans.ts packages/shared/src/index.ts
git commit -m "feat: add analytics Zod schema and plan limits"
```

---

## Chunk 2: API Layer (Middleware, Routes, Cron)

### Task 5: Analytics Middleware (First-Party Tracking)

**Files:**

- Create: `apps/api/src/middleware/analytics.ts`
- Modify: `apps/api/src/index.ts` (mount middleware ~line 206)

- [ ] **Step 1: Create the middleware**

```typescript
// apps/api/src/middleware/analytics.ts
import type { MiddlewareHandler } from "hono";
import { classifyTraffic } from "@llm-boost/shared";
import { analyticsQueries } from "@llm-boost/db";
import type { AppEnv } from "../types";

const SKIP_PATHS = ["/health", "/favicon.ico", "/robots.txt"];

export function analyticsMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();

    // Skip non-relevant requests
    const method = c.req.method;
    if (method === "OPTIONS" || method === "HEAD") return;

    const path = new URL(c.req.url).pathname;
    if (SKIP_PATHS.some((p) => path.startsWith(p))) return;
    if (path.startsWith("/s/")) return; // snippet serving route

    const userAgent = c.req.header("user-agent") ?? null;
    const referrer = c.req.header("referer") ?? null;
    const classification = classifyTraffic(userAgent, referrer);

    const cf = (c.req.raw as any).cf;
    const country = cf?.country ?? null;
    const botScore = cf?.botManagement?.score ?? null;

    const db = c.get("db");
    const queries = analyticsQueries(db);

    const event =
      classification.sourceType === "ai_bot"
        ? "bot_visit"
        : classification.sourceType === "ai_referral"
          ? "ai_referral"
          : "pageview";

    c.executionCtx.waitUntil(
      queries
        .insertEvent({
          projectId: null, // first-party
          event,
          domain: "llmrank.app",
          path,
          referrer,
          userAgent,
          sourceType: classification.sourceType,
          aiProvider: classification.aiProvider,
          country,
          botScore,
        })
        .catch((err) => console.error("Analytics insert failed:", err)),
    );
  };
}
```

- [ ] **Step 2: Mount in API index**

In `apps/api/src/index.ts`, add import and mount the middleware after the existing middleware stack (after `logger()`, before route mounting):

```typescript
import { analyticsMiddleware } from "./middleware/analytics";

// After other middleware, before routes:
app.use("*", analyticsMiddleware());
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/middleware/analytics.ts apps/api/src/index.ts
git commit -m "feat: add analytics middleware for first-party AI traffic detection"
```

---

### Task 6: Analytics Routes (Collect + Dashboard Queries)

**Files:**

- Create: `apps/api/src/routes/analytics.ts`
- Modify: `apps/api/src/index.ts` (mount route)

- [ ] **Step 1: Create analytics routes**

```typescript
// apps/api/src/routes/analytics.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import {
  CollectEventSchema,
  PLAN_LIMITS,
  FIRST_PARTY_PROJECT_ID,
} from "@llm-boost/shared";
import { classifyTraffic } from "@llm-boost/shared";
import { analyticsQueries } from "@llm-boost/db";
import type { AppEnv } from "../types";
import { authMiddleware } from "../middleware/auth";
import { rateLimiter } from "../middleware/rate-limit";

const analytics = new Hono<AppEnv>();

// ─── Snippet JS serving ───────────────────────────────────────────────
analytics.get("/s/analytics.js", (c) => {
  const js = `(function(){var s=document.currentScript;if(!s)return;var p=s.getAttribute("data-project");if(!p)return;var d=JSON.stringify({pid:p,url:location.href,ref:document.referrer,ua:navigator.userAgent});var u=s.src.replace("/s/analytics.js","/analytics/collect");try{var b=new Blob([d],{type:"application/json"});navigator.sendBeacon(u,b)}catch(e){fetch(u,{method:"POST",body:d,headers:{"Content-Type":"application/json"},keepalive:true}).catch(function(){})}})();`;
  return c.text(js, 200, {
    "Content-Type": "application/javascript",
    "Cache-Control": "public, max-age=3600",
  });
});

// ─── Collect endpoint (public, no auth) ───────────────────────────────
analytics.post(
  "/analytics/collect",
  cors({ origin: "*" }),
  rateLimiter({ limit: 100, windowSeconds: 1, keyPrefix: "analytics" }),
  zValidator("json", CollectEventSchema),
  async (c) => {
    const body = c.req.valid("json");

    // Validate project exists and has snippet enabled
    const db = c.get("db");
    const project = await db.query.projects.findFirst({
      where: (p, { eq, and }) =>
        and(eq(p.id, body.pid), eq(p.analyticsSnippetEnabled, true)),
      columns: { id: true, domain: true },
    });

    if (!project) {
      // Still return 204 — don't leak info
      return c.body(null, 204);
    }

    const classification = classifyTraffic(body.ua || null, body.ref || null);
    const cf = (c.req.raw as any).cf;
    let parsedPath = "/";
    try {
      parsedPath = new URL(body.url).pathname;
    } catch {}
    let parsedDomain = project.domain;
    try {
      parsedDomain = new URL(body.url).hostname;
    } catch {}

    const queries = analyticsQueries(db);
    c.executionCtx.waitUntil(
      queries
        .insertEvent({
          projectId: body.pid,
          event:
            classification.sourceType === "ai_bot" ? "bot_visit" : "pageview",
          domain: parsedDomain,
          path: parsedPath,
          referrer: body.ref || null,
          userAgent: body.ua || null,
          sourceType: classification.sourceType,
          aiProvider: classification.aiProvider,
          country: cf?.country ?? null,
          botScore: cf?.botManagement?.score ?? null,
        })
        .catch((err) => console.error("Collect insert failed:", err)),
    );

    return c.body(null, 204);
  },
);

// ─── Dashboard: summary ───────────────────────────────────────────────
analytics.get("/analytics/:projectId/summary", authMiddleware(), async (c) => {
  const projectId = c.req.param("projectId");
  const userId = c.get("userId");
  const db = c.get("db");

  // Ownership check
  const project = await db.query.projects.findFirst({
    where: (p, { eq, and }) => and(eq(p.id, projectId), eq(p.userId, userId)),
    columns: { id: true },
  });
  if (!project)
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );

  // Plan-based retention
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { plan: true },
  });
  const plan = user?.plan ?? "free";
  const limits =
    PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
  const days = limits.analyticsRetentionDays;

  const queries = analyticsQueries(db);
  const [rows, topPages] = await Promise.all([
    queries.getSummary(projectId, days),
    queries.getTopPages(projectId, days, 10),
  ]);

  // Compute totals
  let totalVisits = 0;
  let aiTotal = 0;
  const byProvider: Array<{ provider: string; visits: number; type: string }> =
    [];

  for (const row of rows) {
    totalVisits += row.total;
    if (row.sourceType === "ai_bot" || row.sourceType === "ai_referral") {
      aiTotal += row.total;
      if (row.aiProvider && row.aiProvider !== "none") {
        byProvider.push({
          provider: row.aiProvider,
          visits: row.total,
          type: row.sourceType,
        });
      }
    }
  }

  // Free plan: totals only, no breakdown
  const isFree = plan === "free";

  return c.json({
    period: `${days}d`,
    totalVisits,
    aiTraffic: {
      total: aiTotal,
      byProvider: isFree ? [] : byProvider,
      trend: null, // TODO: compute vs previous period
    },
    topPages: isFree ? [] : topPages,
  });
});

// ─── Dashboard: AI traffic by day ─────────────────────────────────────
analytics.get(
  "/analytics/:projectId/ai-traffic",
  authMiddleware(),
  async (c) => {
    const projectId = c.req.param("projectId");
    const userId = c.get("userId");
    const db = c.get("db");

    const project = await db.query.projects.findFirst({
      where: (p, { eq, and }) => and(eq(p.id, projectId), eq(p.userId, userId)),
      columns: { id: true },
    });
    if (!project)
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      columns: { plan: true },
    });
    const plan = user?.plan ?? "free";
    if (plan === "free") {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: "Upgrade to view AI traffic breakdown",
          },
        },
        403,
      );
    }

    const limits =
      PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
    const queries = analyticsQueries(db);
    const data = await queries.getAiTrafficByDay(
      projectId,
      limits.analyticsRetentionDays,
    );

    return c.json({ data });
  },
);

// ─── Internal: admin summary ──────────────────────────────────────────
analytics.get("/analytics/internal/summary", authMiddleware(), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  // Admin check — verify user has admin role
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { role: true },
  });
  if (user?.role !== "admin") {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Admin access required" } },
      403,
    );
  }

  const queries = analyticsQueries(db);
  const rows = await queries.getSummary(FIRST_PARTY_PROJECT_ID, 30);

  let totalVisits = 0;
  let aiTotal = 0;
  const byProvider: Array<{ provider: string; visits: number; type: string }> =
    [];

  for (const row of rows) {
    totalVisits += row.total;
    if (row.sourceType === "ai_bot" || row.sourceType === "ai_referral") {
      aiTotal += row.total;
      if (row.aiProvider && row.aiProvider !== "none") {
        byProvider.push({
          provider: row.aiProvider,
          visits: row.total,
          type: row.sourceType,
        });
      }
    }
  }

  return c.json({
    period: "30d",
    totalVisits,
    aiTraffic: { total: aiTotal, byProvider },
  });
});

export { analytics as analyticsRoutes };
```

- [ ] **Step 2: Mount in API index**

In `apps/api/src/index.ts`, add:

```typescript
import { analyticsRoutes } from "./routes/analytics";

// Mount alongside other routes (around line 260):
app.route("/", analyticsRoutes);
```

Note: The snippet route is `/s/analytics.js` and collect is `/analytics/collect` — both are top-level paths, so mount with `"/"`.

- [ ] **Step 3: Add rollup cron to scheduled handler**

In `apps/api/src/index.ts`, inside the `scheduled()` function (around line 618), add a new cron case:

```typescript
// After existing cron handlers, before the closing:
if (controller.cron === "0 2 * * *") {
  // Daily analytics rollup at 2 AM UTC
  const db = createDb(env.DATABASE_URL);
  const queries = analyticsQueries(db);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];
  await queries.aggregateDay(dateStr);
  await queries.pruneOldEvents(90);
  console.log(`Analytics rollup complete for ${dateStr}`);
}
```

- [ ] **Step 4: Add cron trigger to wrangler.toml**

In `apps/api/wrangler.toml`, add `"0 2 * * *"` to the crons array (line 55).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/analytics.ts apps/api/src/index.ts apps/api/wrangler.toml
git commit -m "feat: add analytics collect endpoint, dashboard API, and rollup cron"
```

---

### Task 7: Server-Side GA4 Helper

**Files:**

- Create: `apps/api/src/lib/ga4.ts`

- [ ] **Step 1: Create GA4 Measurement Protocol helper**

```typescript
// apps/api/src/lib/ga4.ts

interface GA4Event {
  name: string;
  params?: Record<string, string | number | boolean>;
}

export async function trackGA4Server(
  measurementId: string,
  apiSecret: string,
  clientId: string,
  events: GA4Event[],
): Promise<void> {
  if (!measurementId || !apiSecret) return;

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;

  await fetch(url, {
    method: "POST",
    body: JSON.stringify({
      client_id: clientId,
      events,
    }),
  }).catch((err) => console.error("GA4 server-side tracking failed:", err));
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/lib/ga4.ts
git commit -m "feat: add server-side GA4 Measurement Protocol helper"
```

---

## Chunk 3: Client-Side Analytics (Quick Win)

### Task 8: GA4 Pageviews + Cloudflare Web Analytics

**Files:**

- Modify: `apps/web/src/components/google-analytics.tsx` (remove `send_page_view: false`)
- Create: `apps/web/src/components/cloudflare-analytics.tsx`
- Modify: `apps/web/src/app/layout.tsx` (add CF component)

- [ ] **Step 1: Enable GA4 pageviews**

In `apps/web/src/components/google-analytics.tsx`, remove the `send_page_view: false` config option (line 19). Change to:

```typescript
gtag("config", "${gaId}");
```

- [ ] **Step 2: Create Cloudflare Web Analytics component**

```typescript
// apps/web/src/components/cloudflare-analytics.tsx
"use client";

import Script from "next/script";

const CF_TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

export function CloudflareAnalytics() {
  if (!CF_TOKEN) return null;

  return (
    <Script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={`{"token": "${CF_TOKEN}"}`}
      strategy="afterInteractive"
    />
  );
}
```

- [ ] **Step 3: Add to layout**

In `apps/web/src/app/layout.tsx`, add import and component (after the existing `<Intercom />` around line 83):

```typescript
import { CloudflareAnalytics } from "@/components/cloudflare-analytics";

// In JSX, alongside other analytics:
<CloudflareAnalytics />
```

- [ ] **Step 4: Wire GA4 custom events in telemetry**

In `apps/web/src/lib/telemetry.ts`, update the `track()` function to map key SaaS events to GA4:

Add these named events to the existing `track()` GA forwarding logic:

```typescript
// Inside track(), after the PostHog capture:
withGtag((gtag) => {
  const sanitized = sanitizeForGa(properties);
  gtag("event", event, sanitized);
});
```

This should already work if `withGtag` and the GA forwarding are in place. Verify the existing `track()` function already forwards to GA. If not, add the `withGtag` call.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/google-analytics.tsx apps/web/src/components/cloudflare-analytics.tsx apps/web/src/app/layout.tsx apps/web/src/lib/telemetry.ts
git commit -m "feat: enable GA4 pageviews, add Cloudflare Web Analytics, wire SaaS events"
```

---

## Chunk 4: Dashboard UI

### Task 9: AI Traffic Dashboard Tab

**Files:**

- Create: `apps/web/src/app/dashboard/projects/[id]/_components/ai-traffic-tab.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx` (add tab)

- [ ] **Step 1: Create the AI Traffic tab component**

```typescript
// apps/web/src/app/dashboard/projects/[id]/_components/ai-traffic-tab.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Bot, Globe, ExternalLink, Code } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AiTrafficSummary {
  period: string;
  totalVisits: number;
  aiTraffic: {
    total: number;
    byProvider: Array<{ provider: string; visits: number; type: string }>;
    trend: string | null;
  };
  topPages: Array<{ path: string; aiVisits: number; totalVisits: number }>;
}

interface AiTrafficTabProps {
  projectId: string;
  snippetEnabled: boolean;
}

export function AiTrafficTab({ projectId, snippetEnabled }: AiTrafficTabProps) {
  const [summary, setSummary] = useState<AiTrafficSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.fetch(`/analytics/${projectId}/summary`)
      .then((res) => res.json())
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading analytics...</div>;
  }

  if (error) {
    return <div className="py-12 text-center text-sm text-destructive">{error}</div>;
  }

  if (!summary) return null;

  const trendValue = summary.aiTraffic.trend ? parseFloat(summary.aiTraffic.trend) : 0;
  const TrendIcon = trendValue >= 0 ? ArrowUp : ArrowDown;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalVisits.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Bot className="mr-1 inline h-4 w-4" />
              AI Bot Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {summary.aiTraffic.byProvider
                .filter((p) => p.type === "ai_bot")
                .reduce((sum, p) => sum + p.visits, 0)
                .toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Globe className="mr-1 inline h-4 w-4" />
              AI Referral Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">
                {summary.aiTraffic.byProvider
                  .filter((p) => p.type === "ai_referral")
                  .reduce((sum, p) => sum + p.visits, 0)
                  .toLocaleString()}
              </p>
              {summary.aiTraffic.trend && (
                <span className={cn("flex items-center text-sm", trendValue >= 0 ? "text-green-600" : "text-red-600")}>
                  <TrendIcon className="h-3 w-3" />
                  {summary.aiTraffic.trend}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider breakdown */}
      {summary.aiTraffic.byProvider.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Provider Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.aiTraffic.byProvider.map((p) => (
                <div key={`${p.provider}-${p.type}`} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <span className="text-sm font-medium capitalize">{p.provider}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.type === "ai_bot" ? "Bot" : "Referral"}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">{p.visits.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top pages */}
      {summary.topPages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Pages (AI Traffic)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.topPages.map((page) => (
                <div key={page.path} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="truncate text-sm font-mono">{page.path}</span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-muted-foreground">{page.totalVisits} total</span>
                    <span className="font-semibold">{page.aiVisits} AI</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snippet CTA */}
      {!snippetEnabled && summary.totalVisits === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <Code className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Not seeing data?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add the tracking snippet to your site to see AI traffic analytics.
            </p>
            <Button variant="outline" size="sm" className="mt-3">
              <ExternalLink className="mr-1 h-3 w-3" />
              View setup instructions
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add tab to project dashboard**

In `apps/web/src/app/dashboard/projects/[id]/page.tsx`, add dynamic import alongside other tabs (around line 188):

```typescript
const AiTrafficTab = dynamic(
  () => import("./_components/ai-traffic-tab").then((m) => ({ default: m.AiTrafficTab })),
  { loading: () => <TabSkeleton /> },
);
```

Add the tab rendering in the tab switch/conditional block (follow the existing pattern for other tabs):

```typescript
{currentTab === "ai-traffic" && (
  <AiTrafficTab
    projectId={params.id}
    snippetEnabled={project?.analyticsSnippetEnabled ?? false}
  />
)}
```

- [ ] **Step 3: Add "AI Traffic" to navigation tabs**

Find the tab navigation component (likely in `useProjectPageNavigation` hook or the page itself) and add an "AI Traffic" tab entry. Follow the existing pattern for tab definitions.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/projects/[id]/_components/ai-traffic-tab.tsx apps/web/src/app/dashboard/projects/[id]/page.tsx
git commit -m "feat: add AI Traffic dashboard tab with provider breakdown and top pages"
```

---

### Task 10: Add API Client Methods

**Files:**

- Modify: `apps/web/src/lib/api.ts` (or the relevant api domain file)

- [ ] **Step 1: Add analytics API methods**

Add to the API client (follow existing pattern for domain-specific methods):

```typescript
analytics: {
  getSummary(projectId: string) {
    return apiFetch<AiTrafficSummary>(`/analytics/${projectId}/summary`);
  },
  getAiTraffic(projectId: string) {
    return apiFetch<{ data: Array<{ date: string; sourceType: string; aiProvider: string; count: number }> }>(
      `/analytics/${projectId}/ai-traffic`,
    );
  },
},
```

- [ ] **Step 2: Update the AiTrafficTab to use the API client instead of raw fetch**

Replace the `api.fetch(...)` call in `ai-traffic-tab.tsx` with `api.analytics.getSummary(projectId)`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/app/dashboard/projects/[id]/_components/ai-traffic-tab.tsx
git commit -m "feat: add analytics API client methods"
```

---

### Task 10b: Snippet Settings UI in Project Settings

**Files:**

- Create: `apps/web/src/app/dashboard/projects/[id]/_components/snippet-settings-section.tsx`
- Modify: project settings page (find the settings tab component and add the snippet section)

- [ ] **Step 1: Create snippet settings component**

```typescript
// apps/web/src/app/dashboard/projects/[id]/_components/snippet-settings-section.tsx
"use client";

import { useState } from "react";
import { Check, Copy, Code } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

interface SnippetSettingsSectionProps {
  projectId: string;
  snippetEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function SnippetSettingsSection({
  projectId,
  snippetEnabled,
  onToggle,
}: SnippetSettingsSectionProps) {
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  const snippetCode = `<script defer src="https://api.llmrank.app/s/analytics.js" data-project="${projectId}"></script>`;

  async function handleToggle(checked: boolean) {
    setToggling(true);
    try {
      await api.projects.update(projectId, { analyticsSnippetEnabled: checked } as any);
      onToggle(checked);
    } catch {
      // revert on failure
    } finally {
      setToggling(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(snippetCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Code className="h-4 w-4" />
          AI Traffic Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="snippet-toggle">Enable tracking snippet</Label>
          <Switch
            id="snippet-toggle"
            checked={snippetEnabled}
            onCheckedChange={handleToggle}
            disabled={toggling}
          />
        </div>

        {snippetEnabled && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Add this snippet to your site&apos;s &lt;head&gt; to track AI traffic.
            </p>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 text-xs">
                {snippetCode}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add to project settings**

Find the project settings tab/page and add `<SnippetSettingsSection>` with the project's `analyticsSnippetEnabled` state. Follow the existing pattern for settings sections in the project settings UI.

- [ ] **Step 3: Add `analyticsSnippetEnabled` to project update API schema**

In `packages/shared/src/schemas/project.ts`, add to `UpdateProjectSchema`:

```typescript
analyticsSnippetEnabled: z.boolean().optional(),
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/projects/[id]/_components/snippet-settings-section.tsx packages/shared/src/schemas/project.ts
git commit -m "feat: add snippet settings UI for AI traffic tracking"
```

---

## Chunk 5: Final Integration + Testing

### Task 11: Integration Tests

**Files:**

- Create: `packages/shared/src/__tests__/analytics-schema.test.ts`

- [ ] **Step 1: Write Zod schema validation tests**

```typescript
// packages/shared/src/__tests__/analytics-schema.test.ts
import { describe, it, expect } from "vitest";
import { CollectEventSchema } from "../schemas/analytics";

describe("CollectEventSchema", () => {
  it("accepts valid collect payload", () => {
    const result = CollectEventSchema.safeParse({
      pid: "123e4567-e89b-12d3-a456-426614174000",
      url: "https://example.com/page",
      ref: "https://chat.openai.com/",
      ua: "Mozilla/5.0",
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload without optional fields", () => {
    const result = CollectEventSchema.safeParse({
      pid: "123e4567-e89b-12d3-a456-426614174000",
      url: "https://example.com/page",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID for pid", () => {
    const result = CollectEventSchema.safeParse({
      pid: "not-a-uuid",
      url: "https://example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = CollectEventSchema.safeParse({
      pid: "123e4567-e89b-12d3-a456-426614174000",
      url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass including new traffic-classifier and schema tests

- [ ] **Step 3: Full typecheck**

Run: `pnpm typecheck`
Expected: All 15 packages pass

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/__tests__/analytics-schema.test.ts
git commit -m "test: add analytics schema validation and traffic classifier tests"
```

---

### Task 12: Push Schema + Environment Setup

- [ ] **Step 1: Push schema to Neon (if not done in Task 2)**

```bash
export $(grep -v '^#' .env | xargs) && cd packages/db && npx drizzle-kit push
```

- [ ] **Step 2: Add env vars to `.env` (local dev)**

```bash
# Add to .env:
NEXT_PUBLIC_CF_ANALYTICS_TOKEN=<get from CF dashboard>
GA4_MEASUREMENT_ID=G-TLYXK6GG0C
GA4_API_SECRET=<get from GA4 admin>
```

- [ ] **Step 3: Add secrets to Cloudflare Workers (production)**

```bash
echo "<secret>" | npx wrangler secret put GA4_MEASUREMENT_ID --name llm-boost-api
echo "<secret>" | npx wrangler secret put GA4_API_SECRET --name llm-boost-api
```

- [ ] **Step 4: Final commit with any remaining changes**

```bash
git add -A
git commit -m "chore: finalize analytics integration setup"
```
