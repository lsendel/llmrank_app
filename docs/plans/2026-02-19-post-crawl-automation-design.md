# Post-Crawl Automation & UX Improvements Design

**Date:** 2026-02-19
**Status:** Approved

## Overview

After a full browser walkthrough of all 14 project tabs, we identified 11 high-value features grouped into P0–P3. Most features are **wiring existing services** into the post-crawl pipeline, not building new infrastructure.

## Architecture

All auto-triggers hook into `post-processing-service.ts → schedule()`, which already runs after crawl completion via the outbox pattern (`dispatchOrRun`). New steps fire as `waitUntil` or outbox events when `batch.is_final === true`.

```
Crawl Complete (is_final)
  ├── [existing] LLM scoring
  ├── [existing] Integration enrichment
  ├── [existing] Crawl summary / KV invalidation / email / regression
  ├── [P0-NEW] Auto-run visibility checks (outbox: "auto_visibility")
  ├── [P0-NEW] Auto-regenerate narrative (outbox: "auto_narrative")
  ├── [P1-NEW] Auto-generate personas (waitUntil)
  ├── [P1-NEW] Auto-generate report (waitUntil)
  └── [P2-NEW] Auto-discover competitors (waitUntil)
```

## P0 Features

### 1. Auto-Run Visibility Checks After Crawl

**What:** When `is_final`, fetch top 10 saved keywords for the project. If keywords exist, run visibility checks across all 7 providers automatically.

**Where:** New outbox event type `"auto_visibility"` in `post-processing-service.ts`. Handler in `outbox-processor.ts` calls `visibilityService.runCheck()` per keyword×provider.

**Plan gating:** Free tier gets 0 auto-checks (skip entirely). Starter gets 3 keywords × 3 providers. Pro gets 10 × 7. Agency gets 10 × 7.

**Dependencies:** `savedKeywords` table (already populated by keyword discovery which runs during onboarding), `visibility-service.ts` (exists), LLM API keys (OpenAI for visibility checks).

### 2. Auto-Regenerate Stale Narratives

**What:** When `is_final` and a narrative already exists for this project, regenerate all sections with fresh crawl data. Skip if narrative was manually edited (Agency tier edits are "pinned").

**Where:** New outbox event type `"auto_narrative"` in `post-processing-service.ts`. Handler calls `narrativeService.generate()` or `narrativeService.regenerateSection()`.

**Pin logic:** Add `isPinned: boolean` column to `narrative_sections` (or a flag in the sections JSONB). Pinned sections skip auto-regeneration.

## P1 Features

### 3. Auto-Generate Personas

**What:** On first crawl completion (no personas exist yet), generate 3 audience personas from crawled content. Uses existing `POST /api/personas/:projectId/generate` endpoint logic.

**Where:** `waitUntil` in post-processing. Check `personaQueries.countByProject() === 0`, then call persona generation with roles derived from site content analysis.

**Plan gating:** Starter+ only (Free tier skips). Respect `limits.personasPerProject`.

### 4. Auto-Generate Report

**What:** On crawl completion, auto-queue a summary PDF report if none exists for this crawl. Uses existing `reportService.generate()`.

**Where:** `waitUntil` in post-processing. Check no report exists for this crawl job, then queue one.

**Plan gating:** Pro+ only. Free/Starter skip.

### 5. Post-Crawl Onboarding Checklist

**What:** After first crawl completes, show a persistent checklist overlay on the project page: "Run visibility checks → Discover personas → Generate report → Set up schedule." Each step is a link to the right tab with a CTA.

**Where:** New `PostCrawlChecklist` component on the project page. State tracked in localStorage keyed by projectId. Dismissible.

**Steps:**

1. "Review your score" → Overview tab (auto-complete: always done)
2. "Check AI visibility" → Visibility tab (complete when ≥1 visibility check exists)
3. "Discover personas" → Personas tab (complete when ≥1 persona exists)
4. "Generate a report" → Reports tab (complete when ≥1 report exists)
5. "Set up monitoring" → Visibility tab scheduled section (complete when ≥1 schedule exists)

## P2 Features

### 6. Auto-Discover Competitors

**What:** On first crawl, use LLM to identify 3 competitor domains from the crawled site's content/industry. Auto-add them to the competitors table with `source: "auto"`.

**Where:** New service function `autoDiscoverCompetitors()` called via `waitUntil`. Uses Anthropic to analyze homepage content + meta tags → suggest competitor domains. Then calls `competitorBenchmarkService.benchmarkCompetitor()` for each.

**Plan gating:** Pro+ only. Respect `limits.competitorsPerProject`.

### 7. Bulk AI Fix — Already Exists

**Finding:** The `POST /api/fixes/generate-batch` endpoint and `QuickWinsCard` "Fix All" button **already exist**. The UI button calls `api.fixes.generateBatch()`. No new work needed here — just verify it works end-to-end.

### 8. Auto-Schedule Visibility Checks

**What:** After the first manual or auto visibility check completes, suggest a weekly schedule. Show a toast/banner: "Want to track this weekly? [Enable] [Dismiss]"

**Where:** Frontend-only. In `VisibilityTab`, after a check completes, show a one-time prompt if no schedules exist. Calls existing `POST /api/visibility/schedules` on accept.

## P3 Features

### 9. Smart Keyword Expansion from Gaps

**What:** After visibility checks run, identify queries where competitors appear but user doesn't. Auto-suggest those as new tracked keywords.

**Where:** New service function `suggestKeywordsFromGaps()`. Called from a button on the AI Visibility tab's "Visibility Gaps" section: "Track these as keywords" → saves to `savedKeywords`.

### 10. Deduplicate Platform Readiness

**What:** Overview tab shows full Platform Readiness Matrix. Visibility tab shows it again. Replace the Overview version with compact platform badges (icon + grade letter only), link to Visibility tab for details.

**Where:** New `PlatformReadinessBadges` component in overview-tab.tsx replacing the full `PlatformReadinessMatrix` import. Full matrix stays in visibility-tab.tsx.

### 11. Integration Connection Prompts

**What:** After crawl, if PSI or Clarity aren't connected, show a dismissible banner on Overview: "Connect PageSpeed Insights for richer performance data" with one-click link to Integrations tab.

**Where:** Frontend-only. New `IntegrationPromptBanner` in overview-tab.tsx. Checks integration status via existing `api.integrations.list()`. Dismissed state in localStorage.

## Non-Goals

- No new database tables (except possibly a `isPinned` flag for narratives)
- No new external service dependencies
- No changes to the Rust crawler
- Bulk AI Fix (P2-6) already works — skip implementation
