# Pipeline Reliability & Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix outbox backlog, ensure enrichments auto-fire on crawl completion, improve AI traffic onboarding UX, surface PSI data, show sync errors, and update CI to Node 22.

**Architecture:** Backend changes in the API (outbox processor, post-processing, enrichments, analytics), frontend changes in the web app (AI traffic tab, integration cards), and CI config updates. Each task is independently deployable.

**Tech Stack:** Hono (Cloudflare Workers), Drizzle ORM, Next.js, Vitest, GitHub Actions

---

### Task 1: Increase outbox batch size and add logging

**Problem:** Outbox processes 10 events per 5-min cron tick. An 80-event backlog takes 40 minutes to clear.

**Files:**

- Modify: `apps/api/src/services/outbox-processor.ts:55` — increase batch limit
- Modify: `apps/api/src/services/outbox-processor.ts:57-59` — add count logging

- [ ] **Step 1: Increase batch limit from 10 to 50**

In `apps/api/src/services/outbox-processor.ts`, line 55, change `.limit(10)` to `.limit(50)`.

- [ ] **Step 2: Log pending count even when zero**

After line 59 (`return { processed: 0, failed: 0 }`), add before the early return:

```typescript
if (events.length === 0) {
  log.info("No pending outbox events");
  return { processed: 0, failed: 0 };
}
```

(Replace the existing `if (events.length === 0)` block.)

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @llm-boost/api exec vitest run src/__tests__/services/outbox-processor.test.ts` (if exists, otherwise skip)
Run: `pnpm --filter @llm-boost/api typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/outbox-processor.ts
git commit -m "fix: increase outbox batch size from 10 to 50"
```

---

### Task 2: Add diagnostic logging to enrichment dispatch

**Problem:** The enrichment event was never enqueued for the latest crawl. The `is_final` condition has no logging, making it impossible to debug why enrichments didn't fire.

**Files:**

- Modify: `apps/api/src/services/post-processing-service.ts:99-120`

- [ ] **Step 1: Add logging around the enrichment dispatch condition**

After line 98 (end of LLM scoring block), add logging before the enrichment condition:

```typescript
if (batch.is_final) {
  const hasIntegrationKeys = !!(
    env.integrationKey &&
    env.googleClientId &&
    env.googleClientSecret
  );
  if (!hasIntegrationKeys) {
    console.warn(
      `[post-processing] Skipping enrichment dispatch for job ${batch.job_id}: ` +
        `missing env vars (integrationKey=${!!env.integrationKey}, ` +
        `googleClientId=${!!env.googleClientId}, ` +
        `googleClientSecret=${!!env.googleClientSecret})`,
    );
  }
}
```

Place this BEFORE the existing `if (batch.is_final && env.integrationKey && ...)` block so it logs when the condition would fail.

- [ ] **Step 2: Add logging on successful dispatch**

Inside the enrichment dispatch block (after the `dispatchOrRun` call on line 119), add:

```typescript
console.info(
  `[post-processing] Enrichment event dispatched for job ${batch.job_id}, project ${projectId}`,
);
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @llm-boost/api typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/post-processing-service.ts
git commit -m "fix: add diagnostic logging to enrichment dispatch condition"
```

---

### Task 3: Process stale outbox events and add retry logic

**Problem:** 80 pending `llm_scoring` events from March 17 are still in the outbox. They may have been attempted and failed, or the processor missed them.

**Files:**

- Modify: `apps/api/src/services/outbox-processor.ts`

- [ ] **Step 1: Add max attempts check**

In the outbox processor, after fetching events (line 55), add filtering for events that haven't exceeded max attempts:

```typescript
const MAX_ATTEMPTS = 5;
```

Add to the WHERE clause a condition: `lte(outboxEvents.attempts, MAX_ATTEMPTS)` (requires importing `lte` if not already imported). If an event has been tried 5+ times, skip it.

- [ ] **Step 2: Mark over-limit events as failed**

After the main processing loop, add a cleanup pass:

```typescript
// Mark events that exceeded max attempts as permanently failed
const staleEvents = await db
  .select({ id: outboxEvents.id })
  .from(outboxEvents)
  .where(
    and(
      eq(outboxEvents.status, "pending"),
      sql`${outboxEvents.attempts} > ${MAX_ATTEMPTS}`,
    ) as any,
  )
  .limit(50);

for (const event of staleEvents) {
  await db
    .update(outboxEvents)
    .set({ status: "failed" as any, processedAt: new Date() })
    .where(eq(outboxEvents.id, event.id) as any);
  log.warn(`Outbox event permanently failed after ${MAX_ATTEMPTS} attempts`, {
    eventId: event.id,
  });
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @llm-boost/api typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/outbox-processor.ts
git commit -m "fix: add max retry limit and stale event cleanup to outbox processor"
```

---

### Task 4: AI Traffic tab — better onboarding and snippet verification

**Problem:** Tab shows nothing useful when there's no data. No way to verify the snippet is working.

**Files:**

- Modify: `apps/web/src/components/tabs/ai-traffic-tab.tsx`

- [ ] **Step 1: Add a "Test Snippet" button that pings the collect endpoint**

When `snippetEnabled && summary.totalPageviews === 0`, show a "Verify Snippet" button that sends a test beacon:

```typescript
async function handleTestSnippet() {
  setTesting(true);
  try {
    const res = await fetch("https://api.llmrank.app/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pid: projectId,
        url: `https://test.llmrank.app/snippet-test-${Date.now()}`,
        ref: "",
        ua: navigator.userAgent,
      }),
    });
    setTestResult(res.status === 204 ? "success" : "error");
  } catch {
    setTestResult("error");
  } finally {
    setTesting(false);
    setTimeout(() => setTestResult(null), 5000);
  }
}
```

Add states: `const [testing, setTesting] = useState(false)` and `const [testResult, setTestResult] = useState<"success" | "error" | null>(null)`.

- [ ] **Step 2: Improve the empty state when snippet IS enabled but no data yet**

Replace the existing empty state card with:

```tsx
{
  snippetEnabled && summary?.totalPageviews === 0 && (
    <Card className="border-dashed">
      <CardContent className="py-6 text-center space-y-3">
        <Code className="mx-auto h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">
            Snippet installed — waiting for traffic
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Data appears within minutes of the first visit. AI traffic from
            ChatGPT, Claude, and Perplexity will be classified automatically.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestSnippet}
          disabled={testing}
        >
          {testing
            ? "Sending test..."
            : testResult === "success"
              ? "✓ Snippet working"
              : testResult === "error"
                ? "✗ Failed"
                : "Verify Snippet"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @llm-boost/web typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tabs/ai-traffic-tab.tsx
git commit -m "feat: AI traffic tab snippet verification and better empty state"
```

---

### Task 5: Surface integration sync errors on cards

**Problem:** When sync fails, users see "No data yet" with no indication of why. The `lastError` field exists in the DB but isn't shown to users.

**Files:**

- Modify: `apps/web/src/components/tabs/integrations-tab-sections.tsx`

- [ ] **Step 1: Read the file and find the integration card component**

Find the section that renders each integration card with the toggle, "Last synced" text, and Test/Disconnect buttons. Look for where `lastSyncAt` is displayed.

- [ ] **Step 2: Add error display below the "Last synced" line**

After the `paragraph` showing "Last synced: ...", add a conditional error message:

```tsx
{
  integration.lastError && (
    <p className="text-xs text-destructive mt-1">
      Last sync error: {integration.lastError}
    </p>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @llm-boost/web typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tabs/integrations-tab-sections.tsx
git commit -m "feat: show integration sync errors on cards"
```

---

### Task 6: Add PSI section to integration analytics

**Problem:** 112 PSI enrichment rows exist but `aggregateIntegrations` doesn't handle PSI, so Core Web Vitals data is collected but never displayed.

**Files:**

- Modify: `packages/reports/src/integrations.ts` — add PSI aggregation
- Modify: `packages/reports/src/types.ts` — add PSI to `ReportIntegrationData`
- Modify: `apps/web/src/components/integration-insights-view-sections.tsx` — add PSI section
- Modify: `apps/web/src/components/integration-insights-view.tsx` — render PSI section
- Modify: `apps/web/src/components/integration-insights-view-helpers.ts` — add PSI to summary
- Modify: `apps/web/src/lib/api/types/integrations.ts` — add PSI type

- [ ] **Step 1: Add PSI type to shared types**

In `apps/web/src/lib/api/types/integrations.ts`, add `psi` to the `integrations` object inside `IntegrationInsights`:

```typescript
psi: {
  avgPerformanceScore: number;
  avgLcp: number | null;
  avgCls: number | null;
  avgFcp: number | null;
  cwvPassRate: number;
  pageScores: { url: string; score: number; lcp: number | null; cls: number | null }[];
} | null;
```

- [ ] **Step 2: Add PSI to `ReportIntegrationData`**

In `packages/reports/src/types.ts`, add the same `psi` field to the `ReportIntegrationData` type.

- [ ] **Step 3: Add PSI aggregation in `aggregateIntegrations`**

In `packages/reports/src/integrations.ts`, add after the clarity section:

```typescript
const psiEnrichments = enrichments.filter((e) => e.provider === "psi");
let psi: ReportIntegrationData["psi"] = null;
if (psiEnrichments.length > 0) {
  let totalPerf = 0;
  let perfCount = 0;
  let totalLcp = 0;
  let lcpCount = 0;
  let totalCls = 0;
  let clsCount = 0;
  let totalFcp = 0;
  let fcpCount = 0;
  let cwvPass = 0;
  const pageScores: {
    url: string;
    score: number;
    lcp: number | null;
    cls: number | null;
  }[] = [];

  for (const e of psiEnrichments) {
    const d = e.data as Record<string, unknown>;
    const score = Number(d.labPerformanceScore ?? 0);
    if (score > 0) {
      totalPerf += score;
      perfCount++;
    }

    const lcp = d.lcp as Record<string, unknown> | undefined;
    const cls = d.cls as Record<string, unknown> | undefined;
    const fcp = d.fcp as Record<string, unknown> | undefined;

    if (lcp?.value != null) {
      totalLcp += Number(lcp.value);
      lcpCount++;
    }
    if (cls?.value != null) {
      totalCls += Number(cls.value);
      clsCount++;
    }
    if (fcp?.value != null) {
      totalFcp += Number(fcp.value);
      fcpCount++;
    }

    const crux = String(d.cruxOverall ?? "");
    if (crux === "FAST" || crux === "AVERAGE") cwvPass++;

    const url = String(d.pageUrl ?? d.url ?? "");
    if (url && score > 0) {
      pageScores.push({
        url,
        score: Math.round(score * 100),
        lcp: lcp?.value != null ? Number(lcp.value) : null,
        cls: cls?.value != null ? Number(cls.value) : null,
      });
    }
  }

  psi = {
    avgPerformanceScore:
      perfCount > 0 ? Math.round((totalPerf / perfCount) * 100) : 0,
    avgLcp: lcpCount > 0 ? Math.round((totalLcp / lcpCount) * 10) / 10 : null,
    avgCls:
      clsCount > 0 ? Math.round((totalCls / clsCount) * 1000) / 1000 : null,
    avgFcp: fcpCount > 0 ? Math.round((totalFcp / fcpCount) * 10) / 10 : null,
    cwvPassRate:
      psiEnrichments.length > 0
        ? Math.round((cwvPass / psiEnrichments.length) * 100)
        : 0,
    pageScores: pageScores.sort((a, b) => a.score - b.score).slice(0, 20),
  };
}
```

Add `psi` to the null check and return: `if (!gsc && !ga4 && !clarity && !meta && !psi) return null;` and `return { gsc, ga4, clarity, meta, psi };`

- [ ] **Step 4: Add PSI summary item**

In `apps/web/src/components/integration-insights-view-helpers.ts`, add after the clarity block in `buildSummaryItems`:

```typescript
if (integrations.psi) {
  const psi = integrations.psi;
  const hasData = psi.avgPerformanceScore > 0;
  items.push({
    icon: Gauge, // import Gauge from lucide-react
    label: "PSI",
    value: hasData
      ? `${psi.avgPerformanceScore}/100 performance · ${psi.cwvPassRate}% CWV pass`
      : "No performance data yet",
  });
}
```

Add `Gauge` to the lucide-react import.

- [ ] **Step 5: Add PSI section component**

In `apps/web/src/components/integration-insights-view-sections.tsx`, add a `PsiSection` component that shows avg performance score, CWV pass rate, and a table of worst-performing pages.

- [ ] **Step 6: Render PSI in the insights view**

In `apps/web/src/components/integration-insights-view.tsx`, add PSI rendering alongside the other provider sections.

- [ ] **Step 7: Run typecheck and tests**

Run: `pnpm typecheck`
Run: `pnpm --filter @llm-boost/web exec vitest run src/components/integration-insights-view-helpers.test.ts`

- [ ] **Step 8: Commit**

```bash
git add packages/reports/src/integrations.ts packages/reports/src/types.ts apps/web/src/components/integration-insights-view-sections.tsx apps/web/src/components/integration-insights-view.tsx apps/web/src/components/integration-insights-view-helpers.ts apps/web/src/lib/api/types/integrations.ts
git commit -m "feat: add PSI performance data to integration analytics"
```

---

### Task 7: Auto-enrichment reliability — ensure enrichments fire on every crawl completion

**Problem:** The enrichment event wasn't dispatched for the latest crawl. This may be because env vars were briefly unavailable, the outbox was full, or a race condition during the final batch.

**Files:**

- Modify: `apps/api/src/services/post-processing-service.ts:100-120`

- [ ] **Step 1: Make enrichment dispatch more resilient**

Wrap the enrichment dispatch in a try-catch so failures don't silently swallow:

```typescript
if (
  batch.is_final &&
  env.integrationKey &&
  env.googleClientId &&
  env.googleClientSecret
) {
  try {
    await dispatchOrRun(deps.outbox, args.executionCtx, {
      type: "integration_enrichment",
      payload: {
        /* existing payload */
      },
    });
    console.info(
      `[post-processing] Enrichment dispatched for job ${batch.job_id}`,
    );
  } catch (err) {
    console.error(
      `[post-processing] Failed to dispatch enrichment for job ${batch.job_id}:`,
      err,
    );
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @llm-boost/api typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/post-processing-service.ts
git commit -m "fix: add error handling around enrichment dispatch"
```

---

### Task 8: Upgrade GitHub Actions to Node 22

**Problem:** GitHub warns about Node.js 20 deprecation on every run. June 2026 deadline.

**Files:**

- Modify: `.github/workflows/deploy-cloudflare.yml`
- Modify: `.github/workflows/deploy-fly.yml`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update Node version in all workflows**

In all three workflow files, change `node-version: 20` to `node-version: 22`.

- [ ] **Step 2: Remove `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env var**

This was a workaround. With Node 22, the warnings should stop. Remove the `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` env var from all jobs in `deploy-cloudflare.yml` and `ci.yml`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-cloudflare.yml .github/workflows/deploy-fly.yml .github/workflows/ci.yml
git commit -m "chore: upgrade GitHub Actions to Node 22"
```

---

### Task 9: Triage Dependabot vulnerabilities

**Files:**

- No code changes — run `pnpm audit` and assess

- [ ] **Step 1: Run audit**

Run: `pnpm audit --production` to see which vulnerabilities affect production.

- [ ] **Step 2: Update packages**

Run: `pnpm update --latest` for affected packages, or apply targeted fixes with `pnpm audit --fix`.

- [ ] **Step 3: Test and commit**

Run: `pnpm typecheck && pnpm test`

```bash
git add pnpm-lock.yaml package.json
git commit -m "fix: update dependencies to resolve security vulnerabilities"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`

- [ ] **Step 3: Push and verify deploy**

```bash
git push
```

Verify at https://llmrank.app/dashboard/projects/fe681853-0cd0-4f8e-8b39-5a987caf84c0?tab=integrations and https://llmrank.app/dashboard/projects/fe681853-0cd0-4f8e-8b39-5a987caf84c0?tab=ai-traffic
