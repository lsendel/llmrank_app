# Screen-by-Screen Usability + Feature Gap Analysis (V3)

Date: 2026-03-04
Scope: `apps/web`, `apps/api`, end-user flows for marketers, SEO operators, and agency teams
Mode: Execution-first (prioritized backlog + live implementation)

## Objectives

1. Reduce UX friction on primary happy paths (scan -> workspace -> crawl -> actions -> automation).
2. Improve visual/IA organization so users can find the right workflow faster.
3. Increase default automation so teams get value without manual setup.
4. Strengthen Google + LLM discoverability on public funnel pages.
5. Map backend capabilities to UI exposure and close the highest-impact gaps first.

## Happy Path Audit

### 1) Acquisition -> Activation

Routes: `/`, `/scan`, `/scan/results`, `/sign-up`, `/dashboard/projects/new`

Current strength:

- Strong top-of-funnel scan value and clear CTAs.

Observed gaps:

- Scan landing had limited structured metadata compared with other high-intent pages.
- Project creation defaults were mostly implicit, not explicitly configurable.

Improvements shipped in this pass:

- Added richer `/scan` metadata (keywords + canonical) and JSON-LD (web page, breadcrumb, FAQ).
- Added explicit “Default operations mode” controls on project creation.

### 2) Project Workspace Navigation

Routes: `/dashboard/projects/[id]`

Current strength:

- Deep capability set already exists (analyze, visibility, strategy, automation, settings).

Observed gaps:

- Cognitive load from many tabs; users can lose workflow context.
- Top-level “job to be done” navigation was implicit in sidebar grouping only.

Improvements shipped in this pass:

- Added a top “Workspace” switcher with four workflow areas:
  - Analyze
  - Grow Visibility
  - Automate & Operate
  - Configure
- Added per-project memory of the last sub-tab used in each workspace.
- Aligned sidebar group naming to the same IA model.

### 3) Automation-by-Default

Routes: `/dashboard/projects/new`, scan-to-workspace conversion path

Current strength:

- Backend and helper already support default schedule, pipeline, visibility schedule, digest.

Observed gaps:

- Users could not see or control all defaults at project creation.

Improvements shipped in this pass:

- Exposed schedule choice (`manual`, `daily`, `weekly`, `monthly`).
- Exposed toggle for post-crawl automation pipeline.
- Exposed toggle for weekly AI visibility tracking.
- Retained weekly digest opt-in control.

### 4) Public SEO + LLM Discoverability

Routes: public marketing and scanner pages

Current strength:

- Good metadata and schema on several pages.

Observed gaps:

- `/scan` metadata depth was lower than other landing pages.
- No first-party `llms.txt` endpoint.
- Sitemap coverage was missing some important growth pages.

Improvements shipped in this pass:

- Added `/llms.txt` route for AI-agent discoverability.
- Expanded sitemap coverage to include:
  - `/ai-seo-tool`
  - `/chatgpt-seo`
  - `/leaderboard`
  - `/llms.txt`

## Backend Capability Inventory vs UI Exposure

Available backend capability (already in `apps/api/src/routes/*`):

- Core: projects, crawls, pages, scores, dashboard
- Actionability: action-items, fixes, insights, prompt research
- Growth: visibility, strategy, keywords, competitors, trends
- Operations: pipeline, alerts, logs, reports, exports
- Orgs: teams, organizations, API tokens, admin

Exposure gap summary:

- Capability depth is high; biggest remaining gaps are orchestration and guided UX, not missing endpoints.

## Prioritized Implementation Backlog

## P0 (Now / In Progress)

1. Workflow-first project IA (workspace switcher + remembered sub-flow).
   - Status: Implemented.
2. Make automation defaults visible and configurable at project creation.
   - Status: Implemented.
3. Strengthen scanner page structured SEO/LLM metadata.
   - Status: Implemented.

## P1 (Next)

1. Guided “First 7 days” execution rail in project workspace (with one-click actions).
2. Cross-screen recommendation memory (“continue where you left off”) between dashboard, projects list, and project tabs.
3. Portfolio-level anomaly workflows with bulk smart fixes (not only bulk crawl).
4. Deeper visibility workspace guidance (when to use Search Visibility vs AI Visibility vs AI Analysis).

Progress update (same day):

- Item 2 is now implemented:
  - project workspace writes last active project+tab context
  - dashboard shows a "Continue where you left off" resume card
  - projects page shows a portfolio-level resume card
- Item 3 is now implemented:
  - projects anomaly workflows include a bulk "Plan Smart Fixes" action
  - selected anomaly projects are converted into deduped action-item plans

## P2 (After P1)

1. Journey-level e2e coverage for full lifecycle:
   - scan -> workspace -> defaults -> first crawl -> action plan -> automation run.
2. Advanced role/persona personalization across navigation and card ordering.
3. Progressive disclosure for advanced controls in low-frequency settings.

## Execution Notes

This pass prioritizes high-leverage UX changes that are low-risk to backend behavior:

- No schema changes required.
- Existing defaults helper reused instead of introducing divergent setup logic.
- Deep links preserved; new workspace layer wraps existing tab architecture.
