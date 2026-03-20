# Batch LLM Scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-page synchronous Anthropic API calls with the Message Batches API for 50% cost savings on content scoring.

**Architecture:** Add `llm_batch_jobs` DB table, modify `LLMScorer` to build batch requests, create a batch polling service called from cron, and update `llm-scoring.ts` to submit batches instead of calling `pMap`. Falls back to sync for < 5 uncached pages.

**Tech Stack:** `@anthropic-ai/sdk` (batches API), Drizzle ORM, Cloudflare Workers (cron), Vitest

**Spec:** `docs/superpowers/specs/2026-03-20-batch-llm-scoring-design.md`

---

### Task 1: Add `llm_batch_jobs` table and queries

**Files:**

- Modify: `packages/db/src/schema/features.ts` — add `llmBatchJobs` table
- Create: `packages/db/src/queries/batch-jobs.ts` — CRUD queries
- Modify: `packages/db/src/index.ts` — export new queries

- [ ] **Step 1: Add table schema**

In `packages/db/src/schema/features.ts`, add after the existing tables:

```typescript
export const llmBatchJobs = pgTable(
  "llm_batch_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: text("batch_id").notNull(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("submitted"),
    totalRequests: integer("total_requests").notNull().default(0),
    completedRequests: integer("completed_requests").notNull().default(0),
    failedRequests: integer("failed_requests").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    error: text("error"),
  },
  (t) => [
    index("idx_llm_batch_jobs_status").on(t.status),
    index("idx_llm_batch_jobs_job_id").on(t.jobId),
  ],
);
```

Import `crawlJobs` and `projects` from the appropriate schema files (they should already be importable).

- [ ] **Step 2: Create queries file**

Create `packages/db/src/queries/batch-jobs.ts`:

```typescript
import { eq, and, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { llmBatchJobs } from "../schema";

export function batchJobQueries(db: Database) {
  return {
    async create(data: {
      batchId: string;
      jobId: string;
      projectId: string;
      totalRequests: number;
    }) {
      const [row] = await db.insert(llmBatchJobs).values(data).returning();
      return row;
    },

    async listPending() {
      return db.query.llmBatchJobs.findMany({
        where: inArray(llmBatchJobs.status, ["submitted", "processing"]),
      });
    },

    async updateStatus(
      id: string,
      update: {
        status: string;
        completedRequests?: number;
        failedRequests?: number;
        completedAt?: Date;
        error?: string | null;
      },
    ) {
      const [row] = await db
        .update(llmBatchJobs)
        .set(update)
        .where(eq(llmBatchJobs.id, id))
        .returning();
      return row;
    },
  };
}
```

- [ ] **Step 3: Export from index**

In `packages/db/src/index.ts`, add:

```typescript
export { batchJobQueries } from "./queries/batch-jobs";
```

Also add `llmBatchJobs` to the schema export if needed for Drizzle relations.

- [ ] **Step 4: Push schema to DB**

Run: `cd packages/db && export $(grep -v '^#' ../../.env | xargs) && npx drizzle-kit push`

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @llm-boost/db typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/db/
git commit -m "feat: add llm_batch_jobs table for batch LLM scoring"
```

---

### Task 2: Add batch methods to LLMScorer

**Files:**

- Modify: `packages/llm/src/scorer.ts` — add `buildBatchRequests()` and `processBatchResult()`

- [ ] **Step 1: Add `buildBatchRequests` method**

Add to the `LLMScorer` class:

```typescript
/**
 * Build batch request objects for the Anthropic Batches API.
 * Checks KV cache first — only uncached pages go in the batch.
 * Returns cached results separately for immediate DB writes.
 */
async buildBatchRequests(
  pages: { pageId: string; text: string; contentHash: string }[],
): Promise<{
  cached: { pageId: string; scores: LLMContentScores }[];
  requests: {
    custom_id: string;
    params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user"; content: string }[];
    };
  }[];
}> {
  const cached: { pageId: string; scores: LLMContentScores }[] = [];
  const requests: typeof cached extends any[] ? {
    custom_id: string;
    params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user"; content: string }[];
    };
  }[] : never = [];

  for (const page of pages) {
    // Check cache
    if (this.kv) {
      const cachedScore = await getCachedScore(this.kv, page.contentHash);
      if (cachedScore) {
        cached.push({ pageId: page.pageId, scores: cachedScore });
        continue;
      }
    }

    // Skip thin content
    const wordCount = page.text.split(/\s+/).filter(Boolean).length;
    if (wordCount < MIN_WORD_COUNT) continue;

    const prompt = buildContentScoringPrompt(page.text);
    requests.push({
      custom_id: page.pageId,
      params: {
        model: this.model,
        max_tokens: 1024,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
      },
    });
  }

  return { cached, requests };
}
```

- [ ] **Step 2: Add `processBatchResult` method**

````typescript
/**
 * Parse a single batch result into LLMContentScores.
 * Same parsing logic as scoreContent().
 */
processBatchResult(
  resultMessage: { content: { type: string; text?: string }[] },
): LLMContentScores | null {
  const textBlock = resultMessage.content.find((b) => b.type === "text");
  if (!textBlock?.text) return null;

  let text = textBlock.text;
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  return JSON.parse(text) as LLMContentScores;
}
````

- [ ] **Step 3: Expose the Anthropic client**

Add a public getter so the batch polling service can use it:

```typescript
get anthropicClient(): Anthropic {
  return this.client;
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter @llm-boost/llm typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/llm/src/scorer.ts
git commit -m "feat: add batch request building and result parsing to LLMScorer"
```

---

### Task 3: Create batch polling service

**Files:**

- Create: `apps/api/src/services/batch-polling-service.ts`

- [ ] **Step 1: Create the service**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import {
  createDb,
  batchJobQueries,
  scoreQueries,
  pageQueries,
} from "@llm-boost/db";
import { LLMScorer } from "@llm-boost/llm";
import { createLogger } from "@llm-boost/shared";

const log = createLogger({ service: "batch-polling" });

export async function pollPendingBatches(env: {
  DATABASE_URL: string;
  ANTHROPIC_API_KEY: string;
  KV?: KVNamespace;
  R2?: R2Bucket;
}): Promise<{ polled: number; completed: number }> {
  const db = createDb(env.DATABASE_URL);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const pending = await batchJobQueries(db).listPending();

  if (pending.length === 0) return { polled: 0, completed: 0 };

  log.info(`Polling ${pending.length} pending batch jobs`);
  let completed = 0;

  for (const job of pending) {
    try {
      const batch = await client.messages.batches.retrieve(job.batchId);

      // Update status
      await batchJobQueries(db).updateStatus(job.id, {
        status: batch.processing_status,
        completedRequests: batch.request_counts.succeeded,
        failedRequests: batch.request_counts.errored,
      });

      if (batch.processing_status !== "ended") continue;

      // Fetch and process results
      const scorer = new LLMScorer({
        anthropicApiKey: env.ANTHROPIC_API_KEY,
        kvNamespace: env.KV,
      });

      let processed = 0;
      let failed = 0;

      for await (const result of await client.messages.batches.results(
        job.batchId,
      )) {
        if (result.result.type === "succeeded") {
          try {
            const scores = scorer.processBatchResult(result.result.message);
            if (scores) {
              // Cache the result
              if (env.KV) {
                const { setCachedScore } = await import("@llm-boost/llm/cache");
                // We need the content hash — get it from the page
                const page = await pageQueries(db).getById(result.custom_id);
                if (page?.contentHash) {
                  await setCachedScore(env.KV, page.contentHash, scores);
                }
              }

              // Update the score detail with LLM scores
              const scoreRows = await scoreQueries(db).listByPage(
                result.custom_id,
              );
              if (scoreRows.length > 0) {
                await scoreQueries(db).updateDetail(scoreRows[0].id, {
                  llmContentScores: scores,
                });
              }
              processed++;
            }
          } catch (err) {
            log.error("Failed to process batch result", {
              customId: result.custom_id,
              error: err instanceof Error ? err.message : String(err),
            });
            failed++;
          }
        } else {
          log.warn("Batch result not succeeded", {
            customId: result.custom_id,
            type: result.result.type,
          });
          failed++;
        }
      }

      await batchJobQueries(db).updateStatus(job.id, {
        status: "completed",
        completedRequests: processed,
        failedRequests: failed,
        completedAt: new Date(),
      });

      log.info("Batch job completed", {
        batchId: job.batchId,
        processed,
        failed,
      });
      completed++;
    } catch (err) {
      log.error("Batch polling error", {
        batchId: job.batchId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { polled: pending.length, completed };
}
```

Note: The result processing here is simplified — it only updates `detail.llmContentScores` without re-running the full scoring engine. For the initial implementation this is sufficient. A future enhancement could re-score pages with the full scoring engine to update pillar scores and recommendations.

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @llm-boost/api typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/batch-polling-service.ts
git commit -m "feat: batch polling service for Anthropic Message Batches"
```

---

### Task 4: Update LLM scoring to use batch API

**Files:**

- Modify: `apps/api/src/services/llm-scoring.ts`

- [ ] **Step 1: Add batch submission path**

Replace the `pMap` loop in `runLLMScoring` with:

```typescript
export async function runLLMScoring(input: LLMScoringInput): Promise<void> {
  const db = createDb(input.databaseUrl);
  const scorer = new LLMScorer({
    anthropicApiKey: input.anthropicApiKey,
    kvNamespace: input.kvNamespace,
  });

  // Build page data for batch request
  const pageData: { pageId: string; text: string; contentHash: string }[] = [];

  for (let i = 0; i < input.insertedPages.length; i++) {
    const crawlPage = input.batchPages[i];
    const scoreRow = input.insertedScores[i];
    if (!scoreRow || !crawlPage.content_hash || crawlPage.word_count < 200)
      continue;

    try {
      const r2Obj = await input.r2Bucket.get(crawlPage.html_r2_key);
      if (!r2Obj) continue;

      let html: string;
      if (r2Obj.httpMetadata?.contentEncoding === "gzip") {
        const ds = r2Obj.body.pipeThrough(new DecompressionStream("gzip"));
        html = await new Response(ds).text();
      } else {
        html = await r2Obj.text();
      }

      const text = html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      pageData.push({
        pageId: scoreRow.pageId,
        text,
        contentHash: crawlPage.content_hash,
      });
    } catch (err) {
      log.error("Failed to read page content for scoring", {
        pageId: scoreRow.pageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (pageData.length === 0) return;

  // Build batch requests (checks cache, skips cached pages)
  const { cached, requests } = await scorer.buildBatchRequests(pageData);
  log.info("Batch request built", {
    total: pageData.length,
    cached: cached.length,
    uncached: requests.length,
  });

  // Write cached results immediately
  for (const { pageId, scores } of cached) {
    try {
      const scoreRows = await scoreQueries(db).listByPage(pageId);
      if (scoreRows.length > 0) {
        await scoreQueries(db).updateDetail(scoreRows[0].id, {
          llmContentScores: scores,
        });
      }
    } catch (err) {
      log.error("Failed to write cached LLM score", {
        pageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (requests.length === 0) {
    log.info("All pages cached, no batch needed");
    return;
  }

  // Fallback: small batches use sync path (< 5 uncached pages)
  if (requests.length < 5) {
    log.info("Small batch, using sync scoring", { count: requests.length });
    for (const req of requests) {
      try {
        const page = pageData.find((p) => p.pageId === req.custom_id);
        if (!page) continue;
        const scores = await scorer.scoreContent(page.text, page.contentHash);
        if (!scores) continue;
        const scoreRows = await scoreQueries(db).listByPage(req.custom_id);
        if (scoreRows.length > 0) {
          await scoreQueries(db).updateDetail(scoreRows[0].id, {
            llmContentScores: scores,
          });
        }
      } catch (err) {
        log.error("Sync scoring failed", {
          pageId: req.custom_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return;
  }

  // Submit batch to Anthropic
  try {
    const batch = await scorer.anthropicClient.messages.batches.create({
      requests,
    });

    log.info("Batch submitted to Anthropic", {
      batchId: batch.id,
      requestCount: requests.length,
    });

    // Store for polling
    const { batchJobQueries } = await import("@llm-boost/db");
    await batchJobQueries(db).create({
      batchId: batch.id,
      jobId: input.jobId,
      projectId: "", // Will be set by the caller if available
      totalRequests: requests.length,
    });
  } catch (err) {
    log.error("Failed to submit batch", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Fallback to sync on batch submission failure
    log.info("Falling back to sync scoring");
    await pMap(
      requests,
      async (req) => {
        const page = pageData.find((p) => p.pageId === req.custom_id);
        if (!page) return;
        try {
          const scores = await scorer.scoreContent(page.text, page.contentHash);
          if (!scores) return;
          const scoreRows = await scoreQueries(db).listByPage(req.custom_id);
          if (scoreRows.length > 0) {
            await scoreQueries(db).updateDetail(scoreRows[0].id, {
              llmContentScores: scores,
            });
          }
        } catch {}
      },
      { concurrency: 5, settle: true },
    );
  }
}
```

- [ ] **Step 2: Update LLMScoringInput to include projectId**

Add `projectId?: string` to the `LLMScoringInput` interface.

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @llm-boost/api typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/llm-scoring.ts
git commit -m "feat: switch LLM scoring to Anthropic Batch API with sync fallback"
```

---

### Task 5: Add batch polling to cron

**Files:**

- Modify: `apps/api/src/scheduled.ts`

- [ ] **Step 1: Add batch polling step**

In `runScheduledTasks`, add a new try-catch block after the outbox processing:

```typescript
try {
  const { pollPendingBatches } =
    await import("./services/batch-polling-service");
  await pollPendingBatches({
    DATABASE_URL: env.DATABASE_URL,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    KV: env.KV,
    R2: env.R2,
  });
} catch (err) {
  log.error("Batch polling failed", {
    error: err instanceof Error ? err.message : String(err),
  });
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @llm-boost/api typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/scheduled.ts
git commit -m "feat: add batch polling to cron handler"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`

- [ ] **Step 2: Run API tests**

Run: `pnpm --filter @llm-boost/api test`

- [ ] **Step 3: Push schema to Neon**

Run: `cd packages/db && export $(grep -v '^#' ../../.env | xargs) && npx drizzle-kit push`

- [ ] **Step 4: Push and deploy**

```bash
git push
```

Verify deploy succeeds on GitHub Actions.
