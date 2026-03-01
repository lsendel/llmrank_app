# Screen-by-Screen Product Gap Analysis

Date: 2026-02-27  
Scope: `apps/web`, `apps/api`, route coverage, UX flow coherence, automation defaults

## Executive Summary

The platform already has strong depth (crawl, scoring, visibility checks, strategy, pipeline automation, integrations, reporting), but the main friction is workflow fragmentation: users can access many capabilities, yet the path from "insight" to "action" is still too manual and split across many screens.

Most critical product/engineering gaps observed:

1. Authentication handoff was dropping intended destination after sign-in/sign-up.
2. Test setup mixed unit and e2e specs in the same runner command.
3. Onboarding defaults are inconsistent with scan-to-workspace defaults.
4. Project workspace has high cognitive load (16 tabs + overlapping concepts).
5. Team management is duplicated between `/dashboard/team` and settings.

## Quick Fixes Applied (This Pass)

1. Fixed auth redirect preservation in sign-in and sign-up components.
2. Replaced browser `alert()` auth error handling with inline error messaging.
3. Removed inaccurate "Clerk" security wording from sign-in value props.
4. Scoped Vitest to unit/component tests and excluded `e2e/**`.
5. Added shared workspace-default bootstrap helper and wired onboarding + scan conversion to use it.
6. Added warning/info/success toast styling so non-error operational feedback is visually distinct.
7. Canonicalized team management entry point by redirecting `/dashboard/team` to `/dashboard/settings?tab=team`.
8. Added URL-driven settings tab state (`?tab=`) with tab normalization and org-only tab guards.
9. Reworked project `Configure` workspace into task-based selection with progressive disclosure (`?configure=` deep-link support).
10. Consolidated visibility workflows into one canonical "Visibility Workspace" with internal mode switching while preserving old visibility deep links.
11. Standardized freshness/confidence metadata chips across overview and visibility score surfaces, including AI Visibility.
12. Added social auth loading/error UX for sign-in/sign-up Google flows.
13. Added auth telemetry for redirect funnel tracking, including destination-reached events after sign-in/sign-up.
14. Added lightweight sign-up password strength/validation hints before submission.
15. Hardened API base URL fallback to prefer same-origin outside local dev, reducing localhost connection noise in QA.
16. Elevated "Since your last visit" to the dashboard primary fold with feed deltas and crawl outcome narrative.
17. Upgraded "What to Do Next" to prioritize highest-impact anomaly handoff with one-click issue workflow CTA.
18. Added public scan provenance/confidence chips (last scan time, pages sampled, confidence, probe count) and normalized AI visibility preview provider handling.

Files changed:

- `apps/web/src/components/auth/sign-in.tsx`
- `apps/web/src/components/auth/sign-up.tsx`
- `apps/web/src/components/auth-redirect-tracker.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/vitest.config.ts`
- `apps/web/src/app/dashboard/projects/[id]/configure-state.ts`
- `apps/web/src/app/dashboard/projects/[id]/configure-state.test.ts`
- `apps/web/src/app/dashboard/projects/[id]/page.tsx`
- `apps/web/src/components/tabs/overview-tab.tsx`
- `apps/web/src/components/tabs/visibility-tab.tsx`
- `apps/web/src/components/tabs/ai-visibility-tab.tsx`
- `apps/web/src/lib/insight-metadata.ts`
- `apps/web/src/lib/__tests__/insight-metadata.test.ts`
- `apps/web/src/components/auth/sign-in.tsx`
- `apps/web/src/components/auth/sign-up.tsx`
- `apps/web/src/lib/api-base-url.ts`
- `apps/web/src/lib/__tests__/api-base-url.test.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/auth-client.ts`
- `apps/web/src/app/dashboard/settings/page.tsx`
- `apps/web/src/components/settings/audit-log-section.tsx`
- `apps/web/src/components/settings/team-section.tsx`
- `apps/web/src/components/settings/sso-configuration.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/dashboard/page.test.tsx`
- `apps/web/src/components/cards/next-steps-card.tsx`
- `apps/web/src/components/cards/next-steps-card.test.tsx`
- `apps/web/src/app/scan/results/page.tsx`
- `apps/web/src/app/scan/results/page.test.tsx`

## Screen Coverage and Gaps

## 1) Public Acquisition Screens

Routes reviewed:

- `/`
- `/scan`
- `/scan/results`
- `/pricing`
- `/integrations`
- `/mcp`
- `/leaderboard`
- `/ai-seo-tool`
- `/chatgpt-seo`
- `/audit/[industry]`
- `/privacy`
- `/terms`

Gaps:

- Public pages are polished but conversion paths are still linear instead of persona-guided.
- Public scan gives useful preview, but confidence/provenance metadata is still thin on public-facing scoring blocks.
- Local dev logs show API dependency noise when API host is unavailable (`NEXT_PUBLIC_API_URL` fallback to `http://localhost:8787`), which makes UI QA noisy.

Recommendations:

- Add a persistent "choose your workflow" CTA strip: `Quick Scan`, `Create Workspace`, `Connect Integrations`.
- Add explicit confidence chips on scan/public score surfaces: last run time, pages sampled, provider count.
- Make local/dev API fallback strategy more resilient to avoid noisy console failures in public page QA.

## 2) Auth (Sign-in / Sign-up)

Routes/files reviewed:

- `/sign-in` (`apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`)
- `/sign-up` (`apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`)
- components in `apps/web/src/components/auth/*`

Gaps:

- Redirect continuity from middleware to auth completion was broken before fix.
- Error UX used blocking browser alerts before fix.
- Trust copy had inaccurate implementation reference before fix.

Recommendations:

- Add loading + error states for social sign-in as well (not only email/password).
- Add lightweight password strength and validation hints on sign-up.
- Add explicit auth telemetry for "redirect destination reached" conversion measurement.

## 3) Onboarding

Routes/files reviewed:

- `/onboarding`
- `apps/web/src/hooks/use-onboarding-wizard.ts`

Gaps:

- Creates project and crawl quickly, but does not apply the same default automation setup used in scan-to-workspace flow.
- Missing explicit pre-launch automation consent step (schedule, digest, visibility tracking).

Recommendations:

- Reuse scan-to-workspace default setup in onboarding:
  - weekly crawl schedule
  - `autoRunOnCrawl: true`
  - default visibility schedule
  - weekly digest opt-in when currently off
- Add "Confirm defaults" step before first crawl launch.

## 4) Dashboard + Portfolio

Routes/files reviewed:

- `/dashboard`
- `/dashboard/projects`
- `/dashboard/history`

Strengths:

- Strong portfolio controls already present (anomaly filters, bulk actions, preflight logic, pipeline bulk-enable).

Gaps:

- Portfolio and dashboard are feature-rich but high density; users still need clearer "what changed since last visit" narratives and stricter default saved views by persona.

Recommendations:

- Elevate "since last visit" and anomalies to primary fold.
- Persist role-based default preset server-side (not only localStorage).
- Add clearer handoff from anomaly cards to one-click executable workflows.

## 5) Project Workspace

Route/file reviewed:

- `/dashboard/projects/[id]`
- tab state in `apps/web/src/app/dashboard/projects/[id]/tab-state.ts`

Gaps:

- 16 tabs increase navigation overhead and split related work:
  - `visibility` + `ai-visibility` + `ai-analysis`
  - `strategy` + `competitors` + `personas` + `keywords`

Recommendations:

- Consolidate to four top-level workspaces:
  - Analyze
  - Grow Visibility
  - Automate & Operate
  - Configure
- Keep deep-link compatibility with redirect mapping for old `?tab=` values.

## 6) Settings and Team Management

Routes/files reviewed:

- `/dashboard/settings`
- `/dashboard/team`
- settings `TeamSection`

Gaps:

- Team administration is split between a dedicated page and settings tab, with overlapping but different models (team vs org-oriented flow).

Recommendations:

- Pick one canonical management surface and redirect the other.
- Align role semantics and invite workflows across team/org UIs.

## 7) Automation and Insights Surfaces

Files reviewed:

- `apps/web/src/components/tabs/automation-tab.tsx`
- `apps/web/src/components/tabs/visibility-tab.tsx`
- `apps/web/src/components/tabs/ai-visibility-tab.tsx`

Strengths:

- Good automation controls exist: run-now, health check, step skipping, success/failure status.
- Visibility tab already includes run/monitor and analysis concepts with scheduling controls.

Gaps:

- Advanced automation capability exists but still requires too many manual setup steps for first-time users.
- Visibility concepts are still split across multiple tabs/surfaces.

Recommendations:

- Auto-enable and expose "default operations mode" for new projects.
- Merge visibility experiences into one canonical workflow with submodes.
- Add explicit confidence/freshness values to all visibility summary cards.

## Backend Capability Inventory (Already Available)

`apps/api/src/index.ts` confirms broad backend support is already present:

- projects, crawls, pages, scores, dashboard
- visibility + schedules
- integrations
- strategy, competitors, trends, prompt research
- reports + exports
- pipeline + alerts + notifications
- teams + organizations + API tokens
- public scan/report endpoints

Implication: Most immediate product gains are UX orchestration and default automation behavior, not net-new backend surface area.

## Prioritized Next Implementation Batch

P0:

1. Unify onboarding defaults with scan-to-workspace defaults.
2. Consolidate project IA (tab grouping + redirects).
3. Canonicalize team/org management into one route.

P1:

1. Visibility workspace consolidation (`run-monitor` + `analyze-gaps` as one canonical area).
2. Confidence/freshness metadata standardization across score and visibility cards.
3. Server-backed persona presets for dashboard/project list.

P2:

1. Improve toast variant system (warning/info visual treatment).
2. Harden local/dev API fallback behavior for cleaner QA.
3. Expand journey-level e2e coverage for onboarding -> first crawl -> automation output.
