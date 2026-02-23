# AI Intelligence Pipeline — Design Document

**Date:** 2026-02-23
**Status:** Approved
**Approach:** Hybrid (Pipeline orchestration + Event-driven side effects)

## Problem

The platform has strong individual AI features (auto site description, competitor discovery, keyword generation, visibility checks, reports) but they run independently. Users must manually trigger each step, there's no audit trail, no settings validation, and no ongoing recommendations. The result: users get a score but not a clear path to improve it.

## Goals

1. **Automated pipeline** — One crawl triggers the full intelligence flow automatically
2. **Audit everything** — Full trail of user + system actions with analytics
3. **Actionable fixes** — Reports with concrete code/config snippets including llms.txt and schema generation
4. **Health validation** — Proactive settings audit with auto-fix proposals
5. **Ongoing value** — Recommendations that improve over time via dashboard, digests, and MCP
6. **Provenance tracking** — Flag AI-generated vs user-created content across all entities

## Architecture: Hybrid Pipeline + Events

Pipeline service controls step execution order and settings. Outbox events handle side effects (audit logging, notifications, analytics).

```
crawl_complete
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  ProjectPipelineService (state machine)             │
│                                                     │
│  1. site_description ──► 2. competitors ──►         │
│  3. keywords ──► 4. visibility_check ──►            │
│  5. content_optimization ──► 6. action_report ──►   │
│  7. health_check                                    │
│                                                     │
│  Each step:                                         │
│    - Check pipelineSettings.skipSteps               │
│    - Call existing service                          │
│    - Record result in pipelineRuns.stepResults       │
│    - Emit outbox event                              │
└──────────────────────┬──────────────────────────────┘
                       │
              outbox events
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    audit_service  notifications  analytics
```

## Database Changes

### New table: `pipelineRuns`

| Column      | Type      | Description                                                      |
| ----------- | --------- | ---------------------------------------------------------------- |
| id          | uuid      | Primary key                                                      |
| projectId   | uuid      | FK to projects                                                   |
| crawlJobId  | uuid      | FK to crawlJobs (trigger)                                        |
| status      | enum      | `pending`, `running`, `paused`, `completed`, `failed`            |
| currentStep | text      | Current step name (null when done)                               |
| stepResults | jsonb     | `{ step_name: { status, duration_ms, result_summary, error? } }` |
| settings    | jsonb     | Snapshot of pipeline settings at run time                        |
| startedAt   | timestamp |                                                                  |
| completedAt | timestamp |                                                                  |
| error       | text      | Error message if failed                                          |

### Alter table: `projects`

Add column: `pipelineSettings jsonb DEFAULT '{}'`

```json
{
  "autoRunOnCrawl": true,
  "skipSteps": [],
  "competitorLimit": 5,
  "keywordLimit": 25,
  "visibilityProviders": ["chatgpt", "claude", "perplexity"],
  "contentOptimizationLimit": 10
}
```

### Alter table: `projects`

Add columns for provenance:

- `siteDescriptionSource text DEFAULT 'auto'` — `"auto"` | `"user"`
- `industrySource text DEFAULT 'auto'` — `"auto"` | `"user"`

### Existing tables (no changes needed)

- `savedKeywords.source` — already has `"auto_discovered"` | `"user_added"` | `"perplexity"`
- `competitors.source` — already has `"auto_discovered"` | `"user_added"`

## Pipeline Steps Detail

### Step 1: `site_description`

- **Service:** `auto-site-description-service.ts` (exists)
- **Input:** Crawl job pages (titles, meta descriptions, content)
- **Output:** `siteDescription` + `industry` on project
- **Skip if:** User already set description manually (`siteDescriptionSource === "user"`)
- **Provenance:** Sets `siteDescriptionSource = "auto"`

### Step 2: `competitors`

- **Service:** `auto-competitor-service.ts` (exists)
- **Input:** Domain + site description + industry
- **Output:** Up to N competitors (from `pipelineSettings.competitorLimit`)
- **Providers:** Claude (primary), Perplexity, Grok (fallback)
- **Skip if:** User already has manually-added competitors
- **Provenance:** Sets `source = "auto_discovered"` on each competitor

### Step 3: `keywords`

- **Service:** `auto-keyword-service.ts` (exists)
- **Input:** Crawl data (titles, headings, content summaries)
- **Output:** Up to N keywords (from `pipelineSettings.keywordLimit`)
- **Skip if:** User already has enough manually-added keywords
- **Provenance:** Sets `source = "auto_discovered"` on each keyword

### Step 4: `visibility_check`

- **Service:** Visibility check routes (exist)
- **Input:** Generated keywords + configured providers
- **Output:** Visibility results per keyword per provider
- **Providers:** From `pipelineSettings.visibilityProviders`
- **Rate limiting:** Respects existing 5 checks/60s limit, batches accordingly

### Step 5: `content_optimization` (NEW)

- **Service:** New `content-optimization-service.ts`
- **Input:** Pages with lowest AI-readiness scores (limited by `contentOptimizationLimit`)
- **Output:** Per-page improvement suggestions stored in `contentFixes` table
- **LLM:** Claude Sonnet for analysis, generates:
  - Fact density improvements (add specific claims, statistics)
  - Structure improvements (H2/H3 hierarchy, FAQ sections)
  - Tone adjustments (authoritative, citable language)
  - Missing schema markup suggestions

### Step 6: `action_report` (ENHANCED)

- **Service:** Enhanced `auto-report-service.ts`
- **Report type:** `"action_items"` (new)
- **Contents:**
  - Priority 1 — Critical blockers (robots.txt blocking AI crawlers, no llms.txt, NOINDEX)
  - Priority 2 — High impact fixes with code snippets:
    - Auto-generated `llms.txt` file content
    - Auto-generated JSON-LD schema snippets (Organization, Article, FAQ)
    - Missing/improved meta descriptions
  - Priority 3 — Optimization suggestions from content_optimization step
  - Competitor Advantages — Where competitors outperform and why
- **Provenance:** Each action item tagged `source: "ai_generated"`
- **MCP integration:** Each fix item has an `issueCode` that MCP `apply_fix` tool can reference

### Step 7: `health_check` (NEW)

- **Service:** New `health-check-service.ts`
- **Checks:**

| Check                                | Category      | Auto-fixable?                                |
| ------------------------------------ | ------------- | -------------------------------------------- |
| AI crawlers blocked in robots.txt    | Technical     | Yes — propose corrected robots.txt           |
| Missing llms.txt                     | Technical     | Yes — generate from site context             |
| Missing sitemap.xml                  | Technical     | No — flag only                               |
| Missing schema markup                | Technical     | Yes — generate JSON-LD                       |
| Incomplete meta tags                 | Technical     | Yes — suggest improvements                   |
| Crawl schedule = manual on paid plan | Configuration | Yes — suggest weekly                         |
| < 5 keywords tracked                 | Configuration | Yes — trigger keyword generation             |
| 0 competitors tracked                | Configuration | Yes — trigger competitor discovery           |
| No scheduled visibility checks       | Configuration | Yes — suggest daily                          |
| Underutilized plan features          | Billing       | No — suggest feature adoption or plan change |

- **Output:** `healthCheckResults` JSON on pipeline run, surfaced in dashboard + report

## Audit Logging

### Implementation

Single `emitAuditEvent()` function called from services:

```typescript
interface AuditEvent {
  action: string; // e.g. "crawl.started"
  actorId: string; // user ID or "system"
  resourceType: string; // e.g. "crawl_job"
  resourceId: string; // e.g. crawl job UUID
  metadata?: Record<string, unknown>;
  orgId?: string;
}
```

### Events

| Category    | Events                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| Project     | `project.created`, `project.updated`, `project.deleted`                                                         |
| Crawl       | `crawl.started`, `crawl.completed`, `crawl.failed`                                                              |
| Pipeline    | `pipeline.started`, `pipeline.step.completed`, `pipeline.step.skipped`, `pipeline.completed`, `pipeline.failed` |
| Competitors | `competitor.added`, `competitor.removed`, `competitor.benchmarked`                                              |
| Keywords    | `keyword.added`, `keyword.removed`, `keyword.bulk_added`                                                        |
| Visibility  | `visibility.checked`, `visibility.scheduled`                                                                    |
| Report      | `report.generated`, `report.downloaded`                                                                         |
| Settings    | `settings.updated`, `pipeline_settings.updated`                                                                 |
| Auth        | `user.login`, `user.logout`, `api_token.used`                                                                   |

### Analytics (derived from audit events)

| Metric                     | Derivation                                    |
| -------------------------- | --------------------------------------------- |
| Time-to-first-crawl        | `pipeline.completed` - `project.created`      |
| Feature adoption           | Count distinct event types per user per week  |
| Pipeline step skip rate    | `pipeline.step.skipped` / total pipeline runs |
| Score improvement velocity | Score delta across consecutive crawls         |

## MCP Enhancements

### New tools

| Tool                     | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| `run_full_analysis`      | Triggers pipeline for a project. Returns summary when complete. |
| `get_action_items`       | Returns prioritized action items with fix code snippets         |
| `apply_fix`              | Given issue code + page, returns exact fix to apply             |
| `validate_settings`      | Runs health check, returns issues and proposed corrections      |
| `update_project_context` | Update site description, industry, pipeline settings            |
| `add_competitor`         | Add a competitor domain to track                                |
| `remove_competitor`      | Remove a tracked competitor                                     |

### Design principle

MCP tools are **opinionated by default**. `run_full_analysis` runs everything. Users shouldn't need to orchestrate steps manually. Smart defaults, minimum decisions.

## Ongoing Recommendations

### Dashboard "Next Best Actions" Widget

Shows 3-5 prioritized actions computed from:

- Latest crawl issues (by score impact)
- Competitor score changes (if competitor improved)
- Unused features (e.g., "Set up visibility monitoring")
- Score trends (if score dropped, explain why)

### Digest Notifications

Extends existing `digest-service.ts` to include:

- Score change summary
- Competitor movements
- Top 3 action items
- Pipeline run results

### MCP Proactive Context

`get_action_items` returns time-aware recommendations:

- "Last crawl was 14 days ago — consider re-crawling"
- "AI visibility dropped 12% this week"
- "competitor.com now outranks you for 'best CRM'"

## User-Editable Results

All pipeline-generated data is editable after creation:

- **Keywords:** Add/remove via existing routes (POST/DELETE)
- **Competitors:** Add/remove via existing routes
- **Site description:** Update via PATCH /projects/:id/site-context (sets `siteDescriptionSource = "user"`)
- **Action items:** Dismiss/snooze individual items

When user edits AI-generated content, provenance updates to `"user"` or `"user_edited"`.

## Non-Goals (for this iteration)

- Citation position tracking over time
- Content freshness monitoring
- Cross-platform ranking correlation analysis
- Prompt A/B testing
- Streaming LLM responses
- Multi-project bundled reports
