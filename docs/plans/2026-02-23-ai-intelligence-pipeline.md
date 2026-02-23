# AI Intelligence Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Orchestrate existing auto-generation services into an automated pipeline triggered by crawl completion, with audit logging, action-item reports, health checks, and MCP integration.

**Architecture:** Hybrid — `ProjectPipelineService` state machine controls step execution; outbox events fire for audit logging, notifications, and analytics. All existing auto-services are reused as-is; new services added for content optimization, health check, and action-item report.

**Tech Stack:** Hono (API), Drizzle ORM (Neon PG), Anthropic Claude (LLM), existing outbox pattern, Vitest (tests)

**Design doc:** `docs/plans/2026-02-23-ai-intelligence-pipeline-design.md`

---

## Phase 1: Database Schema

### Task 1: Add `pipelineRuns` table to schema

**Files:**

- Modify: `packages/db/src/schema.ts`

**Step 1: Add pipeline status enum and table**

After the existing `eventStatusEnum` definition (~line 855), add:

```typescript
export const pipelineStatusEnum = pgEnum("pipeline_status", [
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
]);

export const pipelineRuns = pgTable("pipeline_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  crawlJobId: uuid("crawl_job_id").references(() => crawlJobs.id),
  status: pipelineStatusEnum("status").default("pending").notNull(),
  currentStep: text("current_step"),
  stepResults: jsonb("step_results").default({}),
  settings: jsonb("settings").default({}),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Step 2: Add the table to schema `relations` if the file uses them**

Check if there's a `relations()` call for other tables and add one for `pipelineRuns` → `projects` and `crawlJobs`.

**Step 3: Add pipeline settings + provenance columns to `projects` table**

In the `projects` table definition, add:

```typescript
  pipelineSettings: jsonb("pipeline_settings").default({}),
  siteDescriptionSource: text("site_description_source").default("auto"),
  industrySource: text("industry_source").default("auto"),
```

**Step 4: Push schema to dev DB**

Run: `cd packages/db && npx drizzle-kit push`

**Step 5: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add pipelineRuns table and project pipeline columns"
```

---

### Task 2: Add pipeline queries

**Files:**

- Create: `packages/db/src/queries/pipeline-runs.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Write failing test**

Create `packages/db/src/__tests__/queries/pipeline-runs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { pipelineRunQueries } from "../../queries/pipeline-runs";

function createMockDb() {
  const returning = vi.fn().mockResolvedValue([]);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where, returning });
  const values = vi.fn().mockReturnValue({ returning });
  return {
    db: {
      insert: vi.fn().mockReturnValue({ values }),
      update: vi.fn().mockReturnValue({ set }),
      query: {
        pipelineRuns: {
          findFirst: vi.fn().mockResolvedValue(undefined),
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    } as any,
    mocks: { returning, where, set, values },
  };
}

describe("pipelineRunQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let q: ReturnType<typeof pipelineRunQueries>;

  beforeEach(() => {
    mock = createMockDb();
    q = pipelineRunQueries(mock.db);
  });

  it("create inserts a new pipeline run", async () => {
    const data = {
      projectId: "proj-1",
      crawlJobId: "crawl-1",
      settings: { autoRunOnCrawl: true, skipSteps: [] },
    };
    mock.mocks.returning.mockResolvedValueOnce([{ id: "run-1", ...data }]);

    const result = await q.create(data);
    expect(mock.db.insert).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "run-1" });
  });

  it("getById returns a pipeline run", async () => {
    const fakeRun = { id: "run-1", status: "pending" };
    mock.db.query.pipelineRuns.findFirst.mockResolvedValueOnce(fakeRun);

    const result = await q.getById("run-1");
    expect(result).toEqual(fakeRun);
  });

  it("updateStep updates currentStep and stepResults", async () => {
    mock.mocks.returning.mockResolvedValueOnce([{ id: "run-1" }]);
    await q.updateStep("run-1", "competitors", {
      status: "completed",
      duration_ms: 500,
    });
    expect(mock.db.update).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/db && npx vitest run src/__tests__/queries/pipeline-runs.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `packages/db/src/queries/pipeline-runs.ts`:

```typescript
import { eq, and, desc } from "drizzle-orm";
import type { Database } from "../client";
import { pipelineRuns } from "../schema";

export function pipelineRunQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      crawlJobId?: string;
      settings?: Record<string, unknown>;
    }) {
      const [run] = await db.insert(pipelineRuns).values(data).returning();
      return run;
    },

    async getById(id: string) {
      return db.query.pipelineRuns.findFirst({
        where: eq(pipelineRuns.id, id),
      });
    },

    async getLatestByProject(projectId: string) {
      return db.query.pipelineRuns.findFirst({
        where: eq(pipelineRuns.projectId, projectId),
        orderBy: desc(pipelineRuns.createdAt),
      });
    },

    async listByProject(projectId: string) {
      return db.query.pipelineRuns.findMany({
        where: eq(pipelineRuns.projectId, projectId),
        orderBy: desc(pipelineRuns.createdAt),
      });
    },

    async updateStatus(
      id: string,
      status: "pending" | "running" | "paused" | "completed" | "failed",
      extra?: {
        currentStep?: string | null;
        error?: string;
        completedAt?: Date;
        startedAt?: Date;
      },
    ) {
      const [updated] = await db
        .update(pipelineRuns)
        .set({ status, ...extra })
        .where(eq(pipelineRuns.id, id))
        .returning();
      return updated;
    },

    async updateStep(
      id: string,
      stepName: string,
      stepResult: Record<string, unknown>,
    ) {
      // Merge step result into existing stepResults JSONB
      const existing = await this.getById(id);
      const stepResults = {
        ...((existing?.stepResults as Record<string, unknown>) ?? {}),
        [stepName]: stepResult,
      };
      const [updated] = await db
        .update(pipelineRuns)
        .set({ stepResults, currentStep: stepName })
        .where(eq(pipelineRuns.id, id))
        .returning();
      return updated;
    },
  };
}
```

**Step 4: Export from index**

Add to `packages/db/src/index.ts`:

```typescript
export { pipelineRunQueries } from "./queries/pipeline-runs";
```

Also register `pipelineRuns` in the Drizzle `relations` export and ensure the schema object used by `createDb` includes the new table.

**Step 5: Run test to verify it passes**

Run: `cd packages/db && npx vitest run src/__tests__/queries/pipeline-runs.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/db/src/queries/pipeline-runs.ts packages/db/src/__tests__/queries/pipeline-runs.test.ts packages/db/src/index.ts
git commit -m "feat(db): add pipeline run queries"
```

---

## Phase 2: Audit Service

### Task 3: Add audit query helpers

**Files:**

- Create: `packages/db/src/queries/audit-logs.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Write the query module**

The `auditLogs` table already exists in schema. Create `packages/db/src/queries/audit-logs.ts`:

```typescript
import { eq, desc, and, gte, sql } from "drizzle-orm";
import type { Database } from "../client";
import { auditLogs } from "../schema";

export function auditLogQueries(db: Database) {
  return {
    async create(data: {
      actorId: string;
      action: string;
      resourceType: string;
      resourceId?: string;
      metadata?: Record<string, unknown>;
      orgId?: string;
      ipAddress?: string;
      userAgent?: string;
    }) {
      const [log] = await db.insert(auditLogs).values(data).returning();
      return log;
    },

    async listByActor(actorId: string, limit = 50) {
      return db.query.auditLogs.findMany({
        where: eq(auditLogs.actorId, actorId),
        orderBy: desc(auditLogs.createdAt),
        limit,
      });
    },

    async listByResource(resourceType: string, resourceId: string, limit = 50) {
      return db.query.auditLogs.findMany({
        where: and(
          eq(auditLogs.resourceType, resourceType),
          eq(auditLogs.resourceId, resourceId),
        ),
        orderBy: desc(auditLogs.createdAt),
        limit,
      });
    },

    async countByActionSince(action: string, since: Date) {
      const rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(
          and(eq(auditLogs.action, action), gte(auditLogs.createdAt, since)),
        );
      return rows[0]?.count ?? 0;
    },

    async getDistinctActionsByActor(actorId: string, since: Date) {
      const rows = await db
        .selectDistinct({ action: auditLogs.action })
        .from(auditLogs)
        .where(
          and(eq(auditLogs.actorId, actorId), gte(auditLogs.createdAt, since)),
        );
      return rows.map((r) => r.action);
    },
  };
}
```

**Step 2: Export from index**

Add to `packages/db/src/index.ts`:

```typescript
export { auditLogQueries } from "./queries/audit-logs";
```

**Step 3: Commit**

```bash
git add packages/db/src/queries/audit-logs.ts packages/db/src/index.ts
git commit -m "feat(db): add audit log query helpers"
```

---

### Task 4: Create audit service

**Files:**

- Create: `apps/api/src/services/audit-service.ts`
- Create: `apps/api/src/__tests__/services/audit-service.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuditQueries = {
  create: vi.fn().mockResolvedValue({ id: "log-1" }),
};
const mockOutbox = {
  enqueue: vi.fn().mockResolvedValue({ id: "evt-1" }),
};

vi.mock("@llm-boost/db", () => ({
  auditLogQueries: () => mockAuditQueries,
  outboxQueries: () => mockOutbox,
}));

import { createAuditService } from "../../services/audit-service";

describe("AuditService", () => {
  const fakeDb = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emitEvent writes to auditLogs and enqueues outbox event", async () => {
    const service = createAuditService(fakeDb);
    await service.emitEvent({
      action: "crawl.started",
      actorId: "user-1",
      resourceType: "crawl_job",
      resourceId: "crawl-1",
    });

    expect(mockAuditQueries.create).toHaveBeenCalledWith({
      action: "crawl.started",
      actorId: "user-1",
      resourceType: "crawl_job",
      resourceId: "crawl-1",
      metadata: undefined,
    });
    expect(mockOutbox.enqueue).toHaveBeenCalledWith({
      type: "audit.crawl.started",
      payload: expect.objectContaining({ action: "crawl.started" }),
    });
  });

  it("emitEvent does not throw if outbox enqueue fails", async () => {
    mockOutbox.enqueue.mockRejectedValueOnce(new Error("DB error"));
    const service = createAuditService(fakeDb);

    await expect(
      service.emitEvent({
        action: "project.created",
        actorId: "user-1",
        resourceType: "project",
      }),
    ).resolves.not.toThrow();

    expect(mockAuditQueries.create).toHaveBeenCalled();
  });
});
```

**Step 2: Run test — verify fails**

Run: `cd apps/api && npx vitest run src/__tests__/services/audit-service.test.ts`

**Step 3: Write implementation**

Create `apps/api/src/services/audit-service.ts`:

```typescript
import { auditLogQueries, outboxQueries } from "@llm-boost/db";
import type { Database } from "@llm-boost/db";

export interface AuditEvent {
  action: string;
  actorId: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  orgId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export function createAuditService(db: Database) {
  const audit = auditLogQueries(db);
  const outbox = outboxQueries(db);

  return {
    async emitEvent(event: AuditEvent) {
      // Write to audit log (synchronous — must succeed)
      await audit.create({
        action: event.action,
        actorId: event.actorId,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        metadata: event.metadata,
        orgId: event.orgId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      });

      // Enqueue outbox event for async side effects (best-effort)
      try {
        await outbox.enqueue({
          type: `audit.${event.action}`,
          payload: {
            action: event.action,
            actorId: event.actorId,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            metadata: event.metadata,
          },
        });
      } catch {
        // Outbox failure should not block the primary action
      }
    },
  };
}
```

**Step 4: Run test — verify passes**

Run: `cd apps/api && npx vitest run src/__tests__/services/audit-service.test.ts`

**Step 5: Commit**

```bash
git add apps/api/src/services/audit-service.ts apps/api/src/__tests__/services/audit-service.test.ts
git commit -m "feat(api): add audit service with outbox event emission"
```

---

## Phase 3: Pipeline Service

### Task 5: Create pipeline service

**Files:**

- Create: `apps/api/src/services/pipeline-service.ts`
- Create: `apps/api/src/__tests__/services/pipeline-service.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPipelineRuns = {
  create: vi
    .fn()
    .mockResolvedValue({ id: "run-1", status: "pending", stepResults: {} }),
  getById: vi.fn().mockResolvedValue(null),
  updateStatus: vi.fn().mockResolvedValue({ id: "run-1" }),
  updateStep: vi.fn().mockResolvedValue({ id: "run-1" }),
};

const mockAudit = {
  emitEvent: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@llm-boost/db", () => ({
  pipelineRunQueries: () => mockPipelineRuns,
  projectQueries: () => ({
    getById: vi.fn().mockResolvedValue({
      id: "proj-1",
      userId: "user-1",
      domain: "example.com",
      pipelineSettings: { autoRunOnCrawl: true, skipSteps: [] },
    }),
  }),
  userQueries: () => ({
    getById: vi.fn().mockResolvedValue({ id: "user-1", plan: "pro" }),
  }),
}));

import { createPipelineService } from "../../services/pipeline-service";

describe("PipelineService", () => {
  const fakeDb = {} as any;
  const fakeKeys = {
    databaseUrl: "postgresql://test",
    anthropicApiKey: "sk-test",
    perplexityApiKey: "pplx-test",
    grokApiKey: "grok-test",
    reportServiceUrl: "http://localhost:3001",
    sharedSecret: "secret",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pipeline run with pending status", async () => {
    const service = createPipelineService(fakeDb, mockAudit as any, fakeKeys);
    const run = await service.start("proj-1", "crawl-1");

    expect(mockPipelineRuns.create).toHaveBeenCalledWith({
      projectId: "proj-1",
      crawlJobId: "crawl-1",
      settings: { autoRunOnCrawl: true, skipSteps: [] },
    });
    expect(run).toMatchObject({ id: "run-1" });
  });

  it("skips steps listed in skipSteps setting", async () => {
    vi.mocked((await import("@llm-boost/db")).projectQueries).mockReturnValue({
      getById: vi.fn().mockResolvedValue({
        id: "proj-1",
        userId: "user-1",
        domain: "example.com",
        pipelineSettings: { autoRunOnCrawl: true, skipSteps: ["competitors"] },
      }),
    } as any);

    const service = createPipelineService(fakeDb, mockAudit as any, fakeKeys);
    await service.start("proj-1", "crawl-1");

    // Should emit a skip event for competitors
    expect(mockAudit.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pipeline.step.skipped" }),
    );
  });
});
```

**Step 2: Run test — verify fails**

Run: `cd apps/api && npx vitest run src/__tests__/services/pipeline-service.test.ts`

**Step 3: Write implementation**

Create `apps/api/src/services/pipeline-service.ts`:

```typescript
import { pipelineRunQueries, projectQueries, userQueries } from "@llm-boost/db";
import type { Database } from "@llm-boost/db";
import { runAutoSiteDescription } from "./auto-site-description-service";
import { runAutoCompetitorDiscovery } from "./auto-competitor-service";
import { runAutoKeywordGeneration } from "./auto-keyword-service";
import { runAutoVisibilityChecks } from "./auto-visibility-service";
import type { createAuditService } from "./audit-service";

type AuditService = ReturnType<typeof createAuditService>;

const PIPELINE_STEPS = [
  "site_description",
  "competitors",
  "keywords",
  "visibility_check",
  "content_optimization",
  "action_report",
  "health_check",
] as const;

type StepName = (typeof PIPELINE_STEPS)[number];

interface PipelineKeys {
  databaseUrl: string;
  anthropicApiKey: string;
  perplexityApiKey?: string;
  grokApiKey?: string;
  reportServiceUrl?: string;
  sharedSecret?: string;
}

interface PipelineSettings {
  autoRunOnCrawl?: boolean;
  skipSteps?: string[];
  competitorLimit?: number;
  keywordLimit?: number;
  visibilityProviders?: string[];
  contentOptimizationLimit?: number;
}

export function createPipelineService(
  db: Database,
  audit: AuditService,
  keys: PipelineKeys,
) {
  const runs = pipelineRunQueries(db);
  const projects = projectQueries(db);
  const users = userQueries(db);

  async function runStep(
    runId: string,
    step: StepName,
    projectId: string,
    crawlJobId: string,
    settings: PipelineSettings,
  ): Promise<void> {
    const start = Date.now();
    try {
      switch (step) {
        case "site_description":
          await runAutoSiteDescription({
            databaseUrl: keys.databaseUrl,
            projectId,
            crawlJobId,
            anthropicApiKey: keys.anthropicApiKey,
          });
          break;
        case "competitors":
          await runAutoCompetitorDiscovery({
            databaseUrl: keys.databaseUrl,
            projectId,
            anthropicApiKey: keys.anthropicApiKey,
            perplexityApiKey: keys.perplexityApiKey,
            grokApiKey: keys.grokApiKey,
          });
          break;
        case "keywords":
          await runAutoKeywordGeneration({
            databaseUrl: keys.databaseUrl,
            projectId,
            crawlJobId,
            anthropicApiKey: keys.anthropicApiKey,
          });
          break;
        case "visibility_check":
          await runAutoVisibilityChecks({
            databaseUrl: keys.databaseUrl,
            projectId,
            apiKeys: {
              anthropicApiKey: keys.anthropicApiKey,
              perplexityApiKey: keys.perplexityApiKey ?? "",
              grokApiKey: keys.grokApiKey ?? "",
            },
          });
          break;
        case "content_optimization":
          // Phase 4 — will be implemented as a separate service
          break;
        case "action_report":
          // Phase 5 — will be implemented as enhanced report
          break;
        case "health_check":
          // Phase 6 — will be implemented as a separate service
          break;
      }

      await runs.updateStep(runId, step, {
        status: "completed",
        duration_ms: Date.now() - start,
      });

      await audit.emitEvent({
        action: "pipeline.step.completed",
        actorId: "system",
        resourceType: "pipeline_run",
        resourceId: runId,
        metadata: { step, duration_ms: Date.now() - start },
      });
    } catch (err) {
      await runs.updateStep(runId, step, {
        status: "failed",
        duration_ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      // Don't rethrow — continue with next step
    }
  }

  return {
    async start(projectId: string, crawlJobId: string) {
      const project = await projects.getById(projectId);
      if (!project) throw new Error("Project not found");

      const settings = (project.pipelineSettings ?? {}) as PipelineSettings;
      const skipSteps = new Set(settings.skipSteps ?? []);

      const run = await runs.create({
        projectId,
        crawlJobId,
        settings,
      });

      await runs.updateStatus(run.id, "running", { startedAt: new Date() });

      await audit.emitEvent({
        action: "pipeline.started",
        actorId: "system",
        resourceType: "pipeline_run",
        resourceId: run.id,
        metadata: { projectId, crawlJobId },
      });

      for (const step of PIPELINE_STEPS) {
        if (skipSteps.has(step)) {
          await runs.updateStep(run.id, step, { status: "skipped" });
          await audit.emitEvent({
            action: "pipeline.step.skipped",
            actorId: "system",
            resourceType: "pipeline_run",
            resourceId: run.id,
            metadata: { step },
          });
          continue;
        }

        await runs.updateStatus(run.id, "running", { currentStep: step });
        await runStep(run.id, step, projectId, crawlJobId, settings);
      }

      await runs.updateStatus(run.id, "completed", {
        currentStep: null,
        completedAt: new Date(),
      });

      await audit.emitEvent({
        action: "pipeline.completed",
        actorId: "system",
        resourceType: "pipeline_run",
        resourceId: run.id,
        metadata: { projectId },
      });

      return runs.getById(run.id);
    },

    async getLatest(projectId: string) {
      return runs.getLatestByProject(projectId);
    },

    async list(projectId: string) {
      return runs.listByProject(projectId);
    },
  };
}
```

**Step 4: Run test — verify passes**

Run: `cd apps/api && npx vitest run src/__tests__/services/pipeline-service.test.ts`

**Step 5: Commit**

```bash
git add apps/api/src/services/pipeline-service.ts apps/api/src/__tests__/services/pipeline-service.test.ts
git commit -m "feat(api): add pipeline orchestration service"
```

---

## Phase 4: Content Optimization Service

### Task 6: Create content optimization service

**Files:**

- Create: `apps/api/src/services/content-optimization-service.ts`
- Create: `apps/api/src/__tests__/services/content-optimization-service.test.ts`

This service takes the lowest-scoring pages from a crawl and generates improvement suggestions using Claude.

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPages = [
  {
    id: "page-1",
    url: "https://example.com/blog",
    title: "Blog",
    wordCount: 200,
  },
];
const mockScores = [
  { pageId: "page-1", aiReadinessScore: 40, contentScore: 50, detail: {} },
];
const mockIssues = [
  { pageId: "page-1", code: "LOW_WORD_COUNT", message: "Content too thin" },
];

vi.mock("@llm-boost/db", () => ({
  pageQueries: () => ({ listByJob: vi.fn().mockResolvedValue(mockPages) }),
  scoreQueries: () => ({ listByJob: vi.fn().mockResolvedValue(mockScores) }),
  issueQueries: () => ({ listByJob: vi.fn().mockResolvedValue(mockIssues) }),
  contentFixQueries: () => ({ createMany: vi.fn().mockResolvedValue([]) }),
  createDb: vi.fn().mockReturnValue({}),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              improvements: [
                { type: "fact_density", suggestion: "Add specific statistics" },
                {
                  type: "structure",
                  suggestion: "Add FAQ section with schema",
                },
              ],
            }),
          },
        ],
      }),
    },
  })),
}));

import { runContentOptimization } from "../../services/content-optimization-service";

describe("ContentOptimizationService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates improvement suggestions for low-scoring pages", async () => {
    await expect(
      runContentOptimization({
        databaseUrl: "postgresql://test",
        projectId: "proj-1",
        crawlJobId: "crawl-1",
        anthropicApiKey: "sk-test",
        limit: 10,
      }),
    ).resolves.not.toThrow();
  });
});
```

**Step 2: Write implementation**

Create `apps/api/src/services/content-optimization-service.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import {
  createDb,
  pageQueries,
  scoreQueries,
  issueQueries,
  contentFixQueries,
} from "@llm-boost/db";

export interface ContentOptimizationInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
  anthropicApiKey: string;
  limit?: number;
}

export async function runContentOptimization(
  input: ContentOptimizationInput,
): Promise<void> {
  const db = createDb(input.databaseUrl);
  const pages = await pageQueries(db).listByJob(input.crawlJobId);
  const scores = await scoreQueries(db).listByJob(input.crawlJobId);
  const issues = await issueQueries(db).listByJob(input.crawlJobId);

  // Sort pages by AI readiness score (ascending) and take lowest N
  const limit = input.limit ?? 10;
  const scoreMap = new Map(scores.map((s) => [s.pageId, s]));
  const issueMap = new Map<string, typeof issues>();
  for (const issue of issues) {
    const arr = issueMap.get(issue.pageId) ?? [];
    arr.push(issue);
    issueMap.set(issue.pageId, arr);
  }

  const ranked = pages
    .map((p) => ({ page: p, score: scoreMap.get(p.id) }))
    .filter((r) => r.score)
    .sort(
      (a, b) =>
        (a.score!.aiReadinessScore ?? 100) - (b.score!.aiReadinessScore ?? 100),
    )
    .slice(0, limit);

  if (ranked.length === 0) return;

  const client = new Anthropic({ apiKey: input.anthropicApiKey });

  for (const { page, score } of ranked) {
    const pageIssues = issueMap.get(page.id) ?? [];

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Analyze this page and suggest improvements for AI visibility:

URL: ${page.url}
Title: ${page.title ?? "None"}
Word Count: ${page.wordCount ?? 0}
AI Readiness Score: ${score!.aiReadinessScore}/100
Content Score: ${score!.contentScore}/100
Issues: ${pageIssues.map((i) => i.code).join(", ") || "None"}

Return JSON: { "improvements": [{ "type": "fact_density"|"structure"|"schema"|"meta"|"tone", "suggestion": string, "priority": "high"|"medium"|"low" }] }`,
          },
        ],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.improvements?.length) {
          await contentFixQueries(db).createMany(
            parsed.improvements.map((imp: any) => ({
              pageId: page.id,
              projectId: input.projectId,
              crawlJobId: input.crawlJobId,
              fixType: imp.type,
              suggestion: imp.suggestion,
              priority: imp.priority ?? "medium",
              source: "ai_generated",
            })),
          );
        }
      }
    } catch {
      // Continue with next page on failure
    }
  }
}
```

**Note:** The `contentFixQueries` may need to be created if it doesn't exist. Check `packages/db/src/queries/` for existing content fix queries. The `contentFixes` table already exists in the schema.

**Step 3: Run tests, commit**

```bash
git add apps/api/src/services/content-optimization-service.ts apps/api/src/__tests__/services/content-optimization-service.test.ts
git commit -m "feat(api): add content optimization service for low-scoring pages"
```

---

## Phase 5: Health Check Service

### Task 7: Create health check service

**Files:**

- Create: `apps/api/src/services/health-check-service.ts`
- Create: `apps/api/src/__tests__/services/health-check-service.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@llm-boost/db", () => ({
  createDb: vi.fn().mockReturnValue({}),
  projectQueries: () => ({
    getById: vi.fn().mockResolvedValue({
      id: "proj-1",
      domain: "https://example.com",
      crawlSchedule: "manual",
      pipelineSettings: {},
    }),
  }),
  savedKeywordQueries: () => ({
    countByProject: vi.fn().mockResolvedValue(2),
  }),
  competitorQueries: () => ({
    listByProject: vi.fn().mockResolvedValue([]),
  }),
  userQueries: () => ({
    getById: vi.fn().mockResolvedValue({ id: "user-1", plan: "pro" }),
  }),
  issueQueries: () => ({
    listByJob: vi.fn().mockResolvedValue([
      { code: "AI_CRAWLER_BLOCKED", severity: "critical" },
      { code: "MISSING_LLMS_TXT", severity: "critical" },
    ]),
  }),
}));

import { runHealthCheck } from "../../services/health-check-service";

describe("HealthCheckService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("flags missing competitors", async () => {
    const result = await runHealthCheck({
      databaseUrl: "postgresql://test",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        check: "competitors_tracked",
        status: "fail",
        autoFixable: true,
      }),
    );
  });

  it("flags low keyword count", async () => {
    const result = await runHealthCheck({
      databaseUrl: "postgresql://test",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        check: "keyword_coverage",
        status: "fail",
      }),
    );
  });

  it("flags manual crawl schedule on paid plan", async () => {
    const result = await runHealthCheck({
      databaseUrl: "postgresql://test",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        check: "crawl_schedule",
        status: "warn",
      }),
    );
  });

  it("includes critical issues from crawl", async () => {
    const result = await runHealthCheck({
      databaseUrl: "postgresql://test",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        check: "ai_crawler_access",
        status: "fail",
      }),
    );
  });
});
```

**Step 2: Write implementation**

Create `apps/api/src/services/health-check-service.ts`:

```typescript
import {
  createDb,
  projectQueries,
  savedKeywordQueries,
  competitorQueries,
  userQueries,
  issueQueries,
} from "@llm-boost/db";

export interface HealthCheckInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
}

interface CheckResult {
  check: string;
  category: "technical" | "configuration" | "billing";
  status: "pass" | "warn" | "fail";
  message: string;
  autoFixable: boolean;
  suggestion?: string;
}

export interface HealthCheckResult {
  projectId: string;
  crawlJobId: string;
  checks: CheckResult[];
  score: number; // 0-100
}

export async function runHealthCheck(
  input: HealthCheckInput,
): Promise<HealthCheckResult> {
  const db = createDb(input.databaseUrl);
  const project = await projectQueries(db).getById(input.projectId);
  if (!project) throw new Error("Project not found");

  const user = await userQueries(db).getById(project.userId);
  const keywordCount = await savedKeywordQueries(db).countByProject(
    input.projectId,
  );
  const competitors = await competitorQueries(db).listByProject(
    input.projectId,
  );
  const issues = await issueQueries(db).listByJob(input.crawlJobId);

  const checks: CheckResult[] = [];
  const issuesCodes = new Set(issues.map((i) => i.code));

  // Technical checks from crawl issues
  if (issuesCodes.has("AI_CRAWLER_BLOCKED")) {
    checks.push({
      check: "ai_crawler_access",
      category: "technical",
      status: "fail",
      message: "AI crawlers are blocked in robots.txt",
      autoFixable: true,
      suggestion: "Update robots.txt to allow GPTBot, ClaudeBot, PerplexityBot",
    });
  } else {
    checks.push({
      check: "ai_crawler_access",
      category: "technical",
      status: "pass",
      message: "AI crawlers have access",
      autoFixable: false,
    });
  }

  if (issuesCodes.has("MISSING_LLMS_TXT")) {
    checks.push({
      check: "llms_txt",
      category: "technical",
      status: "fail",
      message: "No llms.txt file found",
      autoFixable: true,
      suggestion: "Generate llms.txt from site context to guide AI crawlers",
    });
  } else {
    checks.push({
      check: "llms_txt",
      category: "technical",
      status: "pass",
      message: "llms.txt is present",
      autoFixable: false,
    });
  }

  // Configuration checks
  if (competitors.length === 0) {
    checks.push({
      check: "competitors_tracked",
      category: "configuration",
      status: "fail",
      message: "No competitors tracked",
      autoFixable: true,
      suggestion: "Run competitor auto-discovery to identify top competitors",
    });
  } else {
    checks.push({
      check: "competitors_tracked",
      category: "configuration",
      status: "pass",
      message: `${competitors.length} competitors tracked`,
      autoFixable: false,
    });
  }

  if (keywordCount < 5) {
    checks.push({
      check: "keyword_coverage",
      category: "configuration",
      status: "fail",
      message: `Only ${keywordCount} keywords tracked (recommend 5+)`,
      autoFixable: true,
      suggestion: "Generate more keywords from crawl data",
    });
  } else {
    checks.push({
      check: "keyword_coverage",
      category: "configuration",
      status: "pass",
      message: `${keywordCount} keywords tracked`,
      autoFixable: false,
    });
  }

  if (project.crawlSchedule === "manual" && user && user.plan !== "free") {
    checks.push({
      check: "crawl_schedule",
      category: "configuration",
      status: "warn",
      message: "Crawl schedule is manual on a paid plan",
      autoFixable: true,
      suggestion: "Enable weekly automatic crawls to track changes",
    });
  }

  const passCount = checks.filter((c) => c.status === "pass").length;
  const score = Math.round((passCount / checks.length) * 100);

  return {
    projectId: input.projectId,
    crawlJobId: input.crawlJobId,
    checks,
    score,
  };
}
```

**Step 3: Run tests, commit**

```bash
git add apps/api/src/services/health-check-service.ts apps/api/src/__tests__/services/health-check-service.test.ts
git commit -m "feat(api): add health check service for settings validation"
```

---

## Phase 6: Wire Pipeline to Crawl Completion

### Task 8: Trigger pipeline from crawl ingestion

**Files:**

- Modify: `apps/api/src/routes/projects.ts` (the `/rerun-auto-generation` route, or wherever crawl completion is handled)

**Step 1: Find where crawl completion triggers auto-generation**

The existing route `POST /projects/:id/rerun-auto-generation` manually triggers auto-services. We need to also look for where crawl status changes to `completed` — this is likely in the crawl ingestion callback route.

Search for: `status.*completed` in `apps/api/src/routes/crawls.ts` or an ingestion route.

**Step 2: Add pipeline trigger**

After crawl status is set to `completed`, add:

```typescript
import { createPipelineService } from "../services/pipeline-service";
import { createAuditService } from "../services/audit-service";

// After crawl marked complete:
const project = await projectQueries(db).getById(crawlJob.projectId);
const settings = (project?.pipelineSettings ?? {}) as Record<string, unknown>;

if (settings.autoRunOnCrawl !== false) {
  const audit = createAuditService(db);
  const pipeline = createPipelineService(db, audit, {
    databaseUrl: c.env.DATABASE_URL,
    anthropicApiKey: c.env.ANTHROPIC_API_KEY,
    perplexityApiKey: c.env.PERPLEXITY_API_KEY,
    grokApiKey: c.env.GROK_API_KEY,
    reportServiceUrl: c.env.REPORT_SERVICE_URL,
    sharedSecret: c.env.CRAWLER_SHARED_SECRET,
  });

  // Fire and forget — don't block the response
  pipeline.start(crawlJob.projectId, crawlJob.id).catch((err) => {
    const log = c.get("logger");
    log.error("Pipeline failed", {
      error: String(err),
      projectId: crawlJob.projectId,
    });
  });
}
```

**Step 3: Update the existing `/rerun-auto-generation` to use pipeline service**

Replace the manual `Promise.allSettled` orchestration with:

```typescript
const audit = createAuditService(db);
const pipeline = createPipelineService(db, audit, {
  /* keys */
});
const run = await pipeline.start(projectId, jobId);
return c.json({ data: { pipelineRunId: run?.id, status: run?.status } });
```

**Step 4: Commit**

```bash
git add apps/api/src/routes/projects.ts apps/api/src/routes/crawls.ts
git commit -m "feat(api): wire pipeline service to crawl completion and rerun-auto-generation"
```

---

## Phase 7: Pipeline API Routes

### Task 9: Add pipeline routes

**Files:**

- Create: `apps/api/src/routes/pipeline.ts`
- Modify: `apps/api/src/index.ts` (register route)

**Step 1: Create routes**

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { pipelineRunQueries, projectQueries } from "@llm-boost/db";

export const pipelineRoutes = new Hono<AppEnv>();

// GET /pipeline/:projectId — List pipeline runs for a project
pipelineRoutes.get("/:projectId", authMiddleware, async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");
  const runs = await pipelineRunQueries(db).listByProject(projectId);

  return c.json({
    data: runs.map((r) => ({
      id: r.id,
      status: r.status,
      currentStep: r.currentStep,
      stepResults: r.stepResults,
      startedAt: r.startedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

// GET /pipeline/:projectId/latest — Get latest pipeline run
pipelineRoutes.get("/:projectId/latest", authMiddleware, async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");
  const run = await pipelineRunQueries(db).getLatestByProject(projectId);

  if (!run) return c.json({ data: null });

  return c.json({
    data: {
      id: run.id,
      status: run.status,
      currentStep: run.currentStep,
      stepResults: run.stepResults,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
    },
  });
});

// PATCH /pipeline/:projectId/settings — Update pipeline settings
pipelineRoutes.patch("/:projectId/settings", authMiddleware, async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");
  const body = await c.req.json<Record<string, unknown>>();

  const project = await projectQueries(db).getById(projectId);
  if (!project) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  // Merge new settings with existing
  const existing = (project.pipelineSettings ?? {}) as Record<string, unknown>;
  const merged = { ...existing, ...body };

  await projectQueries(db).update(projectId, { pipelineSettings: merged });

  return c.json({ data: merged });
});
```

**Step 2: Register in app**

In `apps/api/src/index.ts`, add:

```typescript
import { pipelineRoutes } from "./routes/pipeline";
// ...
app.route("/api/pipeline", pipelineRoutes);
```

**Step 3: Commit**

```bash
git add apps/api/src/routes/pipeline.ts apps/api/src/index.ts
git commit -m "feat(api): add pipeline routes for run listing and settings"
```

---

## Phase 8: MCP Tool Enhancements

### Task 10: Add MCP pipeline and action-item tools

**Files:**

- Create: `packages/mcp/src/tools/pipeline.ts`
- Modify: `packages/mcp/src/tools/register.ts`

**Step 1: Create pipeline tools**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "../types";
import { formatError } from "../utils";

export function registerPipelineTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.tool(
    "run_full_analysis",
    {
      description:
        "Run the full AI intelligence pipeline for a project: site description, competitors, keywords, visibility checks, content optimization, action report, and health check. Returns summary when complete.",
      inputSchema: {
        type: "object" as const,
        properties: {
          project_id: { type: "string", description: "Project ID to analyze" },
        },
        required: ["project_id"],
      },
    },
    async (args: { project_id: string }) => {
      try {
        const result = await ctx.client.post(
          `/api/projects/${args.project_id}/rerun-auto-generation`,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Pipeline triggered. ${JSON.stringify(result.data)}`,
            },
          ],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "get_action_items",
    {
      description:
        "Get prioritized action items with fix code snippets for a project. Includes llms.txt generation, schema markup, meta tag fixes, and competitor advantages.",
      inputSchema: {
        type: "object" as const,
        properties: {
          project_id: { type: "string", description: "Project ID" },
        },
        required: ["project_id"],
      },
    },
    async (args: { project_id: string }) => {
      try {
        const result = await ctx.client.get(
          `/api/pipeline/${args.project_id}/latest`,
        );
        const recommendations = await ctx.client.get(
          `/api/visibility/${args.project_id}/recommendations`,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  pipeline: result.data,
                  recommendations: recommendations.data,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "validate_settings",
    {
      description:
        "Run a health check on project settings. Validates robots.txt, llms.txt, schema markup, crawl schedule, keyword coverage, competitor tracking, and plan utilization.",
      inputSchema: {
        type: "object" as const,
        properties: {
          project_id: { type: "string", description: "Project ID" },
        },
        required: ["project_id"],
      },
    },
    async (args: { project_id: string }) => {
      try {
        const result = await ctx.client.get(
          `/api/pipeline/${args.project_id}/health-check`,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "update_project_context",
    {
      description:
        "Update project site description, industry, or pipeline settings.",
      inputSchema: {
        type: "object" as const,
        properties: {
          project_id: { type: "string", description: "Project ID" },
          site_description: { type: "string", description: "Site description" },
          industry: { type: "string", description: "Industry" },
          pipeline_settings: {
            type: "object",
            description: "Pipeline settings (autoRunOnCrawl, skipSteps, etc.)",
          },
        },
        required: ["project_id"],
      },
    },
    async (args: {
      project_id: string;
      site_description?: string;
      industry?: string;
      pipeline_settings?: Record<string, unknown>;
    }) => {
      try {
        if (args.site_description || args.industry) {
          await ctx.client.patch(
            `/api/projects/${args.project_id}/site-context`,
            {
              siteDescription: args.site_description,
              industry: args.industry,
            },
          );
        }
        if (args.pipeline_settings) {
          await ctx.client.patch(
            `/api/pipeline/${args.project_id}/settings`,
            args.pipeline_settings,
          );
        }
        return {
          content: [
            { type: "text" as const, text: "Project context updated." },
          ],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "add_competitor",
    {
      description: "Add a competitor domain to track for a project.",
      inputSchema: {
        type: "object" as const,
        properties: {
          project_id: { type: "string", description: "Project ID" },
          domain: {
            type: "string",
            description: "Competitor domain (e.g. competitor.com)",
          },
        },
        required: ["project_id", "domain"],
      },
    },
    async (args: { project_id: string; domain: string }) => {
      try {
        const result = await ctx.client.post(
          `/api/competitors/${args.project_id}`,
          { domain: args.domain },
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Competitor added: ${args.domain}. ${JSON.stringify(result.data)}`,
            },
          ],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "remove_competitor",
    {
      description: "Remove a tracked competitor from a project.",
      inputSchema: {
        type: "object" as const,
        properties: {
          competitor_id: {
            type: "string",
            description: "Competitor ID to remove",
          },
        },
        required: ["competitor_id"],
      },
    },
    async (args: { competitor_id: string }) => {
      try {
        await ctx.client.delete(`/api/competitors/${args.competitor_id}`);
        return {
          content: [{ type: "text" as const, text: "Competitor removed." }],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );
}
```

**Step 2: Register in `register.ts`**

Add to `packages/mcp/src/tools/register.ts`:

```typescript
import { registerPipelineTools } from "./pipeline";
// In registerAllTools():
registerPipelineTools(server, ctx);
```

**Step 3: Commit**

```bash
git add packages/mcp/src/tools/pipeline.ts packages/mcp/src/tools/register.ts
git commit -m "feat(mcp): add pipeline, action-items, health-check, and competitor tools"
```

---

## Phase 9: Recommendations Service

### Task 11: Create recommendations service for dashboard

**Files:**

- Create: `apps/api/src/services/recommendations-service.ts`
- Create: `apps/api/src/__tests__/services/recommendations-service.test.ts`

**Step 1: Write implementation**

This service computes the "Next Best Actions" for the dashboard widget. It reads the latest crawl results, competitor changes, keyword coverage, and unused features.

```typescript
import type { Database } from "@llm-boost/db";
import {
  projectQueries,
  userQueries,
  crawlQueries,
  scoreQueries,
  issueQueries,
  savedKeywordQueries,
  competitorQueries,
  pipelineRunQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS, resolveEffectivePlan } from "@llm-boost/shared";

interface Recommendation {
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  action?: string; // API endpoint or MCP tool to invoke
}

export function createRecommendationsService(db: Database) {
  return {
    async getForProject(projectId: string): Promise<Recommendation[]> {
      const project = await projectQueries(db).getById(projectId);
      if (!project) return [];

      const user = await userQueries(db).getById(project.userId);
      if (!user) return [];

      const recommendations: Recommendation[] = [];
      const effectivePlan = resolveEffectivePlan(user);
      const limits = PLAN_LIMITS[effectivePlan];

      // Check latest crawl
      const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
      if (!latestCrawl) {
        recommendations.push({
          priority: "critical",
          category: "crawl",
          title: "Run your first crawl",
          description:
            "No crawl data yet. Start a crawl to get your AI-readiness score.",
          action: "start_crawl",
        });
        return recommendations;
      }

      // Check crawl age
      const daysSinceCrawl = latestCrawl.completedAt
        ? Math.floor(
            (Date.now() - latestCrawl.completedAt.getTime()) / 86400000,
          )
        : null;
      if (daysSinceCrawl && daysSinceCrawl > 14) {
        recommendations.push({
          priority: "medium",
          category: "crawl",
          title: "Re-crawl your site",
          description: `Last crawl was ${daysSinceCrawl} days ago. Re-crawl to check for changes.`,
          action: "start_crawl",
        });
      }

      // Check critical issues
      if (latestCrawl.id) {
        const issues = await issueQueries(db).listByJob(latestCrawl.id);
        const criticalIssues = issues.filter((i) => i.severity === "critical");
        if (criticalIssues.length > 0) {
          recommendations.push({
            priority: "critical",
            category: "issues",
            title: `${criticalIssues.length} critical issues found`,
            description: criticalIssues
              .map((i) => i.message)
              .slice(0, 3)
              .join("; "),
            action: "get_action_items",
          });
        }
      }

      // Check keyword coverage
      const keywordCount =
        await savedKeywordQueries(db).countByProject(projectId);
      if (keywordCount < 5) {
        recommendations.push({
          priority: "high",
          category: "keywords",
          title: "Add more keywords",
          description: `Only ${keywordCount} keywords tracked. Add at least 5 for meaningful visibility data.`,
          action: "discover_keywords_from_visibility",
        });
      }

      // Check competitor tracking
      const competitors = await competitorQueries(db).listByProject(projectId);
      if (competitors.length === 0) {
        recommendations.push({
          priority: "high",
          category: "competitors",
          title: "Track competitors",
          description:
            "No competitors tracked. Discover competitors to benchmark against.",
          action: "run_full_analysis",
        });
      }

      // Check pipeline hasn't run
      const latestPipeline =
        await pipelineRunQueries(db).getLatestByProject(projectId);
      if (!latestPipeline) {
        recommendations.push({
          priority: "medium",
          category: "pipeline",
          title: "Run full analysis",
          description:
            "Run the AI intelligence pipeline for comprehensive insights.",
          action: "run_full_analysis",
        });
      }

      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      recommendations.sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
      );

      return recommendations.slice(0, 5);
    },
  };
}
```

**Step 2: Add route**

Add to `apps/api/src/routes/pipeline.ts`:

```typescript
import { createRecommendationsService } from "../services/recommendations-service";

// GET /pipeline/:projectId/recommendations — Next best actions
pipelineRoutes.get("/:projectId/recommendations", authMiddleware, async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");
  const service = createRecommendationsService(db);
  const recommendations = await service.getForProject(projectId);
  return c.json({ data: recommendations });
});
```

**Step 3: Write tests, commit**

```bash
git add apps/api/src/services/recommendations-service.ts apps/api/src/__tests__/services/recommendations-service.test.ts apps/api/src/routes/pipeline.ts
git commit -m "feat(api): add recommendations service for dashboard next-best-actions"
```

---

## Phase 10: Sprinkle Audit Events

### Task 12: Add audit events to existing services

**Files:**

- Modify: `apps/api/src/routes/projects.ts` — emit `project.created`, `project.updated`, `project.deleted`
- Modify: `apps/api/src/routes/crawls.ts` — emit `crawl.started`
- Modify: `apps/api/src/routes/keywords.ts` — emit `keyword.added`, `keyword.removed`
- Modify: `apps/api/src/routes/competitors.ts` — emit `competitor.added`, `competitor.removed`

**Pattern for each route:**

```typescript
import { createAuditService } from "../services/audit-service";

// After the primary action succeeds:
const audit = createAuditService(db);
await audit
  .emitEvent({
    action: "project.created",
    actorId: userId,
    resourceType: "project",
    resourceId: newProject.id,
  })
  .catch(() => {}); // Never block the response
```

**Step 1: Add audit events to each route (one at a time)**

For each route file, add the audit import and `emitEvent` call after the primary action. Use `.catch(() => {})` to ensure audit failures never block user actions.

**Step 2: Commit after each file**

```bash
git commit -m "feat(api): add audit events to project routes"
git commit -m "feat(api): add audit events to crawl routes"
git commit -m "feat(api): add audit events to keyword routes"
git commit -m "feat(api): add audit events to competitor routes"
```

---

## Phase 11: Provenance Tracking

### Task 13: Track AI vs user source on site description

**Files:**

- Modify: `apps/api/src/services/auto-site-description-service.ts` — set `siteDescriptionSource: "auto"`, `industrySource: "auto"`
- Modify: `apps/api/src/routes/projects.ts` (PATCH site-context) — set `siteDescriptionSource: "user"`, `industrySource: "user"` when user manually updates

**Step 1: Update auto-service**

In `auto-site-description-service.ts`, where it calls `projectQueries(db).update(...)`, add the source fields:

```typescript
await projectQueries(db).update(projectId, {
  siteDescription: result.siteDescription,
  industry: result.industry,
  siteDescriptionSource: "auto",
  industrySource: "auto",
});
```

**Step 2: Update manual route**

In the `PATCH /:id/site-context` handler, add source tracking:

```typescript
await projectQueries(db).update(projectId, {
  ...(body.siteDescription !== undefined && {
    siteDescription: body.siteDescription,
    siteDescriptionSource: "user",
  }),
  ...(body.industry !== undefined && {
    industry: body.industry,
    industrySource: "user",
  }),
});
```

**Step 3: Commit**

```bash
git add apps/api/src/services/auto-site-description-service.ts apps/api/src/routes/projects.ts
git commit -m "feat(api): track provenance (ai vs user) on site description and industry"
```

---

## Phase 12: Final Verification

### Task 14: Typecheck and test all packages

**Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: All packages pass (ignore pre-existing crawl-service.test.ts errors)

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Push schema to dev DB**

Run: `cd packages/db && npx drizzle-kit push`

**Step 4: Final commit**

If any fixes were needed:

```bash
git commit -m "fix: resolve type/test issues from pipeline implementation"
```

---

## Summary

| Phase                   | Tasks | New Files                                   | Modified Files             |
| ----------------------- | ----- | ------------------------------------------- | -------------------------- |
| 1. Schema               | 1-2   | `queries/pipeline-runs.ts`                  | `schema.ts`, `index.ts`    |
| 2. Audit                | 3-4   | `queries/audit-logs.ts`, `audit-service.ts` | `index.ts`                 |
| 3. Pipeline             | 5     | `pipeline-service.ts`                       | —                          |
| 4. Content Optimization | 6     | `content-optimization-service.ts`           | —                          |
| 5. Health Check         | 7     | `health-check-service.ts`                   | —                          |
| 6. Wire Pipeline        | 8     | —                                           | `projects.ts`, `crawls.ts` |
| 7. API Routes           | 9     | `routes/pipeline.ts`                        | `index.ts`                 |
| 8. MCP Tools            | 10    | `tools/pipeline.ts`                         | `register.ts`              |
| 9. Recommendations      | 11    | `recommendations-service.ts`                | `routes/pipeline.ts`       |
| 10. Audit Events        | 12    | —                                           | 4 route files              |
| 11. Provenance          | 13    | —                                           | 2 files                    |
| 12. Verification        | 14    | —                                           | —                          |

**Total: ~12 new files, ~10 modified files, 14 tasks**
