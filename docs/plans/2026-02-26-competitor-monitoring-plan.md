# Competitor Monitoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add continuous competitor monitoring with activity feed, score delta alerts, trend visualization, publishing cadence tracking, and AI visibility watchlist — closing the gap with Semrush EyeOn while staying focused on AI readiness.

**Architecture:** Mirror the existing `scheduledVisibilityChecks` pattern. Weekly cron finds due competitors, dispatches shallow crawls (5-10 pages) to Fly.io, diffs benchmarks against previous snapshots, emits events to the outbox pipeline for notifications. New `competitor_events` table powers an activity feed UI. Watchlist reuses existing visibility check infrastructure.

**Tech Stack:** Drizzle ORM (Neon PG), Hono (Cloudflare Workers), Cloudflare cron triggers, React/Next.js frontend, existing notification pipeline (Resend email + Slack Block Kit)

**Design Doc:** `docs/plans/2026-02-26-competitor-monitoring-design.md`

---

## Phase 1: Database Schema & Queries

### Task 1: Add new enums for competitor monitoring

**Files:**

- Modify: `packages/db/src/schema/enums.ts:108-112` (near `scheduleFrequencyEnum`)

**Step 1: Add the `competitorEventTypeEnum`**

Add after the `scheduleFrequencyEnum` (line 112) in `packages/db/src/schema/enums.ts`:

```ts
export const competitorEventTypeEnum = pgEnum("competitor_event_type", [
  "score_change",
  "score_regression",
  "score_improvement",
  "llms_txt_added",
  "llms_txt_removed",
  "ai_crawlers_blocked",
  "ai_crawlers_unblocked",
  "schema_added",
  "schema_removed",
  "sitemap_added",
  "sitemap_removed",
  "new_pages_detected",
]);

export const monitoringFrequencyEnum = pgEnum("monitoring_frequency", [
  "daily",
  "weekly",
  "monthly",
  "off",
]);
```

**Step 2: Verify typecheck passes**

Run: `pnpm --filter @llm-boost/db exec tsc --noEmit`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add packages/db/src/schema/enums.ts
git commit -m "feat(db): add competitor monitoring enums"
```

---

### Task 2: Extend `competitors` table with monitoring fields

**Files:**

- Modify: `packages/db/src/schema/projects.ts:59-71` (competitors table)

**Step 1: Add monitoring columns to competitors table**

In `packages/db/src/schema/projects.ts`, update the `competitors` table definition. Add the `monitoringFrequencyEnum` import at the top and extend the table:

Add to imports at top of file:

```ts
import { monitoringFrequencyEnum } from "./enums";
```

Replace the `competitors` table (lines 59-71) with:

```ts
export const competitors = pgTable(
  "competitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    source: text("source").notNull().default("user_added"),
    monitoringEnabled: boolean("monitoring_enabled").notNull().default(true),
    monitoringFrequency: monitoringFrequencyEnum("monitoring_frequency")
      .notNull()
      .default("weekly"),
    nextBenchmarkAt: timestamp("next_benchmark_at"),
    lastBenchmarkAt: timestamp("last_benchmark_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_competitors_project").on(t.projectId),
    index("idx_competitors_next_benchmark").on(
      t.nextBenchmarkAt,
      t.monitoringEnabled,
    ),
  ],
);
```

**Step 2: Verify typecheck passes**

Run: `pnpm --filter @llm-boost/db exec tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/db/src/schema/projects.ts
git commit -m "feat(db): extend competitors table with monitoring fields"
```

---

### Task 3: Create `competitor_events` table

**Files:**

- Modify: `packages/db/src/schema/features.ts` (add after `competitorBenchmarks` table, line 65)

**Step 1: Add the competitor_events table definition**

Add import for the new enums at the top of `packages/db/src/schema/features.ts` (line 3):

```ts
import { ..., competitorEventTypeEnum, monitoringFrequencyEnum } from "./enums";
```

Add after the `competitorBenchmarks` table (after line 65):

```ts
export const competitorEvents = pgTable(
  "competitor_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    competitorDomain: text("competitor_domain").notNull(),
    eventType: competitorEventTypeEnum("event_type").notNull(),
    severity: alertSeverityEnum("severity").notNull(),
    summary: text("summary").notNull(),
    data: jsonb("data").default({}),
    benchmarkId: uuid("benchmark_id").references(
      () => competitorBenchmarks.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_competitor_events_feed").on(t.projectId, t.createdAt),
    index("idx_competitor_events_domain").on(
      t.projectId,
      t.competitorDomain,
      t.createdAt,
    ),
  ],
);
```

**Step 2: Verify typecheck passes**

Run: `pnpm --filter @llm-boost/db exec tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/db/src/schema/features.ts
git commit -m "feat(db): add competitor_events table for activity feed"
```

---

### Task 4: Create `competitor_monitoring_schedules` table (Watchlist)

**Files:**

- Modify: `packages/db/src/schema/features.ts` (add after `competitorEvents` table)

**Step 1: Add the watchlist table**

Add after the `competitorEvents` table in `packages/db/src/schema/features.ts`:

```ts
export const competitorMonitoringSchedules = pgTable(
  "competitor_monitoring_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    providers: text("providers").array().notNull(),
    frequency: scheduleFrequencyEnum("frequency").notNull().default("weekly"),
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_comp_mon_schedules_project").on(t.projectId),
    index("idx_comp_mon_schedules_due").on(t.nextRunAt, t.enabled),
  ],
);
```

**Step 2: Verify typecheck passes**

Run: `pnpm --filter @llm-boost/db exec tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/db/src/schema/features.ts
git commit -m "feat(db): add competitor_monitoring_schedules table for watchlist"
```

---

### Task 5: Create DB query functions for competitor events

**Files:**

- Create: `packages/db/src/queries/competitor-events.ts`
- Modify: `packages/db/src/index.ts` (add export)

**Step 1: Write the query module**

Create `packages/db/src/queries/competitor-events.ts`:

```ts
import { eq, and, desc, lte, gte, sql } from "drizzle-orm";
import type { Database } from "../client";
import { competitorEvents } from "../schema";

export function competitorEventQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      competitorDomain: string;
      eventType: string;
      severity: string;
      summary: string;
      data?: Record<string, unknown>;
      benchmarkId?: string;
    }) {
      const [event] = await db
        .insert(competitorEvents)
        .values(data)
        .returning();
      return event;
    },

    async listByProject(
      projectId: string,
      opts: {
        limit?: number;
        offset?: number;
        eventType?: string;
        severity?: string;
        domain?: string;
        since?: Date;
      } = {},
    ) {
      const {
        limit = 20,
        offset = 0,
        eventType,
        severity,
        domain,
        since,
      } = opts;
      const conditions = [eq(competitorEvents.projectId, projectId)];

      if (eventType)
        conditions.push(eq(competitorEvents.eventType, eventType as any));
      if (severity)
        conditions.push(eq(competitorEvents.severity, severity as any));
      if (domain)
        conditions.push(eq(competitorEvents.competitorDomain, domain));
      if (since) conditions.push(gte(competitorEvents.createdAt, since));

      return db.query.competitorEvents.findMany({
        where: and(...conditions),
        orderBy: [desc(competitorEvents.createdAt)],
        limit,
        offset,
      });
    },

    async countByProject(projectId: string) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(competitorEvents)
        .where(eq(competitorEvents.projectId, projectId));
      return result?.count ?? 0;
    },

    async listByDomain(projectId: string, domain: string, limit = 20) {
      return db.query.competitorEvents.findMany({
        where: and(
          eq(competitorEvents.projectId, projectId),
          eq(competitorEvents.competitorDomain, domain),
        ),
        orderBy: [desc(competitorEvents.createdAt)],
        limit,
      });
    },
  };
}
```

**Step 2: Add export to `packages/db/src/index.ts`**

Add after line 16 (`export { competitorBenchmarkQueries }...`):

```ts
export { competitorEventQueries } from "./queries/competitor-events";
```

**Step 3: Verify typecheck passes**

Run: `pnpm --filter @llm-boost/db exec tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/db/src/queries/competitor-events.ts packages/db/src/index.ts
git commit -m "feat(db): add competitor event query functions"
```

---

### Task 6: Create DB query functions for competitor monitoring schedules (Watchlist)

**Files:**

- Create: `packages/db/src/queries/competitor-monitoring-schedules.ts`
- Modify: `packages/db/src/index.ts` (add export)

**Step 1: Write the query module**

Create `packages/db/src/queries/competitor-monitoring-schedules.ts`:

```ts
import { eq, and, desc, lte, sql } from "drizzle-orm";
import type { Database } from "../client";
import { competitorMonitoringSchedules } from "../schema";

export function competitorMonitoringScheduleQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      query: string;
      providers: string[];
      frequency?: string;
      nextRunAt?: Date;
    }) {
      const [schedule] = await db
        .insert(competitorMonitoringSchedules)
        .values({
          ...data,
          nextRunAt: data.nextRunAt ?? new Date(),
        })
        .returning();
      return schedule;
    },

    async listByProject(projectId: string) {
      return db.query.competitorMonitoringSchedules.findMany({
        where: eq(competitorMonitoringSchedules.projectId, projectId),
        orderBy: [desc(competitorMonitoringSchedules.createdAt)],
      });
    },

    async getById(id: string) {
      return db.query.competitorMonitoringSchedules.findFirst({
        where: eq(competitorMonitoringSchedules.id, id),
      });
    },

    async update(
      id: string,
      data: Partial<{
        query: string;
        providers: string[];
        frequency: string;
        enabled: boolean;
        nextRunAt: Date;
        lastRunAt: Date;
      }>,
    ) {
      const [updated] = await db
        .update(competitorMonitoringSchedules)
        .set(data)
        .where(eq(competitorMonitoringSchedules.id, id))
        .returning();
      return updated;
    },

    async delete(id: string) {
      const [deleted] = await db
        .delete(competitorMonitoringSchedules)
        .where(eq(competitorMonitoringSchedules.id, id))
        .returning();
      return deleted;
    },

    async getDueSchedules(now: Date, limit = 10) {
      return db.query.competitorMonitoringSchedules.findMany({
        where: and(
          lte(competitorMonitoringSchedules.nextRunAt, now),
          eq(competitorMonitoringSchedules.enabled, true),
        ),
        limit,
      });
    },

    async countByProject(projectId: string) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(competitorMonitoringSchedules)
        .where(eq(competitorMonitoringSchedules.projectId, projectId));
      return result?.count ?? 0;
    },

    async markRun(id: string, frequency: string) {
      const now = new Date();
      const nextRun = new Date(now);
      if (frequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else if (frequency === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      else nextRun.setHours(nextRun.getHours() + 1); // hourly

      const [updated] = await db
        .update(competitorMonitoringSchedules)
        .set({ lastRunAt: now, nextRunAt: nextRun })
        .where(eq(competitorMonitoringSchedules.id, id))
        .returning();
      return updated;
    },
  };
}
```

**Step 2: Add export to `packages/db/src/index.ts`**

Add after the `competitorEventQueries` export:

```ts
export { competitorMonitoringScheduleQueries } from "./queries/competitor-monitoring-schedules";
```

**Step 3: Extend competitor queries with monitoring helpers**

Add these functions to `packages/db/src/queries/competitors.ts`:

```ts
    async updateMonitoring(id: string, data: {
      monitoringEnabled?: boolean;
      monitoringFrequency?: string;
      nextBenchmarkAt?: Date | null;
      lastBenchmarkAt?: Date | null;
    }) {
      const [updated] = await db
        .update(competitors)
        .set(data)
        .where(eq(competitors.id, id))
        .returning();
      return updated;
    },

    async listDueForBenchmark(now: Date, limit = 20) {
      return db.query.competitors.findMany({
        where: and(
          lte(competitors.nextBenchmarkAt, now),
          eq(competitors.monitoringEnabled, true),
        ),
        limit,
      });
    },
```

You'll need to add `lte, and` imports at the top:

```ts
import { eq, desc, lte, and } from "drizzle-orm";
```

**Step 4: Verify typecheck passes**

Run: `pnpm --filter @llm-boost/db exec tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/db/src/queries/competitor-monitoring-schedules.ts \
  packages/db/src/queries/competitors.ts packages/db/src/index.ts
git commit -m "feat(db): add watchlist schedule queries and competitor monitoring helpers"
```

---

### Task 7: Add plan limits for competitor monitoring

**Files:**

- Modify: `packages/shared/src/constants/plans.ts:10-42` (PlanLimits interface)
- Modify: `packages/shared/src/constants/plans.ts:58-191` (PLAN_LIMITS values)

**Step 1: Extend the PlanLimits interface**

Add after `competitorsPerProject` (line 32) in `packages/shared/src/constants/plans.ts`:

```ts
  competitorMonitoring: boolean;
  competitorMonitoringFrequency: ("weekly" | "daily")[];
  competitorFeedLimit: number;        // max events visible (0 = no access, Infinity = all)
  watchlistQueriesPerProject: number;
  competitorTrendDays: number;
  competitorRebenchmarksPerWeek: number;
```

**Step 2: Add values to each plan tier**

Add these fields to each tier in `PLAN_LIMITS`:

**free (after line 81):**

```ts
    competitorMonitoring: true,
    competitorMonitoringFrequency: ["weekly"],
    competitorFeedLimit: 5,
    watchlistQueriesPerProject: 0,
    competitorTrendDays: 0,
    competitorRebenchmarksPerWeek: 0,
```

Note: free tier `competitorsPerProject` stays 0 — but change it to 1:

```ts
    competitorsPerProject: 1,
```

**starter (after line 114):**

```ts
    competitorMonitoring: true,
    competitorMonitoringFrequency: ["weekly"],
    competitorFeedLimit: Infinity,
    watchlistQueriesPerProject: 3,
    competitorTrendDays: 30,
    competitorRebenchmarksPerWeek: 1,
```

**pro (after line 147):**

```ts
    competitorMonitoring: true,
    competitorMonitoringFrequency: ["weekly"],
    competitorFeedLimit: Infinity,
    watchlistQueriesPerProject: 10,
    competitorTrendDays: 90,
    competitorRebenchmarksPerWeek: 3,
```

**agency (after line 180):**

```ts
    competitorMonitoring: true,
    competitorMonitoringFrequency: ["weekly", "daily"],
    competitorFeedLimit: Infinity,
    watchlistQueriesPerProject: 25,
    competitorTrendDays: 180,
    competitorRebenchmarksPerWeek: Infinity,
```

**Step 3: Verify typecheck passes**

Run: `pnpm --filter @llm-boost/shared exec tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/shared/src/constants/plans.ts
git commit -m "feat(shared): add competitor monitoring plan limits"
```

---

### Task 8: Push schema to Neon and generate migration

**Step 1: Push schema changes to dev database**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Schema changes applied (3 new columns on competitors, 2 new tables, 2 new enums)

**Step 2: Generate migration file for CI**

Run: `cd packages/db && npx drizzle-kit generate`
Expected: New migration SQL file created in `packages/db/migrations/`

**Step 3: Commit migration**

```bash
git add packages/db/migrations/
git commit -m "feat(db): migration for competitor monitoring schema"
```

---

## Phase 2: Monitoring Engine (Core Service)

### Task 9: Create the competitor diff engine

**Files:**

- Create: `apps/api/src/services/competitor-diff-service.ts`

**Step 1: Write the diff service**

This is the core change detection logic. Create `apps/api/src/services/competitor-diff-service.ts`:

```ts
type Benchmark = {
  overallScore: number | null;
  technicalScore: number | null;
  contentScore: number | null;
  aiReadinessScore: number | null;
  performanceScore: number | null;
  llmsTxtScore: number | null;
  robotsTxtScore: number | null;
  sitemapScore: number | null;
  schemaMarkupScore: number | null;
  botAccessScore: number | null;
};

type CompetitorEvent = {
  eventType: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  data: Record<string, unknown>;
};

const SCORE_CHANGE_THRESHOLD = 5;
const REGRESSION_THRESHOLD = 10;
const IMPROVEMENT_THRESHOLD = 10;

export function diffBenchmarks(
  domain: string,
  previous: Benchmark | null,
  current: Benchmark,
): CompetitorEvent[] {
  if (!previous) return [];

  const events: CompetitorEvent[] = [];

  // Overall score regression/improvement
  if (previous.overallScore != null && current.overallScore != null) {
    const delta = current.overallScore - previous.overallScore;
    if (delta <= -REGRESSION_THRESHOLD) {
      events.push({
        eventType: "score_regression",
        severity: "warning",
        summary: `${domain} overall score dropped ${Math.abs(delta).toFixed(0)} points (${previous.overallScore.toFixed(0)} → ${current.overallScore.toFixed(0)})`,
        data: {
          previousScore: previous.overallScore,
          newScore: current.overallScore,
          delta,
        },
      });
    } else if (delta >= IMPROVEMENT_THRESHOLD) {
      events.push({
        eventType: "score_improvement",
        severity: "info",
        summary: `${domain} overall score improved ${delta.toFixed(0)} points (${previous.overallScore.toFixed(0)} → ${current.overallScore.toFixed(0)})`,
        data: {
          previousScore: previous.overallScore,
          newScore: current.overallScore,
          delta,
        },
      });
    }
  }

  // Per-category score changes
  const categories = [
    { key: "technicalScore", label: "Technical" },
    { key: "contentScore", label: "Content" },
    { key: "aiReadinessScore", label: "AI Readiness" },
    { key: "performanceScore", label: "Performance" },
  ] as const;

  for (const { key, label } of categories) {
    const prev = previous[key];
    const curr = current[key];
    if (prev != null && curr != null) {
      const delta = curr - prev;
      if (Math.abs(delta) >= SCORE_CHANGE_THRESHOLD) {
        events.push({
          eventType: "score_change",
          severity: "info",
          summary: `${domain} ${label} score ${delta > 0 ? "improved" : "dropped"} ${Math.abs(delta).toFixed(0)} points (${prev.toFixed(0)} → ${curr.toFixed(0)})`,
          data: { category: key, previousScore: prev, newScore: curr, delta },
        });
      }
    }
  }

  // Binary change detection helpers
  const binaryCheck = (
    prevScore: number | null,
    currScore: number | null,
    addedType: string,
    removedType: string,
    addedSeverity: "critical" | "warning" | "info",
    removedSeverity: "critical" | "warning" | "info",
    label: string,
  ) => {
    const wasPresent = prevScore != null && prevScore > 0;
    const isPresent = currScore != null && currScore > 0;
    if (!wasPresent && isPresent) {
      events.push({
        eventType: addedType,
        severity: addedSeverity,
        summary: `${domain} added ${label}`,
        data: { previousScore: prevScore, newScore: currScore },
      });
    } else if (wasPresent && !isPresent) {
      events.push({
        eventType: removedType,
        severity: removedSeverity,
        summary: `${domain} removed ${label}`,
        data: { previousScore: prevScore, newScore: currScore },
      });
    }
  };

  binaryCheck(
    previous.llmsTxtScore,
    current.llmsTxtScore,
    "llms_txt_added",
    "llms_txt_removed",
    "critical",
    "info",
    "llms.txt",
  );
  binaryCheck(
    previous.botAccessScore,
    current.botAccessScore,
    "ai_crawlers_unblocked",
    "ai_crawlers_blocked",
    "critical",
    "warning",
    "AI crawler access",
  );
  binaryCheck(
    previous.schemaMarkupScore,
    current.schemaMarkupScore,
    "schema_added",
    "schema_removed",
    "info",
    "info",
    "structured data",
  );
  binaryCheck(
    previous.sitemapScore,
    current.sitemapScore,
    "sitemap_added",
    "sitemap_removed",
    "info",
    "info",
    "sitemap",
  );

  return events;
}
```

**Step 2: Verify typecheck passes**

Run: `pnpm --filter api exec tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/api/src/services/competitor-diff-service.ts
git commit -m "feat(api): add competitor benchmark diff engine"
```

---

### Task 10: Write tests for the diff engine

**Files:**

- Create: `apps/api/src/services/competitor-diff-service.test.ts`

**Step 1: Write comprehensive diff tests**

Create `apps/api/src/services/competitor-diff-service.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { diffBenchmarks } from "./competitor-diff-service";

const baseBenchmark = {
  overallScore: 75,
  technicalScore: 80,
  contentScore: 70,
  aiReadinessScore: 65,
  performanceScore: 85,
  llmsTxtScore: 0,
  robotsTxtScore: 50,
  sitemapScore: 80,
  schemaMarkupScore: 60,
  botAccessScore: 0,
};

describe("diffBenchmarks", () => {
  it("returns empty array when no previous benchmark", () => {
    expect(diffBenchmarks("example.com", null, baseBenchmark)).toEqual([]);
  });

  it("returns empty array when scores unchanged", () => {
    expect(diffBenchmarks("example.com", baseBenchmark, baseBenchmark)).toEqual(
      [],
    );
  });

  it("detects overall score regression (> 10 points)", () => {
    const current = { ...baseBenchmark, overallScore: 60 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    const regression = events.find((e) => e.eventType === "score_regression");
    expect(regression).toBeDefined();
    expect(regression!.severity).toBe("warning");
    expect(regression!.data.delta).toBe(-15);
  });

  it("detects overall score improvement (> 10 points)", () => {
    const current = { ...baseBenchmark, overallScore: 90 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    const improvement = events.find((e) => e.eventType === "score_improvement");
    expect(improvement).toBeDefined();
    expect(improvement!.severity).toBe("info");
    expect(improvement!.data.delta).toBe(15);
  });

  it("ignores small overall score changes (< 10 points)", () => {
    const current = { ...baseBenchmark, overallScore: 78 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    expect(
      events.find((e) => e.eventType === "score_regression"),
    ).toBeUndefined();
    expect(
      events.find((e) => e.eventType === "score_improvement"),
    ).toBeUndefined();
  });

  it("detects per-category score change (>= 5 points)", () => {
    const current = { ...baseBenchmark, technicalScore: 72 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    const change = events.find((e) => e.eventType === "score_change");
    expect(change).toBeDefined();
    expect(change!.data.category).toBe("technicalScore");
  });

  it("ignores per-category change < 5 points", () => {
    const current = { ...baseBenchmark, contentScore: 72 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    expect(events.find((e) => e.eventType === "score_change")).toBeUndefined();
  });

  it("detects llms.txt added (critical)", () => {
    const current = { ...baseBenchmark, llmsTxtScore: 85 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    const added = events.find((e) => e.eventType === "llms_txt_added");
    expect(added).toBeDefined();
    expect(added!.severity).toBe("critical");
  });

  it("detects llms.txt removed (info)", () => {
    const previous = { ...baseBenchmark, llmsTxtScore: 85 };
    const current = { ...baseBenchmark, llmsTxtScore: 0 };
    const events = diffBenchmarks("example.com", previous, current);
    const removed = events.find((e) => e.eventType === "llms_txt_removed");
    expect(removed).toBeDefined();
    expect(removed!.severity).toBe("info");
  });

  it("detects AI crawlers unblocked (critical)", () => {
    const current = { ...baseBenchmark, botAccessScore: 90 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    const unblocked = events.find(
      (e) => e.eventType === "ai_crawlers_unblocked",
    );
    expect(unblocked).toBeDefined();
    expect(unblocked!.severity).toBe("critical");
  });

  it("detects AI crawlers blocked (warning)", () => {
    const previous = { ...baseBenchmark, botAccessScore: 90 };
    const current = { ...baseBenchmark, botAccessScore: 0 };
    const events = diffBenchmarks("example.com", previous, current);
    const blocked = events.find((e) => e.eventType === "ai_crawlers_blocked");
    expect(blocked).toBeDefined();
    expect(blocked!.severity).toBe("warning");
  });

  it("detects schema markup added", () => {
    const previous = { ...baseBenchmark, schemaMarkupScore: 0 };
    const current = { ...baseBenchmark, schemaMarkupScore: 70 };
    const events = diffBenchmarks("example.com", previous, current);
    expect(events.find((e) => e.eventType === "schema_added")).toBeDefined();
  });

  it("detects sitemap changes", () => {
    const previous = { ...baseBenchmark, sitemapScore: 0 };
    const current = { ...baseBenchmark, sitemapScore: 90 };
    const events = diffBenchmarks("example.com", previous, current);
    expect(events.find((e) => e.eventType === "sitemap_added")).toBeDefined();
  });

  it("detects multiple events simultaneously", () => {
    const current = {
      ...baseBenchmark,
      overallScore: 50, // -25 regression
      llmsTxtScore: 85, // added
      botAccessScore: 90, // unblocked
    };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    expect(events.length).toBeGreaterThanOrEqual(3);
  });
});
```

**Step 2: Run the tests**

Run: `pnpm --filter api exec vitest run src/services/competitor-diff-service.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add apps/api/src/services/competitor-diff-service.test.ts
git commit -m "test(api): add diff engine tests for competitor change detection"
```

---

### Task 11: Create the competitor monitor service

**Files:**

- Create: `apps/api/src/services/competitor-monitor-service.ts`

**Step 1: Write the monitor service**

Create `apps/api/src/services/competitor-monitor-service.ts`:

```ts
import { diffBenchmarks } from "./competitor-diff-service";

interface CompetitorMonitorDeps {
  competitors: {
    listDueForBenchmark(now: Date, limit?: number): Promise<any[]>;
    updateMonitoring(id: string, data: any): Promise<any>;
  };
  competitorBenchmarks: {
    getLatest(projectId: string, domain: string): Promise<any>;
    create(data: any): Promise<any>;
  };
  competitorEvents: {
    create(data: any): Promise<any>;
  };
  outbox: {
    insert(data: any): Promise<any>;
  };
  benchmarkService: {
    benchmarkCompetitor(args: {
      projectId: string;
      competitorDomain: string;
      competitorLimit: number;
    }): Promise<any>;
  };
}

function computeNextBenchmarkAt(frequency: string): Date {
  const next = new Date();
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next;
}

export function createCompetitorMonitorService(deps: CompetitorMonitorDeps) {
  return {
    async processScheduledBenchmarks() {
      const now = new Date();
      const dueCompetitors = await deps.competitors.listDueForBenchmark(
        now,
        20,
      );

      const results = { processed: 0, events: 0, errors: 0 };

      for (const competitor of dueCompetitors) {
        try {
          // 1. Get previous benchmark
          const previous = await deps.competitorBenchmarks.getLatest(
            competitor.projectId,
            competitor.domain,
          );

          // 2. Run new benchmark
          const benchmark = await deps.benchmarkService.benchmarkCompetitor({
            projectId: competitor.projectId,
            competitorDomain: competitor.domain,
            competitorLimit: Infinity, // system-initiated, skip limit
          });

          // 3. Diff and detect changes
          const events = diffBenchmarks(competitor.domain, previous, benchmark);

          // 4. Store events
          for (const event of events) {
            await deps.competitorEvents.create({
              projectId: competitor.projectId,
              competitorDomain: competitor.domain,
              eventType: event.eventType,
              severity: event.severity,
              summary: event.summary,
              data: event.data,
              benchmarkId: benchmark.id,
            });

            // 5. Emit notification for critical/warning events
            if (event.severity === "critical" || event.severity === "warning") {
              await deps.outbox.insert({
                type: "webhook:alert",
                eventType: `competitor_${event.eventType}`,
                payload: {
                  projectId: competitor.projectId,
                  domain: competitor.domain,
                  ...event,
                },
                projectId: competitor.projectId,
              });
            }

            results.events++;
          }

          // 6. Update monitoring schedule
          await deps.competitors.updateMonitoring(competitor.id, {
            lastBenchmarkAt: now,
            nextBenchmarkAt: computeNextBenchmarkAt(
              competitor.monitoringFrequency,
            ),
          });

          results.processed++;
        } catch (error) {
          console.error(
            `Failed to benchmark competitor ${competitor.domain}:`,
            error,
          );
          results.errors++;
          // Still update nextBenchmarkAt to avoid infinite retry
          await deps.competitors.updateMonitoring(competitor.id, {
            nextBenchmarkAt: computeNextBenchmarkAt(
              competitor.monitoringFrequency,
            ),
          });
        }
      }

      return results;
    },
  };
}
```

**Step 2: Verify typecheck passes**

Run: `pnpm --filter api exec tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/api/src/services/competitor-monitor-service.ts
git commit -m "feat(api): add competitor monitor service for scheduled re-benchmarks"
```

---

### Task 12: Wire cron trigger for competitor monitoring

**Files:**

- Modify: `apps/api/wrangler.toml:55` (add cron)
- Modify: `apps/api/src/index.ts:582-614` (add handler)

**Step 1: Add cron to wrangler.toml**

In `apps/api/wrangler.toml`, update the crons array (line 55) to include the new weekly Sunday 2 AM trigger:

```toml
crons = ["0 0 1 * *", "*/5 * * * *", "*/15 * * * *", "0 3 * * *", "0 4 * * *", "0 9 * * 1", "0 9 1 * *", "0 2 * * 0"]
```

**Step 2: Add the handler in `apps/api/src/index.ts`**

Add a new `processScheduledCompetitorChecks` function before the `scheduled()` handler (around line 575). This wires the monitor service with real DB dependencies:

```ts
async function processScheduledCompetitorChecks(env: Bindings) {
  const db = createDb(env.DATABASE_URL);
  const benchmarkService = createCompetitorBenchmarkService({
    competitorBenchmarks: competitorBenchmarkQueries(db),
    competitors: competitorQueries(db),
  });
  const monitorService = createCompetitorMonitorService({
    competitors: competitorQueries(db),
    competitorBenchmarks: competitorBenchmarkQueries(db),
    competitorEvents: competitorEventQueries(db),
    outbox: outboxQueries(db),
    benchmarkService,
  });

  const results = await monitorService.processScheduledBenchmarks();
  console.log(
    `Competitor monitoring: processed=${results.processed}, events=${results.events}, errors=${results.errors}`,
  );
}
```

Add the import for `competitorEventQueries` and `createCompetitorMonitorService` at the top of the file.

Then in the `scheduled()` handler, add a new else-if before the final `else` block:

```ts
} else if (controller.cron === "0 2 * * 0") {
  await processScheduledCompetitorChecks(env);
} else {
```

**Step 3: Verify typecheck passes**

Run: `pnpm --filter api exec tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/wrangler.toml apps/api/src/index.ts
git commit -m "feat(api): wire weekly competitor monitoring cron trigger"
```

---

## Phase 3: API Routes

### Task 13: Add competitor monitoring settings endpoint

**Files:**

- Modify: `apps/api/src/routes/competitors.ts`

**Step 1: Add PATCH /api/competitors/:id/monitoring route**

Add to `apps/api/src/routes/competitors.ts` after the existing routes:

```ts
competitorRoutes.patch("/:id/monitoring", authMiddleware, async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const { enabled, frequency } = body;

  const db = getDb(c);
  const repo = competitorQueries(db);

  const competitor = await repo.getById(id);
  if (!competitor) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Competitor not found" } },
      404,
    );
  }

  const validFrequencies = ["daily", "weekly", "monthly", "off"];
  if (frequency && !validFrequencies.includes(frequency)) {
    return c.json(
      { error: { code: "INVALID_INPUT", message: "Invalid frequency" } },
      422,
    );
  }

  // Check plan allows daily frequency
  const user = getUser(c);
  const plan = resolveEffectivePlan(user);
  const limits = PLAN_LIMITS[plan];
  if (
    frequency === "daily" &&
    !limits.competitorMonitoringFrequency.includes("daily")
  ) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: "Daily monitoring requires Agency plan",
        },
      },
      403,
    );
  }

  const nextBenchmarkAt =
    frequency === "off"
      ? null
      : computeNextBenchmarkAt(frequency || competitor.monitoringFrequency);

  const updated = await repo.updateMonitoring(id, {
    monitoringEnabled: enabled ?? competitor.monitoringEnabled,
    monitoringFrequency: frequency ?? competitor.monitoringFrequency,
    nextBenchmarkAt,
  });

  return c.json({ data: updated });
});
```

**Step 2: Verify typecheck passes**

Run: `pnpm --filter api exec tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/api/src/routes/competitors.ts
git commit -m "feat(api): add competitor monitoring settings endpoint"
```

---

### Task 14: Add competitor activity feed endpoint

**Files:**

- Modify: `apps/api/src/routes/competitors.ts`

**Step 1: Add GET /api/competitors/feed endpoint**

Add to `apps/api/src/routes/competitors.ts`:

```ts
competitorRoutes.get("/feed", authMiddleware, async (c) => {
  const projectId = c.req.query("projectId");
  if (!projectId) {
    return c.json(
      { error: { code: "INVALID_INPUT", message: "projectId required" } },
      422,
    );
  }

  const user = getUser(c);
  const plan = resolveEffectivePlan(user);
  const limits = PLAN_LIMITS[plan];

  const db = getDb(c);
  const eventRepo = competitorEventQueries(db);

  const limit = Math.min(
    parseInt(c.req.query("limit") || "20"),
    limits.competitorFeedLimit === Infinity ? 100 : limits.competitorFeedLimit,
  );
  const offset = parseInt(c.req.query("offset") || "0");
  const eventType = c.req.query("type") || undefined;
  const severity = c.req.query("severity") || undefined;
  const domain = c.req.query("domain") || undefined;

  const [events, total] = await Promise.all([
    eventRepo.listByProject(projectId, {
      limit,
      offset,
      eventType,
      severity,
      domain,
    }),
    eventRepo.countByProject(projectId),
  ]);

  return c.json({
    data: events,
    total,
    hasMore: offset + limit < total,
  });
});
```

**Step 2: Commit**

```bash
git add apps/api/src/routes/competitors.ts
git commit -m "feat(api): add competitor activity feed endpoint"
```

---

### Task 15: Add competitor trends endpoint

**Files:**

- Modify: `apps/api/src/routes/competitors.ts`

**Step 1: Add GET /api/competitors/trends endpoint**

```ts
competitorRoutes.get("/trends", authMiddleware, async (c) => {
  const projectId = c.req.query("projectId");
  const domain = c.req.query("domain");
  const period = parseInt(c.req.query("period") || "90");

  if (!projectId || !domain) {
    return c.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "projectId and domain required",
        },
      },
      422,
    );
  }

  const user = getUser(c);
  const plan = resolveEffectivePlan(user);
  const limits = PLAN_LIMITS[plan];

  if (limits.competitorTrendDays === 0) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: "Score trends require Starter plan or above",
        },
      },
      403,
    );
  }

  const effectivePeriod = Math.min(period, limits.competitorTrendDays);
  const since = new Date();
  since.setDate(since.getDate() - effectivePeriod);

  const db = getDb(c);
  const benchmarkRepo = competitorBenchmarkQueries(db);
  const all = await benchmarkRepo.listByProject(projectId, 500, 0);

  const filtered = all
    .filter((b) => b.competitorDomain === domain && b.crawledAt >= since)
    .map((b) => ({
      date: b.crawledAt,
      overall: b.overallScore,
      technical: b.technicalScore,
      content: b.contentScore,
      aiReadiness: b.aiReadinessScore,
      performance: b.performanceScore,
    }));

  return c.json({ data: filtered });
});
```

**Step 2: Commit**

```bash
git add apps/api/src/routes/competitors.ts
git commit -m "feat(api): add competitor score trends endpoint"
```

---

### Task 16: Add competitor cadence endpoint

**Files:**

- Modify: `apps/api/src/routes/competitors.ts`

**Step 1: Add GET /api/competitors/cadence endpoint**

```ts
competitorRoutes.get("/cadence", authMiddleware, async (c) => {
  const projectId = c.req.query("projectId");
  if (!projectId) {
    return c.json(
      { error: { code: "INVALID_INPUT", message: "projectId required" } },
      422,
    );
  }

  const db = getDb(c);
  const eventRepo = competitorEventQueries(db);
  const competitorRepo = competitorQueries(db);

  const competitors = await competitorRepo.listByProject(projectId);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const cadenceData = await Promise.all(
    competitors.map(async (comp) => {
      const weekEvents = await eventRepo.listByProject(projectId, {
        domain: comp.domain,
        eventType: "new_pages_detected",
        since: oneWeekAgo,
        limit: 100,
      });
      const monthEvents = await eventRepo.listByProject(projectId, {
        domain: comp.domain,
        eventType: "new_pages_detected",
        since: oneMonthAgo,
        limit: 100,
      });

      return {
        domain: comp.domain,
        newPagesThisWeek: weekEvents.reduce(
          (sum, e) => sum + ((e.data as any)?.count || 0),
          0,
        ),
        newPagesThisMonth: monthEvents.reduce(
          (sum, e) => sum + ((e.data as any)?.count || 0),
          0,
        ),
        trend: weekEvents.length > 0 ? "active" : "quiet",
      };
    }),
  );

  return c.json({ data: cadenceData });
});
```

**Step 2: Commit**

```bash
git add apps/api/src/routes/competitors.ts
git commit -m "feat(api): add competitor publishing cadence endpoint"
```

---

### Task 17: Add watchlist CRUD endpoints

**Files:**

- Create: `apps/api/src/routes/competitor-watchlist.ts`
- Modify: `apps/api/src/index.ts` (register route)

**Step 1: Create the watchlist route file**

Create `apps/api/src/routes/competitor-watchlist.ts`:

```ts
import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authMiddleware, getUser, getDb } from "../middleware";
import { competitorMonitoringScheduleQueries } from "@llm-boost/db";
import { PLAN_LIMITS, resolveEffectivePlan } from "@llm-boost/shared";

export const competitorWatchlistRoutes = new Hono<AppEnv>();

competitorWatchlistRoutes.post("/", authMiddleware, async (c) => {
  const body = await c.req.json();
  const { projectId, query, providers, frequency } = body;

  if (!projectId || !query || !providers?.length) {
    return c.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "projectId, query, and providers required",
        },
      },
      422,
    );
  }

  const user = getUser(c);
  const plan = resolveEffectivePlan(user);
  const limits = PLAN_LIMITS[plan];

  const db = getDb(c);
  const repo = competitorMonitoringScheduleQueries(db);

  const count = await repo.countByProject(projectId);
  if (count >= limits.watchlistQueriesPerProject) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: `Watchlist limit reached (${limits.watchlistQueriesPerProject})`,
        },
      },
      403,
    );
  }

  const schedule = await repo.create({
    projectId,
    query,
    providers,
    frequency: frequency || "weekly",
  });

  return c.json({ data: schedule }, 201);
});

competitorWatchlistRoutes.get("/", authMiddleware, async (c) => {
  const projectId = c.req.query("projectId");
  if (!projectId) {
    return c.json(
      { error: { code: "INVALID_INPUT", message: "projectId required" } },
      422,
    );
  }

  const db = getDb(c);
  const repo = competitorMonitoringScheduleQueries(db);
  const schedules = await repo.listByProject(projectId);

  return c.json({ data: schedules });
});

competitorWatchlistRoutes.patch("/:id", authMiddleware, async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const db = getDb(c);
  const repo = competitorMonitoringScheduleQueries(db);

  const schedule = await repo.getById(id);
  if (!schedule) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Watchlist query not found" } },
      404,
    );
  }

  const updated = await repo.update(id, body);
  return c.json({ data: updated });
});

competitorWatchlistRoutes.delete("/:id", authMiddleware, async (c) => {
  const { id } = c.req.param();
  const db = getDb(c);
  const repo = competitorMonitoringScheduleQueries(db);

  const deleted = await repo.delete(id);
  if (!deleted) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Watchlist query not found" } },
      404,
    );
  }

  return c.json({ data: { deleted: true } });
});
```

**Step 2: Register route in `apps/api/src/index.ts`**

Add near the other route registrations:

```ts
import { competitorWatchlistRoutes } from "./routes/competitor-watchlist";
// ...
app.route("/api/competitors/watchlist", competitorWatchlistRoutes);
```

Note: register this BEFORE the `app.route("/api/competitors", competitorRoutes)` line to avoid path conflicts.

**Step 3: Commit**

```bash
git add apps/api/src/routes/competitor-watchlist.ts apps/api/src/index.ts
git commit -m "feat(api): add watchlist CRUD endpoints"
```

---

### Task 18: Add manual re-benchmark endpoint

**Files:**

- Modify: `apps/api/src/routes/competitors.ts`

**Step 1: Add POST /api/competitors/:id/rebenchmark endpoint**

```ts
competitorRoutes.post("/:id/rebenchmark", authMiddleware, async (c) => {
  const { id } = c.req.param();
  const user = getUser(c);
  const plan = resolveEffectivePlan(user);
  const limits = PLAN_LIMITS[plan];

  if (limits.competitorRebenchmarksPerWeek === 0) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: "Manual re-benchmarks not available on your plan",
        },
      },
      403,
    );
  }

  const db = getDb(c);
  const competitorRepo = competitorQueries(db);
  const competitor = await competitorRepo.getById(id);
  if (!competitor) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Competitor not found" } },
      404,
    );
  }

  // Get previous benchmark for diff
  const benchmarkRepo = competitorBenchmarkQueries(db);
  const previous = await benchmarkRepo.getLatest(
    competitor.projectId,
    competitor.domain,
  );

  // Run benchmark
  const benchmarkService = createCompetitorBenchmarkService({
    competitorBenchmarks: benchmarkRepo,
    competitors: competitorRepo,
  });

  const benchmark = await benchmarkService.benchmarkCompetitor({
    projectId: competitor.projectId,
    competitorDomain: competitor.domain,
    competitorLimit: Infinity,
  });

  // Diff and store events
  const events = diffBenchmarks(competitor.domain, previous, benchmark);
  const eventRepo = competitorEventQueries(db);

  for (const event of events) {
    await eventRepo.create({
      projectId: competitor.projectId,
      competitorDomain: competitor.domain,
      ...event,
      benchmarkId: benchmark.id,
    });
  }

  // Update last benchmark timestamp
  await competitorRepo.updateMonitoring(id, {
    lastBenchmarkAt: new Date(),
  });

  return c.json({ data: { benchmark, events } });
});
```

**Step 2: Commit**

```bash
git add apps/api/src/routes/competitors.ts
git commit -m "feat(api): add manual re-benchmark endpoint"
```

---

## Phase 4: Notifications

### Task 19: Extend notification service with competitor event types

**Files:**

- Modify: `apps/api/src/services/notification-service.ts`

**Step 1: Add competitor events to `formatSlackMessage` (around line 593)**

Add new cases before the `default:` case:

```ts
    case "competitor_score_regression":
      return `*Competitor Score Drop* 📉\n*${data.domain}* dropped ${Math.abs(data.delta).toFixed(0)} points (${data.previousScore} → ${data.newScore})`;
    case "competitor_score_improvement":
      return `*Competitor Score Jump* 📈\n*${data.domain}* improved ${data.delta.toFixed(0)} points (${data.previousScore} → ${data.newScore})`;
    case "competitor_llms_txt_added":
      return `*Competitor Alert* 🚨\n*${data.domain}* added llms.txt — they're optimizing for AI visibility`;
    case "competitor_ai_crawlers_unblocked":
      return `*Competitor Alert* 🚨\n*${data.domain}* unblocked AI crawlers — they're opening up to AI`;
    case "competitor_ai_crawlers_blocked":
      return `*Competitor Alert* ⚠️\n*${data.domain}* blocked AI crawlers`;
    case "competitor_schema_added":
      return `*Competitor Update* ℹ️\n*${data.domain}* added structured data markup`;
    case "competitor_new_pages_detected":
      return `*Competitor Content* 📄\n*${data.domain}* published ${data.count} new page(s)`;
```

**Step 2: Add competitor email subjects to `getSubject` (around line 425)**

Add before the final `return`:

```ts
if (type.includes("competitor_score_regression"))
  return "📉 Competitor Alert: Score Drop Detected";
if (type.includes("competitor_score_improvement"))
  return "📈 Competitor Alert: Score Improvement Detected";
if (type.includes("competitor_llms_txt"))
  return "🚨 Competitor Alert: AI Readiness Change";
if (type.includes("competitor_ai_crawlers"))
  return "🚨 Competitor Alert: Crawler Access Changed";
if (type.startsWith("competitor_")) return "🔍 Competitor Activity Update";
```

**Step 3: Add competitor_alert email template in `renderTemplate` (around line 487)**

Add a new case for `competitor_alert`:

```ts
if (type.startsWith("competitor_")) {
  return `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Competitor Activity Detected</h2>
        <div style="background: #f8f9fa; border-left: 4px solid ${data.severity === "critical" ? "#ef4444" : data.severity === "warning" ? "#f59e0b" : "#3b82f6"}; padding: 16px; margin: 16px 0; border-radius: 4px;">
          <strong>${data.domain}</strong>
          <p style="margin: 8px 0 0;">${data.summary}</p>
        </div>
        ${
          data.previousScore != null
            ? `
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Previous Score</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${data.previousScore}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Current Score</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${data.newScore}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Change</td><td style="padding: 8px; text-align: right; color: ${data.delta > 0 ? "#22c55e" : "#ef4444"}; font-weight: bold;">${data.delta > 0 ? "+" : ""}${data.delta.toFixed(0)}</td></tr>
        </table>`
            : ""
        }
        <a href="https://app.llmrank.com/dashboard/projects/${data.projectId}?tab=competitors" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Activity Feed →</a>
      </div>`;
}
```

**Step 4: Commit**

```bash
git add apps/api/src/services/notification-service.ts
git commit -m "feat(api): add competitor event types to notification pipeline"
```

---

## Phase 5: Frontend API Client

### Task 20: Add competitor monitoring API calls to frontend client

**Files:**

- Modify: `apps/web/src/lib/api.ts` (extend `api.benchmarks` or add new `api.competitorMonitoring` group)

**Step 1: Add new API client methods**

Add a new `competitorMonitoring` section to the API client in `apps/web/src/lib/api.ts` (near the existing `benchmarks` group around line 3247):

```ts
  competitorMonitoring: {
    async getFeed(projectId: string, opts?: {
      limit?: number;
      offset?: number;
      type?: string;
      severity?: string;
      domain?: string;
    }) {
      const params = new URLSearchParams({ projectId });
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.offset) params.set("offset", String(opts.offset));
      if (opts?.type) params.set("type", opts.type);
      if (opts?.severity) params.set("severity", opts.severity);
      if (opts?.domain) params.set("domain", opts.domain);
      return fetchApi(`/api/competitors/feed?${params}`);
    },

    async getTrends(projectId: string, domain: string, period = 90) {
      const params = new URLSearchParams({ projectId, domain, period: String(period) });
      return fetchApi(`/api/competitors/trends?${params}`);
    },

    async getCadence(projectId: string) {
      return fetchApi(`/api/competitors/cadence?projectId=${projectId}`);
    },

    async updateMonitoring(competitorId: string, data: { enabled?: boolean; frequency?: string }) {
      return fetchApi(`/api/competitors/${competitorId}/monitoring`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },

    async rebenchmark(competitorId: string) {
      return fetchApi(`/api/competitors/${competitorId}/rebenchmark`, {
        method: "POST",
      });
    },

    // Watchlist
    async createWatchlistQuery(data: { projectId: string; query: string; providers: string[]; frequency?: string }) {
      return fetchApi("/api/competitors/watchlist", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    async getWatchlist(projectId: string) {
      return fetchApi(`/api/competitors/watchlist?projectId=${projectId}`);
    },

    async updateWatchlistQuery(id: string, data: { query?: string; providers?: string[]; frequency?: string; enabled?: boolean }) {
      return fetchApi(`/api/competitors/watchlist/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },

    async deleteWatchlistQuery(id: string) {
      return fetchApi(`/api/competitors/watchlist/${id}`, {
        method: "DELETE",
      });
    },
  },
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add competitor monitoring API client methods"
```

---

## Phase 6: Frontend — Enhanced Competitors Tab

### Task 21: Refactor competitors tab with sub-navigation

**Files:**

- Modify: `apps/web/src/components/tabs/competitors-tab.tsx`

**Step 1: Read the current competitors-tab.tsx to understand its structure**

Run: Read the file to understand what exists.

**Step 2: Add sub-tab navigation**

Add a tab bar at the top of the competitors tab with three views: **Benchmark** (existing content), **Activity Feed** (new), **Trends** (new). Use a `useState` to track the active sub-tab.

Wrap existing content in a conditional render for the "benchmark" sub-tab. Add skeleton components for the other two tabs.

Enhance the benchmark view with:

- Score delta badges next to each competitor score
- "Last checked" relative timestamp
- Monitoring toggle switch per competitor
- "Re-benchmark now" button

**Step 3: Commit**

```bash
git add apps/web/src/components/tabs/competitors-tab.tsx
git commit -m "feat(web): add sub-navigation to competitors tab"
```

---

### Task 22: Build the activity feed component

**Files:**

- Create: `apps/web/src/components/competitors/activity-feed.tsx`

**Step 1: Build the activity feed timeline**

Create a component that:

- Fetches events from `/api/competitors/feed`
- Renders a vertical timeline with event cards
- Each card shows: competitor domain, severity-colored icon, summary text, relative timestamp
- Filter chips at the top: All | Critical | Score Changes | AI Readiness | New Content
- Domain filter dropdown
- Pagination (load more button)
- Free tier: show last 5 events + upgrade CTA at bottom

Use the existing UI patterns from the project (shadcn/ui components like Card, Badge, Button).

**Step 2: Commit**

```bash
git add apps/web/src/components/competitors/activity-feed.tsx
git commit -m "feat(web): add competitor activity feed timeline component"
```

---

### Task 23: Build the trends view component

**Files:**

- Create: `apps/web/src/components/competitors/trends-view.tsx`

**Step 1: Build the trends chart view**

Create a component that:

- Fetches score trend data from `/api/competitors/trends`
- Renders a line chart (use recharts — already in project dependencies) with one line per competitor
- Category selector buttons: Overall / Technical / Content / AI Readiness / Performance
- Period selector: 30d / 90d / 180d
- Toggleable legend to show/hide individual competitors
- Publishing cadence section below: bar chart from `/api/competitors/cadence`
- Plan-gated with upgrade CTA for Free tier

**Step 2: Commit**

```bash
git add apps/web/src/components/competitors/trends-view.tsx
git commit -m "feat(web): add competitor trends and cadence view"
```

---

### Task 24: Build the watchlist UI in Visibility tab

**Files:**

- Modify: `apps/web/src/components/tabs/visibility-tab.tsx`
- Create: `apps/web/src/components/competitors/watchlist-section.tsx`

**Step 1: Create the watchlist section component**

Create a component that:

- Lists existing watchlist queries with provider badges, frequency, last run timestamp
- "Add Query" form: text input + multi-select providers + frequency dropdown
- Enable/disable toggle per query
- Delete button per query
- Plan-gated: show limit and upgrade CTA when at capacity

**Step 2: Add the watchlist section to the visibility tab**

Add the `<WatchlistSection>` component at the bottom of the visibility tab.

**Step 3: Commit**

```bash
git add apps/web/src/components/competitors/watchlist-section.tsx \
  apps/web/src/components/tabs/visibility-tab.tsx
git commit -m "feat(web): add watchlist section to visibility tab"
```

---

## Phase 7: Testing & Polish

### Task 25: Write integration tests for competitor monitoring flow

**Files:**

- Create: `apps/api/src/services/competitor-monitor-service.test.ts`

**Step 1: Write tests for the full monitoring flow**

Test the `processScheduledBenchmarks` function with:

- Test: processes due competitors and creates benchmark + events
- Test: handles benchmark service failure gracefully (still advances nextBenchmarkAt)
- Test: emits outbox events for critical/warning severity
- Test: skips competitors where monitoringEnabled is false
- Test: respects batch limit of 20

Use real dependency injection (not mocks — per project testing policy). If real DB access is not available in test env, use test doubles that implement the interface.

**Step 2: Run tests**

Run: `pnpm --filter api exec vitest run src/services/competitor-monitor-service.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/api/src/services/competitor-monitor-service.test.ts
git commit -m "test(api): add competitor monitoring integration tests"
```

---

### Task 26: Run full typecheck and test suite

**Step 1: Typecheck all packages**

Run: `pnpm typecheck`
Expected: PASS for all packages

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All existing tests still pass + new tests pass

**Step 3: Fix any issues and commit**

---

### Task 27: Final cleanup commit

Review all changes, ensure no unused imports, no debug console.logs (except in the cron handler), and consistent code style.

```bash
git add -A
git commit -m "chore: clean up competitor monitoring implementation"
```

---

## Summary

| Phase                  | Tasks | New Files | Modified Files |
| ---------------------- | ----- | --------- | -------------- |
| 1. Schema & Queries    | 1-8   | 2         | 5              |
| 2. Monitoring Engine   | 9-12  | 3         | 2              |
| 3. API Routes          | 13-18 | 1         | 2              |
| 4. Notifications       | 19    | 0         | 1              |
| 5. Frontend API Client | 20    | 0         | 1              |
| 6. Frontend UI         | 21-24 | 3         | 2              |
| 7. Testing & Polish    | 25-27 | 1         | 0              |

**Total: 27 tasks across 7 phases**
