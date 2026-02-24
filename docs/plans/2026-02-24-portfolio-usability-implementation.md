# Portfolio-Scale Usability and Growth Implementation Plan

## Goal

Ship a portfolio-first product experience that helps marketers improve Google and LLM visibility with less manual work, clearer priorities, and more professional UX consistency.

## Primary Outcomes

1. Reduce time-to-first-value for new projects from crawl complete to first completed action.
2. Increase weekly active marketers completing at least one recommended action item.
3. Improve conversion from public scan and integrations pages into authenticated projects.
4. Improve trust and clarity through consistent UI behavior, navigation, and data freshness indicators.

## Success Metrics

1. `TTFV`: median minutes from first crawl completion to first completed action item (target: -40%).
2. `Action Adoption`: percent of active projects with >=3 completed action items per week (target: +30%).
3. `Automation Adoption`: percent of new projects with default automation active (target: >=70%).
4. `Portfolio Usage`: percent of weekly active users viewing portfolio priority feed (target: >=60%).
5. `Funnel Conversion`: scan results to sign-up/project creation conversion (target: +20%).
6. `UX Reliability`: support tickets tied to navigation confusion/settings mismatch (target: -50%).

## Workstreams

1. Navigation and Information Architecture Consolidation
2. Portfolio Command Center and Insights
3. Default Automation and Guided Flows
4. Ranking Workflow Execution (Google + LLM)
5. UI Professionalization and Consistency System
6. Backend Scalability and Contract Reliability
7. Public Funnel and Conversion Improvements

## Ticket Backlog

### WS1: Navigation and IA Consolidation

#### PUX-001 (P0) Canonicalize project workspace and deprecate duplicate project routes

- Scope:
  - Keep `/dashboard/projects/[id]?tab=*` as the only canonical project workspace.
  - Add redirects from legacy routes to canonical tabs.
- Files:
  - `apps/web/src/app/dashboard/projects/[id]/issues/page.tsx`
  - `apps/web/src/app/dashboard/projects/[id]/pages/page.tsx`
  - `apps/web/src/app/dashboard/projects/[id]/history/page.tsx`
  - `apps/web/src/app/dashboard/projects/[id]/reports/page.tsx`
  - `apps/web/src/app/dashboard/projects/[id]/logs/page.tsx`
  - `apps/web/src/app/dashboard/projects/[id]/page.tsx`
- Acceptance Criteria:
  - All legacy pages route to canonical tab equivalents with preserved project id.
  - No duplicate navigation entry points remain in sidebar and top-level menus.
  - Deep links continue to work.
- Validation:
  - Playwright flows for each legacy URL assert redirect target and visible tab state.

#### PUX-002 (P0) Validate and normalize `tab` query state

- Scope:
  - Add allowed tab map and fallback for invalid `tab` values.
  - Ensure unknown tabs route to `overview`.
- Files:
  - `apps/web/src/app/dashboard/projects/[id]/page.tsx`
- Acceptance Criteria:
  - Invalid `tab` query does not break render and resolves to `overview`.
  - Browser back/forward preserves tab state.

#### PUX-003 (P0) Fix settings and billing link coherence

- Scope:
  - Replace links using `/dashboard/settings?tab=billing` with `/dashboard/billing`.
  - Keep settings tabs only for settings concerns.
- Files:
  - `apps/web/src/components/narrative/narrative-viewer.tsx`
  - `apps/web/src/components/narrative/ai-insight-card.tsx`
  - `apps/web/src/app/dashboard/settings/page.tsx`
  - `apps/web/src/app/dashboard/billing/page.tsx`
- Acceptance Criteria:
  - All billing CTAs navigate to billing route.
  - No dead settings tab links remain.

#### PUX-004 (P0) Fix org settings visibility bug from `/api/orgs` shape mismatch

- Scope:
  - Align frontend parsing to backend response shape (single object or null).
  - Ensure SSO and Audit tabs render when org exists.
- Files:
  - `apps/web/src/app/dashboard/settings/page.tsx`
  - `apps/api/src/routes/organizations.ts`
  - `apps/api/src/services/organization-service.ts`
- Acceptance Criteria:
  - Org admins reliably see SSO and Audit tabs.
  - Non-org users do not see those tabs.
- Validation:
  - Add tests for both org and non-org response cases.

#### PUX-005 (P1) Unify team and org admin UX

- Scope:
  - Merge duplicated team management surfaces into one admin area.
  - Keep role/seat/invite actions in one place.
- Files:
  - `apps/web/src/app/dashboard/team/page.tsx`
  - `apps/web/src/components/settings/team-section.tsx`
  - `apps/api/src/routes/teams.ts`
  - `apps/api/src/routes/organizations.ts`
- Acceptance Criteria:
  - Single canonical team management flow.
  - Existing invites and role actions are preserved.

### WS2: Portfolio Command Center and Insights

#### PUX-101 (P0) Build portfolio priority feed API

- Scope:
  - Add backend endpoint returning top opportunities and risks across projects.
  - Rank by impact, confidence, effort, and trend delta.
- Files:
  - `apps/api/src/routes/dashboard.ts`
  - `apps/api/src/services/insights-service.ts`
  - `apps/api/src/services/recommendations-service.ts`
- Acceptance Criteria:
  - Endpoint returns ordered cross-project list with reasons and suggested next action.
  - Response includes freshness timestamp and source metadata.

#### PUX-102 (P0) Add portfolio command center UI on `/dashboard/projects`

- Scope:
  - Introduce "Priority Feed" with filters: impact, urgency, channel (Google/LLM).
  - Add clear action buttons: assign, open page, run fix.
- Files:
  - `apps/web/src/app/dashboard/projects/page.tsx`
  - `apps/web/src/components/cards/project-recommendations-card.tsx`
  - `apps/web/src/components/cards/next-steps-card.tsx`
- Acceptance Criteria:
  - Marketer can identify top 5 actions across all properties in one screen.
  - Each action has explicit owner, expected impact, due date.

#### PUX-103 (P1) Add saved views and role-based defaults

- Scope:
  - Persist filter presets for "SEO Manager", "Content Lead", "Exec Summary".
  - Default landing view based on role/team preference.
- Files:
  - `apps/web/src/app/dashboard/projects/page.tsx`
  - `apps/api/src/routes/account.ts`
  - `apps/api/src/services/organization-service.ts`
- Acceptance Criteria:
  - User can save/select view presets.
  - First load uses last selected or role default.

### WS3: Default Automation and Guided Flows

#### PUX-201 (P0) Default post-crawl automation enabled on new projects

- Scope:
  - Ensure newly created projects auto-trigger post-crawl processing.
  - Display automation status in onboarding and project overview.
- Files:
  - `apps/api/src/routes/projects.ts`
  - `apps/api/src/services/post-processing-service.ts`
  - `apps/web/src/app/dashboard/projects/new/page.tsx`
  - `apps/web/src/components/cards/post-crawl-checklist.tsx`
- Acceptance Criteria:
  - New project with completed crawl runs recommendations/quick wins pipeline automatically.
  - UI shows status: pending/running/completed/failed with retry.

#### PUX-202 (P0) Expose pipeline health, runs, and settings in UI

- Scope:
  - Add Automation tab inside project workspace.
  - Surface last run, success rate, failed steps, rerun controls.
- Files:
  - `apps/web/src/app/dashboard/projects/[id]/page.tsx`
  - `apps/web/src/lib/api.ts`
  - `apps/api/src/routes/pipeline.ts`
  - `apps/api/src/services/health-check-service.ts`
- Acceptance Criteria:
  - User can inspect and rerun pipeline without leaving project.
  - Failed steps include readable error summaries and retry action.

#### PUX-203 (P1) Complete placeholder pipeline steps

- Scope:
  - Implement missing step handlers for `content_optimization`, `action_report`, `health_check`.
- Files:
  - `apps/api/src/services/pipeline-service.ts`
  - `apps/api/src/services/content-optimization-service.ts`
  - `apps/api/src/services/report-service.ts`
  - `apps/api/src/services/health-check-service.ts`
- Acceptance Criteria:
  - Full pipeline runs end-to-end without placeholder no-op steps.
  - Step outputs are persisted and visible in automation UI.

#### PUX-204 (P1) Default weekly digest setup flow

- Scope:
  - Auto-propose a weekly digest during onboarding with one-click accept.
  - Let users pick recipient list and time.
- Files:
  - `apps/web/src/components/settings/digest-preferences-section.tsx`
  - `apps/api/src/services/digest-service.ts`
  - `apps/api/src/routes/notification-channels.ts`
- Acceptance Criteria:
  - New user can enable digest in one step.
  - Digests include top portfolio actions and ranking changes.

### WS4: Ranking Workflow Execution (Google + LLM)

#### PUX-301 (P0) Wire issue-level "Optimize with AI" actions end-to-end

- Scope:
  - Connect issue card CTA to fix generation and apply workflow.
- Files:
  - `apps/web/src/components/issue-card.tsx`
  - `apps/web/src/components/tabs/issues-tab.tsx`
  - `apps/api/src/routes/fixes.ts`
  - `apps/api/src/services/fix-generator-service.ts`
- Acceptance Criteria:
  - Clicking CTA opens runnable fix flow with generated recommendation.
  - User can apply/skip and status is recorded.

#### PUX-302 (P1) Build page-level optimization workspace

- Scope:
  - Add "before vs suggested" editor for title/meta/H1/schema/internal links.
  - Include expected SEO and LLM impact score.
- Files:
  - `apps/web/src/app/dashboard/projects/[id]/pages/[pageId]/page.tsx`
  - `apps/web/src/components/tabs/pages-tab.tsx`
  - `apps/api/src/services/page-service.ts`
  - `apps/api/src/routes/pages.ts`
- Acceptance Criteria:
  - User can review actionable edits per page and mark implemented.
  - Impact score and rationale are shown for each suggestion.

#### PUX-303 (P1) Action item automation from critical regressions

- Scope:
  - Auto-create action items for high-severity drops with owners/due dates.
- Files:
  - `apps/api/src/routes/action-items.ts`
  - `apps/api/src/services/regression-service.ts`
  - `apps/api/src/services/notification-service.ts`
- Acceptance Criteria:
  - Critical regressions produce action items automatically.
  - Notifications are sent to configured channels.

### WS5: UI Professionalization and Consistency

#### PUX-401 (P0) Establish shared design tokens and layout standards

- Scope:
  - Standardize spacing, typography scale, card density, status colors, badge hierarchy.
- Files:
  - `apps/web/src/app/globals.css`
  - `apps/web/src/components/ui/*`
  - `apps/web/src/app/dashboard/layout.tsx`
- Acceptance Criteria:
  - All dashboard screens use shared tokenized spacing and type scales.
  - Visual regressions are reviewed against baseline snapshots.

#### PUX-402 (P1) Standardize copy tone and microcopy patterns

- Scope:
  - Define concise operator-focused copy guidelines and apply across key screens.
- Files:
  - `apps/web/src/app/dashboard/projects/[id]/page.tsx`
  - `apps/web/src/app/scan/client.tsx`
  - `apps/web/src/app/scan/results/page.tsx`
  - `apps/web/src/app/integrations/page.tsx`
- Acceptance Criteria:
  - Labels, helper text, and CTA language are consistent and action-oriented.
  - Remove mixed voice and overly verbose blocks.

#### PUX-403 (P1) Add consistency package for empty/loading/error states

- Scope:
  - Build reusable state components and replace ad-hoc render states.
- Files:
  - `apps/web/src/components/ui/*`
  - `apps/web/src/components/tabs/*`
  - `apps/web/src/components/cards/*`
- Acceptance Criteria:
  - Shared empty/loading/error components used in all core dashboard tabs.
  - Errors provide actionable next step and retry path.

### WS6: Backend Scalability and Contract Reliability

#### PUX-501 (P0) Optimize project list retrieval for portfolio scale

- Scope:
  - Replace in-memory enrichment-heavy path with DB-level aggregation/materialized summary.
  - Add pagination and stable sorting by score/activity.
- Files:
  - `apps/api/src/services/project-service.ts`
  - `packages/db/src/queries/projects.ts`
  - `packages/db/src/schema.ts`
- Acceptance Criteria:
  - Portfolio list p95 API latency remains stable with large project counts.
  - Sort/filter outputs match legacy behavior for correctness.

#### PUX-502 (P0) Resolve API contract drift (`action-plan` vs `action-items`)

- Scope:
  - Remove or migrate dead client endpoints and align API naming.
- Files:
  - `apps/web/src/lib/api.ts`
  - `apps/api/src/routes/action-items.ts`
  - `apps/api/src/routes/v1.ts`
- Acceptance Criteria:
  - No client references to non-existent action-plan endpoints.
  - Contract tests pass for action item CRUD and status updates.

#### PUX-503 (P1) Fix crawl schedule flexibility mismatch (`daily`)

- Scope:
  - Ensure `daily` is available anywhere schedule types are selectable.
- Files:
  - `apps/web/src/components/forms/crawl-settings-form.tsx`
  - `apps/api/src/routes/visibility-schedules.ts`
  - `apps/api/src/services/scheduled-visibility-service.ts`
- Acceptance Criteria:
  - User can configure daily schedule in UI and backend stores/runs it correctly.

### WS7: Public Funnel and Conversion

#### PUX-601 (P1) Improve `/scan` to `/scan/results` conversion path

- Scope:
  - Add clear conversion actions: create project, connect integration, schedule recurring scan.
- Files:
  - `apps/web/src/app/scan/client.tsx`
  - `apps/web/src/app/scan/results/page.tsx`
- Acceptance Criteria:
  - Results page provides one primary and two secondary next actions.
  - Track funnel events for each action.

#### PUX-602 (P1) Make integrations page actions stateful and explicit

- Status:
  - Closed on 2026-02-24.
- Scope:
  - Distinguish "available now", "coming soon", and "requires auth".
  - Wire available connect actions to authenticated flows.
- Files:
  - `apps/web/src/app/integrations/page.tsx`
  - `apps/web/src/app/dashboard/projects/[id]/page.tsx`
  - `apps/api/src/routes/integrations.ts`
- Acceptance Criteria:
  - No clickable dead-end buttons on integration cards.
  - Connected state is visible after auth return.
- Arden Closeout Steps:
  1. Run `pnpm -C apps/web test src/app/integrations/catalog-client.test.tsx src/app/integrations/callback/google/page.test.tsx`.
  2. Run manual QA for signed-out, no-project, connected, and upgrade-required states on `/integrations`.
  3. Validate OAuth return UX by connecting GSC/GA4 and confirming `/dashboard/projects/[id]?tab=integrations&connected=<provider>` success banner.
  4. Mark PUX-602 as Done in the tracker and attach test output + two screenshots (catalog states and post-auth connected banner).

#### PUX-603 (P2) Upgrade public report/share pages for executive readability

- Scope:
  - Add executive summary panel, prioritized actions, and confidence/freshness markers.
- Files:
  - `apps/web/src/app/report/[token]/page.tsx`
  - `apps/web/src/app/share/[token]/page.tsx`
  - `apps/api/src/routes/public.ts`
- Acceptance Criteria:
  - Public viewers can identify top actions within 30 seconds.
  - Every recommendation includes data timestamp and confidence indicator.

## 30/60/90 Delivery Plan

### Days 0-30 (Stability and Core Usability)

1. PUX-001, PUX-002, PUX-003, PUX-004
2. PUX-201, PUX-202
3. PUX-301
4. PUX-501, PUX-502
5. PUX-401

### Days 31-60 (Portfolio Intelligence and Automation Depth)

1. PUX-101, PUX-102, PUX-103
2. PUX-203, PUX-204
3. PUX-302, PUX-303
4. PUX-503
5. PUX-403

### Days 61-90 (Growth and Public Conversion)

1. PUX-005
2. PUX-402
3. PUX-601, PUX-602, PUX-603

## Analytics and Instrumentation Spec

Track these events in API and frontend telemetry:

1. `priority_feed_viewed`
2. `priority_action_opened`
3. `priority_action_completed`
4. `automation_default_enabled`
5. `pipeline_run_viewed`
6. `pipeline_run_retried`
7. `issue_optimize_ai_clicked`
8. `fix_applied`
9. `scan_result_cta_clicked`
10. `integration_connect_clicked`
11. `settings_tab_opened`
12. `billing_page_opened`

## QA Matrix by Critical Screens

1. `/dashboard/projects`
2. `/dashboard/projects/[id]?tab=*`
3. `/dashboard/settings`
4. `/dashboard/billing`
5. `/dashboard/team` (until consolidated)
6. `/scan`
7. `/scan/results`
8. `/integrations`
9. `/report/[token]`
10. `/share/[token]`

Each screen requires:

1. Visual regression snapshot
2. Accessibility smoke checks (keyboard + headings + labels)
3. Error-path testing with failed API calls
4. Mobile viewport verification
5. Event telemetry assertion for core CTA

## Risks and Mitigations

1. Risk: Route consolidation breaks deep links.
   - Mitigation: permanent redirects and e2e coverage for all legacy paths.
2. Risk: Portfolio feed ranking logic feels opaque.
   - Mitigation: include "why this is prioritized" explanations in each item.
3. Risk: Automation defaults feel intrusive.
   - Mitigation: default on with clear opt-out controls and transparent schedule summary.
4. Risk: Performance regressions on large accounts.
   - Mitigation: gate rollout with p95 latency dashboard and load tests before full rollout.

## Definition of Done

1. All P0 tickets shipped and verified in staging + production.
2. No broken navigation routes or dead-end CTAs in critical screens.
3. Portfolio feed and automation metrics live in analytics dashboards.
4. Runbooks updated for support and success teams.
5. Post-launch review completed with metric readout at day 14 and day 45.
