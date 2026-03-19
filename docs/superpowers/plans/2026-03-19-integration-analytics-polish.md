# Integration Analytics Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 UX and data display issues on the integrations tab to handle zero-traffic sites gracefully.

**Architecture:** All changes are frontend-only except Task 5 which adds `crawlDate` to the insights API response. Changes are independent — each task can be committed separately.

**Tech Stack:** Next.js (React), TypeScript, Hono (API), Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-integration-analytics-polish-design.md`

---

### Task 1: Fix GSC summary to show tracked pages + non-indexed count

**Files:**

- Modify: `apps/web/src/components/integration-insights-view-helpers.ts:42-66`
- Modify: `apps/web/src/components/integration-insights-view-helpers.test.ts`

- [ ] **Step 1: Update the existing test for GSC summary with no queries**

In `integration-insights-view-helpers.test.ts`, find the test for `buildSummaryItems` with GSC data that has `topQueries: []` and `indexedPages`. Update the expected value to match the new format `"{N} pages tracked · {M} not indexed"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @llm-boost/web exec vitest run src/components/integration-insights-view-helpers.test.ts`
Expected: FAIL — old text format no longer matches

- [ ] **Step 3: Update `buildSummaryItems` in `integration-insights-view-helpers.ts`**

Replace lines 60-65 (the `else` branch when `queryCount === 0`):

```typescript
} else {
  const totalTracked = gsc.indexedPages.length;
  const nonIndexedCount = totalTracked - getIndexedPageCount(gsc);
  items.push({
    icon: Search,
    label: "GSC",
    value: totalTracked > 0
      ? `${totalTracked} pages tracked · ${nonIndexedCount} not indexed`
      : "No index data yet",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @llm-boost/web exec vitest run src/components/integration-insights-view-helpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/integration-insights-view-helpers.ts apps/web/src/components/integration-insights-view-helpers.test.ts
git commit -m "fix: GSC summary shows tracked pages and non-indexed count"
```

---

### Task 2: Fix GA4 summary for zero-traffic sites

**Files:**

- Modify: `apps/web/src/components/integration-insights-view-helpers.ts:69-75`
- Modify: `apps/web/src/components/integration-insights-view-helpers.test.ts`

- [ ] **Step 1: Add test for GA4 with no sessions**

Add a test case where `ga4` has `bounceRate: 0`, `avgEngagement: 0`, `topPages: []`. Assert value is `"No sessions recorded yet"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @llm-boost/web exec vitest run src/components/integration-insights-view-helpers.test.ts`

- [ ] **Step 3: Update GA4 branch in `buildSummaryItems`**

Replace lines 69-75:

```typescript
if (ga4) {
  const hasData =
    ga4.topPages.length > 0 || ga4.bounceRate > 0 || ga4.avgEngagement > 0;
  items.push({
    icon: Activity,
    label: "GA4",
    value: hasData
      ? `${ga4.avgEngagement.toFixed(0)}s avg engagement · ${ga4.bounceRate.toFixed(1)}% bounce rate`
      : "No sessions recorded yet",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @llm-boost/web exec vitest run src/components/integration-insights-view-helpers.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/integration-insights-view-helpers.ts apps/web/src/components/integration-insights-view-helpers.test.ts
git commit -m "fix: GA4 summary shows contextual message for zero-traffic sites"
```

---

### Task 3: Fix Clarity summary for zero-traffic sites

**Files:**

- Modify: `apps/web/src/components/integration-insights-view-helpers.ts:77-83`
- Modify: `apps/web/src/components/integration-insights-view-helpers.test.ts`

- [ ] **Step 1: Add test for Clarity with no sessions**

Add test where `clarity` has `avgUxScore: 0`, `rageClickPages: []`. Assert value is `"No sessions recorded yet"`.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Update Clarity branch in `buildSummaryItems`**

Replace lines 77-83:

```typescript
if (clarity) {
  const hasData = clarity.avgUxScore > 0 || clarity.rageClickPages.length > 0;
  items.push({
    icon: MousePointerClick,
    label: "Clarity",
    value: hasData
      ? `${clarity.avgUxScore.toFixed(0)}/100 UX score · ${clarity.rageClickPages.length} rage click pages`
      : "No sessions recorded yet",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/integration-insights-view-helpers.ts apps/web/src/components/integration-insights-view-helpers.test.ts
git commit -m "fix: Clarity summary shows contextual message for zero-traffic sites"
```

---

### Task 4: GSC index table — limit rows + status filter

**Files:**

- Modify: `apps/web/src/components/integration-insights-view-sections.tsx:210-261`
- Modify: `apps/web/src/components/integration-insights-view-sections.test.tsx`

- [ ] **Step 1: Add tests for table pagination and filtering**

Add tests:

- Table renders only 10 rows by default when `indexedPages` has > 10 entries
- "Show all" button appears when > 10 pages
- Filter pills render with correct counts

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @llm-boost/web exec vitest run src/components/integration-insights-view-sections.test.tsx`

- [ ] **Step 3: Update `GscIndexStatusSection` component**

Add state for `showAll` (boolean, default false) and `statusFilter` (string, default "all"). Compute filter categories from the data:

```tsx
export function GscIndexStatusSection({ gsc }: { gsc: GscInsights }) {
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const filterCategories = useMemo(() => {
    const cats = [{ key: "all", label: "All", count: gsc.indexedPages.length }];
    const notIndexed = gsc.indexedPages.filter((p) =>
      p.status.toLowerCase().includes("not indexed"),
    ).length;
    const unknown = gsc.indexedPages.filter((p) =>
      p.status.toLowerCase().includes("unknown"),
    ).length;
    const indexed = gsc.indexedPages.filter(
      (p) =>
        p.status === "Submitted and indexed" ||
        p.status === "Indexed, not submitted in sitemap",
    ).length;
    if (notIndexed > 0)
      cats.push({
        key: "not-indexed",
        label: "Not indexed",
        count: notIndexed,
      });
    if (unknown > 0)
      cats.push({ key: "unknown", label: "Unknown to Google", count: unknown });
    if (indexed > 0)
      cats.push({ key: "indexed", label: "Indexed", count: indexed });
    return cats;
  }, [gsc.indexedPages]);

  const filteredPages = useMemo(() => {
    if (statusFilter === "all") return gsc.indexedPages;
    if (statusFilter === "not-indexed")
      return gsc.indexedPages.filter((p) =>
        p.status.toLowerCase().includes("not indexed"),
      );
    if (statusFilter === "unknown")
      return gsc.indexedPages.filter((p) =>
        p.status.toLowerCase().includes("unknown"),
      );
    if (statusFilter === "indexed")
      return gsc.indexedPages.filter(
        (p) =>
          p.status === "Submitted and indexed" ||
          p.status === "Indexed, not submitted in sitemap",
      );
    return gsc.indexedPages;
  }, [gsc.indexedPages, statusFilter]);

  const displayedPages = showAll ? filteredPages : filteredPages.slice(0, 10);
  // ... render with filter pills above table and toggle button below
}
```

Add filter pills as small buttons above the table. Add "Show all {N} pages" / "Show less" button below the table when `filteredPages.length > 10`.

Add `import { useState, useMemo } from "react"` to the imports.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/integration-insights-view-sections.tsx apps/web/src/components/integration-insights-view-sections.test.tsx
git commit -m "feat: GSC index table with pagination and status filter"
```

---

### Task 5: Show human-readable crawl date instead of UUID

**Files:**

- Modify: `apps/web/src/lib/api/types/integrations.ts:15-17` — add `crawlDate`
- Modify: `apps/api/src/services/integration-insights-service.ts` — return `crawlDate`
- Modify: `apps/web/src/components/tabs/integrations-tab-analytics.tsx:65-67` — display date
- Modify: `apps/api/src/__tests__/services/integration-insights-service.test.ts`

- [ ] **Step 1: Add `crawlDate` to the API response type**

In `apps/web/src/lib/api/types/integrations.ts`, add to `IntegrationInsights`:

```typescript
export interface IntegrationInsights {
  crawlId: string | null;
  crawlDate: string | null;  // ISO 8601 timestamp
  integrations: { ... } | null;
}
```

- [ ] **Step 2: Return `crawlDate` from the insights service**

In `apps/api/src/services/integration-insights-service.ts`, include `crawlDate` in all return paths. The crawl object already has `createdAt`. For the explicit crawlId case and the fallback loop, add `crawlDate: crawl.createdAt?.toISOString() ?? null` to each return.

- [ ] **Step 3: Update the analytics section to display the date**

In `apps/web/src/components/tabs/integrations-tab-analytics.tsx`, replace lines 65-67:

```tsx
{
  integrationInsights?.crawlId
    ? `Based on crawl from ${new Date(integrationInsights.crawlDate ?? "").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "Connect an integration and run a crawl to unlock insights.";
}
```

Add a `title` attribute on the `CardDescription` with the crawl UUID for debugging:

```tsx
<CardDescription title={integrationInsights?.crawlId ?? undefined}>
```

- [ ] **Step 4: Update tests**

Update `integration-insights-service.test.ts` to verify `crawlDate` is included in the response.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @llm-boost/api exec vitest run src/__tests__/services/integration-insights-service.test.ts`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/types/integrations.ts apps/api/src/services/integration-insights-service.ts apps/web/src/components/tabs/integrations-tab-analytics.tsx apps/api/src/__tests__/services/integration-insights-service.test.ts
git commit -m "fix: show human-readable crawl date instead of UUID"
```

---

### Task 6: Hide meaningless zero delta cards

**Files:**

- Modify: `apps/web/src/components/tabs/integrations-tab-helpers.ts:270-370`
- Modify: `apps/web/src/components/tabs/integrations-tab-analytics.tsx:153` — update empty state text

- [ ] **Step 1: Add filter in `buildIntegrationDeltaMetrics`**

At the end of `buildIntegrationDeltaMetrics()`, before `return metrics`, add a filter to remove metrics where both current and delta are zero:

```typescript
// Filter out metrics where both current and previous are zero (no meaningful data)
return metrics.filter((m) => {
  const current = parseFloat(m.currentValue.replace(/[^0-9.-]/g, ""));
  const delta = parseFloat(m.deltaValue.replace(/[^0-9.-]/g, ""));
  return current !== 0 || delta !== 0;
});
```

- [ ] **Step 2: Update empty state text**

In `integrations-tab-analytics.tsx`, line 153, change the `integrationDeltaMetrics.length === 0` message:

```tsx
) : integrationDeltaMetrics.length === 0 ? (
  <p className="text-xs text-muted-foreground">
    Not enough data for trend comparison yet.
  </p>
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @llm-boost/web exec vitest run`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tabs/integrations-tab-helpers.ts apps/web/src/components/tabs/integrations-tab-analytics.tsx
git commit -m "fix: hide meaningless zero delta cards in integration analytics"
```

---

### Task 7: Fix "Create up to 1 tasks" singular wording

**Files:**

- Modify: `apps/web/src/components/tabs/integrations-tab-analytics.tsx:219-221`

- [ ] **Step 1: Fix the button text**

Replace lines 219-221:

```tsx
{
  autoPlanningSignals
    ? "Planning tasks..."
    : signalTaskPlan.items.length === 1
      ? "Create 1 task"
      : `Create up to ${Math.min(signalTaskPlan.items.length, MAX_SIGNAL_TASKS)} tasks`;
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @llm-boost/web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tabs/integrations-tab-analytics.tsx
git commit -m "fix: singular wording for Create 1 task button"
```

---

### Task 8: Hide rage-click tip when no issues exist

**Files:**

- Modify: `apps/web/src/components/integration-insights-view-sections.tsx:484-492`
- Modify: `apps/web/src/components/integration-insights-view-sections.test.tsx`

- [ ] **Step 1: Add test that tip card is hidden when rageClickPages is empty**

Add test asserting "Lead Capture Tip" is not rendered when `clarity.rageClickPages` is `[]`.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Wrap the tip card in a conditional**

In `ClaritySection`, wrap the tip card div (lines 484-492) in a conditional:

```tsx
{
  clarity.rageClickPages.length > 0 && (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-primary/5 p-6 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-primary opacity-20" />
      <h4 className="mb-2 text-lg font-semibold">Lead Capture Tip</h4>
      <p className="max-w-[280px] text-sm text-muted-foreground">
        Users are rage-clicking on {clarity.rageClickPages.length} pages. Fix
        these to improve your AI visibility score by making your content more
        accessible.
      </p>
    </div>
  );
}
```

When no rage clicks, the grid should be single-column. Change the grid to be conditional:

```tsx
<div className={`grid gap-6 ${clarity.rageClickPages.length > 0 ? "md:grid-cols-2" : ""}`}>
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/integration-insights-view-sections.tsx apps/web/src/components/integration-insights-view-sections.test.tsx
git commit -m "fix: hide rage-click tip card when no issues exist"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`

- [ ] **Step 3: Push and deploy**

```bash
git push
```

Verify on https://llmrank.app/dashboard/projects/fe681853-0cd0-4f8e-8b39-5a987caf84c0?tab=integrations
