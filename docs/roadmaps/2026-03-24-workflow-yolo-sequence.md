# Workflow Reframe YOLO Execution Sequence

This sequence converts the 8-week roadmap into a strict consecutive runbook. Execute each phase in order. Do not ask for further confirmation unless a phase is blocked by unrelated user changes, failing baseline tests outside the touched area, or missing infrastructure access.

## Operating Rules

1. Start each phase only after the previous phase passes its targeted verification.
2. Keep all feature work behind existing route compatibility when possible.
3. Prefer additive refactors and shared read models over destructive rewrites.
4. Treat the user-facing workflow as `Baseline -> Plan -> Execute -> Monitor`.
5. Keep bounded contexts isolated:
   - `Project Workspace`
   - `Crawl Audit`
   - `Visibility Monitoring`
   - `Execution`
   - `Portfolio`
   - `Integrations`
   - `Reporting`
6. Stop immediately if unrelated in-flight user edits conflict with touched files.

## Phase 0: Baseline Snapshot

- Capture current navigation, onboarding, execution, and verification behavior.
- Record baseline metrics and failing tests in touched areas.
- Output:
  - touched-surface inventory
  - baseline screenshots or notes
  - targeted test list

Exit criteria:

- The team knows exactly which files and flows belong to the first slice.

## Phase 1: Workflow Shell

- Codify ubiquitous language in product surfaces.
- Align project navigation with the workflow model without breaking existing routes.
- Expose every active workspace from the project navigation, including configure/settings.
- Reduce contradictory labels and hidden surfaces.

Output:

- workflow navigation map
- project shell cleanup
- route compatibility preserved

Exit criteria:

- A user can reach each active project workspace from visible navigation.

## Phase 2: Activation Slice

- Make every new-project flow persist real defaults:
  - crawl cadence
  - crawl scope
  - automation defaults
  - visibility schedule defaults
  - competitors
  - keywords
- Ensure failed crawl starts degrade into a usable configured project instead of a dead-end flow.

Output:

- consistent project setup behavior across wizard, onboarding, and public scan handoff

Exit criteria:

- A newly created project is configured the way the user selected before the first crawl finishes.

## Phase 3: Execution Domain

- Introduce a unified `ActionPlan` read model over issues, recommendations, fixes, and action items.
- Normalize status, priority, assignee, due date, verification state, and source.
- Publish and consume domain events:
  - `CrawlCompleted`
  - `IssuesDetected`
  - `RecommendationsGenerated`
  - `ActionItemsPlanned`

Output:

- execution-focused API contracts
- application services that orchestrate planning instead of UI-side joins

Exit criteria:

- Execution data can be read from one contract instead of multiple unrelated tabs.

## Phase 4: Execution Center UI

- Replace fragmented issue/recommendation/fix flows with one execution workspace.
- Support filters by owner, impact, source, and status.
- Embed AI-generated fix guidance and manual fix playbooks inline.

Output:

- execution workspace
- migration path from current issues/actions/fixes surfaces

Exit criteria:

- A user can decide, assign, and start work from one place.

## Phase 5: Verification Loop

- Add post-fix verification flow driven by recrawl and visibility refresh.
- Show before/after deltas for score, issue count, visibility, and AI traffic.
- Track verification state per action item.

Output:

- verification timeline
- before/after summaries

Exit criteria:

- Completed work can be proved or rejected with fresh data.

## Phase 6: Portfolio Operations

- Upgrade the portfolio priority feed into a real team operating surface.
- Persist assignment, due dates, urgency, and client/project filters.
- Add portfolio rollups for agencies and multi-site teams.

Output:

- durable portfolio operations layer
- cross-project execution reporting

Exit criteria:

- Teams can manage work across projects without spreadsheet handoffs.

## Phase 7: Outbound Execution Integrations

- Ship one outbound execution integration first:
  - `Linear` preferred for speed
  - `GitHub` if engineering-led users dominate
- Keep external system concepts behind anti-corruption layers.

Output:

- one end-to-end handoff path from internal action item to external execution system

Exit criteria:

- A prioritized item can be pushed out of the app without leaking external domain concepts into the core model.

## Phase 8: Hardening And Rollout

- Add telemetry for activation, execution, verification, and portfolio adoption.
- Remove dead paths once the replacement flow is stable.
- Finish migration docs and regression coverage.

Output:

- rollout checklist
- cleanup PRs
- launch metrics dashboard

Exit criteria:

- The new workflow loop is the default product path and legacy fallback paths are minimized.

## Current Execution Marker

The active implementation starts with:

1. Phase 1 workflow-shell cleanup
2. Phase 2 activation persistence for the project wizard

Everything else stays queued behind those slices.
