# Anthropic Batch LLM Scoring — Design Spec

**Date:** 2026-03-20
**Scope:** Replace per-page synchronous Anthropic API calls with the Message Batches API for 50% cost savings on content scoring.

## Context

Content scoring is the most expensive LLM operation — 500+ calls per crawl at ~$0.001/call using `claude-haiku-4-5-20251001`. Currently uses `client.messages.create()` in a `pMap(concurrency: 5)` loop. The Anthropic Message Batches API processes requests at 50% of standard pricing with results typically available within minutes to hours.

## Architecture

### Current Flow

```
Crawl completes → outbox event → llm-scoring.ts → pMap(pages, scoreContent, {concurrency: 5}) → 500 individual API calls → update page_scores
```

### New Flow

```
Crawl completes → outbox event → llm-scoring.ts → check KV cache per page → build batch of uncached pages → client.messages.batches.create() → store batch_id in llm_batch_jobs → cron polls batch status every 5 min → batch complete → fetch results → update page_scores
```

## Changes

### 1. New table: `llm_batch_jobs`

```sql
CREATE TABLE llm_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT NOT NULL,          -- Anthropic batch ID (msgbatch_xxx)
  job_id UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted',  -- submitted | processing | ended | failed
  total_requests INT NOT NULL DEFAULT 0,
  completed_requests INT NOT NULL DEFAULT 0,
  failed_requests INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  error TEXT
);
```

### 2. `packages/llm/src/scorer.ts` — add `buildBatchRequests()` and `processBatchResults()`

**`buildBatchRequests(pages, kvNamespace)`:**

- For each page, check KV cache by content SHA256 hash
- If cached, skip (return cached result directly)
- If uncached, build a batch request object: `{ custom_id: pageId, params: { model, max_tokens, messages: [...] } }`
- Return: `{ cached: CachedResult[], requests: BatchRequest[] }`

**`processBatchResults(results)`:**

- Parse each result's `content[0].text` as JSON (same parsing logic as current `scoreContent`)
- Return array of `{ pageId, scores }` matching the current output format

### 3. `packages/llm/src/batch-poller.ts` — new module

**`submitBatch(client, requests)`:**

- Call `client.messages.batches.create({ requests })`
- Return `batch_id`

**`checkBatch(client, batchId)`:**

- Call `client.messages.batches.retrieve(batchId)`
- Return status object `{ status, counts: { processing, succeeded, errored, canceled, expired } }`

**`fetchResults(client, batchId)`:**

- Call `client.messages.batches.results(batchId)`
- Stream JSONL results, parse each line
- Return array of `{ custom_id, result: { type, message } }`

### 4. `apps/api/src/services/llm-scoring.ts` — switch to batch flow

Replace the `pMap` loop with:

```typescript
export async function runLLMScoring(input: LLMScoringInput): Promise<void> {
  const scorer = new LLMScorer({ anthropicApiKey, kvNamespace });
  const db = createDb(input.databaseUrl);

  // 1. Build batch (checks KV cache, skips cached pages)
  const { cached, requests } = await scorer.buildBatchRequests(
    input.batchPages,
    input.insertedPages,
    input.insertedScores,
  );

  // 2. Write cached results immediately
  if (cached.length > 0) {
    await writeLLMScores(db, cached);
  }

  // 3. If all pages were cached, done
  if (requests.length === 0) {
    return;
  }

  // 4. Submit batch to Anthropic
  const batchId = await submitBatch(scorer.client, requests);

  // 5. Store batch job for polling
  await batchJobQueries(db).create({
    batchId,
    jobId: input.jobId,
    projectId: input.projectId ?? "",
    totalRequests: requests.length,
  });
}
```

### 5. `apps/api/src/scheduled.ts` — add batch polling to cron

In `runScheduledTasks`, add a new step:

```typescript
try {
  await pollPendingBatches(env);
} catch (err) {
  log.error("Batch polling failed", { error: ... });
}
```

**`pollPendingBatches(env)`:**

- Query `llm_batch_jobs` where `status IN ('submitted', 'processing')`
- For each, call `checkBatch(client, batchId)`
- If `status === 'ended'`: fetch results, process, write to DB, mark as completed
- If individual results failed: log but don't retry (page will be scored on next crawl)

### 6. Fallback for small batches

The Anthropic Batches API has a minimum of 1 request. For crawls with very few uncached pages (< 5), use the existing synchronous path instead of batch to avoid the polling delay. Threshold: if `requests.length < 5`, use `pMap` with `scoreContent()`.

## Files Changed

| File                                             | Change                                                    |
| ------------------------------------------------ | --------------------------------------------------------- |
| `packages/db/src/schema/features.ts`             | Add `llmBatchJobs` table                                  |
| `packages/db/src/queries/batch-jobs.ts`          | Create: CRUD for batch jobs                               |
| `packages/db/src/index.ts`                       | Export new queries                                        |
| `packages/llm/src/scorer.ts`                     | Add `buildBatchRequests()`, `processBatchResults()`       |
| `packages/llm/src/batch-poller.ts`               | Create: `submitBatch()`, `checkBatch()`, `fetchResults()` |
| `apps/api/src/services/llm-scoring.ts`           | Switch from pMap to batch submission                      |
| `apps/api/src/services/batch-polling-service.ts` | Create: `pollPendingBatches()`                            |
| `apps/api/src/scheduled.ts`                      | Add batch polling step to cron                            |

## Testing

- Unit test `buildBatchRequests` with cached/uncached pages
- Unit test `processBatchResults` with mock JSONL
- Unit test fallback threshold (< 5 pages uses sync)
- Integration test: submit → poll → results flow with mocked Anthropic client

## Cost Impact

- Before: 500 pages × $0.001 = $0.50/crawl
- After: 500 pages × $0.0005 = $0.25/crawl (cached pages = $0)
- Monthly savings at 100 crawls: ~$25/month
- At scale (1000 crawls): ~$250/month
