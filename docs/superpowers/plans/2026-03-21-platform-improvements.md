# Platform Improvements — 10 Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backfill missing data, improve frontend UX, add monitoring, consolidate API, build crawl comparison UI, add webhook notifications, scale the crawler, enable incremental crawls, improve reports, and add AI visibility monitoring.

**Architecture:** 10 independent improvements across the full stack — Neon PostgreSQL backfill scripts, Next.js frontend (SWR patterns, new components), Cloudflare Workers API (new routes, Sentry integration), Fly.io crawler (scaling config), and report service enhancements. Each task is self-contained and deployable independently.

**Tech Stack:** Next.js (App Router), Hono (Cloudflare Workers), Drizzle ORM, Neon PostgreSQL, SWR, Sentry, Fly.io, React-PDF, Resend

---

## Task 1: Backfill AI Audit Scores for Existing Crawls

**Files:**

- Create: `infra/scripts/backfill-ai-audit-scores.ts`

This is a one-off script that re-runs the scoring dimension calculation on all existing page_scores rows. The fix in `page-scoring-service.ts` only affects NEW crawls. Existing crawls (all projects) have NULL `llms_txt_score`, `robots_txt_score`, `bot_access_score`, `sitemap_score`, `schema_markup_score`.

- [ ] **Step 1: Create the backfill script**

The script should:

1. Connect to Neon via `DATABASE_URL`
2. Find all crawl_jobs with status='complete' that have page_scores with NULL `llms_txt_score`
3. For each crawl job, load the `summary_data.siteContext` (this has `has_llms_txt`, `has_sitemap`, `ai_crawlers_blocked`, `sitemap_analysis`)
4. Normalize the siteContext from snake_case to camelCase (same transform as `page-scoring-service.ts`)
5. For each page_score row, call `scoringResultToDimensions` from `@llm-boost/scoring` with a minimal `ScoringResult` built from the existing scores + siteContext
6. Update the dimension columns in batch

```typescript
// infra/scripts/backfill-ai-audit-scores.ts
import { createDb, crawlQueries, scoreQueries } from "@llm-boost/db";
import { scorePage, scoringResultToDimensions } from "@llm-boost/scoring";

const db = createDb(process.env.DATABASE_URL!);

async function main() {
  // Get all crawl jobs with NULL dimension scores
  const jobs = await db.execute(sql`
    SELECT DISTINCT cj.id, cj.summary_data
    FROM crawl_jobs cj
    JOIN page_scores ps ON ps.job_id = cj.id
    WHERE cj.status = 'complete'
      AND ps.llms_txt_score IS NULL
    LIMIT 50
  `);

  for (const job of jobs.rows) {
    const sc = job.summary_data?.siteContext;
    const siteContext = sc
      ? {
          hasLlmsTxt: sc.has_llms_txt ?? sc.hasLlmsTxt ?? false,
          hasSitemap: sc.has_sitemap ?? sc.hasSitemap ?? false,
          aiCrawlersBlocked:
            sc.ai_crawlers_blocked ?? sc.aiCrawlersBlocked ?? [],
          contentHashes: new Map(),
          sitemapAnalysis: sc.sitemap_analysis ?? sc.sitemapAnalysis,
        }
      : undefined;

    // Get page scores for this job
    const scores = await scoreQueries(db).listByJob(job.id);

    for (const score of scores) {
      // Build minimal PageData from existing score
      const pageData = {
        url: "",
        statusCode: 200,
        title: null,
        metaDescription: null,
        canonicalUrl: null,
        wordCount: 0,
        contentHash: "",
        extracted: {
          internal_links: [],
          external_links: [],
          headings: [],
          structured_data: [],
          images: [],
          meta_tags: {},
        },
        lighthouse: null,
        llmScores: null,
        siteContext,
      };

      const result = scorePage(pageData);
      const dims = scoringResultToDimensions(result, result.issues);

      await db.execute(sql`
        UPDATE page_scores SET
          llms_txt_score = ${dims.llms_txt},
          robots_txt_score = ${dims.robots_crawlability},
          sitemap_score = ${dims.sitemap},
          schema_markup_score = ${dims.schema_markup},
          bot_access_score = ${dims.bot_access}
        WHERE id = ${score.id}
      `);
    }

    console.log(`Backfilled ${scores.length} scores for job ${job.id}`);
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Run the script**

```bash
export $(grep -v '^#' .env | xargs)
npx tsx infra/scripts/backfill-ai-audit-scores.ts
```

- [ ] **Step 3: Verify**

```sql
SELECT COUNT(*) FILTER (WHERE llms_txt_score IS NOT NULL) as has_scores,
       COUNT(*) FILTER (WHERE llms_txt_score IS NULL) as null_scores
FROM page_scores;
```

- [ ] **Step 4: Commit**

```bash
git add infra/scripts/backfill-ai-audit-scores.ts
git commit -m "chore: backfill AI audit dimension scores for existing crawls"
```

---

## Task 2: Auto-Refresh Overview After Crawl Completes

**Files:**

- Modify: `apps/web/src/hooks/use-project.ts`
- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx`

- [ ] **Step 1: Add polling to useProject hook when crawl is in progress**

In `use-project.ts`, add `refreshInterval` when the latest crawl is not complete:

```typescript
export function useProject(id: string | undefined) {
  const { data, ...rest } = useApiSWR(
    id ? `project-${id}` : null,
    useCallback(() => api.projects.get(id!), [id]),
    {
      refreshInterval: (data) => {
        const status = data?.latestCrawl?.status;
        if (
          status === "crawling" ||
          status === "scoring" ||
          status === "pending"
        ) {
          return 5000; // poll every 5s during active crawl
        }
        return 0; // no polling when idle
      },
    },
  );
  return { data, ...rest };
}
```

- [ ] **Step 2: In page.tsx, trigger SWR revalidation when crawl completes**

Add a `useEffect` that watches `project?.latestCrawl?.status`. When it transitions to `"complete"`, call `mutate()` on the dependent SWR keys (pages, issues, insights):

```typescript
const prevStatusRef = useRef(project?.latestCrawl?.status);
useEffect(() => {
  const prev = prevStatusRef.current;
  const curr = project?.latestCrawl?.status;
  prevStatusRef.current = curr;
  if (prev && prev !== "complete" && curr === "complete") {
    // Crawl just finished — revalidate all data
    mutate((key) => typeof key === "string" && key.startsWith("pages-"));
    mutate((key) => typeof key === "string" && key.startsWith("issues-"));
    mutate((key) => typeof key === "string" && key.startsWith("insights-"));
  }
}, [project?.latestCrawl?.status]);
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter @llm-boost/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-project.ts apps/web/src/app/dashboard/projects/\[id\]/page.tsx
git commit -m "feat: auto-refresh Overview data when crawl completes"
```

---

## Task 3: Sentry Error Boundary Integration

**Files:**

- Modify: `apps/web/src/app/dashboard/projects/[id]/project-tab-registry.tsx`
- Modify: `apps/web/package.json` (if @sentry/nextjs not installed)

- [ ] **Step 1: Check if Sentry is installed in the web app**

```bash
grep -r "sentry" apps/web/package.json
```

If not installed, add it:

```bash
cd apps/web && pnpm add @sentry/nextjs
```

- [ ] **Step 2: Report errors to Sentry in componentDidCatch**

```typescript
import * as Sentry from "@sentry/nextjs";

componentDidCatch(error: Error, info: React.ErrorInfo) {
  console.error("[ProjectTab] render error:", error, info.componentStack);
  Sentry.captureException(error, {
    extra: { componentStack: info.componentStack },
    tags: { component: "ProjectTabErrorBoundary" },
  });
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm --filter @llm-boost/web typecheck
git add apps/web/src/app/dashboard/projects/\[id\]/project-tab-registry.tsx
git commit -m "feat: report tab render errors to Sentry"
```

---

## Task 4: Consolidated Overview API Endpoint

**Files:**

- Create: `apps/api/src/routes/overview.ts`
- Modify: `apps/api/src/routes/register.ts`

The Overview tab currently fires 10+ parallel API calls. Create a single endpoint that returns all overview data.

- [ ] **Step 1: Create the consolidated endpoint**

```typescript
// apps/api/src/routes/overview.ts
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { withOwnership } from "../middleware/ownership";
import { handleServiceError } from "../lib/error-handler";

export const overviewRoutes = new Hono<AppEnv>();

// GET /api/overview/:projectId — All overview data in one call
overviewRoutes.get("/:projectId", withOwnership("project"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  try {
    const { progressService, crawlService, insightsService } =
      c.get("container");

    // Parallel fetch all overview data
    const [progress, project, regressions, trends] = await Promise.all([
      progressService.getProjectProgress(userId, projectId).catch(() => null),
      // ... other data fetches
    ]);

    return c.json({
      data: {
        progress,
        regressions,
        trends,
        // Add other overview data as needed
      },
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

- [ ] **Step 2: Register route**

In `register.ts`:

```typescript
import { overviewRoutes } from "./overview";
// ...
app.route("/api/overview", overviewRoutes);
```

- [ ] **Step 3: Create frontend hook**

```typescript
// apps/web/src/hooks/use-overview-data.ts
export function useOverviewData(projectId: string | undefined) {
  return useApiSWR(
    projectId ? `overview-${projectId}` : null,
    useCallback(() => api.overview.get(projectId!), [projectId]),
  );
}
```

Note: The frontend can adopt this incrementally — keep existing individual SWR calls and replace them one by one.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm typecheck
git add apps/api/src/routes/overview.ts apps/api/src/routes/register.ts
git commit -m "feat: consolidated overview API endpoint"
```

---

## Task 5: Crawl Comparison View

**Files:**

- Create: `apps/web/src/components/tabs/history-tab-comparison.tsx`
- Modify: `apps/web/src/components/tabs/history-tab.tsx`
- Create: `apps/web/src/lib/api/domains/comparison.ts` (if needed)

- [ ] **Step 1: Check existing comparison API**

The API already has `GET /api/crawls/:id1/compare/:id2` — check what it returns.

- [ ] **Step 2: Create comparison component**

```typescript
// apps/web/src/components/tabs/history-tab-comparison.tsx
"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { cn, gradeColor } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface CrawlComparisonProps {
  crawlId1: string;
  crawlId2: string;
}

export function CrawlComparison({ crawlId1, crawlId2 }: CrawlComparisonProps) {
  const { data: comparison } = useApiSWR(
    `compare-${crawlId1}-${crawlId2}`,
    useCallback(() => api.crawls.compare(crawlId1, crawlId2), [crawlId1, crawlId2]),
  );

  if (!comparison) return null;

  return (
    <div className="space-y-6">
      {/* Score delta cards */}
      {/* Category comparison bars */}
      {/* Issues fixed vs new */}
      {/* Top improved/regressed pages */}
    </div>
  );
}
```

- [ ] **Step 3: Add comparison picker to history tab**

In `history-tab.tsx`, add a "Compare" button next to each crawl. When two crawls are selected, show the comparison component.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm --filter @llm-boost/web typecheck
git commit -m "feat: crawl comparison view in History tab"
```

---

## Task 6: Webhook Notifications (Slack/Discord/Custom)

**Files:**

- Modify: `apps/api/src/services/notification-service.ts`
- Modify: `apps/web/src/components/tabs/automation-tab.tsx`

The notification service already supports webhooks and Slack. The gaps are:

- No UI to configure webhook URLs
- No Discord formatting

- [ ] **Step 1: Add Discord webhook formatting**

In `notification-service.ts`, detect Discord webhook URLs (`discord.com/api/webhooks/`) and format as Discord embeds:

```typescript
function formatDiscordPayload(event: NotificationEvent) {
  return {
    embeds: [
      {
        title: event.title,
        description: event.message,
        color: event.severity === "critical" ? 0xff0000 : 0x00ff00,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
```

- [ ] **Step 2: Add webhook configuration UI in Automation tab**

Add a section to the automation tab for configuring webhook URL and selecting events:

```typescript
// Webhook configuration card
<Card>
  <CardHeader>
    <CardTitle>Webhook Notifications</CardTitle>
  </CardHeader>
  <CardContent>
    <Input
      placeholder="https://hooks.slack.com/... or Discord webhook URL"
      value={webhookUrl}
      onChange={(e) => setWebhookUrl(e.target.value)}
    />
    <div className="mt-3 space-y-2">
      {["crawl_complete", "score_drop", "new_critical_issues"].map(event => (
        <label key={event} className="flex items-center gap-2">
          <Checkbox checked={selectedEvents.includes(event)} />
          {eventLabels[event]}
        </label>
      ))}
    </div>
    <Button onClick={saveWebhookConfig}>Save</Button>
  </CardContent>
</Card>
```

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm typecheck
git commit -m "feat: webhook notifications with Slack/Discord support + UI configuration"
```

---

## Task 7: Crawler Auto-Scaling

**Files:**

- Modify: `apps/crawler/fly.toml`

- [ ] **Step 1: Update fly.toml for auto-scaling**

```toml
[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

[http_service.concurrency]
  type = "requests"
  soft_limit = 5
  hard_limit = 10

[[vm]]
  size = "shared-cpu-4x"
  memory = "4gb"
  cpus = 4

[http_service.machine_checks]
  [http_service.machine_checks.health]
    interval = "15s"
    timeout = "2s"
    grace_period = "30s"
    path = "/api/v1/health"
```

Key changes:

- VM size: `shared-cpu-2x` → `shared-cpu-4x` (4GB RAM, 4 CPUs)
- Concurrency type: `connections` → `requests` (more accurate for crawl jobs)
- Soft limit: 10 → 5 (scale sooner to handle queue)
- Hard limit: 25 → 10 (each crawl job uses significant resources)

- [ ] **Step 2: Commit**

```bash
git add apps/crawler/fly.toml
git commit -m "infra: scale crawler VM to 4CPU/4GB, request-based auto-scaling"
```

---

## Task 8: Incremental Crawls (ETag/Last-Modified)

**Files:**

- Modify: `apps/api/src/services/crawl-service.ts`
- Modify: `apps/crawler/src/models.rs`
- Modify: `apps/crawler/src/jobs/mod.rs`

The crawler already captures `etag` and `last_modified` headers (Task 16 of crawler overhaul). Now use them.

- [ ] **Step 1: Store page cache headers in the database**

Add `etag` and `last_modified` columns to the `pages` table schema:

```typescript
// packages/db/src/schema/crawling.ts — add to pages table:
etag: text("etag"),
lastModified: text("last_modified"),
```

Push schema: `cd packages/db && npx drizzle-kit push`

- [ ] **Step 2: When starting a crawl, pass previous page cache data to crawler**

In `crawl-service.ts`, when dispatching a crawl job, include a `cache_hints` map of URL → {etag, last_modified} from the previous crawl's pages:

```typescript
const previousPages = await deps.pages.listByJob(latestCrawlId);
const cacheHints = Object.fromEntries(
  previousPages
    .filter((p) => p.etag || p.lastModified)
    .map((p) => [p.url, { etag: p.etag, last_modified: p.lastModified }]),
);
```

- [ ] **Step 3: In the crawler, send If-None-Match/If-Modified-Since headers**

In `fetcher.rs`, accept optional cache hints. When fetching a URL with a hint, add conditional headers:

```rust
if let Some(etag) = cache_hint.etag {
    request = request.header("If-None-Match", etag);
}
if let Some(lm) = cache_hint.last_modified {
    request = request.header("If-Modified-Since", lm);
}
```

If the response is 304 Not Modified, reuse the previous crawl's data.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: incremental crawls using ETag/Last-Modified cache headers"
```

---

## Task 9: White-Label Reports

**Files:**

- Modify: `packages/reports/src/pdf/components/header.tsx`
- Modify: `packages/reports/src/pdf/templates/summary.tsx`
- Modify: `apps/web/src/components/reports/reports-tab.tsx`

- [ ] **Step 1: Enhance report branding**

The report system already supports `logoUrl`, `companyName`, and `primaryColor`. Enhance:

1. Add `secondaryColor` and `fontFamily` to branding config
2. Use `primaryColor` for headers, section borders, and chart colors throughout the PDF
3. Add "Prepared by [companyName]" footer with custom color
4. Remove "LLM Rank" branding when custom branding is provided

- [ ] **Step 2: Add branding preview in Reports tab**

Show a live preview of how the report header will look with current branding settings.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: enhanced white-label report branding"
```

---

## Task 10: AI Visibility Monitoring Dashboard

**Files:**

- Create: `apps/web/src/components/tabs/ai-visibility-tab-monitor.tsx`
- Modify: `apps/web/src/components/tabs/ai-visibility-tab.tsx`
- Modify: `apps/api/src/routes/visibility.ts`

The visibility check system exists but has no monitoring dashboard. Add:

- [ ] **Step 1: Create visibility trend API endpoint**

```typescript
// In visibility.ts, add:
// GET /api/visibility/trends?projectId=xxx — Get visibility check history
visibilityRoutes.get("/trends", async (c) => {
  const projectId = c.req.query("projectId");
  // Query visibility_checks grouped by date and provider
  // Return: { date, provider, brandMentioned, urlCited }[]
});
```

- [ ] **Step 2: Create monitoring component**

```typescript
// ai-visibility-tab-monitor.tsx
"use client";

export function AIVisibilityMonitor({ projectId }: { projectId: string }) {
  // Show:
  // 1. Citation rate over time (line chart per provider)
  // 2. Current visibility status (mentioned/cited per provider)
  // 3. Alert configuration (threshold for score drops)
  // 4. Competitor citation comparison
}
```

- [ ] **Step 3: Add to AI Visibility tab**

Import and render `AIVisibilityMonitor` in the AI visibility tab.

- [ ] **Step 4: Add scheduled visibility check execution**

Create a cron handler in `apps/api/src/scheduled.ts` that processes due scheduled visibility queries:

```typescript
// Run every hour — check for scheduled queries that are due
const dueQueries = await db
  .select()
  .from(scheduledVisibilityQueries)
  .where(
    and(
      eq(scheduledVisibilityQueries.enabled, true),
      lte(scheduledVisibilityQueries.nextRunAt, new Date()),
    ),
  );

for (const query of dueQueries) {
  await visibilityService.runCheck(
    query.projectId,
    query.queries,
    query.providers,
  );
  await updateNextRunAt(query.id, query.frequency);
}
```

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm typecheck
git commit -m "feat: AI visibility monitoring dashboard with trends and scheduled checks"
```
