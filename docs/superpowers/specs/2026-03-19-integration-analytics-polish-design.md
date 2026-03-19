# Integration Analytics Polish — Design Spec

**Date:** 2026-03-19
**Scope:** 8 UX and data fixes for the integrations tab

## Context

The integrations tab shows analytics from GSC, GA4, Clarity, and Meta. Investigation of the families.care project revealed that while the integration fetchers work correctly, the UI handles zero-traffic sites poorly — showing confusing zeros, unhelpful tips, and raw technical details.

## Changes

### 1. GSC summary: show tracked pages + non-indexed count

**File:** `apps/web/src/components/integration-insights-view-helpers.ts`

**Problem:** `buildSummaryItems()` shows "0 indexed pages · 0 impressions" when pages have index status data but aren't indexed yet. The label implies no data exists when there's actually useful status info.

**Fix:** When `topQueries` is empty, compute `totalTracked = gsc.indexedPages.length` and `nonIndexedCount` (pages NOT matching "Submitted and indexed" or "Indexed, not submitted in sitemap"). Display:

- If `totalTracked > 0`: `"{totalTracked} pages tracked · {nonIndexedCount} not indexed"`
- If `totalTracked === 0`: `"No index data yet"`

### 2. GA4: contextual empty-data message

**File:** `apps/web/src/components/integration-insights-view-helpers.ts`

**Problem:** Shows "0s avg engagement · 0.0% bounce rate" when GA4 returned no matching sessions — looks broken rather than informative.

**Fix:** In `buildSummaryItems`, when `ga4.bounceRate` is 0 and `ga4.topPages.length === 0`, show `"No sessions recorded yet"` instead of the zero metrics. The detailed GA4 section already handles empty state — this fixes the summary card only.

### 3. Clarity: contextual empty-data message

**File:** `apps/web/src/components/integration-insights-view-helpers.ts`

**Problem:** Shows "0/100 UX score · 0 rage click pages" when Clarity had no session data.

**Fix:** In `buildSummaryItems`, when `clarity.avgUxScore` is 0 and `clarity.rageClickPages.length === 0`, show `"No sessions recorded yet"` instead of zeros.

### 4. GSC index table: limit rows + status filter

**File:** `apps/web/src/components/integration-insights-view-sections.tsx`

**Problem:** Dumps 50+ rows with no pagination, creating a wall of data.

**Fix:**

- Show first 10 rows by default
- Add "Show all {N} pages" / "Show less" toggle button below the table
- Add status filter pills above the table: "All", "Not indexed", "Unknown to Google", "Indexed" — filter by matching status text
- Show count per filter: e.g., "Not indexed (38)"

### 5. Crawl reference: human-readable date

**Files:**

- `apps/api/src/services/integration-insights-service.ts` — include `crawlDate` in response
- `apps/web/src/components/tabs/integrations-tab-analytics.tsx` — render date instead of UUID
- `apps/web/src/lib/api/types/integrations.ts` — add `crawlDate` to type

**Problem:** Shows `"Derived from crawl: 910515b4-ad32-46cf-b57b-4742162c593a"` — raw UUID means nothing to users.

**Fix:** Return the crawl's `createdAt` timestamp alongside the `crawlId`. Display as `"Based on crawl from Mar 15, 2026"`. Keep the UUID in a tooltip for debugging.

### 6. Delta cards: hide when all zeros

**File:** `apps/web/src/components/tabs/integrations-tab-helpers.ts`

**Problem:** Shows delta cards like "GSC Clicks: 0, 0 vs previous" and "GA4 bounce rate: 0.0%, 0.0% vs previous" — meaningless noise.

**Fix:** In `buildIntegrationDeltaMetrics()`, skip metrics where both current and previous values are zero/null. Only emit delta cards that have at least one non-zero value. If all deltas are filtered out, show "Not enough data for trend comparison yet" instead of individual zero cards.

### 7. Task button: fix singular wording

**File:** `apps/web/src/components/tabs/integrations-tab-analytics.tsx`

**Problem:** Button says "Create up to 1 tasks" — grammatically wrong.

**Fix:** When `count === 1`: `"Create 1 task"`. When `count > 1`: `"Create up to {count} tasks"`. When `count === 0`: keep disabled with `"No tasks to create"`.

### 8. Rage-click tip: hide when no issues

**File:** `apps/web/src/components/integration-insights-view-sections.tsx`

**Problem:** Shows "Users are rage-clicking on 0 pages. Fix these to improve your AI visibility score" — recommending action on a non-issue.

**Fix:** Only render the Lead Capture Tip card when `rageClickPages.length > 0`. When no rage clicks, the Clarity section should show just the UX score and the "No rage clicks detected" message without the misleading tip.

## Files Changed

| File                                                             | Changes                                           |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| `apps/web/src/components/integration-insights-view-helpers.ts`   | Fix GSC/GA4/Clarity summary messages (#1, #2, #3) |
| `apps/web/src/components/integration-insights-view-sections.tsx` | Table pagination + filter (#4), hide tip (#8)     |
| `apps/web/src/components/tabs/integrations-tab-helpers.ts`       | Filter zero deltas (#6)                           |
| `apps/web/src/components/tabs/integrations-tab-analytics.tsx`    | Crawl date display (#5), task button wording (#7) |
| `apps/api/src/services/integration-insights-service.ts`          | Return `crawlDate` (#5)                           |
| `apps/web/src/lib/api/types/integrations.ts`                     | Add `crawlDate` to type (#5)                      |
| `packages/shared/src/types/integrations.ts`                      | Add `crawlDate` to shared type if needed (#5)     |

## Testing

- Update `integration-insights-view-helpers.test.ts` for new summary text formats
- Update `integration-insights-view-sections.test.tsx` for table pagination and tip visibility
- Update `integrations-tab-helpers` tests for delta filtering
- Verify manually on families.care project after deploy
