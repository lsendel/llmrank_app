# Platform Growth Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship 5 features in one release: scheduled visibility checks, webhook/Slack notification channels, public scan persistence with lead funnel, read-only API tokens, and PostHog telemetry.

**Architecture:** Shared Bus — extend the existing `outbox_events` table as an internal event router. All features emit/consume events through this bus. A Cloudflare Cron Worker drives scheduled visibility checks. PostHog handles product analytics.

**Tech Stack:** Hono (API), Drizzle ORM + Neon PG (DB), PostHog (telemetry), Better Auth + custom token middleware (API auth), Vitest (tests)

**Design Doc:** `docs/plans/2026-02-15-platform-growth-features-design.md`

---

## DDD & Clean Code Principles

Every task in this plan MUST follow these principles. The implementing engineer should treat these as hard constraints, not suggestions.

### Domain-Driven Design

1. **Rich domain types over primitives.** Don't pass raw strings for IDs, tokens, or scopes. Define branded types or value objects (e.g., `TokenHash`, `ChannelType`, `Scope`) so the type system prevents misuse.
2. **Service layer = domain logic only.** Services orchestrate domain rules (plan enforcement, delta detection, token lifecycle). No HTTP concerns, no DB imports — services receive repository interfaces via dependency injection.
3. **Repository pattern enforced.** All DB access goes through typed repository interfaces in `apps/api/src/repositories/`. Query modules in `packages/db/src/queries/` implement these interfaces. Services never import `drizzle-orm` directly.
4. **Aggregate boundaries.** Each feature has a clear aggregate root:
   - Notification channels: `NotificationChannel` (owned by User)
   - Scheduled queries: `ScheduledVisibilityQuery` (owned by Project)
   - Scan results: `ScanResult` (standalone, linked to Lead)
   - API tokens: `ApiToken` (owned by User, scoped to Project)
5. **Domain events over direct coupling.** When a visibility check detects a position change, it emits a domain event (`mention_lost`, `position_changed`) to the outbox — NOT directly call the notification service. The notification service subscribes to events.

### Clean Code

1. **Single Responsibility.** Each file does one thing. A service file contains one service. A route file handles routes for one resource. No god files.
2. **Explicit over implicit.** Function parameters and return types are always typed. No `any` in service or domain code. Use `unknown` + type narrowing when handling external data (webhook payloads, LLM responses).
3. **Error handling at boundaries.** Services throw typed `ServiceError` with error codes. Routes catch and format. Don't suppress errors — let them propagate.
4. **Test-first for domain logic.** Every service method gets a failing test before implementation. Tests verify behavior, not implementation details.
5. **No dead code.** If you replace `webhookUrl` with notification channels, remove the old field. Don't leave commented-out code or unused imports.
6. **Small functions.** If a function exceeds ~20 lines, extract a well-named helper. The cron handler should read like a high-level description of what it does.

### Naming Conventions

- Services: `createXxxService(deps)` — factory function returning service object
- Queries: `xxxQueries(db)` — factory function returning query object
- Routes: `xxxRoutes` — Hono router instance
- Types: PascalCase for interfaces/types, camelCase for values
- Events: `noun.verb.past_tense` (e.g., `visibility.check.completed`, `mention.lost`)

---

## Implementation Order

1. Schema + plan limits (foundation for everything)
2. Telemetry (PostHog) — independent, quick win, measures adoption of all other features
3. Notification channels — needed before scheduled visibility
4. Public scan persistence + lead funnel
5. Scheduled visibility checks
6. Read-only API tokens

---

## Task 1: Schema — New Enums and Tables

**Files:**

- Modify: `packages/db/src/schema.ts` (add enums at ~line 86, tables after line 648)
- Modify: `packages/db/src/index.ts` (export new tables)

**Step 1: Add new enums after existing enums (line ~86)**

```typescript
// After integrationProviderEnum (line 79-86)

export const channelTypeEnum = pgEnum("channel_type", [
  "email",
  "webhook",
  "slack_incoming",
  "slack_app",
]);

export const scheduleFrequencyEnum = pgEnum("schedule_frequency", [
  "hourly",
  "daily",
  "weekly",
]);
```

**Step 2: Add `notification_channels` table after `leads` table (line ~648)**

```typescript
export const notificationChannels = pgTable(
  "notification_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    channelType: channelTypeEnum("channel_type").notNull(),
    config: jsonb("config").notNull().default({}),
    eventTypes: text("event_types").array().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_notif_channels_user").on(t.userId)],
);
```

**Step 3: Add `scheduled_visibility_queries` table**

```typescript
export const scheduledVisibilityQueries = pgTable(
  "scheduled_visibility_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    providers: text("providers").array().notNull(),
    frequency: scheduleFrequencyEnum("frequency").notNull(),
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_sched_vis_project").on(t.projectId),
    index("idx_sched_vis_next_run").on(t.nextRunAt, t.enabled),
  ],
);
```

**Step 4: Add `scan_results` table**

```typescript
export const scanResults = pgTable("scan_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: text("domain").notNull(),
  url: text("url").notNull(),
  scores: jsonb("scores").notNull(),
  issues: jsonb("issues").notNull(),
  quickWins: jsonb("quick_wins").notNull(),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});
```

**Step 5: Add `api_tokens` table**

```typescript
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    scopes: text("scopes").array().notNull(),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_api_tokens_user").on(t.userId),
    index("idx_api_tokens_hash").on(t.tokenHash),
  ],
);
```

**Step 6: Modify `outbox_events` table (line 539-552) — add columns**

Add these fields to the existing `outbox_events` table definition:

```typescript
eventType: text("event_type"),
projectId: uuid("project_id"),
userId: uuid("user_id"),
```

**Step 7: Modify `leads` table (line 642-648) — add columns**

Add these fields to the existing `leads` table:

```typescript
scanResultId: uuid("scan_result_id"),
convertedAt: timestamp("converted_at"),
projectId: uuid("project_id"),
```

**Step 8: Export new tables from `packages/db/src/index.ts`**

Add exports for: `notificationChannels`, `scheduledVisibilityQueries`, `scanResults`, `apiTokens`, `channelTypeEnum`, `scheduleFrequencyEnum`

**Step 9: Push schema to dev DB**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Tables created, columns added

**Step 10: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/index.ts
git commit -m "feat(db): add schema for notification channels, scheduled queries, scan results, API tokens"
```

---

## Task 2: Plan Limits — Add New Feature Gates

**Files:**

- Modify: `packages/shared/src/constants/plans.ts` (add limits at ~lines 17-21 and 37/55/73/91)
- Test: `packages/shared/src/__tests__/plans.test.ts` (if exists, else create)

**Step 1: Add new fields to `PlanLimits` interface (~line 17)**

```typescript
// Add after existing fields in PlanLimits interface:
scheduledQueries: number;
notificationChannels: number;
apiTokens: number;
apiRateLimit: number; // requests per minute
```

**Step 2: Update `PLAN_LIMITS` values for each tier**

Free (~line 37):

```typescript
scheduledQueries: 0,
notificationChannels: 1, // email only
apiTokens: 0,
apiRateLimit: 0,
```

Starter (~line 55):

```typescript
scheduledQueries: 5,
notificationChannels: 2, // email + 1 webhook
apiTokens: 0,
apiRateLimit: 100,
```

Pro (~line 73):

```typescript
scheduledQueries: 25,
notificationChannels: 999, // unlimited
apiTokens: 3,
apiRateLimit: 500,
```

Agency (~line 91):

```typescript
scheduledQueries: 100,
notificationChannels: 999, // unlimited
apiTokens: 10,
apiRateLimit: 2000,
```

**Step 3: Write test for new plan limits**

```typescript
describe("new plan limits", () => {
  it("free tier has no scheduled queries or API tokens", () => {
    expect(PLAN_LIMITS.free.scheduledQueries).toBe(0);
    expect(PLAN_LIMITS.free.apiTokens).toBe(0);
    expect(PLAN_LIMITS.free.notificationChannels).toBe(1);
  });

  it("starter allows scheduled queries but no API tokens", () => {
    expect(PLAN_LIMITS.starter.scheduledQueries).toBe(5);
    expect(PLAN_LIMITS.starter.apiTokens).toBe(0);
  });

  it("pro allows API tokens", () => {
    expect(PLAN_LIMITS.pro.apiTokens).toBe(3);
    expect(PLAN_LIMITS.pro.apiRateLimit).toBe(500);
  });

  it("agency has highest limits", () => {
    expect(PLAN_LIMITS.agency.scheduledQueries).toBe(100);
    expect(PLAN_LIMITS.agency.apiTokens).toBe(10);
    expect(PLAN_LIMITS.agency.apiRateLimit).toBe(2000);
  });
});
```

**Step 4: Run tests**

Run: `pnpm --filter @llm-boost/shared test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add plan limits for scheduled queries, notification channels, API tokens"
```

---

## Task 3: DB Queries — Notification Channels CRUD

**Files:**

- Create: `packages/db/src/queries/notification-channels.ts`
- Modify: `packages/db/src/index.ts` (export)

**Step 1: Write query module following existing pattern (see `queries/leads.ts`)**

```typescript
import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import { notificationChannels } from "../schema";

export function notificationChannelQueries(db: Database) {
  return {
    async create(data: {
      userId: string;
      projectId?: string;
      channelType: "email" | "webhook" | "slack_incoming" | "slack_app";
      config: Record<string, unknown>;
      eventTypes: string[];
    }) {
      const [channel] = await db
        .insert(notificationChannels)
        .values({
          userId: data.userId,
          projectId: data.projectId ?? null,
          channelType: data.channelType,
          config: data.config,
          eventTypes: data.eventTypes,
        })
        .returning();
      return channel;
    },

    async listByUser(userId: string) {
      return db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.userId, userId))
        .orderBy(notificationChannels.createdAt);
    },

    async getById(id: string) {
      const [channel] = await db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.id, id));
      return channel ?? null;
    },

    async update(
      id: string,
      data: Partial<{
        config: Record<string, unknown>;
        eventTypes: string[];
        enabled: boolean;
      }>,
    ) {
      const [updated] = await db
        .update(notificationChannels)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationChannels.id, id))
        .returning();
      return updated ?? null;
    },

    async delete(id: string) {
      await db
        .delete(notificationChannels)
        .where(eq(notificationChannels.id, id));
    },

    async countByUser(userId: string) {
      const rows = await db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.userId, userId));
      return rows.length;
    },

    async findByEventType(
      userId: string,
      eventType: string,
      projectId?: string,
    ) {
      const rows = await this.listByUser(userId);
      return rows.filter(
        (ch) =>
          ch.enabled &&
          ch.eventTypes.includes(eventType) &&
          (!ch.projectId || ch.projectId === projectId),
      );
    },
  };
}
```

**Step 2: Export from `packages/db/src/index.ts`**

```typescript
export { notificationChannelQueries } from "./queries/notification-channels";
```

**Step 3: Commit**

```bash
git add packages/db/src/queries/notification-channels.ts packages/db/src/index.ts
git commit -m "feat(db): add notification channels query module"
```

---

## Task 4: DB Queries — Scheduled Visibility Queries CRUD

**Files:**

- Create: `packages/db/src/queries/scheduled-visibility.ts`
- Modify: `packages/db/src/index.ts` (export)

**Step 1: Write query module**

```typescript
import { and, eq, lte } from "drizzle-orm";
import type { Database } from "../client";
import { scheduledVisibilityQueries } from "../schema";

export function scheduledVisibilityQueries_q(db: Database) {
  return {
    async create(data: {
      projectId: string;
      query: string;
      providers: string[];
      frequency: "hourly" | "daily" | "weekly";
    }) {
      const nextRunAt = computeNextRun(data.frequency);
      const [row] = await db
        .insert(scheduledVisibilityQueries)
        .values({ ...data, nextRunAt })
        .returning();
      return row;
    },

    async listByProject(projectId: string) {
      return db
        .select()
        .from(scheduledVisibilityQueries)
        .where(eq(scheduledVisibilityQueries.projectId, projectId))
        .orderBy(scheduledVisibilityQueries.createdAt);
    },

    async getById(id: string) {
      const [row] = await db
        .select()
        .from(scheduledVisibilityQueries)
        .where(eq(scheduledVisibilityQueries.id, id));
      return row ?? null;
    },

    async update(
      id: string,
      data: Partial<{
        query: string;
        providers: string[];
        frequency: "hourly" | "daily" | "weekly";
        enabled: boolean;
      }>,
    ) {
      const updates: Record<string, unknown> = { ...data };
      if (data.frequency) {
        updates.nextRunAt = computeNextRun(data.frequency);
      }
      const [updated] = await db
        .update(scheduledVisibilityQueries)
        .set(updates)
        .where(eq(scheduledVisibilityQueries.id, id))
        .returning();
      return updated ?? null;
    },

    async delete(id: string) {
      await db
        .delete(scheduledVisibilityQueries)
        .where(eq(scheduledVisibilityQueries.id, id));
    },

    async getDueQueries(now: Date) {
      return db
        .select()
        .from(scheduledVisibilityQueries)
        .where(
          and(
            lte(scheduledVisibilityQueries.nextRunAt, now),
            eq(scheduledVisibilityQueries.enabled, true),
          ),
        )
        .limit(50);
    },

    async markRun(id: string, frequency: "hourly" | "daily" | "weekly") {
      const now = new Date();
      const [updated] = await db
        .update(scheduledVisibilityQueries)
        .set({
          lastRunAt: now,
          nextRunAt: computeNextRun(frequency, now),
        })
        .where(eq(scheduledVisibilityQueries.id, id))
        .returning();
      return updated ?? null;
    },

    async countByProject(projectId: string) {
      const rows = await db
        .select()
        .from(scheduledVisibilityQueries)
        .where(eq(scheduledVisibilityQueries.projectId, projectId));
      return rows.length;
    },
  };
}

function computeNextRun(
  frequency: "hourly" | "daily" | "weekly",
  from: Date = new Date(),
): Date {
  const next = new Date(from);
  switch (frequency) {
    case "hourly":
      next.setHours(next.getHours() + 1);
      break;
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
  }
  return next;
}
```

**Step 2: Export from `packages/db/src/index.ts`**

**Step 3: Commit**

```bash
git add packages/db/src/queries/scheduled-visibility.ts packages/db/src/index.ts
git commit -m "feat(db): add scheduled visibility queries CRUD"
```

---

## Task 5: DB Queries — Scan Results and API Tokens

**Files:**

- Create: `packages/db/src/queries/scan-results.ts`
- Create: `packages/db/src/queries/api-tokens.ts`
- Modify: `packages/db/src/queries/leads.ts` (update for new columns)
- Modify: `packages/db/src/index.ts` (exports)

**Step 1: Write `scan-results.ts`**

```typescript
import { eq, lt } from "drizzle-orm";
import type { Database } from "../client";
import { scanResults } from "../schema";

export function scanResultQueries(db: Database) {
  return {
    async create(data: {
      domain: string;
      url: string;
      scores: Record<string, unknown>;
      issues: unknown[];
      quickWins: unknown[];
      ipHash?: string;
    }) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const [row] = await db
        .insert(scanResults)
        .values({ ...data, expiresAt })
        .returning();
      return row;
    },

    async getById(id: string) {
      const [row] = await db
        .select()
        .from(scanResults)
        .where(eq(scanResults.id, id));
      return row ?? null;
    },

    async deleteExpired() {
      const result = await db
        .delete(scanResults)
        .where(lt(scanResults.expiresAt, new Date()))
        .returning({ id: scanResults.id });
      return result.length;
    },
  };
}
```

**Step 2: Write `api-tokens.ts`**

```typescript
import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../client";
import { apiTokens } from "../schema";

export function apiTokenQueries(db: Database) {
  return {
    async create(data: {
      userId: string;
      projectId: string;
      name: string;
      tokenHash: string;
      tokenPrefix: string;
      scopes: string[];
      expiresAt?: Date;
    }) {
      const [token] = await db.insert(apiTokens).values(data).returning();
      return token;
    },

    async findByHash(tokenHash: string) {
      const [token] = await db
        .select()
        .from(apiTokens)
        .where(
          and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt)),
        );
      if (!token) return null;
      if (token.expiresAt && token.expiresAt < new Date()) return null;
      return token;
    },

    async listByUser(userId: string) {
      return db
        .select({
          id: apiTokens.id,
          name: apiTokens.name,
          tokenPrefix: apiTokens.tokenPrefix,
          scopes: apiTokens.scopes,
          projectId: apiTokens.projectId,
          lastUsedAt: apiTokens.lastUsedAt,
          expiresAt: apiTokens.expiresAt,
          revokedAt: apiTokens.revokedAt,
          createdAt: apiTokens.createdAt,
        })
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId))
        .orderBy(apiTokens.createdAt);
    },

    async revoke(id: string) {
      const [token] = await db
        .update(apiTokens)
        .set({ revokedAt: new Date() })
        .where(eq(apiTokens.id, id))
        .returning();
      return token ?? null;
    },

    async updateLastUsed(id: string) {
      await db
        .update(apiTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiTokens.id, id));
    },

    async countByUser(userId: string) {
      const rows = await db
        .select()
        .from(apiTokens)
        .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));
      return rows.length;
    },
  };
}
```

**Step 3: Update `leads.ts` — add new fields to create method and add `findByEmail`**

Add to existing query object:

```typescript
async findByEmail(email: string) {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.email, email))
    .orderBy(leads.createdAt);
  return lead ?? null;
},

async markConverted(id: string, projectId: string) {
  const [updated] = await db
    .update(leads)
    .set({ convertedAt: new Date(), projectId })
    .where(eq(leads.id, id))
    .returning();
  return updated ?? null;
},
```

Update `create` to accept `scanResultId`:

```typescript
async create(data: {
  email: string;
  reportToken?: string;
  source?: string;
  scanResultId?: string;
}) {
  // add scanResultId: data.scanResultId ?? null to values
}
```

**Step 4: Export all from `packages/db/src/index.ts`**

**Step 5: Commit**

```bash
git add packages/db/src/queries/scan-results.ts packages/db/src/queries/api-tokens.ts packages/db/src/queries/leads.ts packages/db/src/index.ts
git commit -m "feat(db): add scan results, API tokens, and lead conversion queries"
```

---

## Task 6: Telemetry — PostHog Setup

**Files:**

- Create: `apps/web/src/lib/telemetry.ts`
- Create: `apps/web/src/components/posthog-provider.tsx`
- Modify: `apps/web/src/app/layout.tsx` (wrap with PostHog provider)
- Modify: `apps/web/package.json` (add dependency)

**Step 1: Install PostHog**

Run: `pnpm --filter @llm-boost/web add posthog-js`

**Step 2: Create telemetry helper (`apps/web/src/lib/telemetry.ts`)**

```typescript
import posthog from "posthog-js";

let initialized = false;

export function initTelemetry(apiKey: string, apiHost?: string) {
  if (initialized || typeof window === "undefined") return;
  posthog.init(apiKey, {
    api_host: apiHost ?? "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    loaded: () => {
      initialized = true;
    },
  });
}

export function identify(
  userId: string,
  traits: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  posthog.identify(userId, traits);
}

export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}

export function page(name: string): void {
  if (typeof window === "undefined") return;
  posthog.capture("$pageview", { page_name: name });
}

export function reset(): void {
  if (typeof window === "undefined") return;
  posthog.reset();
}
```

**Step 3: Create PostHog provider component**

```typescript
"use client";

import { useEffect } from "react";
import { initTelemetry } from "@/lib/telemetry";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (apiKey) {
      initTelemetry(apiKey, process.env.NEXT_PUBLIC_POSTHOG_HOST);
    }
  }, []);

  return <>{children}</>;
}
```

**Step 4: Wrap layout.tsx with PostHogProvider**

In `apps/web/src/app/layout.tsx`, import and wrap children:

```tsx
import { PostHogProvider } from "@/components/posthog-provider";

// In the return:
<body>
  <PostHogProvider>{children}</PostHogProvider>
</body>;
```

**Step 5: Commit**

```bash
git add apps/web/src/lib/telemetry.ts apps/web/src/components/posthog-provider.tsx apps/web/src/app/layout.tsx apps/web/package.json
git commit -m "feat(web): add PostHog telemetry with shared helper"
```

---

## Task 7: Telemetry — Instrument Key Events

**Files:**

- Modify: `apps/web/src/app/scan/results/page.tsx` (scan.completed)
- Modify: `apps/web/src/components/email-capture-gate.tsx` (scan.email_captured)
- Modify: `apps/web/src/components/reports/report-list.tsx` (report.downloaded)
- Modify: `apps/web/src/components/page-detail/page-llm-quality-section.tsx` (quickwin.clicked)
- Modify: `apps/web/src/components/tabs/integrations-tab.tsx` (integration.tested)

**Step 1: Add `track` import and calls to each file**

For each file, add at the top:

```typescript
import { track } from "@/lib/telemetry";
```

Then add `track()` calls at the right interaction points:

- **Scan results page**: call `track("scan.completed", { domain, grade, score })` in the effect that loads results
- **Email capture gate**: call `track("scan.email_captured", { domain })` after successful lead capture
- **Report list**: call `track("report.downloaded", { format, projectId })` in the download handler
- **Quick wins section**: call `track("quickwin.clicked", { issueCode, severity })` on quick win click
- **Integrations tab**: call `track("integration.tested", { integrationType })` on test button click

**Step 2: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): instrument telemetry events across scan, reports, and integrations"
```

---

## Task 8: Telemetry — Server-Side PostHog

**Files:**

- Modify: `apps/api/package.json` (add posthog-node)
- Create: `apps/api/src/lib/telemetry.ts`

**Step 1: Install**

Run: `pnpm --filter @llm-boost/api add posthog-node`

**Step 2: Create server-side telemetry helper**

```typescript
import { PostHog } from "posthog-node";

let client: PostHog | null = null;

export function getPostHog(apiKey?: string): PostHog | null {
  if (!apiKey) return null;
  if (!client) {
    client = new PostHog(apiKey, { host: "https://us.i.posthog.com" });
  }
  return client;
}

export function trackServer(
  apiKey: string | undefined,
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  const ph = getPostHog(apiKey);
  if (!ph) return;
  ph.capture({ distinctId, event, properties });
}

export async function shutdownPostHog(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
```

**Step 3: Commit**

```bash
git add apps/api/src/lib/telemetry.ts apps/api/package.json
git commit -m "feat(api): add server-side PostHog telemetry helper"
```

---

## Task 9: Notification Channels — Service Layer

**Files:**

- Create: `apps/api/src/services/notification-channel-service.ts`
- Test: `apps/api/src/__tests__/services/notification-channel-service.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotificationChannelService } from "../../services/notification-channel-service";
import { buildUser } from "../helpers/factories";

describe("NotificationChannelService", () => {
  const mockChannelRepo = {
    create: vi.fn(),
    listByUser: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countByUser: vi.fn().mockResolvedValue(0),
  };
  const mockUserRepo = {
    getById: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  describe("create", () => {
    it("creates a webhook channel for starter plan", async () => {
      const user = buildUser({ plan: "starter" });
      mockUserRepo.getById.mockResolvedValue(user);
      mockChannelRepo.countByUser.mockResolvedValue(1);
      mockChannelRepo.create.mockResolvedValue({ id: "ch-1" });

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      const result = await service.create({
        userId: user.id,
        channelType: "webhook",
        config: { url: "https://hooks.example.com/test" },
        eventTypes: ["crawl_completed"],
      });

      expect(result).toEqual({ id: "ch-1" });
      expect(mockChannelRepo.create).toHaveBeenCalled();
    });

    it("rejects when plan limit reached", async () => {
      const user = buildUser({ plan: "starter" });
      mockUserRepo.getById.mockResolvedValue(user);
      mockChannelRepo.countByUser.mockResolvedValue(2);

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          channelType: "webhook",
          config: { url: "https://example.com" },
          eventTypes: ["crawl_completed"],
        }),
      ).rejects.toThrow("PLAN_LIMIT_REACHED");
    });

    it("rejects non-email channels for free tier", async () => {
      const user = buildUser({ plan: "free" });
      mockUserRepo.getById.mockResolvedValue(user);

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          channelType: "webhook",
          config: { url: "https://example.com" },
          eventTypes: ["crawl_completed"],
        }),
      ).rejects.toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @llm-boost/api test -- notification-channel-service`
Expected: FAIL — module not found

**Step 3: Write service implementation**

```typescript
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";
import { ServiceError } from "../lib/errors";

// Domain types — co-locate with service or in a shared types file
type ChannelType = "email" | "webhook" | "slack_incoming" | "slack_app";

interface NotificationChannel {
  id: string;
  userId: string;
  projectId: string | null;
  channelType: ChannelType;
  config: Record<string, unknown>;
  eventTypes: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateChannelInput {
  userId: string;
  projectId?: string;
  channelType: ChannelType;
  config: Record<string, unknown>;
  eventTypes: string[];
}

// Repository interfaces — defines the contract, NOT the implementation
interface NotificationChannelRepository {
  create(data: CreateChannelInput): Promise<NotificationChannel>;
  listByUser(userId: string): Promise<NotificationChannel[]>;
  getById(id: string): Promise<NotificationChannel | null>;
  update(
    id: string,
    data: Partial<
      Pick<NotificationChannel, "config" | "eventTypes" | "enabled">
    >,
  ): Promise<NotificationChannel | null>;
  delete(id: string): Promise<void>;
  countByUser(userId: string): Promise<number>;
}

interface UserRepository {
  getById(
    id: string,
  ): Promise<{ id: string; plan: PlanTier; email: string } | null>;
}

interface NotificationChannelServiceDeps {
  channels: NotificationChannelRepository;
  users: UserRepository;
}

export function createNotificationChannelService(
  deps: NotificationChannelServiceDeps,
) {
  return {
    async create(args: CreateChannelInput) {
      const user = await deps.users.getById(args.userId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      const limits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS];

      // Free tier: email only
      if (user.plan === "free" && args.channelType !== "email") {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "Free tier only supports email notifications",
        );
      }

      const count = await deps.channels.countByUser(args.userId);
      if (count >= limits.notificationChannels) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          `Plan limit of ${limits.notificationChannels} channels reached`,
        );
      }

      return deps.channels.create({
        userId: args.userId,
        projectId: args.projectId,
        channelType: args.channelType,
        config: args.config,
        eventTypes: args.eventTypes,
      });
    },

    async list(userId: string) {
      return deps.channels.listByUser(userId);
    },

    async update(
      userId: string,
      channelId: string,
      data: Partial<
        Pick<NotificationChannel, "config" | "eventTypes" | "enabled">
      >,
    ) {
      const channel = await deps.channels.getById(channelId);
      if (!channel || channel.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Channel not found");
      }
      return deps.channels.update(channelId, data);
    },

    async delete(userId: string, channelId: string) {
      const channel = await deps.channels.getById(channelId);
      if (!channel || channel.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Channel not found");
      }
      await deps.channels.delete(channelId);
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @llm-boost/api test -- notification-channel-service`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/services/notification-channel-service.ts apps/api/src/__tests__/services/notification-channel-service.test.ts
git commit -m "feat(api): notification channel service with plan-gated CRUD"
```

---

## Task 10: Notification Channels — API Routes

**Files:**

- Create: `apps/api/src/routes/notification-channels.ts`
- Modify: `apps/api/src/index.ts` (mount route at ~line 141)

**Step 1: Write route module**

```typescript
import { Hono } from "hono";
import type { Bindings } from "../index";
import { createNotificationChannelService } from "../services/notification-channel-service";
import { notificationChannelQueries } from "@llm-boost/db";
import { userQueries } from "@llm-boost/db";

const channelRoutes = new Hono<{ Bindings: Bindings }>();

// POST /api/notification-channels
channelRoutes.post("/", async (c) => {
  const session = c.get("session");
  const db = c.get("db");
  const body = await c.req.json();

  const service = createNotificationChannelService({
    channels: notificationChannelQueries(db),
    users: userQueries(db),
  });

  const channel = await service.create({
    userId: session.user.id,
    projectId: body.projectId,
    channelType: body.channelType,
    config: body.config,
    eventTypes: body.eventTypes,
  });

  return c.json({ data: channel }, 201);
});

// GET /api/notification-channels
channelRoutes.get("/", async (c) => {
  const session = c.get("session");
  const db = c.get("db");

  const service = createNotificationChannelService({
    channels: notificationChannelQueries(db),
    users: userQueries(db),
  });

  const channels = await service.list(session.user.id);
  return c.json({ data: channels });
});

// PATCH /api/notification-channels/:id
channelRoutes.patch("/:id", async (c) => {
  const session = c.get("session");
  const db = c.get("db");
  const body = await c.req.json();

  const service = createNotificationChannelService({
    channels: notificationChannelQueries(db),
    users: userQueries(db),
  });

  const updated = await service.update(
    session.user.id,
    c.req.param("id"),
    body,
  );
  return c.json({ data: updated });
});

// DELETE /api/notification-channels/:id
channelRoutes.delete("/:id", async (c) => {
  const session = c.get("session");
  const db = c.get("db");

  const service = createNotificationChannelService({
    channels: notificationChannelQueries(db),
    users: userQueries(db),
  });

  await service.delete(session.user.id, c.req.param("id"));
  return c.json({ data: { success: true } });
});

export { channelRoutes };
```

**Step 2: Mount in index.ts**

Add after existing route mounts (~line 151):

```typescript
app.route("/api/notification-channels", channelRoutes);
```

**Step 3: Commit**

```bash
git add apps/api/src/routes/notification-channels.ts apps/api/src/index.ts
git commit -m "feat(api): notification channel CRUD routes"
```

---

## Task 11: Notification Service — Channel-Aware Delivery

**Files:**

- Modify: `apps/api/src/services/notification-service.ts` (~lines 195-272, processQueue)

**Step 1: Update `processQueue` to lookup channels**

In the existing `processQueue()` method, after picking up events from outbox:

1. For each event, look up `notification_channels` matching `eventType` and `projectId`/`userId`
2. For `email` channels: use existing Resend path
3. For `webhook` channels: POST to `config.url` with JSON payload + optional HMAC
4. For `slack_incoming` channels: POST to Slack webhook URL with Block Kit formatted message
5. Existing `webhookUrl`-based delivery stays as fallback during migration

Key code to add in processQueue:

```typescript
// After existing email processing:
if (event.userId && event.eventType) {
  const channels = await notificationChannelQueries(db).findByEventType(
    event.userId,
    event.eventType,
    event.projectId,
  );

  for (const channel of channels) {
    switch (channel.channelType) {
      case "webhook":
        await sendWebhook(channel.config, event);
        break;
      case "slack_incoming":
        await sendSlackIncoming(channel.config, event);
        break;
      // email handled by existing Resend path
    }
  }
}
```

Add helper functions:

```typescript
async function sendWebhook(
  config: Record<string, unknown>,
  event: OutboxEvent,
) {
  const payload = {
    event: event.eventType,
    timestamp: new Date().toISOString(),
    data: event.payload,
  };
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(config.secret as string),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body),
    );
    const hex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    headers["X-Signature"] = `hmac-sha256=${hex}`;
  }

  await fetch(config.url as string, { method: "POST", headers, body });
}

async function sendSlackIncoming(
  config: Record<string, unknown>,
  event: OutboxEvent,
) {
  const payload = {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `LLM Boost: ${event.eventType}` },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: formatSlackMessage(event),
        },
      },
    ],
  };
  await fetch(config.url as string, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
```

**Step 2: Update existing notification methods to populate new outbox columns**

In `queueEmail`, `sendCrawlComplete`, `sendScoreDrop`, etc., when inserting into `outbox_events`, include the new fields:

```typescript
await db.insert(outboxEvents).values({
  type: "email",
  eventType: "crawl_completed", // NEW
  userId: args.userId,           // NEW
  projectId: args.projectId,     // NEW
  payload: { ... },
  status: "pending",
});
```

**Step 3: Commit**

```bash
git add apps/api/src/services/notification-service.ts
git commit -m "feat(api): channel-aware notification delivery with webhook and Slack support"
```

---

## Task 12: Public Scan Persistence — API Changes

**Files:**

- Modify: `apps/api/src/routes/public.ts` (scan endpoint + new scan-results endpoint)
- Test: `apps/api/src/__tests__/integration/public.test.ts`

**Step 1: Write failing test**

```typescript
describe("POST /api/public/scan", () => {
  it("persists scan result and returns scanResultId", async () => {
    // Mock scan + scoring
    const res = await app.request("/api/public/scan", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const data = await res.json();
    expect(data.data.scanResultId).toBeDefined();
    expect(typeof data.data.scanResultId).toBe("string");
  });
});

describe("GET /api/public/scan-results/:id", () => {
  it("returns partial results without email unlock", async () => {
    // Create scan result first, then fetch
    const res = await app.request(`/api/public/scan-results/${scanId}`);
    const data = await res.json();
    expect(data.data.scores).toBeDefined();
    expect(data.data.issues.length).toBeLessThanOrEqual(3); // Partial
    expect(data.data.quickWins).toBeUndefined();
  });
});
```

**Step 2: Run test — expected FAIL**

**Step 3: Modify scan endpoint to persist results**

In `apps/api/src/routes/public.ts`, after scoring (around line 180):

```typescript
// Persist to DB
const scanResult = await scanResultQueries(db).create({
  domain: new URL(body.url).hostname,
  url: body.url,
  scores: result.scores,
  issues: result.issues,
  quickWins: result.quickWins,
  ipHash: ipHash,
});

// Return scanResultId alongside existing data
return c.json({
  data: {
    scanResultId: scanResult.id,
    scores: result.scores,
    grade: result.grade,
    issues: result.issues.slice(0, 3), // Partial: top 3 only
    meta: result.meta,
  },
});
```

**Step 4: Add GET endpoint for scan results**

```typescript
publicRoutes.get("/scan-results/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const unlockToken = c.req.query("token");

  const result = await scanResultQueries(db).getById(id);
  if (!result) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Scan result not found" } },
      404,
    );
  }

  // Check if email was captured (token = lead ID)
  const isUnlocked = unlockToken
    ? !!(await leadQueries(db).getById(unlockToken))
    : false;

  if (isUnlocked) {
    return c.json({ data: result }); // Full results
  }

  // Partial results
  return c.json({
    data: {
      id: result.id,
      domain: result.domain,
      url: result.url,
      scores: result.scores,
      issues: (result.issues as any[]).slice(0, 3),
      // quickWins omitted
      createdAt: result.createdAt,
    },
  });
});
```

**Step 5: Update leads endpoint to accept scanResultId**

In the existing POST `/leads` handler (~line 289), update to accept `scanResultId`:

```typescript
const lead = await leadQueries(db).create({
  email: body.email,
  reportToken: body.reportToken,
  source: body.source ?? "public_scan",
  scanResultId: body.scanResultId,
});
```

**Step 6: Run tests**

Run: `pnpm --filter @llm-boost/api test -- public`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/api/src/routes/public.ts apps/api/src/__tests__/integration/public.test.ts
git commit -m "feat(api): persist public scan results and serve gated scan-results endpoint"
```

---

## Task 13: Public Scan Persistence — Frontend Changes

**Files:**

- Modify: `apps/web/src/app/scan/results/page.tsx` (fetch from API instead of sessionStorage)
- Modify: `apps/web/src/components/email-capture-gate.tsx` (connect to scan flow)
- Modify: `apps/web/src/lib/api.ts` (add scan-results methods)

**Step 1: Add API client methods**

In `apps/web/src/lib/api.ts`, extend the `public` section:

```typescript
public: {
  // existing methods...
  async getScanResult(id: string, token?: string): Promise<ScanResult> {
    const params = token ? `?token=${token}` : "";
    const res = await fetch(`${API_BASE}/api/public/scan-results/${id}${params}`);
    if (!res.ok) throw new Error("Failed to fetch scan result");
    const json = await res.json();
    return json.data;
  },
},
```

**Step 2: Rewrite scan results page to use API**

Replace sessionStorage reads with URL-based fetch:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { track } from "@/lib/telemetry";
import { EmailCaptureGate } from "@/components/email-capture-gate";

export default function ScanResultsPage() {
  const searchParams = useSearchParams();
  const scanId = searchParams.get("id");
  const [result, setResult] = useState<any>(null);
  const [unlockToken, setUnlockToken] = useState<string | null>(
    typeof window !== "undefined"
      ? localStorage.getItem(`scan-unlocked-${scanId}`)
      : null,
  );

  useEffect(() => {
    if (!scanId) return;
    api.public.getScanResult(scanId, unlockToken ?? undefined).then((data) => {
      setResult(data);
      track("scan.completed", {
        domain: data.domain,
        grade: data.scores?.grade,
      });
    });
  }, [scanId, unlockToken]);

  function handleEmailCaptured(leadId: string) {
    localStorage.setItem(`scan-unlocked-${scanId}`, leadId);
    setUnlockToken(leadId);
  }

  if (!result) return <div>Loading...</div>;

  return (
    <>
      {/* Scores section — always shown */}
      {/* Top 3 issues — always shown */}

      {!unlockToken && (
        <EmailCaptureGate
          scanResultId={scanId!}
          onCaptured={handleEmailCaptured}
        />
      )}

      {unlockToken && (
        <>
          {/* Full issues list */}
          {/* Quick wins with code snippets */}
          {/* Recommendations */}
        </>
      )}

      {/* Signup CTA */}
    </>
  );
}
```

**Step 3: Update EmailCaptureGate to work with scanResultId**

Modify the component to accept `scanResultId` prop and pass it to the leads API:

```tsx
interface EmailCaptureGateProps {
  scanResultId?: string;
  reportToken?: string;
  onCaptured: (leadId: string) => void;
}

// In handleSubmit:
const lead = await api.public.captureLead({
  email: trimmed,
  reportToken,
  scanResultId,
});
onCaptured(lead.id);
```

**Step 4: Update scan form redirect**

In `apps/web/src/app/scan/page.tsx`, change the redirect after scan:

```typescript
// Before: sessionStorage.setItem("scanResult", JSON.stringify(result));
// After:
router.push(`/scan/results?id=${result.scanResultId}`);
```

**Step 5: Commit**

```bash
git add apps/web/src/app/scan/results/page.tsx apps/web/src/components/email-capture-gate.tsx apps/web/src/lib/api.ts apps/web/src/app/scan/page.tsx
git commit -m "feat(web): fetch scan results from API, integrate email capture gate"
```

---

## Task 14: Project Seeding on Signup

**Files:**

- Modify: `apps/api/src/routes/account.ts` (or post-signup hook)
- Create: `apps/api/src/services/lead-conversion-service.ts`

**Step 1: Write the lead conversion service**

```typescript
import type { Database } from "@llm-boost/db";
import { leadQueries, scanResultQueries, projectQueries } from "@llm-boost/db";

export async function convertLeadToProject(
  db: Database,
  userId: string,
  email: string,
) {
  const lead = await leadQueries(db).findByEmail(email);
  if (!lead || !lead.scanResultId || lead.convertedAt) return null;

  const scanResult = await scanResultQueries(db).getById(lead.scanResultId);
  if (!scanResult) return null;

  // Create project from scan domain
  const project = await projectQueries(db).create({
    userId,
    name: scanResult.domain,
    domain: `https://${scanResult.domain}`,
  });

  // Mark lead as converted
  await leadQueries(db).markConverted(lead.id, project.id);

  return project;
}
```

**Step 2: Call from signup/account creation flow**

In the post-signup handler (or Better Auth `onCreateUser` hook), call:

```typescript
const seededProject = await convertLeadToProject(db, user.id, user.email);
// If seededProject, trigger first crawl with free credits
```

**Step 3: Commit**

```bash
git add apps/api/src/services/lead-conversion-service.ts apps/api/src/routes/account.ts
git commit -m "feat(api): auto-seed project from lead scan data on signup"
```

---

## Task 15: Scheduled Visibility — Service Layer

**Files:**

- Create: `apps/api/src/services/scheduled-visibility-service.ts`
- Test: `apps/api/src/__tests__/services/scheduled-visibility-service.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createScheduledVisibilityService } from "../../services/scheduled-visibility-service";
import { buildUser, buildProject } from "../helpers/factories";

describe("ScheduledVisibilityService", () => {
  const mockScheduleRepo = {
    create: vi.fn(),
    listByProject: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countByProject: vi.fn().mockResolvedValue(0),
    getDueQueries: vi.fn().mockResolvedValue([]),
    markRun: vi.fn(),
  };
  const mockProjectRepo = {
    getById: vi.fn(),
  };
  const mockUserRepo = {
    getById: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  describe("create", () => {
    it("creates a scheduled query within plan limits", async () => {
      const user = buildUser({ plan: "pro" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.countByProject.mockResolvedValue(5);
      mockScheduleRepo.create.mockResolvedValue({ id: "sq-1" });

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      const result = await service.create({
        userId: user.id,
        projectId: project.id,
        query: "best CRM software",
        providers: ["chatgpt", "claude"],
        frequency: "daily",
      });

      expect(result).toEqual({ id: "sq-1" });
    });

    it("rejects hourly for starter plan", async () => {
      const user = buildUser({ plan: "starter" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          projectId: project.id,
          query: "test",
          providers: ["chatgpt"],
          frequency: "hourly",
        }),
      ).rejects.toThrow();
    });

    it("rejects for free plan", async () => {
      const user = buildUser({ plan: "free" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          projectId: project.id,
          query: "test",
          providers: ["chatgpt"],
          frequency: "daily",
        }),
      ).rejects.toThrow("PLAN_LIMIT_REACHED");
    });
  });
});
```

**Step 2: Run test — expected FAIL**

**Step 3: Write service**

```typescript
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";
import { ServiceError } from "../lib/errors";

// Domain types
type Frequency = "hourly" | "daily" | "weekly";

interface ScheduledVisibilityQuery {
  id: string;
  projectId: string;
  query: string;
  providers: string[];
  frequency: Frequency;
  lastRunAt: Date | null;
  nextRunAt: Date;
  enabled: boolean;
  createdAt: Date;
}

interface CreateScheduleInput {
  projectId: string;
  query: string;
  providers: string[];
  frequency: Frequency;
}

// Repository interfaces
interface ScheduledVisibilityRepository {
  create(data: CreateScheduleInput): Promise<ScheduledVisibilityQuery>;
  listByProject(projectId: string): Promise<ScheduledVisibilityQuery[]>;
  getById(id: string): Promise<ScheduledVisibilityQuery | null>;
  update(
    id: string,
    data: Partial<
      Pick<
        ScheduledVisibilityQuery,
        "query" | "providers" | "frequency" | "enabled"
      >
    >,
  ): Promise<ScheduledVisibilityQuery | null>;
  delete(id: string): Promise<void>;
  countByProject(projectId: string): Promise<number>;
  getDueQueries(now: Date): Promise<ScheduledVisibilityQuery[]>;
  markRun(
    id: string,
    frequency: Frequency,
  ): Promise<ScheduledVisibilityQuery | null>;
}

interface ScheduledVisibilityServiceDeps {
  schedules: ScheduledVisibilityRepository;
  projects: {
    getById(id: string): Promise<{ id: string; userId: string } | null>;
  };
  users: {
    getById(id: string): Promise<{ id: string; plan: PlanTier } | null>;
  };
}

export function createScheduledVisibilityService(
  deps: ScheduledVisibilityServiceDeps,
) {
  return {
    async create(args: {
      userId: string;
      projectId: string;
      query: string;
      providers: string[];
      frequency: "hourly" | "daily" | "weekly";
    }) {
      const user = await deps.users.getById(args.userId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      const project = await deps.projects.getById(args.projectId);
      if (!project || project.userId !== args.userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      const limits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS];
      if (limits.scheduledQueries === 0) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "Scheduled queries not available on your plan",
        );
      }

      // Starter: daily/weekly only
      if (user.plan === "starter" && args.frequency === "hourly") {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "Hourly scheduling requires Pro or Agency plan",
        );
      }

      const count = await deps.schedules.countByProject(args.projectId);
      if (count >= limits.scheduledQueries) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          `Limit of ${limits.scheduledQueries} scheduled queries reached`,
        );
      }

      return deps.schedules.create(args);
    },

    async list(userId: string, projectId: string) {
      const project = await deps.projects.getById(projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }
      return deps.schedules.listByProject(projectId);
    },

    async update(
      userId: string,
      scheduleId: string,
      data: Partial<
        Pick<
          ScheduledVisibilityQuery,
          "query" | "providers" | "frequency" | "enabled"
        >
      >,
    ) {
      const schedule = await deps.schedules.getById(scheduleId);
      if (!schedule) throw new ServiceError("NOT_FOUND", 404, "Not found");

      const project = await deps.projects.getById(schedule.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Not found");
      }

      if (data.frequency === "hourly") {
        const user = await deps.users.getById(userId);
        if (user.plan === "starter") {
          throw new ServiceError(
            "PLAN_LIMIT_REACHED",
            403,
            "Hourly requires Pro or Agency",
          );
        }
      }

      return deps.schedules.update(scheduleId, data);
    },

    async delete(userId: string, scheduleId: string) {
      const schedule = await deps.schedules.getById(scheduleId);
      if (!schedule) throw new ServiceError("NOT_FOUND", 404, "Not found");

      const project = await deps.projects.getById(schedule.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Not found");
      }

      await deps.schedules.delete(scheduleId);
    },
  };
}
```

**Step 4: Run test — expected PASS**

**Step 5: Commit**

```bash
git add apps/api/src/services/scheduled-visibility-service.ts apps/api/src/__tests__/services/scheduled-visibility-service.test.ts
git commit -m "feat(api): scheduled visibility service with plan-gated CRUD"
```

---

## Task 16: Scheduled Visibility — Routes + Cron Worker

**Files:**

- Create: `apps/api/src/routes/visibility-schedules.ts`
- Modify: `apps/api/src/index.ts` (mount route + add cron handler at ~line 251)

**Step 1: Write route module**

Follow pattern from Task 10 (notification channel routes). CRUD endpoints:

- `POST /api/visibility/schedules`
- `GET /api/visibility/schedules?projectId=`
- `PATCH /api/visibility/schedules/:id`
- `DELETE /api/visibility/schedules/:id`

**Step 2: Add cron handler in `index.ts`**

In the `scheduled()` export (~line 251), add a new cron branch:

```typescript
async scheduled(controller: ScheduledController, env: Bindings, _ctx: ExecutionContext) {
  if (controller.cron === "0 0 1 * *") {
    await resetMonthlyCredits(env);
  } else if (controller.cron === "*/15 * * * *") {
    await processScheduledVisibilityChecks(env);
  } else {
    await runScheduledTasks(env);
  }
},
```

**Step 3: Write the cron processor function**

```typescript
async function processScheduledVisibilityChecks(env: Bindings) {
  const db = createDb(env.DATABASE_URL);
  const scheduleRepo = scheduledVisibilityQueries_q(db);
  const due = await scheduleRepo.getDueQueries(new Date());

  for (const schedule of due.slice(0, 10)) {
    try {
      const project = await projectQueries(db).getById(schedule.projectId);
      if (!project) continue;

      // Run visibility check using existing service
      const results = await visibilityService.runCheck({
        userId: project.userId,
        projectId: schedule.projectId,
        query: schedule.query,
        providers: schedule.providers,
        competitors: [], // loaded from competitors table
        apiKeys: {
          openai: env.OPENAI_API_KEY,
          anthropic: env.ANTHROPIC_API_KEY,
        },
      });

      // Delta detection
      await detectAndEmitChanges(db, schedule, results, project);

      // Mark run complete
      await scheduleRepo.markRun(schedule.id, schedule.frequency);

      // Server-side telemetry
      trackServer(
        env.POSTHOG_API_KEY,
        project.userId,
        "visibility.check.scheduled",
        { projectId: schedule.projectId, providers: schedule.providers },
      );
    } catch (err) {
      console.error(`Scheduled check failed for ${schedule.id}:`, err);
    }
  }
}
```

**Step 4: Write delta detection function**

```typescript
async function detectAndEmitChanges(
  db: Database,
  schedule: any,
  results: any[],
  project: any,
) {
  const outbox = outboxQueries(db);

  for (const result of results) {
    const previous = await visibilityQueries(db).getLatestForQuery(
      schedule.projectId,
      schedule.query,
      result.llmProvider,
    );

    if (!previous) continue;

    if (previous.brandMentioned && !result.brandMentioned) {
      await outbox.create({
        type: "notification",
        eventType: "mention_lost",
        userId: project.userId,
        projectId: project.id,
        payload: {
          query: schedule.query,
          provider: result.llmProvider,
          domain: project.domain,
        },
      });
    } else if (!previous.brandMentioned && result.brandMentioned) {
      await outbox.create({
        type: "notification",
        eventType: "mention_gained",
        userId: project.userId,
        projectId: project.id,
        payload: {
          query: schedule.query,
          provider: result.llmProvider,
          domain: project.domain,
        },
      });
    }

    if (
      previous.citationPosition !== result.citationPosition &&
      result.citationPosition
    ) {
      await outbox.create({
        type: "notification",
        eventType: "position_changed",
        userId: project.userId,
        projectId: project.id,
        payload: {
          query: schedule.query,
          provider: result.llmProvider,
          oldPosition: previous.citationPosition,
          newPosition: result.citationPosition,
        },
      });
    }
  }
}
```

**Step 5: Add `getLatestForQuery` to visibility queries**

In `packages/db/src/queries/visibility.ts`, add:

```typescript
async getLatestForQuery(projectId: string, query: string, provider: string) {
  const [row] = await db
    .select()
    .from(visibilityChecks)
    .where(
      and(
        eq(visibilityChecks.projectId, projectId),
        eq(visibilityChecks.query, query),
        eq(visibilityChecks.llmProvider, provider),
      ),
    )
    .orderBy(desc(visibilityChecks.checkedAt))
    .limit(1);
  return row ?? null;
},
```

**Step 6: Update `wrangler.toml` to add 15-minute cron**

```toml
[triggers]
crons = ["0 0 1 * *", "*/15 * * * *"]
```

**Step 7: Commit**

```bash
git add apps/api/src/routes/visibility-schedules.ts apps/api/src/index.ts packages/db/src/queries/visibility.ts wrangler.toml
git commit -m "feat(api): scheduled visibility cron worker with delta detection and notifications"
```

---

## Task 17: API Tokens — Service Layer

**Files:**

- Create: `apps/api/src/services/api-token-service.ts`
- Test: `apps/api/src/__tests__/services/api-token-service.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiTokenService } from "../../services/api-token-service";
import { buildUser, buildProject } from "../helpers/factories";

describe("ApiTokenService", () => {
  const mockTokenRepo = {
    create: vi.fn(),
    findByHash: vi.fn(),
    listByUser: vi.fn().mockResolvedValue([]),
    revoke: vi.fn(),
    updateLastUsed: vi.fn(),
    countByUser: vi.fn().mockResolvedValue(0),
  };
  const mockUserRepo = { getById: vi.fn() };
  const mockProjectRepo = { getById: vi.fn() };

  beforeEach(() => vi.clearAllMocks());

  describe("create", () => {
    it("generates token and returns plaintext once", async () => {
      const user = buildUser({ plan: "pro" });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(
        buildProject({ userId: user.id }),
      );
      mockTokenRepo.create.mockResolvedValue({ id: "tok-1" });

      const service = createApiTokenService({
        tokens: mockTokenRepo,
        users: mockUserRepo,
        projects: mockProjectRepo,
      });

      const result = await service.create({
        userId: user.id,
        projectId: "proj-1",
        name: "CI token",
        scopes: ["metrics:read"],
      });

      expect(result.plaintext).toMatch(/^llmb_/);
      expect(result.plaintext.length).toBeGreaterThan(20);
      expect(mockTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: expect.any(String),
          tokenPrefix: expect.stringMatching(/^llmb_/),
        }),
      );
    });

    it("rejects for free plan", async () => {
      const user = buildUser({ plan: "free" });
      mockUserRepo.getById.mockResolvedValue(user);

      const service = createApiTokenService({
        tokens: mockTokenRepo,
        users: mockUserRepo,
        projects: mockProjectRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          projectId: "proj-1",
          name: "test",
          scopes: ["metrics:read"],
        }),
      ).rejects.toThrow("PLAN_LIMIT_REACHED");
    });
  });

  describe("authenticate", () => {
    it("returns token context for valid token", async () => {
      const token = {
        id: "tok-1",
        userId: "user-1",
        projectId: "proj-1",
        scopes: ["metrics:read"],
        revokedAt: null,
      };
      mockTokenRepo.findByHash.mockResolvedValue(token);

      const service = createApiTokenService({
        tokens: mockTokenRepo,
        users: mockUserRepo,
        projects: mockProjectRepo,
      });

      const result = await service.authenticate("llmb_test123");
      expect(result).toEqual(
        expect.objectContaining({
          userId: "user-1",
          projectId: "proj-1",
          scopes: ["metrics:read"],
        }),
      );
      expect(mockTokenRepo.updateLastUsed).toHaveBeenCalledWith("tok-1");
    });

    it("returns null for unknown token", async () => {
      mockTokenRepo.findByHash.mockResolvedValue(null);

      const service = createApiTokenService({
        tokens: mockTokenRepo,
        users: mockUserRepo,
        projects: mockProjectRepo,
      });

      const result = await service.authenticate("llmb_invalid");
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run test — expected FAIL**

**Step 3: Write service**

```typescript
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";
import { ServiceError } from "../lib/errors";

// Domain types
type TokenScope = "metrics:read" | "scores:read" | "visibility:read";

interface ApiToken {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  scopes: TokenScope[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

interface TokenContext {
  tokenId: string;
  userId: string;
  projectId: string;
  scopes: TokenScope[];
}

interface CreateTokenInput {
  userId: string;
  projectId: string;
  name: string;
  scopes: TokenScope[];
  expiresAt?: Date;
}

// Repository interfaces
interface ApiTokenRepository {
  create(
    data: Omit<ApiToken, "id" | "lastUsedAt" | "revokedAt" | "createdAt">,
  ): Promise<ApiToken>;
  findByHash(tokenHash: string): Promise<ApiToken | null>;
  listByUser(userId: string): Promise<Omit<ApiToken, "tokenHash">[]>;
  revoke(id: string): Promise<ApiToken | null>;
  updateLastUsed(id: string): Promise<void>;
  countByUser(userId: string): Promise<number>;
}

interface ApiTokenServiceDeps {
  tokens: ApiTokenRepository;
  users: {
    getById(id: string): Promise<{ id: string; plan: PlanTier } | null>;
  };
  projects: {
    getById(id: string): Promise<{ id: string; userId: string } | null>;
  };
}

export function createApiTokenService(deps: ApiTokenServiceDeps) {
  return {
    async create(args: CreateTokenInput) {
      const user = await deps.users.getById(args.userId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      const limits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS];
      if (limits.apiTokens === 0) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "API tokens not available on your plan",
        );
      }

      const count = await deps.tokens.countByUser(args.userId);
      if (count >= limits.apiTokens) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          `Limit of ${limits.apiTokens} API tokens reached`,
        );
      }

      const project = await deps.projects.getById(args.projectId);
      if (!project || project.userId !== args.userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      // Generate token
      const randomBytes = crypto.getRandomValues(new Uint8Array(32));
      const base62 = Array.from(randomBytes)
        .map(
          (b) =>
            "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"[
              b % 62
            ],
        )
        .join("");
      const plaintext = `llmb_${base62}`;

      // Hash for storage
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(plaintext),
      );
      const tokenHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const created = await deps.tokens.create({
        userId: args.userId,
        projectId: args.projectId,
        name: args.name,
        tokenHash,
        tokenPrefix: plaintext.slice(0, 12),
        scopes: args.scopes,
        expiresAt: args.expiresAt,
      });

      return { ...created, plaintext };
    },

    async authenticate(rawToken: string) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(rawToken),
      );
      const tokenHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const token = await deps.tokens.findByHash(tokenHash);
      if (!token) return null;

      await deps.tokens.updateLastUsed(token.id);

      return {
        tokenId: token.id,
        userId: token.userId,
        projectId: token.projectId,
        scopes: token.scopes,
      };
    },

    async list(userId: string) {
      return deps.tokens.listByUser(userId);
    },

    async revoke(userId: string, tokenId: string) {
      const tokens = await deps.tokens.listByUser(userId);
      const token = tokens.find((t: any) => t.id === tokenId);
      if (!token) throw new ServiceError("NOT_FOUND", 404, "Token not found");
      return deps.tokens.revoke(tokenId);
    },
  };
}
```

**Step 4: Run test — expected PASS**

**Step 5: Commit**

```bash
git add apps/api/src/services/api-token-service.ts apps/api/src/__tests__/services/api-token-service.test.ts
git commit -m "feat(api): API token service with generation, auth, and plan gating"
```

---

## Task 18: API Tokens — Auth Middleware + v1 Routes

**Files:**

- Create: `apps/api/src/middleware/api-token-auth.ts`
- Create: `apps/api/src/routes/api-tokens.ts` (CRUD)
- Create: `apps/api/src/routes/v1.ts` (read-only API)
- Modify: `apps/api/src/index.ts` (mount routes)

**Step 1: Write token auth middleware**

```typescript
import { createMiddleware } from "hono/factory";
import type { Bindings } from "../index";
import { createApiTokenService } from "../services/api-token-service";
import { apiTokenQueries, userQueries, projectQueries } from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";

export const apiTokenAuth = createMiddleware<{ Bindings: Bindings }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer llmb_")) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid API token" } },
        401,
      );
    }

    const rawToken = authHeader.slice(7); // Remove "Bearer "
    const db = c.get("db");
    const service = createApiTokenService({
      tokens: apiTokenQueries(db),
      users: userQueries(db),
      projects: projectQueries(db),
    });

    const tokenCtx = await service.authenticate(rawToken);
    if (!tokenCtx) {
      return c.json(
        {
          error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
        },
        401,
      );
    }

    // Rate limit check
    const user = await userQueries(db).getById(tokenCtx.userId);
    if (user) {
      const limits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS];
      // KV rate limiting — same pattern as existing rate limiter
      const kvKey = `ratelimit:token:${tokenCtx.tokenId}`;
      const kv = c.env.KV;
      const current = parseInt((await kv.get(kvKey)) ?? "0", 10);
      if (current >= limits.apiRateLimit) {
        return c.json(
          { error: { code: "RATE_LIMIT", message: "Rate limit exceeded" } },
          429,
        );
      }
      await kv.put(kvKey, String(current + 1), { expirationTtl: 60 });
    }

    c.set("tokenCtx", tokenCtx);
    await next();
  },
);
```

**Step 2: Write CRUD routes for token management**

`apps/api/src/routes/api-tokens.ts` — standard CRUD behind session auth:

- `POST /api/tokens` — create (returns plaintext once)
- `GET /api/tokens` — list
- `DELETE /api/tokens/:id` — revoke

**Step 3: Write v1 read-only routes**

```typescript
import { Hono } from "hono";
import type { Bindings } from "../index";
import { apiTokenAuth } from "../middleware/api-token-auth";

const v1Routes = new Hono<{ Bindings: Bindings }>();
v1Routes.use("/*", apiTokenAuth);

// GET /api/v1/projects/:id/metrics
v1Routes.get("/projects/:id/metrics", async (c) => {
  const tokenCtx = c.get("tokenCtx");
  const projectId = c.req.param("id");

  if (tokenCtx.projectId !== projectId) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Token not scoped to this project",
        },
      },
      403,
    );
  }
  if (!tokenCtx.scopes.includes("metrics:read")) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Insufficient scope" } },
      403,
    );
  }

  const db = c.get("db");
  // Fetch latest scores for project
  const scores = await scoreQueries(db).getLatestByProject(projectId);
  return c.json({ data: scores });
});

// GET /api/v1/projects/:id/pages
v1Routes.get("/projects/:id/pages", async (c) => {
  // Similar scope check, return paginated page scores
});

// GET /api/v1/projects/:id/issues
v1Routes.get("/projects/:id/issues", async (c) => {
  // Scope check, return issues filterable by severity
});

// GET /api/v1/projects/:id/visibility
v1Routes.get("/projects/:id/visibility", async (c) => {
  // Scope check, return visibility results + trends
});

export { v1Routes };
```

**Step 4: Mount routes in index.ts**

```typescript
app.route("/api/tokens", tokenRoutes); // Session-auth CRUD
app.route("/api/v1", v1Routes); // Token-auth read-only
```

**Step 5: Commit**

```bash
git add apps/api/src/middleware/api-token-auth.ts apps/api/src/routes/api-tokens.ts apps/api/src/routes/v1.ts apps/api/src/index.ts
git commit -m "feat(api): API token auth middleware and versioned read-only endpoints"
```

---

## Task 19: Notification Channel Settings UI

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/page.tsx`
- Modify: `apps/web/src/lib/api.ts` (add channel API methods)

**Step 1: Add API client methods for channels**

```typescript
channels: {
  async list(): Promise<NotificationChannel[]> {
    const res = await fetchAuth("/api/notification-channels");
    return res.data;
  },
  async create(data: CreateChannelInput): Promise<NotificationChannel> {
    const res = await fetchAuth("/api/notification-channels", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  async update(id: string, data: Partial<ChannelUpdate>): Promise<NotificationChannel> {
    const res = await fetchAuth(`/api/notification-channels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  async delete(id: string): Promise<void> {
    await fetchAuth(`/api/notification-channels/${id}`, { method: "DELETE" });
  },
},
```

**Step 2: Add Notifications tab to settings page**

In the settings page, add a new tab (after existing webhook section ~line 413):

- List existing channels with type badge, event types, enabled toggle
- "Add Channel" button → modal with:
  - Channel type selector (Email / Webhook / Slack Incoming)
  - Config form (changes per type: URL for webhook, Slack webhook URL, email address)
  - Event type checkboxes
- "Test" button that sends a test event
- "Delete" button
- Plan limit badge at top

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/settings/page.tsx apps/web/src/lib/api.ts
git commit -m "feat(web): notification channel management UI in settings"
```

---

## Task 20: API Token Settings UI

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/page.tsx`
- Modify: `apps/web/src/lib/api.ts` (add token API methods)

**Step 1: Add API client methods for tokens**

```typescript
tokens: {
  async list(): Promise<ApiToken[]> {
    const res = await fetchAuth("/api/tokens");
    return res.data;
  },
  async create(data: CreateTokenInput): Promise<ApiTokenWithPlaintext> {
    const res = await fetchAuth("/api/tokens", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  async revoke(id: string): Promise<void> {
    await fetchAuth(`/api/tokens/${id}`, { method: "DELETE" });
  },
},
```

**Step 2: Add API Tokens tab to settings page**

- Token list with: name, prefix (`llmb_abc1...`), scopes, last used, created date
- "Create Token" button → modal with:
  - Name input
  - Project selector dropdown
  - Scope checkboxes (metrics:read, scores:read, visibility:read)
  - Create → shows plaintext token in copy-to-clipboard modal with "this won't be shown again" warning
- "Revoke" button per token (with confirmation)
- Plan gate: show upgrade CTA for Free/Starter

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/settings/page.tsx apps/web/src/lib/api.ts
git commit -m "feat(web): API token management UI in settings"
```

---

## Task 21: Scheduled Visibility UI

**Files:**

- Modify: `apps/web/src/lib/api.ts` (add schedule API methods)
- Modify visibility dashboard page to show scheduled queries section

**Step 1: Add API client methods**

```typescript
visibility: {
  // existing methods...
  schedules: {
    async list(projectId: string): Promise<ScheduledQuery[]> {
      const res = await fetchAuth(`/api/visibility/schedules?projectId=${projectId}`);
      return res.data;
    },
    async create(data: CreateScheduleInput): Promise<ScheduledQuery> {
      const res = await fetchAuth("/api/visibility/schedules", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res.data;
    },
    async update(id: string, data: Partial<ScheduleUpdate>): Promise<ScheduledQuery> {
      const res = await fetchAuth(`/api/visibility/schedules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return res.data;
    },
    async delete(id: string): Promise<void> {
      await fetchAuth(`/api/visibility/schedules/${id}`, { method: "DELETE" });
    },
  },
},
```

**Step 2: Add scheduled queries section to visibility page**

- "Scheduled Checks" card with list of active schedules
- Each row: query text, providers, frequency, next run, enabled toggle
- "Add Schedule" button → form with query, provider checkboxes, frequency selector
- Plan gate messaging for frequency restrictions

**Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/
git commit -m "feat(web): scheduled visibility check management UI"
```

---

## Task 22: Cleanup Cron + Expired Data

**Files:**

- Modify: `apps/api/src/index.ts` (add cleanup to scheduled handler)

**Step 1: Add cleanup to daily cron**

In the scheduled handler, add a daily cleanup job:

```typescript
// runs daily at 3am
if (controller.cron === "0 3 * * *") {
  const db = createDb(env.DATABASE_URL);
  // Delete expired scan results
  const deleted = await scanResultQueries(db).deleteExpired();
  console.log(`Cleaned up ${deleted} expired scan results`);

  // Delete unconverted leads older than 90 days
  // (add deleteOldLeads to lead queries)
}
```

**Step 2: Update wrangler.toml crons**

```toml
[triggers]
crons = ["0 0 1 * *", "*/15 * * * *", "0 3 * * *"]
```

**Step 3: Commit**

```bash
git add apps/api/src/index.ts wrangler.toml
git commit -m "feat(api): daily cleanup cron for expired scan results and stale leads"
```

---

## Task 23: Integration Tests + Final Verification

**Files:**

- Modify: `apps/api/src/__tests__/helpers/factories.ts` (add new factories)
- Modify: `apps/api/src/__tests__/helpers/mock-repositories.ts` (add new mocks)
- Create integration tests for new endpoints

**Step 1: Add factories for new entities**

```typescript
export function buildNotificationChannel(overrides = {}) {
  return {
    id: "ch-1",
    userId: "user-1",
    projectId: null,
    channelType: "webhook",
    config: { url: "https://hooks.example.com" },
    eventTypes: ["crawl_completed"],
    enabled: true,
    createdAt: STATIC_DATE,
    updatedAt: STATIC_DATE,
    ...overrides,
  };
}

export function buildScheduledQuery(overrides = {}) {
  return {
    id: "sq-1",
    projectId: "proj-1",
    query: "best CRM software",
    providers: ["chatgpt", "claude"],
    frequency: "daily",
    lastRunAt: null,
    nextRunAt: new Date(Date.now() + 86400000),
    enabled: true,
    createdAt: STATIC_DATE,
    ...overrides,
  };
}

export function buildApiToken(overrides = {}) {
  return {
    id: "tok-1",
    userId: "user-1",
    projectId: "proj-1",
    name: "CI token",
    tokenHash: "abc123hash",
    tokenPrefix: "llmb_abc1",
    scopes: ["metrics:read"],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: STATIC_DATE,
    ...overrides,
  };
}
```

**Step 2: Add mock repositories**

```typescript
export function createMockChannelRepo(overrides?: any) {
  return applyOverrides(
    {
      create: vi.fn().mockResolvedValue(buildNotificationChannel()),
      listByUser: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      delete: vi.fn(),
      countByUser: vi.fn().mockResolvedValue(0),
      findByEventType: vi.fn().mockResolvedValue([]),
    },
    overrides,
  );
}

export function createMockTokenRepo(overrides?: any) {
  return applyOverrides(
    {
      create: vi.fn().mockResolvedValue(buildApiToken()),
      findByHash: vi.fn().mockResolvedValue(null),
      listByUser: vi.fn().mockResolvedValue([]),
      revoke: vi.fn(),
      updateLastUsed: vi.fn(),
      countByUser: vi.fn().mockResolvedValue(0),
    },
    overrides,
  );
}
```

**Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/api/src/__tests__/
git commit -m "test: add factories, mocks, and integration tests for new features"
```

---

## Summary

| Task  | Feature                               | Files                                         | Est. Complexity |
| ----- | ------------------------------------- | --------------------------------------------- | --------------- |
| 1     | Schema + new tables                   | packages/db/src/schema.ts                     | Medium          |
| 2     | Plan limits                           | packages/shared/src/constants/plans.ts        | Low             |
| 3-5   | DB queries (4 modules)                | packages/db/src/queries/\*.ts                 | Medium          |
| 6-8   | PostHog telemetry                     | apps/web + apps/api                           | Low             |
| 9-10  | Notification channel service + routes | apps/api/src/services + routes                | Medium          |
| 11    | Channel-aware notification delivery   | apps/api/src/services/notification-service.ts | High            |
| 12-14 | Public scan persistence               | apps/api + apps/web                           | High            |
| 15-16 | Scheduled visibility + cron           | apps/api services + cron handler              | High            |
| 17-18 | API tokens + v1 routes                | apps/api middleware + routes                  | High            |
| 19-21 | Frontend UIs (3 features)             | apps/web settings + visibility                | Medium          |
| 22    | Cleanup cron                          | apps/api/src/index.ts                         | Low             |
| 23    | Integration tests + verification      | apps/api/src/**tests**                        | Medium          |
