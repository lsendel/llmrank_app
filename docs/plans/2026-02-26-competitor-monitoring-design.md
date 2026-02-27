# Competitor Monitoring & Activity Feed — Design Document

**Date:** 2026-02-26
**Status:** Approved
**Origin:** Gap analysis vs. Semrush EyeOn competitive monitoring tool

## Problem

LLM Rank has competitor benchmarking (manual, on-demand) but no continuous monitoring. Users can't see "what changed" with competitors — only "where we stand" at the moment they trigger a benchmark. Semrush EyeOn solves the "what changed" problem for general SEO; we need to solve it for AI readiness specifically.

## Goals

1. **Continuous competitor change detection** — automatically re-benchmark competitors weekly
2. **Competitor activity feed** — chronological timeline of AI-readiness changes
3. **Automated competitor re-crawl** — scheduled shallow crawls (5-10 pages) via Fly.io
4. **Score delta alerts** — notify users when competitors make significant AI-readiness moves
5. **Competitive publishing cadence** — track how often competitors publish AI-optimized content
6. **AI Visibility Watchlist** — monitor specific queries for new competitor citations

## Architecture Decision

**Approach: Mirror the Visibility Schedule Pattern**

Replicate the existing `scheduledVisibilityChecks` architecture:

- Cron-driven execution → find due competitors → dispatch shallow crawls → diff benchmarks → emit outbox events → notification pipeline

This was chosen over:

- **Workers-only approach** (rejected: 30s CPU limit, no Lighthouse, can't scale to deeper crawls)
- **Queue-driven approach** (rejected: more moving parts than needed for weekly batch of 20)

## Data Model

### Schema Changes

#### Extend `competitors` table

```sql
ALTER TABLE competitors ADD COLUMN monitoring_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE competitors ADD COLUMN monitoring_frequency text NOT NULL DEFAULT 'weekly';
ALTER TABLE competitors ADD COLUMN next_benchmark_at timestamp;
ALTER TABLE competitors ADD COLUMN last_benchmark_at timestamp;
```

`monitoring_frequency` values: `"daily"` | `"weekly"` | `"monthly"` | `"off"`

#### New `competitor_events` table

```sql
CREATE TABLE competitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  competitor_domain text NOT NULL,
  event_type text NOT NULL,
  severity text NOT NULL,  -- "critical" | "warning" | "info"
  summary text NOT NULL,
  data jsonb DEFAULT '{}',
  benchmark_id uuid REFERENCES competitor_benchmarks(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_competitor_events_feed ON competitor_events (project_id, created_at DESC);
CREATE INDEX idx_competitor_events_domain ON competitor_events (project_id, competitor_domain, created_at DESC);
```

Event types:

- `score_change` — any category delta > 5 points
- `score_regression` — overall drops > 10 points
- `score_improvement` — overall improves > 10 points
- `llms_txt_added` / `llms_txt_removed`
- `ai_crawlers_blocked` / `ai_crawlers_unblocked`
- `schema_added` / `schema_removed`
- `sitemap_added` / `sitemap_removed`
- `new_pages_detected`

#### New `competitor_monitoring_schedules` table (Watchlist)

```sql
CREATE TABLE competitor_monitoring_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  query text NOT NULL,
  providers text[] NOT NULL,
  frequency text NOT NULL DEFAULT 'weekly',
  last_run_at timestamp,
  next_run_at timestamp,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_comp_mon_schedules_due ON competitor_monitoring_schedules (next_run_at, enabled);
```

## Monitoring Engine

### Scheduled Re-benchmark Flow

**Cron:** `0 2 * * 0` (Sunday 2 AM UTC) — new entry in `wrangler.toml`

```
Cron fires
  → competitorMonitorService.processScheduledBenchmarks()
    → Query: competitors WHERE next_benchmark_at <= now AND monitoring_enabled = true
    → Batch (max 20 per run)
    → For each competitor:
        1. Fetch previous latest benchmark from competitor_benchmarks
        2. Dispatch shallow crawl to Fly.io (5-10 pages, no Lighthouse)
           OR fall back to Workers-fetch if Fly.io unavailable
        3. On callback: score pages, insert new competitor_benchmarks row
        4. Run diffBenchmarks(previous, current)
        5. Insert competitor_events for each detected change
        6. If severity=critical or severity=warning:
           insert outbox_event → notification pipeline
        7. Update competitor: last_benchmark_at=now, next_benchmark_at=now+frequency
```

### Change Detection Logic (diffBenchmarks)

| Change                          | Event Type                          | Severity |
| ------------------------------- | ----------------------------------- | -------- |
| Overall score drops > 10 pts    | `score_regression`                  | warning  |
| Overall score improves > 10 pts | `score_improvement`                 | info     |
| Any category delta > 5 pts      | `score_change`                      | info     |
| llms.txt appears                | `llms_txt_added`                    | critical |
| llms.txt disappears             | `llms_txt_removed`                  | info     |
| AI crawlers become blocked      | `ai_crawlers_blocked`               | warning  |
| AI crawlers become unblocked    | `ai_crawlers_unblocked`             | critical |
| Schema markup appears           | `schema_added`                      | info     |
| Sitemap appears/disappears      | `sitemap_added` / `sitemap_removed` | info     |

`llms_txt_added` and `ai_crawlers_unblocked` are **critical** because they mean a competitor just took a significant step to improve AI visibility.

### Publishing Cadence Detection

During shallow crawl callback:

- Compare discovered page URLs vs previous benchmark's known pages
- If new URLs found → emit `new_pages_detected` event with count and sample URLs
- Store discovered page URLs in `competitor_benchmarks.data` jsonb

### AI Visibility Watchlist

Extends `processScheduledVisibilityChecks()`:

- Watchlist queries processed alongside existing visibility schedules
- When a competitor starts getting cited for a watched query → emit `competitor_watchlist_alert`
- Reuses existing `detectAndEmitChanges()` logic

## API Endpoints

### Competitor Monitoring Settings

```
PATCH /api/competitors/:id/monitoring
  Body: { enabled: boolean, frequency: "daily"|"weekly"|"monthly"|"off" }
```

### Competitor Activity Feed

```
GET /api/competitors/feed?projectId=xxx&limit=20&offset=0&type=all&severity=all&domain=all
  Response: { data: CompetitorEvent[], total: number, hasMore: boolean }
```

### Competitor Score Trends

```
GET /api/competitors/trends?projectId=xxx&domain=competitor.com&period=90d
  Response: { data: { date, overall, technical, content, aiReadiness, performance }[] }
```

### Competitor Publishing Cadence

```
GET /api/competitors/cadence?projectId=xxx
  Response: { data: { domain, newPagesThisWeek, newPagesThisMonth, trend }[] }
```

### AI Visibility Watchlist CRUD

```
POST   /api/competitors/watchlist
GET    /api/competitors/watchlist?projectId=xxx
PATCH  /api/competitors/watchlist/:id
DELETE /api/competitors/watchlist/:id
```

### Manual Re-benchmark

```
POST /api/competitors/:id/rebenchmark
```

## Plan Gating

| Feature               | Free                                | Starter   | Pro            | Agency              |
| --------------------- | ----------------------------------- | --------- | -------------- | ------------------- |
| Competitor monitoring | 1 competitor, weekly, homepage-only | 3, weekly | 10, weekly     | 20, daily available |
| Activity feed         | Last 5 events (read-only)           | Full      | Full + filters | Full                |
| Watchlist queries     | 0                                   | 3         | 10             | 25                  |
| Score trends          | Last 2 data points                  | 30 days   | 90 days        | 180 days            |
| Manual re-benchmark   | No                                  | 1/week    | 3/week         | Unlimited           |

## Frontend

### Competitors Tab — 3 Sub-views

**1. Benchmark View (enhanced existing)**

- Score delta badges ("+5 ▲" green, "-8 ▼" red)
- "Last checked" timestamp per competitor
- Monitoring toggle (on/off)
- "Re-benchmark now" button (plan-gated)

**2. Activity Feed View (new)**

- Chronological timeline of competitor_events
- Event cards: domain + favicon, severity icon, summary text, relative timestamp
- Filter chips: All | Critical | Score Changes | AI Readiness | New Content
- Domain filter dropdown
- Free tier: last 5 events + upgrade CTA

**3. Trends View (new)**

- Line chart: competitor scores over time (toggleable lines per competitor)
- Category selector: Overall / Technical / Content / AI Readiness / Performance
- Period selector: 30d / 90d / 180d
- Publishing cadence bar chart: new pages per week per competitor

### Watchlist (in Visibility Tab)

- New "Watchlist" section within existing Visibility tab
- Add query + select providers + set frequency
- Results table: query × competitor matrix showing who gets cited

## Notifications & Alerts

### New Event Types

| Event Type                       | Trigger                                    | Default Channel       |
| -------------------------------- | ------------------------------------------ | --------------------- |
| `competitor_score_drop`          | Competitor overall drops > 10 pts          | Email + Slack         |
| `competitor_score_jump`          | Competitor overall jumps > 10 pts          | Email + Slack         |
| `competitor_ai_readiness_change` | llms.txt, crawler blocking, schema changes | Email + Slack         |
| `competitor_new_content`         | New pages detected                         | Email (weekly digest) |
| `competitor_watchlist_alert`     | Competitor cited for watched query         | Email + Slack         |

### Notification Formats

**Email:** Populate the existing stubbed `competitor_alert` template with competitor domain, event type, summary, score comparison table, and CTA to activity feed.

**Slack Block Kit:** Extend `formatSlackMessage()` with competitor event cases — bold domain, colored sidebar by severity, score delta inline.

**Weekly Digest Enhancement:** Add "Competitor Activity Summary" section — event count per competitor, top 3 significant changes, score leaderboard shifts.

## Implementation Phases

### Phase 1: Foundation (DB + Monitoring Engine)

- Schema migration (extend competitors, create competitor_events, create competitor_monitoring_schedules)
- Competitor monitor service with diffBenchmarks logic
- Cron job registration
- DB queries for new tables

### Phase 2: API Layer

- All 6 endpoint groups (monitoring settings, feed, trends, cadence, watchlist CRUD, manual re-benchmark)
- Plan gating middleware
- Zod validation schemas

### Phase 3: Notifications

- Wire competitor events into outbox pipeline
- Email template for competitor_alert
- Slack Block Kit formatting
- Weekly digest competitor section

### Phase 4: Frontend — Activity Feed

- Competitors tab sub-navigation (Benchmark | Feed | Trends)
- Activity feed timeline component
- Event cards with severity styling
- Filtering (event type, severity, domain)
- Free tier gating with upgrade CTA

### Phase 5: Frontend — Trends & Cadence

- Score trend line chart (multi-competitor)
- Category and period selectors
- Publishing cadence bar chart

### Phase 6: Frontend — Watchlist

- Watchlist CRUD UI in Visibility tab
- Query × competitor citation matrix
- Watchlist alert integration

### Phase 7: Testing & Polish

- Integration tests for monitoring service
- Change detection unit tests
- Feed pagination tests
- E2E smoke test for competitor monitoring flow
