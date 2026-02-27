# Product Gap Analysis (Screens + Backend)

Date: 2026-02-26  
Scope: `apps/web` UI routes/components, `apps/api` routes/services, current automation behavior

## Executive Summary

The product already has strong depth (crawl, scoring, visibility, pipeline automation, reports, integrations), but usability is fragmented by too many parallel surfaces and weak cross-tab orchestration.

Top gaps:

1. **Information architecture overload** in project workspace (`16` tabs) with overlapping concepts (`visibility` vs `ai-visibility`, `strategy` vs `competitors/personas/keywords`).
2. **Automation controls are underexposed**: backend supports robust post-crawl pipeline and cron workers, but UI mostly shows status rather than configurable policies.
3. **Insight confidence and freshness are not explicit**: users see results but not enough data provenance/timestamp confidence cues.
4. **Plan-gated UX is inconsistent**: some screens show disabled state clearly; others allow interaction then fail.
5. **Testing focus is shallow at journey level**: smoke tests exist, but critical multi-step flows (onboarding → first crawl → pipeline outcomes) are not covered end-to-end.

## Immediate Fixes Implemented

1. Added **hourly visibility scheduling option** in UI (backend already supported it).
2. Expanded AI visibility provider coverage in UI to include **Grok** and consistent provider columns.
3. Added explicit **report schedule plan-lock state** for Pro+ gating instead of ambiguous failures.
4. Added **freshness/confidence chips** to Overview and Visibility surfaces to expose data recency and sampling reliability.
5. Added **scan-to-project one-click conversion** for signed-in users with automatic default setup (weekly crawl cadence, pipeline auto-run, weekly visibility schedule attempt, weekly digest opt-in when currently off).
6. Added **Visibility IA submodes** (`Run & Monitor`, `Analyze & Gaps`) to reduce cross-purpose cognitive load in one long screen.
7. Added **provider preset controls** in Visibility Run mode (intent-based recommended set + quick presets, including plan-aware full-coverage gating).
8. Added **bulk crawl preflight** in portfolio Projects view with estimated credit impact and skip/over-limit warnings before execution.
9. Added **Projects portfolio operations board** with `Since Last Visit` activity summary and anomaly counts (failed/stale/no-crawl/manual-schedule/pipeline-off) to surface risk at a glance.
10. Added **one-click anomaly filters** from the portfolio board (shareable `anomaly` URL state) so teams can jump directly into failed/stale/no-crawl/in-progress/low-score/manual-schedule/pipeline-off subsets.
11. Added **contextual anomaly remediation shortcuts** in Projects view: when an anomaly filter is active, users now get direct links into the most relevant project tabs (`issues`, `automation`, `settings`, `logs`, etc.) for the top affected projects.
12. Added **anomaly matching bulk-selection controls**: users can now select/unselect all projects in the current anomaly subset (not just the visible page), and bulk crawl preflight now evaluates the full selected anomaly scope.
13. Added **anomaly-specific bulk pipeline preset** for `pipeline_disabled`: users can select matching projects and apply one-click `autoRunOnCrawl=true` updates with partial-success reporting and auto-refresh.

Files:

- `apps/web/src/components/tabs/visibility-tab.tsx`
- `apps/web/src/components/tabs/ai-visibility-tab.tsx`
- `apps/web/src/components/reports/reports-tab.tsx`
- `apps/web/src/components/tabs/overview-tab.tsx`
- `apps/web/src/app/scan/results/page.tsx`
- `apps/web/src/app/dashboard/projects/page.tsx`

## Screen-by-Screen Gap Analysis

## 1) Public Acquisition Screens

Routes:

- `/` (`apps/web/src/app/page.tsx`)
- `/scan` + `/scan/results` (`apps/web/src/app/scan/*`)
- `/pricing` (`apps/web/src/app/pricing/page.tsx`)
- `/integrations` (`apps/web/src/app/integrations/page.tsx`)
- `/mcp` (`apps/web/src/app/mcp/page.tsx`)
- `/leaderboard` (`apps/web/src/app/leaderboard/*`)

Gaps:

- **Messaging fragmentation**: each marketing page has slightly different narrative and conversion path; no shared “choose your path” CTA orchestration.
- **Scan-to-workspace handoff is weak**: scan results CTAs are present, but no guided “import this scan into project workspace with defaults” flow.
- **Trust instrumentation missing in UI**: pages claim methodology; little visible proof surfaces (freshness timestamps, crawl sample size badges, benchmark context).

Recommendations:

- Add a unified “Start path” chooser on public pages: `Quick scan`, `Create workspace`, `Connect data`.
- Add one-click conversion on `/scan/results`: `Create Project from this scan` with prefilled domain + enabled defaults (weekly digest + weekly visibility schedule).
- Add confidence/freshness chips near scores on public surfaces (`last analyzed`, `pages sampled`, `providers queried`).

## 2) Onboarding

Route:

- `/onboarding` (`apps/web/src/app/onboarding/page.tsx`, `apps/web/src/hooks/use-onboarding-wizard.ts`)

Strengths:

- Smooth first-run flow with automatic project creation and crawl dispatch.
- Persona classification is best-effort and non-blocking.

Gaps:

- **No explicit consent/summary step** of automation defaults before launch.
- **No integration fast-start during onboarding** (only after entering workspace).
- **No post-onboarding “operational readiness” checkpoint** (alerts, schedules, report cadence).

Recommendations:

- Add final pre-scan checklist with defaults toggles:
  - `autoRunOnCrawl`
  - visibility schedule (weekly/hourly)
  - weekly digest
  - first report recipient.
- Add optional “Connect GSC now” as inline branch.
- After first completed crawl, trigger guided setup modal for integrations + schedules.

## 3) Dashboard (Portfolio)

Routes:

- `/dashboard` (`apps/web/src/app/dashboard/page.tsx`)
- `/dashboard/projects` (`apps/web/src/app/dashboard/projects/page.tsx`)
- `/dashboard/history` (`apps/web/src/app/dashboard/history/page.tsx`)

Strengths:

- Useful cards (`next steps`, `priority feed`, quick tools).
- Filtering/sorting presets and bulk actions in projects list.

Gaps:

- **Cognitive load**: high density + many cards without explicit “what changed since last visit”.
- **Bulk actions lack smart safeguards** (preview impact/cost for bulk crawl).
- **Limited portfolio-level trends**: project cards show local stats but weak cross-project anomaly detection.

Recommendations:

- Add “Since last login” module with major deltas + failures.
- Add preflight confirmation for bulk crawl including estimated credit impact.
- Add portfolio-level risk board: regressions, stale crawls, failing pipelines, unconfigured schedules.

## 4) Project Workspace (Core)

Route:

- `/dashboard/projects/[id]` (`apps/web/src/app/dashboard/projects/[id]/page.tsx`)

Current structure:

- `overview`, `pages`, `issues`, `history`, `strategy`, `competitors`, `ai-visibility`, `ai-analysis`, `visibility`, `personas`, `keywords`, `integrations`, `reports`, `automation`, `logs`, `settings`

Primary gap:

- **Too many tabs with overlap**, making workflows non-linear.

Recommended IA consolidation:

- **Analyze**: overview, pages, issues, history
- **Grow Visibility**: visibility + ai-visibility + keywords + personas + competitors
- **Automate & Operate**: automation + reports + integrations + logs
- **Configure**: settings

## 4a) Overview

File: `apps/web/src/components/tabs/overview-tab.tsx`

Gaps:

- Insight-rich but no explicit confidence/freshness markers per card.
- “Top issues” and “quick wins” don’t expose expected score impact rollup at section level.

Recommendations:

- Add data stamps per block (`updated X ago`, `from crawl #...`).
- Add aggregate “potential uplift” meter combining top quick wins.

## 4b) Pages + Page Detail

Files:

- `apps/web/src/components/tabs/pages-tab.tsx`
- `apps/web/src/app/dashboard/projects/[id]/pages/[pageId]/page.tsx`
- `apps/web/src/components/page-detail/page-optimization-workspace.tsx`

Gaps:

- Pages table lacks segment/filter by issue category, intent, template group.
- Optimization workspace is strong but isolated from execution systems (no “create action item” / owner assignment directly).

Recommendations:

- Add filters: issue-heavy, traffic-heavy, AI-readiness low, by template cluster.
- Add tasking controls from page-level recommendations (`assign`, `due date`, `status`).

## 4c) Issues

File: `apps/web/src/components/tabs/issues-tab.tsx`

Gaps:

- Good filtering and fix-rate banner; missing “effort-to-impact sorting” and execution SLA view.

Recommendations:

- Add sort modes: `impact`, `effort`, `time-to-fix`.
- Add execution lane summary (open >14d, blocked, ownerless).

## 4d) Strategy / Competitors / Personas / Keywords

Files:

- `apps/web/src/components/tabs/strategy-tab.tsx`
- `apps/web/src/components/tabs/competitors-tab.tsx`
- `apps/web/src/components/tabs/personas-tab.tsx`
- `apps/web/src/components/tabs/keywords-tab.tsx`

Gaps:

- Functionality exists but is split across multiple tabs with duplicated competitor mechanics.
- Weak closed-loop behavior from discovered insights to tracked entities.

Recommendations:

- Build a single “Demand Model” flow:
  1. Discover personas
  2. Generate/validate keywords
  3. Map to competitors
  4. Push to scheduled visibility checks.
- Add “accept all recommended” with preview + dedupe controls.

## 4e) Visibility + AI Visibility

Files:

- `apps/web/src/components/tabs/visibility-tab.tsx`
- `apps/web/src/components/tabs/ai-visibility-tab.tsx`

Gaps:

- Overlap/confusion between operational checks and analytics summaries.
- Schedule builder is solid but lacked hourly UI option (now fixed).
- Provider coverage inconsistent in analytics table (now fixed).

Recommendations:

- Merge into one workspace with two submodes:
  - `Run & Monitor`
  - `Analyze & Gaps`
- Add “recommended provider set” presets by plan and query intent.
- Add confidence scoring: mention reliability based on repeated checks and source diversity.

## 4f) Integrations

File: `apps/web/src/components/tabs/integrations-tab.tsx`

Strengths:

- Clear connection/test/sync states.

Gaps:

- Sync outcomes are not deeply connected to downstream actions (what changed in scoring/action items after sync).

Recommendations:

- Add “Delta from last sync” card (new issues, score changes, query shifts).
- Add action shortcuts generated from integration insights.

## 4g) Reports

File: `apps/web/src/components/reports/reports-tab.tsx`

Gaps:

- Auto-report UX previously attempted interaction on locked plans (now improved with explicit lock messaging).
- Missing report templates by audience (`exec`, `SEO lead`, `content lead`) and cadence wizard.

Recommendations:

- Add persona-based report presets and saved recipients groups.
- Add “send now” + dry-run preview for scheduled templates.

## 4h) Automation

File: `apps/web/src/components/tabs/automation-tab.tsx`

Strengths:

- Good visibility into latest run and health checks.

Gaps:

- Backend supports pipeline settings updates, but UI does not expose per-step policy control.

Recommendations:

- Add `Pipeline Settings` editor:
  - `autoRunOnCrawl`
  - step toggles (`skipSteps`)
  - optional retry policy controls.
- Add “why step failed” deep links into related tabs with pre-filtered context.

## 4i) Logs

File: `apps/web/src/components/tabs/logs-tab.tsx`

Gaps:

- Good upload and summary, but no actionable bridge into robots/llms.txt fixes.

Recommendations:

- Add generated fix suggestions from bot behavior anomalies.
- Add path-level recommendations tied to page detail/action items.

## 5) Settings / Team / Billing / Admin

Files:

- `apps/web/src/app/dashboard/settings/page.tsx`
- `apps/web/src/components/settings/*`
- `apps/web/src/app/dashboard/billing/page.tsx`
- `apps/web/src/app/dashboard/admin/page.tsx`

Gaps:

- Settings and team are capable but fragmented between workspace settings and account settings.
- Billing and upgrade prompts are not consistently contextualized at action point.
- Admin has broad controls, but risk actions could use stronger guard rails and audit explainability.

Recommendations:

- Unify settings IA around:
  - `Workspace settings`
  - `Account settings`
  - `Org security`.
- Add contextual upgrade rationale inline with blocked actions (what unlocks immediately).
- In admin actions, require reason + preview blast radius before destructive actions.

## Backend Capability Gaps (Exposure/UX, not missing backend)

Existing backend capabilities underexposed in UI:

- Pipeline settings patch endpoint exists (`/api/pipeline/:projectId/settings`) but no first-class UI for step policy.
- Cron-driven automation already runs for:
  - notifications
  - scheduled visibility
  - weekly/monthly digests
  - cleanup and outbox processing
    (`apps/api/src/index.ts`).
- Scheduled visibility supports `hourly|daily|weekly`; UI now matches this.

## Testing and Quality Gaps

Observed:

- Minimal smoke coverage in `apps/web/e2e/smoke.spec.ts`.
- High-risk critical flows are not covered end-to-end (onboarding → crawl → pipeline → report/schedule outcomes).

Recommendations:

- Add e2e journeys:
  1. First user onboarding to first completed crawl.
  2. Run visibility checks + schedule + cron execution verification.
  3. Integration connect → sync → insight delta appears.
  4. Report schedule on Pro plan, plan lock on Free plan.

## Prioritized Roadmap

P0 (next 1-2 weeks):

1. Consolidate visibility IA (single workspace, two submodes).
2. Add pipeline settings UI and automation defaults editor.
3. Add scan-to-project one-click conversion with default automation setup.
4. Add confidence/freshness chips across overview and visibility insights.

P1 (2-4 weeks):

1. Consolidate strategy/competitors/personas/keywords into one guided demand flow.
2. Add portfolio anomaly board and bulk crawl preflight cost preview.
3. Add report presets by audience + schedule wizard.

P2 (4-8 weeks):

1. Advanced execution layer: assign owners/SLAs from page and issue contexts.
2. Cross-source causal insights (integration deltas → issue/recommendation changes).
3. Expand e2e suite for full operational lifecycle coverage.
