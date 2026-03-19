# Overview & App-Wide Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 12 issues found during app-wide audit — broken overview data, missing empty states, and UX inconsistencies.

**Architecture:** Mix of backend scoring pipeline fixes, post-processing data persistence, frontend empty states, and UI polish. Critical items (1-3) require understanding the scoring engine and summary data pipeline.

**Tech Stack:** Hono API, Drizzle ORM, Next.js, Vitest

---

## Root Cause Analysis (from DB investigation)

- **Bug 1 (AI Crawlability 0/5):** All 5 AI-specific score columns (llms_txt_score, robots_txt_score, sitemap_score, schema_markup_score, bot_access_score) are NULL for all 2000 page_scores rows. The scoring engine in `packages/scoring` isn't populating these fields. The API's `avg()` function treats NULL as 0.
- **Bug 2 (Score Trends empty):** All 5 crawls have `summary_data = NULL`. The `persistCrawlSummaryData` function in post-processing is either not running or failing silently.
- **Bug 3 (Content Health --):** LLM Quality needs `llmContentScores` from LLM scoring (outbox events are stuck pending). Engagement/UX need GA4/Clarity data (exists but all zeros — no traffic for families.care).

---

### Task 1: Fix AI Crawlability audit — scoring engine not populating AI-specific scores

**Problem:** `llms_txt_score`, `robots_txt_score`, `sitemap_score`, `schema_markup_score`, `bot_access_score` are all NULL in page_scores.

**Files:**

- Investigate: `packages/scoring/src/` — find where these fields should be computed
- Fix: The scoring engine likely computes these but stores them in `detail` JSONB instead of the dedicated columns, OR the scoring factors exist but the results aren't mapped to the column names

- [ ] **Step 1:** Read `packages/scoring/src/` to find how AI crawlability factors are scored
- [ ] **Step 2:** Read `packages/db/src/schema/` for the page_scores table definition
- [ ] **Step 3:** Trace the data flow from scoring → page_scores insert to find where the mapping breaks
- [ ] **Step 4:** Fix the mapping so scoring results are written to the dedicated columns
- [ ] **Step 5:** Run typecheck and tests
- [ ] **Step 6:** Commit

Also fix the API `avg()` function in `apps/api/src/routes/crawls.ts:307-310` to only average non-null values (skip pages where the field is NULL instead of treating them as 0).

---

### Task 2: Fix Score Trends — persist summary_data on crawl completion

**Problem:** `summary_data` is NULL for all crawls. The `persistCrawlSummaryData` function runs via `waitUntil` in post-processing but appears to fail silently.

**Files:**

- Investigate: `apps/api/src/services/summary.ts` — the `persistCrawlSummaryData` function
- Fix: Add error logging, verify the function computes and stores summary data correctly

- [ ] **Step 1:** Read the summary service to understand what `persistCrawlSummaryData` does
- [ ] **Step 2:** Check if it's called correctly in post-processing (line 122-131)
- [ ] **Step 3:** Add try-catch and logging around the call
- [ ] **Step 4:** Create a one-time backfill script to populate summary_data for existing crawls
- [ ] **Step 5:** Commit

---

### Task 3: Fix Content Health — handle null/zero integration data gracefully

**Problem:** Shows "--" for LLM Quality, Engagement, UX Quality when data is unavailable.

**Files:**

- Modify: `apps/web/src/components/platform-opportunity-cards.tsx:110-130`

- [ ] **Step 1:** When `llmQuality` is null, show "Run LLM scoring" instead of "--"
- [ ] **Step 2:** When `engagement` is null, show "Connect GA4" or "No traffic yet" instead of "--"
- [ ] **Step 3:** When `uxQuality` is null, show "Connect Clarity" or "No sessions" instead of "--"
- [ ] **Step 4:** Commit

---

### Task 4: Fix AI Traffic tab — use API client instead of raw fetch

**Problem:** Uses raw `fetch()` instead of the `api` client, inconsistent error handling.

**Files:**

- Modify: `apps/web/src/components/tabs/ai-traffic-tab.tsx`

- [ ] **Step 1:** Replace raw `fetch` with the existing API client pattern
- [ ] **Step 2:** Add proper error handling and retry
- [ ] **Step 3:** Commit

---

### Task 5: Strategy tab — add empty states for personas and competitors

**Problem:** Blank grids when no data exists, no guidance.

**Files:**

- Modify: `apps/web/src/components/tabs/strategy-tab.tsx`

- [ ] **Step 1:** Add empty state when no personas exist with CTA to create one
- [ ] **Step 2:** Add empty state when no competitors tracked with CTA to add
- [ ] **Step 3:** Commit

---

### Task 6: Competitors tab — add empty state for benchmarks

**Problem:** Benchmark section is blank when no competitors benchmarked.

**Files:**

- Modify: `apps/web/src/components/tabs/competitors-tab.tsx`

- [ ] **Step 1:** Add empty state card with CTA to benchmark first competitor
- [ ] **Step 2:** Commit

---

### Task 7: Fix Progress Since Last Crawl — clarify 0.0 score changes with issue count mismatches

**Problem:** Shows "266 fixed, 264 new" but "0.0 points change" — confusing.

**Files:**

- Investigate: `apps/web/src/components/tabs/overview-tab.tsx` or related sections

- [ ] **Step 1:** When score change is 0 but issue counts differ, show explanatory text like "Score stable despite issue churn"
- [ ] **Step 2:** Commit

---

### Task 8: Add loading skeletons for dynamic chart imports

**Problem:** Dynamic imports (SSR false) create blank spaces while loading.

**Files:**

- Modify: `apps/web/src/components/tabs/overview-tab.tsx` — where charts are dynamically imported

- [ ] **Step 1:** Add skeleton/loading placeholder for each dynamically imported chart component
- [ ] **Step 2:** Commit

---

### Task 9: Visibility tab — Gemini/Perplexity showing 0% visibility

**Problem:** ChatGPT/Claude show 100% but Gemini/Perplexity show 0%. Need to verify if this is real data or display bug.

**Files:**

- Investigate: The visibility check data in the DB for this project

- [ ] **Step 1:** Query DB for visibility check results per provider
- [ ] **Step 2:** If real data (checks not run for those providers), show "Not checked" instead of "0%"
- [ ] **Step 3:** If bug, fix the data flow
- [ ] **Step 4:** Commit

---

### Task 10: Reports tab — show explanation when Generate is disabled

**Files:**

- Modify: `apps/web/src/components/reports/reports-tab.tsx`

- [ ] **Step 1:** When Generate button is disabled (no crawl data), add tooltip or small text explaining why
- [ ] **Step 2:** Commit

---

### Task 11: Visibility tab — explain region filter plan requirement

**Files:**

- Modify: `apps/web/src/components/tabs/visibility-tab.tsx`

- [ ] **Step 1:** When region filter is disabled for lower plans, show a small "Pro+" badge/tooltip
- [ ] **Step 2:** Commit

---

### Task 12: History tab — explain why in-progress crawls can't be compared

**Files:**

- Modify: `apps/web/src/components/tabs/history-tab.tsx`

- [ ] **Step 1:** Disable checkbox for in-progress crawls with tooltip "Crawl must complete before comparison"
- [ ] **Step 2:** Commit

---

### Task 13: Final verification

- [ ] **Step 1:** Run full typecheck: `pnpm typecheck`
- [ ] **Step 2:** Run tests: `pnpm test`
- [ ] **Step 3:** Push and verify on production
