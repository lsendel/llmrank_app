# Business Growth: 10 Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship 10 features that drive user engagement, conversion, and retention across the LLM Boost platform.

**Architecture:** Each feature follows the API-first pattern: add/extend API routes in `apps/api`, then build frontend components in `apps/web`. Many features have existing backend infrastructure (digest service, regression service, crawl comparison queries, action items table) that just needs frontend wiring.

**Tech Stack:** Hono (API), Next.js (Web), Drizzle ORM (DB), Vitest (tests), Resend (email), Stripe (billing), Tailwind + shadcn/ui (styling).

**Existing Infrastructure Summary:**

- `digest-service.ts` — weekly/monthly digest emails already work
- `regression-service.ts` — score drop detection exists
- `notification-service.ts` — email, webhook, Slack delivery
- `crawlQueries.getComparisonData()` — crawl comparison backend exists
- `CrawlComparison` component — frontend comparison table exists
- `UpgradePrompt` component — contextual upgrade card exists
- `actionItems` table — fix tracking schema exists
- `crawlScheduleEnum` + `nextCrawlAt` — scheduling schema exists
- `GET /api/billing/usage` — usage data endpoint exists
- `PLATFORM_REQUIREMENTS` — platform scoring factors exist

---

## Wave 1: Quick Wins (Frontend-Heavy)

---

### Task 1: Usage Meter Component

**Goal:** Show users their plan consumption to drive upgrade urgency.

**Files:**

- Create: `apps/web/src/components/usage-meter.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx` (add to header area)
- Modify: `apps/web/src/lib/api.ts` (add `billing.usage()` method if missing)

**Step 1: Add billing.usage() to API client (if missing)**

Check `apps/web/src/lib/api.ts` for existing `billing.usage` method. The API already has `GET /api/billing/usage` that returns:

```json
{
  "data": {
    "plan": "free",
    "crawlCreditsRemaining": 2,
    "crawlCreditsTotal": 2,
    "maxPagesPerCrawl": 10,
    "maxDepth": 2,
    "maxProjects": 1
  }
}
```

If `api.billing.usage()` doesn't exist in the client, add it:

```typescript
// In the billing namespace of api.ts
usage: () => apiClient.get<{
  plan: string;
  crawlCreditsRemaining: number;
  crawlCreditsTotal: number;
  maxPagesPerCrawl: number;
  maxDepth: number;
  maxProjects: number;
}>("/api/billing/usage"),
```

**Step 2: Create UsageMeter component**

Create `apps/web/src/components/usage-meter.tsx`:

```tsx
"use client";

import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

export function UsageMeter() {
  const { data } = useApiSWR(
    "billing-usage",
    useCallback(() => api.billing.usage(), []),
  );

  if (!data?.data) return null;

  const { plan, crawlCreditsRemaining, crawlCreditsTotal } = data.data;
  const used = crawlCreditsTotal - crawlCreditsRemaining;
  const pct =
    crawlCreditsTotal > 0 ? Math.round((used / crawlCreditsTotal) * 100) : 0;

  const color =
    pct > 80
      ? "text-red-600"
      : pct > 50
        ? "text-yellow-600"
        : "text-emerald-600";
  const progressColor =
    pct > 80 ? "bg-red-600" : pct > 50 ? "bg-yellow-500" : "bg-emerald-500";

  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
      <Badge variant="outline" className="capitalize">
        {plan}
      </Badge>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Crawls:</span>
        <div className="w-20">
          <Progress
            value={pct}
            className="h-2"
            indicatorClassName={progressColor}
          />
        </div>
        <span className={color}>
          {used}/{crawlCreditsTotal === Infinity ? "∞" : crawlCreditsTotal}
        </span>
      </div>
      {pct > 80 && (
        <Link
          href="/pricing"
          className="text-xs font-medium text-primary hover:underline"
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}
```

**Step 3: Add UsageMeter to project page header**

In `apps/web/src/app/dashboard/projects/[id]/page.tsx`, import and place next to the "Run Crawl" button:

```tsx
import { UsageMeter } from "@/components/usage-meter";

// In the header section, add between project info and Run Crawl button:
<div className="flex items-center gap-3">
  <UsageMeter />
  <Button onClick={handleStartCrawl} disabled={startingCrawl}>
    <Play className="h-4 w-4" />
    {startingCrawl ? "Starting..." : "Run Crawl"}
  </Button>
</div>;
```

**Step 4: Verify locally**

Run: `pnpm --filter web dev`
Navigate to a project page. The usage meter should show next to the "Run Crawl" button.

**Step 5: Commit**

```bash
git add apps/web/src/components/usage-meter.tsx apps/web/src/app/dashboard/projects/\[id\]/page.tsx apps/web/src/lib/api.ts
git commit -m "feat(web): add usage meter component to project header"
```

---

### Task 2: Smart Upgrade Prompts (Contextual Placement)

**Goal:** Place `UpgradePrompt` cards at strategic locations based on user plan.

**Files:**

- Modify: `apps/web/src/components/tabs/issues-tab.tsx`
- Modify: `apps/web/src/components/tabs/competitors-tab.tsx`
- Modify: `apps/web/src/components/tabs/integrations-tab.tsx`
- Modify: `apps/web/src/components/tabs/visibility-tab.tsx`
- Create: `apps/web/src/hooks/use-plan.ts`

**Step 1: Create usePlan hook**

Create `apps/web/src/hooks/use-plan.ts` to centralize plan checks:

```typescript
"use client";

import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { useCallback } from "react";

export function usePlan() {
  const { data } = useApiSWR(
    "billing-usage",
    useCallback(() => api.billing.usage(), []),
  );

  const plan = data?.data?.plan ?? "free";
  return {
    plan,
    isFree: plan === "free",
    isStarter: plan === "starter",
    isPro: plan === "pro",
    isAgency: plan === "agency",
    isPaid: plan !== "free",
    isProOrAbove: plan === "pro" || plan === "agency",
  };
}
```

**Step 2: Add upgrade prompt to Issues tab**

In `apps/web/src/components/tabs/issues-tab.tsx`, add above the issue list for free users:

```tsx
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { usePlan } from "@/hooks/use-plan";

// Inside the component:
const { isFree } = usePlan();

// Before the issue list, after filters:
{
  isFree && (
    <UpgradePrompt
      feature="AI-Powered Issue Priority"
      description="Sort issues by AI-estimated impact to fix the most important problems first."
      nextTier="Starter ($79/mo)"
      nextTierUnlocks="AI priority sorting, 100 pages/crawl, 10 crawls/month"
    />
  );
}
```

**Step 3: Add upgrade prompt to Competitors tab**

In `apps/web/src/components/tabs/competitors-tab.tsx`, find where competitors are shown and add for Starter users:

```tsx
{
  isStarter && (
    <UpgradePrompt
      feature="Extended Competitor Analysis"
      description="Compare with up to 5 competitors and get AI-generated gap analysis."
      nextTier="Pro ($149/mo)"
      nextTierUnlocks="5 competitors, content gap analysis, scheduled crawls"
    />
  );
}
```

**Step 4: Add upgrade prompt to Visibility tab**

In the Visibility tab, add for free users:

```tsx
{
  isFree && (
    <UpgradePrompt
      feature="AI Visibility Tracking"
      description="Track how LLMs mention your brand across 25+ queries with scheduled monitoring."
      nextTier="Starter ($79/mo)"
      nextTierUnlocks="25 visibility checks, 5 scheduled queries, keyword discovery"
    />
  );
}
```

**Step 5: Commit**

```bash
git add apps/web/src/hooks/use-plan.ts apps/web/src/components/tabs/issues-tab.tsx apps/web/src/components/tabs/competitors-tab.tsx apps/web/src/components/tabs/visibility-tab.tsx
git commit -m "feat(web): add contextual upgrade prompts across tabs"
```

---

### Task 3: Scheduled Crawls UI

**Goal:** Let users configure crawl frequency from the Settings tab.

**Analysis:** The `crawlScheduleEnum` (manual/daily/weekly/monthly) and `nextCrawlAt` column already exist in the `projects` table. The `CrawlSettingsForm` already exists at `apps/web/src/components/forms/crawl-settings-form.tsx`. Check if it already has schedule selection.

**Files:**

- Modify: `apps/web/src/components/forms/crawl-settings-form.tsx` (add schedule selector if missing)
- Modify: `apps/api/src/routes/projects.ts` (verify PUT /:id accepts crawlSchedule)

**Step 1: Read CrawlSettingsForm to understand current state**

Read `apps/web/src/components/forms/crawl-settings-form.tsx` to see if schedule is already there.

**Step 2: Add schedule selector if missing**

Add a schedule radio group or select to the CrawlSettingsForm:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlan } from "@/hooks/use-plan";

// Inside the form:
const { isFree, isStarter } = usePlan();

<div className="space-y-2">
  <Label>Crawl Schedule</Label>
  <Select value={schedule} onValueChange={setSchedule}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="manual">Manual only</SelectItem>
      <SelectItem value="monthly" disabled={isFree}>
        Monthly (1st of each month) {isFree && "— Starter+"}
      </SelectItem>
      <SelectItem value="weekly" disabled={isFree || isStarter}>
        Weekly (every Monday) {(isFree || isStarter) && "— Pro+"}
      </SelectItem>
    </SelectContent>
  </Select>
  {schedule !== "manual" && (
    <p className="text-xs text-muted-foreground">
      Next scheduled crawl: {nextCrawlDate ?? "will be set on save"}
    </p>
  )}
</div>;
```

**Step 3: Wire schedule to project update API**

The `PUT /api/projects/:id` already accepts settings. Ensure the schedule value is sent:

```typescript
// In the save handler:
await api.projects.update(projectId, {
  settings: { ...currentSettings, schedule: selectedSchedule },
});
```

**Step 4: Commit**

```bash
git add apps/web/src/components/forms/crawl-settings-form.tsx
git commit -m "feat(web): add crawl schedule selector to settings"
```

---

### Task 4: Fix Tracking Workflow

**Goal:** Let users mark issues as fixed/in-progress/won't-fix and track resolution rate.

**Analysis:** The `actionItems` table already exists with `status` (pending/in_progress/fixed/wont_fix pattern), `severity`, `category`, `scoreImpact`, `title`, `description`, `assigneeId`, `verifiedAt`, `verifiedByCrawlId`. We need API routes and frontend UI.

**Files:**

- Create: `apps/api/src/routes/action-items.ts`
- Modify: `apps/api/src/index.ts` (mount the new route)
- Modify: `apps/web/src/lib/api.ts` (add actionItems namespace)
- Modify: `apps/web/src/components/tabs/issues-tab.tsx` (add status controls)
- Modify: `apps/web/src/components/issue-card.tsx` (add status dropdown)

**Step 1: Create action items API routes**

Create `apps/api/src/routes/action-items.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { withOwnership } from "../middleware/ownership";
import { handleServiceError } from "../services/errors";
import { actionItems, eq, and, sql } from "@llm-boost/db";

export const actionItemRoutes = new Hono<AppEnv>();

actionItemRoutes.use("*", authMiddleware);

// GET / — List action items for a project
actionItemRoutes.get("/", async (c) => {
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId required" } },
      422,
    );
  }

  const items = await db.query.actionItems.findMany({
    where: eq(actionItems.projectId, projectId),
    orderBy: (ai, { desc }) => [desc(ai.createdAt)],
  });

  return c.json({ data: items });
});

// PATCH /:id/status — Update action item status
actionItemRoutes.patch("/:id/status", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json<{ status: string }>();

  const validStatuses = ["pending", "in_progress", "fixed", "wont_fix"];
  if (!validStatuses.includes(body.status)) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid status" } },
      422,
    );
  }

  const [updated] = await db
    .update(actionItems)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(actionItems.id, id))
    .returning();

  if (!updated) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Action item not found" } },
      404,
    );
  }

  return c.json({ data: updated });
});

// GET /stats — Fix rate stats for a project
actionItemRoutes.get("/stats", async (c) => {
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId required" } },
      422,
    );
  }

  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      fixed: sql<number>`count(*) filter (where ${actionItems.status} = 'fixed')`,
      inProgress: sql<number>`count(*) filter (where ${actionItems.status} = 'in_progress')`,
    })
    .from(actionItems)
    .where(eq(actionItems.projectId, projectId));

  return c.json({
    data: {
      total: Number(stats?.total ?? 0),
      fixed: Number(stats?.fixed ?? 0),
      inProgress: Number(stats?.inProgress ?? 0),
      fixRate: stats?.total
        ? Math.round((Number(stats.fixed) / Number(stats.total)) * 100)
        : 0,
    },
  });
});
```

**Step 2: Mount the route in apps/api/src/index.ts**

Find where routes are mounted (look for `.route("/api/..."`) and add:

```typescript
import { actionItemRoutes } from "./routes/action-items";
// ...
app.route("/api/action-items", actionItemRoutes);
```

**Step 3: Add API client methods**

In `apps/web/src/lib/api.ts`, add:

```typescript
actionItems: {
  list: (projectId: string) => apiClient.get<ActionItem[]>(`/api/action-items?projectId=${projectId}`),
  updateStatus: (id: string, status: string) => apiClient.patch(`/api/action-items/${id}/status`, { status }),
  stats: (projectId: string) => apiClient.get<{ total: number; fixed: number; inProgress: number; fixRate: number }>(`/api/action-items/stats?projectId=${projectId}`),
},
```

**Step 4: Add status badge + dropdown to IssueCard**

In `apps/web/src/components/issue-card.tsx`, add a status dropdown:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Add onStatusChange prop and status prop
interface IssueCardProps extends PageIssue {
  actionItemId?: string;
  status?: string;
  onStatusChange?: (id: string, status: string) => void;
}

// In the card, add a status selector:
{
  actionItemId && onStatusChange && (
    <Select
      value={status ?? "pending"}
      onValueChange={(v) => onStatusChange(actionItemId, v)}
    >
      <SelectTrigger className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">Open</SelectItem>
        <SelectItem value="in_progress">In Progress</SelectItem>
        <SelectItem value="fixed">Fixed</SelectItem>
        <SelectItem value="wont_fix">Won't Fix</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

**Step 5: Add fix rate banner to Issues tab**

In the IssuesTab, fetch and display fix rate stats:

```tsx
const { data: statsData } = useApiSWR(
  projectId ? `action-item-stats-${projectId}` : null,
  useCallback(() => api.actionItems.stats(projectId!), [projectId]),
);

// Above the filters:
{
  statsData?.data && statsData.data.total > 0 && (
    <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3 text-sm">
      <span>
        Fix rate: <strong>{statsData.data.fixRate}%</strong>
      </span>
      <span className="text-muted-foreground">
        {statsData.data.fixed}/{statsData.data.total} resolved
      </span>
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add apps/api/src/routes/action-items.ts apps/api/src/index.ts apps/web/src/lib/api.ts apps/web/src/components/issue-card.tsx apps/web/src/components/tabs/issues-tab.tsx
git commit -m "feat: add fix tracking workflow with status management"
```

---

## Wave 2: Medium Effort

---

### Task 5: Score Change Alerts

**Goal:** Show alert banners on the project page when regressions are detected.

**Analysis:** `regression-service.ts` already detects score drops. `notification-service.ts` already sends score_drop emails. What's missing: a DB table for alerts with acknowledgement, a frontend alert banner, and an API to list/acknowledge alerts.

**Files:**

- Modify: `packages/db/src/schema.ts` (add `alerts` table)
- Create: `packages/db/src/queries/alerts.ts`
- Modify: `packages/db/src/index.ts` (export alertQueries)
- Create: `apps/api/src/routes/alerts.ts`
- Modify: `apps/api/src/index.ts` (mount alerts route)
- Create: `apps/web/src/components/alert-banner.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx` (add alert banner)
- Modify: `apps/web/src/lib/api.ts` (add alerts namespace)

**Step 1: Add alerts table to schema**

In `packages/db/src/schema.ts`, add after the `actionItems` table:

```typescript
export const alertSeverityEnum = pgEnum("alert_severity", [
  "critical",
  "warning",
  "info",
]);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "score_drop", "critical_issue", "crawler_blocked", "noindex"
    severity: alertSeverityEnum("severity").notNull(),
    message: text("message").notNull(),
    data: jsonb("data").default({}),
    acknowledgedAt: timestamp("acknowledged_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_alerts_project").on(t.projectId),
    index("idx_alerts_unacked").on(t.projectId, t.acknowledgedAt),
  ],
);
```

**Step 2: Push schema to DB**

Run: `cd packages/db && npx drizzle-kit push`

**Step 3: Create alert queries**

Create `packages/db/src/queries/alerts.ts`:

```typescript
import { eq, and, isNull, desc } from "drizzle-orm";
import type { Database } from "../client";
import { alerts } from "../schema";

export function alertQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      type: string;
      severity: "critical" | "warning" | "info";
      message: string;
      data?: unknown;
    }) {
      const [alert] = await db.insert(alerts).values(data).returning();
      return alert;
    },

    async listUnacknowledged(projectId: string) {
      return db.query.alerts.findMany({
        where: and(
          eq(alerts.projectId, projectId),
          isNull(alerts.acknowledgedAt),
        ),
        orderBy: [desc(alerts.createdAt)],
      });
    },

    async acknowledge(id: string) {
      const [updated] = await db
        .update(alerts)
        .set({ acknowledgedAt: new Date() })
        .where(eq(alerts.id, id))
        .returning();
      return updated;
    },

    async acknowledgeAll(projectId: string) {
      await db
        .update(alerts)
        .set({ acknowledgedAt: new Date() })
        .where(
          and(eq(alerts.projectId, projectId), isNull(alerts.acknowledgedAt)),
        );
    },
  };
}
```

**Step 4: Export from packages/db/src/index.ts**

Add: `export { alertQueries } from "./queries/alerts";`

**Step 5: Create alerts API route**

Create `apps/api/src/routes/alerts.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { alertQueries } from "@llm-boost/db";

export const alertRoutes = new Hono<AppEnv>();
alertRoutes.use("*", authMiddleware);

alertRoutes.get("/", async (c) => {
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId)
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId required" } },
      422,
    );

  const items = await alertQueries(db).listUnacknowledged(projectId);
  return c.json({ data: items });
});

alertRoutes.post("/:id/acknowledge", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const updated = await alertQueries(db).acknowledge(id);
  return c.json({ data: updated });
});

alertRoutes.post("/acknowledge-all", async (c) => {
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId)
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId required" } },
      422,
    );
  await alertQueries(db).acknowledgeAll(projectId);
  return c.json({ data: { success: true } });
});
```

**Step 6: Mount route and create frontend alert banner**

Mount in `apps/api/src/index.ts`: `app.route("/api/alerts", alertRoutes);`

Create `apps/web/src/components/alert-banner.tsx`:

```tsx
"use client";

import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AlertBanner({ projectId }: { projectId: string }) {
  const { data, mutate } = useApiSWR(
    `alerts-${projectId}`,
    useCallback(() => api.alerts.list(projectId), [projectId]),
  );

  const alerts = data?.data ?? [];
  if (alerts.length === 0) return null;

  async function dismissAll() {
    await api.alerts.acknowledgeAll(projectId);
    mutate();
  }

  const criticalCount = alerts.filter(
    (a: any) => a.severity === "critical",
  ).length;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${criticalCount > 0 ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950" : "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"}`}
    >
      <AlertTriangle
        className={`h-5 w-5 ${criticalCount > 0 ? "text-red-600" : "text-yellow-600"}`}
      />
      <div className="flex-1 text-sm">
        <strong>
          {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
        </strong>
        {": "}
        {alerts
          .slice(0, 2)
          .map((a: any) => a.message)
          .join("; ")}
        {alerts.length > 2 && ` and ${alerts.length - 2} more`}
      </div>
      <Button variant="ghost" size="sm" onClick={dismissAll}>
        <X className="h-4 w-4" /> Dismiss
      </Button>
    </div>
  );
}
```

**Step 7: Add to project page**

In `apps/web/src/app/dashboard/projects/[id]/page.tsx`, add below the header and above PostCrawlChecklist:

```tsx
import { AlertBanner } from "@/components/alert-banner";

// After the header div and before PostCrawlChecklist:
<AlertBanner projectId={project.id} />;
```

**Step 8: Wire regression service to create alerts**

In `apps/api/src/services/post-processing-service.ts`, after the regression detection runs, also create alerts:

```typescript
// After calling regressionService.checkAndNotify():
import { alertQueries } from "@llm-boost/db";

for (const regression of regressions) {
  await alertQueries(db).create({
    projectId,
    type: "score_drop",
    severity: regression.severity,
    message: `${regression.category} score dropped ${regression.delta} points (${regression.previousScore} → ${regression.currentScore})`,
    data: regression,
  });
}
```

**Step 9: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/queries/alerts.ts packages/db/src/index.ts apps/api/src/routes/alerts.ts apps/api/src/index.ts apps/web/src/components/alert-banner.tsx apps/web/src/app/dashboard/projects/\[id\]/page.tsx apps/api/src/services/post-processing-service.ts
git commit -m "feat: add score change alerts with dismissible banners"
```

---

### Task 6: Crawl Comparison View (Wire into History Tab)

**Goal:** Let users compare any two crawls from the History tab.

**Analysis:** Backend `GET /api/crawls/:id/compare/:otherId` already exists. `CrawlComparison` component already exists. The History tab needs a "Compare" button and a crawl selector.

**Files:**

- Modify: `apps/web/src/components/tabs/history-tab.tsx` (add compare UI)

**Step 1: Add compare functionality to History tab**

Modify `apps/web/src/components/tabs/history-tab.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, GitCompare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, gradeColor } from "@/lib/utils";
import type { CrawlJob } from "@/lib/api";
import { CrawlHistoryChart } from "@/components/score-trend-chart";
import { CrawlComparison } from "@/components/crawl-comparison";

export function HistoryTab({ crawlHistory }: { crawlHistory: CrawlJob[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const completedCrawls = crawlHistory.filter((c) => c.status === "complete");

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 2) return [prev[1], id]; // keep max 2
      return [...prev, id];
    });
  }

  if (crawlHistory.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No crawl history yet. Run your first crawl to see results.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CrawlHistoryChart crawlHistory={crawlHistory} />

      {/* Compare controls */}
      {completedCrawls.length >= 2 && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={selected.length !== 2}
            onClick={() => setComparing(true)}
          >
            <GitCompare className="mr-1.5 h-4 w-4" />
            Compare Selected ({selected.length}/2)
          </Button>
          {selected.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelected([]);
                setComparing(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Comparison view */}
      {comparing && selected.length === 2 && (
        <Card className="p-4">
          <h3 className="mb-3 font-semibold">Crawl Comparison</h3>
          <CrawlComparison jobId={selected[0]} otherId={selected[1]} />
        </Card>
      )}

      {/* History table with checkboxes */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {completedCrawls.length >= 2 && <TableHead className="w-10" />}
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pages</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crawlHistory.map((crawl) => (
              <TableRow key={crawl.id}>
                {completedCrawls.length >= 2 && (
                  <TableCell>
                    {crawl.status === "complete" && (
                      <Checkbox
                        checked={selected.includes(crawl.id)}
                        onCheckedChange={() => toggleSelect(crawl.id)}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {crawl.startedAt
                    ? new Date(crawl.startedAt).toLocaleDateString()
                    : "--"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      crawl.status === "complete"
                        ? "success"
                        : crawl.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {crawl.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    {crawl.pagesCrawled ?? crawl.pagesScored}
                  </span>
                </TableCell>
                <TableCell>
                  {crawl.overallScore != null ? (
                    <span
                      className={cn(
                        "font-semibold",
                        gradeColor(crawl.overallScore),
                      )}
                    >
                      {crawl.overallScore}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </TableCell>
                <TableCell className="font-semibold">
                  {crawl.letterGrade ?? "--"}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/dashboard/crawl/${crawl.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Details
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
```

**Step 2: Verify the api.crawls.compare method exists in api.ts**

Check `apps/web/src/lib/api.ts` for a `compare` method. It should exist since `CrawlComparison` component already uses it. If not, add:

```typescript
compare: (jobId: string, otherId: string) =>
  apiClient.get<ComparisonItem[]>(`/api/crawls/${jobId}/compare/${otherId}`),
```

**Step 3: Commit**

```bash
git add apps/web/src/components/tabs/history-tab.tsx
git commit -m "feat(web): add crawl comparison view to history tab"
```

---

### Task 7: 14-Day Pro Trial

**Goal:** Let free users try Pro features for 14 days.

**Files:**

- Modify: `packages/db/src/schema.ts` (add trial columns to users)
- Modify: `packages/shared/src/constants/plans.ts` (add trial resolution helper)
- Create: `apps/api/src/routes/trial.ts`
- Modify: `apps/api/src/index.ts` (mount trial route)
- Modify: `apps/api/src/services/billing-service.ts` (use trial-aware plan resolution)
- Create: `apps/web/src/components/trial-banner.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx` (add trial banner)
- Modify: `apps/web/src/lib/api.ts` (add trial namespace)

**Step 1: Add trial columns to users table**

In `packages/db/src/schema.ts`, add to the `users` table definition:

```typescript
trialStartedAt: timestamp("trial_started_at"),
trialEndsAt: timestamp("trial_ends_at"),
```

**Step 2: Push schema**

Run: `cd packages/db && npx drizzle-kit push`

**Step 3: Add trial resolution to shared package**

In `packages/shared/src/constants/plans.ts`, add:

```typescript
export function resolveEffectivePlan(user: {
  plan: PlanTier;
  trialEndsAt?: Date | string | null;
}): PlanTier {
  if (user.trialEndsAt) {
    const expires =
      typeof user.trialEndsAt === "string"
        ? new Date(user.trialEndsAt)
        : user.trialEndsAt;
    if (expires > new Date()) return "pro";
  }
  return user.plan;
}
```

**Step 4: Create trial API route**

Create `apps/api/src/routes/trial.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { userQueries } from "@llm-boost/db";

export const trialRoutes = new Hono<AppEnv>();
trialRoutes.use("*", authMiddleware);

// POST /start — Start 14-day Pro trial
trialRoutes.post("/start", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const user = await userQueries(db).getById(userId);
  if (!user)
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );

  // Guard: one trial per user
  if (user.trialStartedAt) {
    return c.json(
      {
        error: {
          code: "TRIAL_ALREADY_USED",
          message: "You have already used your free trial",
        },
      },
      409,
    );
  }

  // Guard: only free users can start a trial
  if (user.plan !== "free") {
    return c.json(
      {
        error: {
          code: "ALREADY_PAID",
          message: "You already have a paid plan",
        },
      },
      409,
    );
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

  await userQueries(db).update(userId, {
    trialStartedAt: now,
    trialEndsAt: endsAt,
  });

  return c.json({
    data: {
      trialStartedAt: now.toISOString(),
      trialEndsAt: endsAt.toISOString(),
      daysRemaining: 14,
    },
  });
});

// GET /status — Get trial status
trialRoutes.get("/status", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const user = await userQueries(db).getById(userId);
  if (!user)
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );

  if (!user.trialStartedAt) {
    return c.json({ data: { eligible: user.plan === "free", active: false } });
  }

  const endsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const active = endsAt ? endsAt > new Date() : false;
  const daysRemaining = endsAt
    ? Math.max(
        0,
        Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      )
    : 0;

  return c.json({
    data: {
      eligible: false,
      active,
      trialStartedAt: user.trialStartedAt.toISOString(),
      trialEndsAt: endsAt?.toISOString() ?? null,
      daysRemaining,
    },
  });
});
```

**Step 5: Mount route**

In `apps/api/src/index.ts`: `app.route("/api/trial", trialRoutes);`

**Step 6: Update billing service to use trial-aware plan**

In `apps/api/src/services/billing-service.ts`, update `getUsage`:

```typescript
import { resolveEffectivePlan } from "@llm-boost/shared";

// In getUsage:
const effectivePlan = resolveEffectivePlan(user);
const limits = PLAN_LIMITS[effectivePlan];
return {
  plan: user.plan,
  effectivePlan,
  // ... rest stays the same but uses effectivePlan limits
};
```

**Step 7: Create trial banner component**

Create `apps/web/src/components/trial-banner.tsx`:

```tsx
"use client";

import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { useCallback, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function TrialBanner() {
  const { data, mutate } = useApiSWR(
    "trial-status",
    useCallback(() => api.trial.status(), []),
  );
  const [starting, setStarting] = useState(false);

  if (!data?.data) return null;

  const { eligible, active, daysRemaining } = data.data;

  if (active) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>
          Pro Trial: <strong>{daysRemaining} days remaining</strong>
        </span>
        <Link href="/pricing" className="ml-auto">
          <Button size="sm" variant="outline" className="gap-1">
            Subscribe to keep access <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    );
  }

  if (eligible) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Try all Pro features free for 14 days</span>
        <Button
          size="sm"
          className="ml-auto gap-1"
          disabled={starting}
          onClick={async () => {
            setStarting(true);
            try {
              await api.trial.start();
              mutate();
            } finally {
              setStarting(false);
            }
          }}
        >
          {starting ? "Starting..." : "Start Free Trial"}
        </Button>
      </div>
    );
  }

  return null;
}
```

**Step 8: Add API client methods and place banner**

In `apps/web/src/lib/api.ts`:

```typescript
trial: {
  status: () => apiClient.get<{ eligible: boolean; active: boolean; daysRemaining?: number }>("/api/trial/status"),
  start: () => apiClient.post("/api/trial/start", {}),
},
```

In the project page, add `<TrialBanner />` in the header area.

**Step 9: Commit**

```bash
git add packages/db/src/schema.ts packages/shared/src/constants/plans.ts apps/api/src/routes/trial.ts apps/api/src/index.ts apps/api/src/services/billing-service.ts apps/web/src/components/trial-banner.tsx apps/web/src/app/dashboard/projects/\[id\]/page.tsx apps/web/src/lib/api.ts
git commit -m "feat: add 14-day Pro trial with banner and plan resolution"
```

---

## Wave 3: Deeper Work

---

### Task 8: Weekly Email Digest (Frontend Settings)

**Goal:** Wire up the existing digest service to be configurable from the user Settings page.

**Analysis:** `digest-service.ts` already processes weekly/monthly digests. `digestPreferenceQueries` already exist. The `users` table already has `digestFrequency` (default "off") and `digestDay` columns. What's missing is a UI in Settings to toggle preferences.

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/page.tsx` (add digest preferences section)
- Modify: `apps/web/src/lib/api.ts` (add account.updateDigestPreferences if missing)
- Modify: `apps/api/src/routes/account.ts` (add/verify digest preferences endpoint)

**Step 1: Read account route to understand existing endpoints**

Read `apps/api/src/routes/account.ts` to see what endpoints exist for user settings.

**Step 2: Add digest preferences endpoint if missing**

In `apps/api/src/routes/account.ts`, add:

```typescript
// PATCH /digest — Update digest preferences
accountRoutes.patch("/digest", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<{
    digestFrequency?: string;
    digestDay?: number;
  }>();

  await userQueries(db).update(userId, {
    ...(body.digestFrequency !== undefined && {
      digestFrequency: body.digestFrequency,
    }),
    ...(body.digestDay !== undefined && { digestDay: body.digestDay }),
  });

  return c.json({ data: { success: true } });
});
```

**Step 3: Add digest settings UI**

In the Settings page (`apps/web/src/app/dashboard/settings/page.tsx`), add a card:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Email Digest</CardTitle>
    <CardDescription>
      Receive periodic summaries of your project scores and issues.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <Select value={digestFrequency} onValueChange={setDigestFrequency}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="off">Off</SelectItem>
        <SelectItem value="weekly">Weekly (every Monday)</SelectItem>
        <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
      </SelectContent>
    </Select>
    <Button onClick={handleSaveDigest} size="sm">
      Save
    </Button>
  </CardContent>
</Card>
```

**Step 4: Commit**

```bash
git add apps/api/src/routes/account.ts apps/web/src/app/dashboard/settings/page.tsx apps/web/src/lib/api.ts
git commit -m "feat(web): add email digest preferences to settings"
```

---

### Task 9: Platform Optimization Guides

**Goal:** Show per-platform readiness with actionable recommendations.

**Analysis:** `PLATFORM_REQUIREMENTS` exists in `@llm-boost/shared`. The API already has `GET /api/crawls/:id/platform-readiness`. `platformScores` are stored in `pageScores.platformScores`. The `PlatformReadinessMatrix` component already exists. This task adds dedicated guide pages.

**Files:**

- Create: `apps/web/src/app/dashboard/projects/[id]/guides/[platform]/page.tsx`
- Create: `apps/web/src/components/platform-guide.tsx`
- Modify: `apps/web/src/components/platform-readiness-matrix.tsx` (add "View Guide" links)

**Step 1: Create platform guide component**

Create `apps/web/src/components/platform-guide.tsx`:

```tsx
"use client";

import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const PLATFORM_INFO: Record<string, { name: string; description: string }> = {
  chatgpt: {
    name: "ChatGPT",
    description:
      "OpenAI's conversational AI — focuses on structured data, schema markup, and clear content hierarchy.",
  },
  claude: {
    name: "Claude",
    description:
      "Anthropic's assistant — values well-cited, factual content with clear sourcing.",
  },
  perplexity: {
    name: "Perplexity",
    description:
      "AI search engine — prioritizes citable content, freshness, and authoritative sources.",
  },
  gemini: {
    name: "Gemini",
    description:
      "Google's AI — leverages existing SEO signals plus structured data.",
  },
  copilot: {
    name: "Copilot",
    description:
      "Microsoft's AI assistant — uses Bing index signals plus content quality.",
  },
  grok: {
    name: "Grok",
    description:
      "xAI's assistant — values real-time content and direct, clear answers.",
  },
  gemini_ai_mode: {
    name: "Gemini AI Mode",
    description:
      "Google's AI Overview — blends traditional search ranking with AI synthesis.",
  },
};

interface PlatformGuideProps {
  projectId: string;
  platform: string;
  crawlId?: string;
}

export function PlatformGuide({
  projectId,
  platform,
  crawlId,
}: PlatformGuideProps) {
  const { data } = useApiSWR(
    crawlId ? `platform-readiness-${crawlId}` : null,
    useCallback(() => api.crawls.platformReadiness(crawlId!), [crawlId]),
  );

  const info = PLATFORM_INFO[platform];
  const readiness = data?.data?.[platform];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {info?.name ?? platform} Optimization Guide
        </h1>
        <p className="mt-1 text-muted-foreground">{info?.description}</p>
      </div>

      {readiness && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Your {info?.name} Readiness
              <Badge
                variant={
                  readiness.score >= 80
                    ? "success"
                    : readiness.score >= 60
                      ? "warning"
                      : "destructive"
                }
              >
                {readiness.score}/100
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {readiness.checks?.map((check: any, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  {check.pass ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-500" />
                  ) : check.severity === "critical" ? (
                    <XCircle className="mt-0.5 h-4 w-4 text-red-500" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{check.label}</p>
                    {check.recommendation && (
                      <p className="text-xs text-muted-foreground">
                        {check.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Create guide page**

Create `apps/web/src/app/dashboard/projects/[id]/guides/[platform]/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { useProject } from "@/hooks/use-project";
import { PlatformGuide } from "@/components/platform-guide";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PlatformGuidePage() {
  const params = useParams<{ id: string; platform: string }>();
  const { data: project } = useProject(params.id);

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/projects/${params.id}?tab=overview`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Project
      </Link>
      <PlatformGuide
        projectId={params.id}
        platform={params.platform}
        crawlId={project?.latestCrawl?.id}
      />
    </div>
  );
}
```

**Step 3: Add "View Guide" links to PlatformReadinessMatrix**

In `apps/web/src/components/platform-readiness-matrix.tsx`, add Link buttons to each platform card:

```tsx
import Link from "next/link";

// In each platform card:
<Link
  href={`/dashboard/projects/${projectId}/guides/${platform}`}
  className="text-xs text-primary hover:underline"
>
  View Guide →
</Link>;
```

**Step 4: Commit**

```bash
git add apps/web/src/components/platform-guide.tsx "apps/web/src/app/dashboard/projects/[id]/guides/[platform]/page.tsx" apps/web/src/components/platform-readiness-matrix.tsx
git commit -m "feat(web): add platform optimization guide pages"
```

---

### Task 10: Content Gap Analysis

**Goal:** Show what content users are missing vs competitors.

**Files:**

- Create: `apps/api/src/services/content-gap-service.ts`
- Modify: `apps/api/src/routes/competitors.ts` (add gap analysis endpoint)
- Create: `apps/web/src/components/content-gap-analysis.tsx`
- Modify: `apps/web/src/components/tabs/competitors-tab.tsx` (add gap analysis section)
- Modify: `apps/web/src/lib/api.ts` (add gaps method)

**Step 1: Create content gap service**

Create `apps/api/src/services/content-gap-service.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import {
  type Database,
  competitorBenchmarkQueries,
  pageQueries,
  crawlQueries,
} from "@llm-boost/db";

interface ContentGap {
  topic: string;
  competitorDomains: string[];
  suggestedOutline: string[];
  priority: "high" | "medium" | "low";
}

export async function analyzeContentGaps(opts: {
  db: Database;
  projectId: string;
  anthropicApiKey: string;
}): Promise<ContentGap[]> {
  const { db, projectId, anthropicApiKey } = opts;

  // Get user's pages from latest crawl
  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  if (!latestCrawl || latestCrawl.status !== "complete") return [];

  const userPages = await pageQueries(db).listByJob(latestCrawl.id);
  const userTopics = userPages
    .filter((p) => p.title)
    .map((p) => p.title!)
    .slice(0, 50);

  // Get competitor benchmark data
  const benchmarks =
    await competitorBenchmarkQueries(db).listByProject(projectId);
  if (benchmarks.length === 0) return [];

  const competitorDomains = [
    ...new Set(benchmarks.map((b) => b.competitorDomain)),
  ];

  const client = new Anthropic({ apiKey: anthropicApiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyze content gaps. User's page titles:\n${userTopics.join("\n")}\n\nCompetitor domains: ${competitorDomains.join(", ")}\n\nIdentify 3-5 topics competitors likely cover that the user doesn't. For each, provide a topic name, which competitors likely cover it, a 3-bullet suggested outline, and priority (high/medium/low).\n\nRespond as JSON array: [{"topic":"...","competitorDomains":["..."],"suggestedOutline":["..."],"priority":"high|medium|low"}]`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  return JSON.parse(jsonMatch[0]) as ContentGap[];
}
```

**Step 2: Add gap analysis endpoint**

In `apps/api/src/routes/competitors.ts`, add:

```typescript
// GET /gaps?projectId=:id — Content gap analysis
competitorRoutes.get("/gaps", async (c) => {
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId)
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId required" } },
      422,
    );

  // Plan gate: Starter+ only
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user || user.plan === "free") {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: "Content gap analysis requires Starter or higher",
        },
      },
      403,
    );
  }

  const { analyzeContentGaps } =
    await import("../services/content-gap-service");
  const gaps = await analyzeContentGaps({
    db,
    projectId,
    anthropicApiKey: c.env.ANTHROPIC_API_KEY,
  });

  return c.json({ data: gaps });
});
```

**Step 3: Create frontend component**

Create `apps/web/src/components/content-gap-analysis.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, Loader2 } from "lucide-react";

export function ContentGapAnalysis({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const { data, mutate } = useApiSWR(
    `content-gaps-${projectId}`,
    useCallback(() => api.competitors.gaps(projectId), [projectId]),
  );

  const gaps = data?.data ?? [];

  if (gaps.length === 0 && !loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <Lightbulb className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Content Gap Analysis</p>
            <p className="text-xs text-muted-foreground">
              Discover topics your competitors cover that you don't.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLoading(true);
              mutate().finally(() => setLoading(false));
            }}
          >
            {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Analyze Gaps
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Content Gaps ({gaps.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {gaps.map((gap: any, i: number) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">{gap.topic}</span>
              <Badge
                variant={
                  gap.priority === "high"
                    ? "destructive"
                    : gap.priority === "medium"
                      ? "warning"
                      : "secondary"
                }
              >
                {gap.priority}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Covered by: {gap.competitorDomains.join(", ")}
            </p>
            {gap.suggestedOutline?.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {gap.suggestedOutline.map((item: string, j: number) => (
                  <li key={j} className="text-muted-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

**Step 4: Add to Competitors tab**

In `apps/web/src/components/tabs/competitors-tab.tsx`, add the `ContentGapAnalysis` component:

```tsx
import { ContentGapAnalysis } from "@/components/content-gap-analysis";

// After the competitor benchmarks section:
<ContentGapAnalysis projectId={projectId} />;
```

**Step 5: Add API client method**

In `apps/web/src/lib/api.ts`, add to the competitors namespace:

```typescript
gaps: (projectId: string) =>
  apiClient.get<ContentGap[]>(`/api/competitors/gaps?projectId=${projectId}`),
```

**Step 6: Commit**

```bash
git add apps/api/src/services/content-gap-service.ts apps/api/src/routes/competitors.ts apps/web/src/components/content-gap-analysis.tsx apps/web/src/components/tabs/competitors-tab.tsx apps/web/src/lib/api.ts
git commit -m "feat: add content gap analysis with AI-generated outlines"
```

---

## Deployment

After all features are implemented:

1. **Push DB schema changes:** `cd packages/db && npx drizzle-kit push`
2. **Build and typecheck:** `pnpm typecheck && pnpm build`
3. **Deploy API:** `cd apps/api && npx wrangler deploy`
4. **Deploy Web:** `cd apps/web && npx opennextjs-cloudflare build && npx wrangler deploy --config wrangler.jsonc`

---

## Success Verification

| Feature          | How to Verify                                                    |
| ---------------- | ---------------------------------------------------------------- |
| Usage Meter      | Navigate to project page, see crawl usage bar in header          |
| Upgrade Prompts  | Log in as free user, check Issues/Competitors/Visibility tabs    |
| Scheduled Crawls | Go to Settings tab, change crawl schedule, save                  |
| Fix Tracking     | Go to Issues tab, change issue status via dropdown               |
| Score Alerts     | After a crawl with score drop, see alert banner on project page  |
| Crawl Comparison | Go to History tab, select 2 crawls, click Compare                |
| Pro Trial        | As free user, see "Start Free Trial" banner, click to activate   |
| Email Digest     | Go to Settings, change digest to weekly, verify preference saved |
| Platform Guides  | Click "View Guide" on any platform in Platform Readiness matrix  |
| Content Gap      | Go to Competitors tab, click "Analyze Gaps"                      |
