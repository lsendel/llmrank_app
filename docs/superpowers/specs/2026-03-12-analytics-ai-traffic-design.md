# Hybrid Analytics + AI Traffic Tracking — Design Spec

**Date:** 2026-03-12
**Status:** Approved
**Goal:** Add hybrid analytics (GA4 + Cloudflare Web Analytics + server-side events) to llmrank.app, plus a customer-facing "AI Traffic Analytics" feature that detects AI bot crawlers and AI search referral traffic.

---

## Problem

LLMRank has partial analytics infrastructure (GA4 script loaded but no events, PostHog SDK present but no API keys, no Cloudflare Web Analytics). There is no AI traffic detection — neither for llmrank.app itself nor for customer sites. AI search traffic is a blind spot for most SEO tools, and LLMRank is uniquely positioned to fill this gap.

## Solution

Two workstreams delivered together:

1. **Quick Win** — Wire up GA4 pageviews + custom events, add Cloudflare Web Analytics, add server-side event tracking via GA4 Measurement Protocol, and detect AI traffic on llmrank.app via Hono middleware.

2. **AI Traffic Analytics Feature** — An opt-in tracking snippet customers embed on their sites. A lightweight beacon reports page visits back to LLMRank, where AI bot and referral traffic is classified and displayed in a new "AI Traffic" dashboard tab.

Both share a common traffic classifier, data model, and API layer.

---

## Architecture

```
Customer Site                        llmrank.app (Cloudflare Edge)
┌──────────────┐                     ┌─────────────────────────────────────┐
│ analytics.js │──beacon──►          │ Hono API                           │
│ (~800 bytes) │           │         │  ├─ POST /analytics/collect         │
└──────────────┘           │         │  ├─ GET  /analytics/:id/summary     │
                           │         │  ├─ GET  /analytics/:id/ai-traffic  │
                           ▼         │  └─ middleware/analytics.ts          │
                     ┌───────────┐   │       (classifies every request)    │
                     │ traffic-  │   ├─────────────────────────────────────┤
                     │ classifier│   │ Neon PostgreSQL                     │
                     │ (shared)  │   │  ├─ analytics_events (raw)          │
                     └───────────┘   │  └─ analytics_daily_rollups (agg)   │
                                     ├─────────────────────────────────────┤
                                     │ External                            │
                                     │  ├─ GA4 (client + Measurement API)  │
                                     │  ├─ Cloudflare Web Analytics        │
                                     │  └─ PostHog (forwarded events)      │
                                     └─────────────────────────────────────┘
```

**Edge-first approach:** All analytics processing happens in the existing Cloudflare Workers deployment. No new services. The Hono API handles both beacon ingestion and dashboard queries. Cloudflare's `cf` object provides country, bot score, and ASN for free on every request.

---

## Data Model

### `analytics_events` — raw event log

| Column      | Type                    | Notes                                                                                                                                           |
| ----------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | uuid                    | PK, defaultRandom                                                                                                                               |
| project_id  | uuid                    | nullable — null for llmrank.app first-party events. FK to projects (nullable)                                                                   |
| event       | text                    | `pageview`, `bot_visit`, `ai_referral`, `scan_started`, `signup`, `plan_upgrade`, etc.                                                          |
| domain      | text                    | which site was visited                                                                                                                          |
| path        | text                    | page path                                                                                                                                       |
| referrer    | text                    | nullable                                                                                                                                        |
| user_agent  | text                    | nullable                                                                                                                                        |
| source_type | enum (`sourceTypeEnum`) | `organic`, `ai_referral`, `ai_bot`, `direct`, `social`, `other` — defined in `packages/db/src/schema/enums.ts`                                  |
| ai_provider | text                    | nullable — `chatgpt`, `perplexity`, `claude`, `gemini`, `copilot`, etc.                                                                         |
| country     | text                    | from `request.cf?.country` (Cloudflare Workers `cf` object)                                                                                     |
| bot_score   | integer                 | nullable — from `request.cf?.botManagement?.score` if available (requires CF Bot Management add-on; gracefully defaults to null if unavailable) |
| metadata    | jsonb                   | flexible bag for extra event params                                                                                                             |
| created_at  | timestamp               | defaultNow                                                                                                                                      |

Indexes: `(project_id, created_at)`, `(source_type, created_at)`, `(ai_provider, created_at)`.

### `analytics_daily_rollups` — pre-aggregated daily counts

| Column      | Type    | Notes                                                                                                  |
| ----------- | ------- | ------------------------------------------------------------------------------------------------------ |
| id          | uuid    | PK, defaultRandom                                                                                      |
| project_id  | uuid    | NOT NULL — use sentinel UUID `00000000-0000-0000-0000-000000000000` for first-party llmrank.app events |
| date        | date    |                                                                                                        |
| event       | text    |                                                                                                        |
| source_type | enum    |                                                                                                        |
| ai_provider | text    | NOT NULL, default `'none'` — sentinel value instead of null to support unique constraint               |
| country     | text    | NOT NULL, default `'unknown'` — sentinel value instead of null                                         |
| count       | integer |                                                                                                        |

Unique constraint: `(project_id, date, event, source_type, ai_provider, country)`. All columns in the constraint are NOT NULL (using sentinel UUIDs and sentinel strings instead of nulls) to ensure PostgreSQL's unique constraint works correctly for upserts. Define `FIRST_PARTY_PROJECT_ID = '00000000-0000-0000-0000-000000000000'` as a constant in `packages/shared`.

Raw events are the source of truth. Rollups are materialized by a daily cron. Raw events pruned after 90 days.

### Schema migration

New enum in `packages/db/src/schema/enums.ts`:

- `sourceTypeEnum = pgEnum("source_type", ["organic", "ai_referral", "ai_bot", "direct", "social", "other"])`

Add to `projects` table:

- `analytics_snippet_enabled: boolean default false`

---

## AI Traffic Classification

A shared pure-function utility at `packages/shared/src/utils/traffic-classifier.ts`. Used by both the Hono middleware (first-party) and the collect endpoint (customer snippets). Classification happens at write time.

### Bot detection by User-Agent

| Pattern                                             | AI Provider |
| --------------------------------------------------- | ----------- |
| `GPTBot`, `ChatGPT-User`                            | chatgpt     |
| `ClaudeBot`, `Claude-Web`                           | claude      |
| `PerplexityBot`                                     | perplexity  |
| `Google-Extended`, `Googlebot` (with AI indicators) | gemini      |
| `Applebot-Extended`                                 | apple_ai    |
| `cohere-ai`                                         | cohere      |
| `Meta-ExternalAgent`                                | meta_ai     |

### Referral detection by Referrer URL

| Referrer contains                      | AI Provider |
| -------------------------------------- | ----------- |
| `chat.openai.com`, `chatgpt.com`       | chatgpt     |
| `claude.ai`                            | claude      |
| `perplexity.ai`                        | perplexity  |
| `gemini.google.com`, `bard.google.com` | gemini      |
| `you.com`                              | you         |
| `phind.com`                            | phind       |
| `copilot.microsoft.com`                | copilot     |

### Source type resolution order

1. If User-Agent matches a bot pattern → `ai_bot`
2. If referrer matches an AI provider → `ai_referral`
3. If referrer is a search engine (google, bing, duckduckgo, etc.) → `organic`
4. If referrer is a social platform (twitter, linkedin, facebook, etc.) → `social`
5. If no referrer → `direct`
6. Otherwise → `other`

**Function signature:**

```typescript
interface ClassificationResult {
  sourceType:
    | "organic"
    | "ai_referral"
    | "ai_bot"
    | "direct"
    | "social"
    | "other";
  aiProvider: string | null;
}

function classifyTraffic(
  userAgent: string | null,
  referrer: string | null,
): ClassificationResult;
```

No dependencies. Fully unit-testable.

---

## Quick Win: GA4 + Cloudflare Web Analytics + First-Party Tracking

### GA4

- Enable automatic pageviews by removing `send_page_view: false` from `google-analytics.tsx`
- Extend `lib/telemetry.ts` `track()` to fire GA4 custom events for: `scan_started`, `signup`, `plan_upgrade`, `report_download`
- Already loaded with measurement ID `G-TLYXK6GG0C`

### Cloudflare Web Analytics

- New component `apps/web/src/components/cloudflare-analytics.tsx`
- Beacon script: `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "TOKEN"}'></script>`
- Added to `layout.tsx` alongside existing analytics components
- New env var: `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`

### Server-side GA4 Measurement Protocol

- New utility `apps/api/src/lib/ga4.ts`
- Fires events to GA4 for non-browser actions: crawl completion, scheduled visibility checks, webhook events (plan upgrades, etc.)
- Env vars: `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`
- Uses `fetch()` to `https://www.google-analytics.com/mp/collect`

### Hono analytics middleware

- New file `apps/api/src/middleware/analytics.ts`
- Runs on every request, classifies traffic using the shared classifier
- Writes to `analytics_events` asynchronously via `context.executionCtx.waitUntil()`
- Reads Cloudflare's `cf` object for country (`request.cf?.country`) and bot score (`request.cf?.botManagement?.score`, if available)
- Filters out: health checks (`/health`), static assets, preflight OPTIONS requests
- Mounted early in the middleware stack in `apps/api/src/index.ts`

---

## Customer Snippet + Collect Endpoint

### Tracking snippet — `analytics.js` (~800 bytes minified)

Served as an API route from `https://api.llmrank.app/s/analytics.js` (a Hono route that returns the static JS file with `Content-Type: application/javascript`). This keeps the snippet on the API domain for a first-party-looking URL. Customer embeds:

```html
<script
  defer
  src="https://api.llmrank.app/s/analytics.js"
  data-project="PROJECT_ID"
></script>
```

On page load, fires a single `POST` beacon to `https://api.llmrank.app/analytics/collect`:

```json
{
  "pid": "project-uuid",
  "url": "https://customer.com/page",
  "ref": "https://chat.openai.com/",
  "ua": "Mozilla/5.0 ..."
}
```

Uses `navigator.sendBeacon()` with `fetch()` fallback. No cookies, no localStorage, no fingerprinting. Privacy-friendly. Works with most adblockers since it's a first-party-looking API call.

### Collect endpoint — `POST /analytics/collect`

- Lives in `apps/api/src/routes/analytics.ts`
- Validates `pid` is a real project UUID with `analytics_snippet_enabled = true` (reject unknown/disabled projects)
- Rate limited: 100 req/s per project, using the existing rate-limit middleware keyed by project ID instead of user ID
- Request body validated with Zod schema in `packages/shared/src/schemas/analytics.ts`: `pid` (uuid), `url` (string, valid URL), `ref` (string, optional), `ua` (string, optional)
- Runs the shared traffic classifier on referrer + user-agent
- `domain` field derived by parsing the hostname from the beacon's `url` field
- Adds country from `request.cf?.country`
- Writes to `analytics_events` asynchronously via `context.executionCtx.waitUntil()` with `project_id` set
- Returns `204 No Content`
- CORS: allows all origins (snippet runs on customer domains)

### Snippet management in project settings

- New section in project settings: "AI Traffic Tracking"
- Shows the embed code with the project ID pre-filled
- Toggle to enable/disable collection per project
- Controlled by `projects.analytics_snippet_enabled` column

---

## Analytics API

| Method | Path                               | Auth                           | Purpose                                    |
| ------ | ---------------------------------- | ------------------------------ | ------------------------------------------ |
| `POST` | `/analytics/collect`               | None (public)                  | Snippet beacon ingestion                   |
| `GET`  | `/analytics/:projectId/summary`    | Clerk auth + project ownership | Dashboard summary (30d rollup)             |
| `GET`  | `/analytics/:projectId/ai-traffic` | Clerk auth + project ownership | AI traffic breakdown by provider + day     |
| `GET`  | `/analytics/internal/summary`      | Clerk auth + admin role        | First-party llmrank.app stats (admin only) |

All authenticated endpoints verify the requesting user owns the project (or is a team member), following the existing pattern in `apps/api/src/routes/projects.ts`. The collect endpoint is unauthenticated — it validates the project ID exists and has `analytics_snippet_enabled = true` but does not require user auth.

### Summary response

```json
{
  "period": "30d",
  "totalVisits": 1240,
  "aiTraffic": {
    "total": 53,
    "byProvider": [
      { "provider": "chatgpt", "visits": 28, "type": "ai_referral" },
      { "provider": "perplexity", "visits": 12, "type": "ai_referral" },
      { "provider": "claude", "visits": 7, "type": "ai_referral" },
      { "provider": "chatgpt", "visits": 89, "type": "ai_bot" }
    ],
    "trend": "+18%"
  },
  "topPages": [{ "path": "/pricing", "aiVisits": 14, "totalVisits": 230 }]
}
```

Queries hit `analytics_daily_rollups`. Trend = current 30d vs previous 30d.

### Rollup cron

Cloudflare scheduled handler, runs daily at 02:00 UTC:

1. Aggregate raw `analytics_events` from the previous day into `analytics_daily_rollups` (upsert on unique constraint)
2. Prune raw events older than 90 days (per plan retention limits)

Pruning uses batched deletes (`DELETE ... WHERE created_at < $1 LIMIT 5000` in a loop) to avoid long-running transactions on Neon.

Reuses the existing scheduled handler pattern in `apps/api/src/index.ts`. Requires adding a cron trigger in `apps/api/wrangler.toml`.

### PostHog forwarding

The existing server-side PostHog integration (`apps/api/src/lib/telemetry.ts`) continues to receive key SaaS events (scan, signup, upgrade) via the `trackServer()` function. Analytics middleware events (pageviews, bot visits) are NOT forwarded to PostHog — they go to Postgres only. PostHog remains the tool for session-level product analytics; Postgres owns traffic/AI analytics.

---

## Dashboard UI — "AI Traffic" Tab

New tab on the project dashboard page. Three sections:

1. **Summary cards** — Total visits, AI referral visits, AI bot visits, trend percentage with arrow
2. **AI provider breakdown** — Table showing visits per provider (ChatGPT, Perplexity, Claude, etc.), split by referral vs bot type
3. **Top pages** — Which customer pages receive the most AI traffic

When `analytics_snippet_enabled` is false and no snippet events exist, shows a callout: "Not seeing data? Add the tracking snippet to your site" with the copyable embed code.

---

## Plan Gating

| Feature                  | Free            | Starter             | Pro                 | Agency              |
| ------------------------ | --------------- | ------------------- | ------------------- | ------------------- |
| GA4 + CF Web Analytics   | Always on       | Always on           | Always on           | Always on           |
| AI Traffic dashboard tab | 7d, totals only | 30d, full breakdown | 90d, full breakdown | 90d, full breakdown |
| Customer snippet         | No              | 1 project           | All projects        | All projects        |
| Raw event retention      | N/A             | 30d                 | 90d                 | 90d                 |

Free users see the AI Traffic tab with total AI visits for 7 days (from first-party middleware data via rollups — no snippet required) and an upgrade CTA to unlock provider breakdown and the snippet.

---

## Files

### New files

| File                                                           | Purpose                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/shared/src/utils/traffic-classifier.ts`              | Pure function: classifies user-agent + referrer → source_type + ai_provider |
| `packages/db/src/schema/analytics.ts`                          | `analytics_events` + `analytics_daily_rollups` tables                       |
| `packages/db/src/queries/analytics.ts`                         | Insert events, query rollups, prune old data                                |
| `apps/api/src/routes/analytics.ts`                             | Collect endpoint + dashboard query endpoints                                |
| `apps/api/src/middleware/analytics.ts`                         | First-party request classification middleware                               |
| `apps/api/src/lib/ga4.ts`                                      | Server-side GA4 Measurement Protocol helper                                 |
| `apps/web/src/components/cloudflare-analytics.tsx`             | CF Web Analytics beacon script                                              |
| `apps/web/src/app/dashboard/projects/[id]/ai-traffic/page.tsx` | AI Traffic dashboard tab                                                    |
| `packages/shared/src/schemas/analytics.ts`                     | Zod schema for collect endpoint payload                                     |

### Modified files

| File                                           | Change                                                  |
| ---------------------------------------------- | ------------------------------------------------------- |
| `apps/web/src/components/google-analytics.tsx` | Enable pageviews, remove `send_page_view: false`        |
| `apps/web/src/lib/telemetry.ts`                | Add SaaS event definitions, wire GA4 custom events      |
| `apps/web/src/app/layout.tsx`                  | Add `<CloudflareAnalytics />` component                 |
| `apps/api/src/index.ts`                        | Mount analytics middleware + routes + daily rollup cron |
| `apps/api/wrangler.toml`                       | Add cron trigger `0 2 * * *` for daily rollup           |
| `packages/db/src/schema/enums.ts`              | Add `sourceTypeEnum`                                    |
| `packages/db/src/schema/index.ts`              | Export new analytics tables + enum                      |
| `packages/db/src/schema/projects.ts`           | Add `analytics_snippet_enabled` column                  |
| `packages/db/src/queries/index.ts`             | Export new analytics queries                            |
| `packages/shared/src/plan-limits.ts`           | Add analytics limits per plan                           |

---

## Error Handling

- **Collect endpoint failures:** Return `204` regardless — never leak errors to customer sites. Log internally.
- **Classification misses:** Unknown user-agents/referrers default to `other` source type, `null` ai_provider. The classifier pattern lists are maintained manually and updated as new AI providers emerge.
- **Rollup cron failures:** Log error, retry on next scheduled run. Raw events are preserved so no data is lost.
- **GA4 Measurement API failures:** Fire-and-forget via `waitUntil()`. GA4 is supplementary — Postgres is the source of truth.
- **Rate limiting:** Collect endpoint returns `429` when exceeded. Snippet does not retry.

---

## Testing

- **`traffic-classifier.ts`** — Unit tests for all bot UA patterns, all referrer patterns, edge cases (empty strings, unknown agents, mixed signals where both UA and referrer match)
- **Collect endpoint** — Integration tests: valid/invalid project IDs, disabled snippets rejected, rate limiting, CORS headers, 204 response
- **Rollup cron** — Test aggregation logic with sample data, verify unique constraint upsert behavior
- **Dashboard API** — Test plan gating (free vs paid date ranges), date range filtering, empty state responses
- **Analytics middleware** — Test filtering (health checks excluded, OPTIONS excluded), CF header extraction
