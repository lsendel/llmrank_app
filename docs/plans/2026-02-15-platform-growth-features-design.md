# Platform Growth Features Design

**Date:** 2026-02-15
**Status:** Approved
**Approach:** Shared Bus (extend existing outbox_events as event router)

## Overview

Five features shipping as one release to close the loop on competitor intelligence, lead conversion, developer integrations, and product analytics.

1. Scheduled visibility checks for tracked competitors
2. Slack/webhook notification channels (plan-gated)
3. Public scan persistence with gated results and project seeding
4. Read-only API tokens scoped to project metrics
5. UI telemetry via PostHog

## Architecture

All features share the existing `outbox_events` table as an internal event bus. Events flow:

```
Cron Worker / API Route → outbox_events → Notification Service → channels
                                        → Telemetry (PostHog server-side)
```

---

## 1. Data Model

### New Tables

**`notification_channels`**

| Column      | Type                                                 | Notes                                  |
| ----------- | ---------------------------------------------------- | -------------------------------------- |
| id          | uuid PK                                              | defaultRandom()                        |
| userId      | uuid FK → users                                      |                                        |
| projectId   | uuid FK → projects                                   | nullable (null = all projects)         |
| channelType | enum('email','webhook','slack_incoming','slack_app') |                                        |
| config      | jsonb                                                | { url, headers, slackChannel, secret } |
| eventTypes  | text[]                                               | ['crawl_completed', 'score_drop', ...] |
| enabled     | boolean                                              | default true                           |
| createdAt   | timestamp                                            | defaultNow()                           |
| updatedAt   | timestamp                                            |                                        |

Plan gates: Free = 1 email only. Starter = email + 1 webhook. Pro/Agency = unlimited.

**`scheduled_visibility_queries`**

| Column    | Type                            | Notes                                 |
| --------- | ------------------------------- | ------------------------------------- |
| id        | uuid PK                         | defaultRandom()                       |
| projectId | uuid FK → projects              |                                       |
| query     | text                            | LLM query to run                      |
| providers | text[]                          | ['chatgpt','claude','perplexity',...] |
| frequency | enum('hourly','daily','weekly') |                                       |
| lastRunAt | timestamp                       | nullable                              |
| nextRunAt | timestamp                       |                                       |
| enabled   | boolean                         | default true                          |
| createdAt | timestamp                       | defaultNow()                          |

Plan gates: Free = 0. Starter = 5 (daily/weekly only). Pro = 25 (all). Agency = 100.

**`scan_results`**

| Column    | Type      | Notes                                 |
| --------- | --------- | ------------------------------------- |
| id        | uuid PK   | defaultRandom()                       |
| domain    | text      |                                       |
| url       | text      |                                       |
| scores    | jsonb     | full score breakdown                  |
| issues    | jsonb     | array of findings                     |
| quickWins | jsonb     | top recommendations                   |
| ipHash    | text      | SHA256(IP) for rate limit, not raw IP |
| createdAt | timestamp | defaultNow()                          |
| expiresAt | timestamp | 30 days from creation                 |

**`api_tokens`**

| Column      | Type               | Notes                                            |
| ----------- | ------------------ | ------------------------------------------------ |
| id          | uuid PK            | defaultRandom()                                  |
| userId      | uuid FK → users    |                                                  |
| projectId   | uuid FK → projects |                                                  |
| name        | text               | user-facing label                                |
| tokenHash   | text               | SHA256 of plaintext token                        |
| tokenPrefix | text               | first 8 chars (e.g. "llmb_abc1")                 |
| scopes      | text[]             | ['metrics:read','scores:read','visibility:read'] |
| lastUsedAt  | timestamp          | nullable                                         |
| expiresAt   | timestamp          | nullable                                         |
| revokedAt   | timestamp          | nullable                                         |
| createdAt   | timestamp          | defaultNow()                                     |

Plan gates: Free/Starter = 0 tokens. Pro = 3. Agency = 10.

### Modifications to Existing Tables

**`outbox_events`** — add columns:

- `eventType` text — normalized event name (e.g. 'visibility.check.completed')
- `projectId` uuid FK — for routing to project-scoped channels
- `userId` uuid FK — for routing to user-scoped channels

**`leads`** — add columns:

- `scanResultId` uuid FK → scan_results (nullable)
- `convertedAt` timestamp (nullable) — when they signed up
- `projectId` uuid FK → projects (nullable) — the seeded project

---

## 2. Scheduled Visibility Checks

### Cron Worker

A `scheduled()` handler in `apps/api/src/index.ts`:

- Runs every 15 minutes via Cloudflare Cron Trigger
- Queries `scheduled_visibility_queries WHERE nextRunAt <= now() AND enabled = true`
- Batches by provider, respecting rate limits (2s cooldown between calls)
- Max 10 concurrent checks per invocation
- Calls existing `VisibilityService.runCheck()` for each

### Delta Detection

After each check, compare with previous result for same (projectId, query, provider):

- Brand mention gained → emit `mention_gained` event
- Brand mention lost → emit `mention_lost` event
- Citation position changed → emit `position_changed` event
- Competitor mention changes → emit `competitor_shift` event

Events go to `outbox_events` → notification service → configured channels.

### nextRunAt Calculation

After each run: `nextRunAt = now() + frequency interval`. If a cron invocation can't finish all due queries within Worker time limit, remaining queries get nextRunAt bumped by 15 minutes.

### API Routes

```
POST   /api/visibility/schedules     — create scheduled query
GET    /api/visibility/schedules     — list user's scheduled queries
PATCH  /api/visibility/schedules/:id — update frequency/enabled
DELETE /api/visibility/schedules/:id — remove
```

---

## 3. Webhook/Slack Notification Channels

### Channel-Aware Notification Service

Replace per-user `webhookUrl` with `notification_channels` table lookup:

```
NotificationService.send(event) →
  1. Find channels where eventType matches AND (projectId matches OR null)
  2. Per channel type:
     - email → Resend API (existing)
     - webhook → POST config.url with JSON + HMAC signature
     - slack_incoming → POST Slack webhook with Block Kit payload
     - slack_app → future: Slack API with bot token from config
```

### Webhook Payload

```json
{
  "event": "crawl_completed",
  "timestamp": "2026-02-15T...",
  "project": { "id": "...", "domain": "..." },
  "data": { ... },
  "signature": "hmac-sha256=..."
}
```

### Configuration UI

Settings → Notifications tab:

- Channel list with enable/disable toggles
- "Add channel" → type selector → config form
- Event type checkboxes per channel
- Plan limit badge (X/Y channels used)
- Test button for webhook/Slack channels

### Slack App Readiness

`channelType` enum includes `slack_app` from day one. Future Slack app adds OAuth flow that stores bot_token + channel_id in config jsonb. No schema migration needed.

---

## 4. Public Scan Persistence + Lead Funnel

### Flow

1. User enters URL → `POST /api/public/scan`
2. API runs single-page analysis (existing)
3. API persists to `scan_results` table
4. Returns `scanResultId` + partial results (grade, category scores, top 3 issues)
5. Frontend shows partial results immediately
6. "Unlock full report" gate → email capture
7. `POST /api/public/leads { email, scanResultId }`
8. Frontend fetches full results via `GET /api/public/scan-results/:id?token=...`
9. CTA: "Sign up to track this site"

### Gating

| Section               | No email | After email |
| --------------------- | -------- | ----------- |
| Overall grade + score | Yes      | Yes         |
| Category scores (4)   | Yes      | Yes         |
| Top 3 issues          | Yes      | Yes         |
| All issues (up to 37) | No       | Yes         |
| Quick wins with code  | No       | Yes         |
| Recommendations       | No       | Yes         |
| PDF download          | No       | No (signup) |

### Project Seeding on Signup

When a user signs up and a lead record exists with matching email:

1. Find lead → linked scanResultId
2. Create project from scan domain
3. Seed with scan scores/issues
4. Auto-trigger first full crawl (1 free credit)
5. Redirect to populated dashboard

### Cleanup

- `scan_results`: 30-day TTL, daily cron deletes expired rows
- Unconverted leads: 90-day cleanup
- Converted leads: kept indefinitely

### sessionStorage Removal

- API returns `scanResultId`
- Frontend redirects to `/scan/results?id={scanResultId}`
- Results page fetches from API
- No more sessionStorage — results survive tab close, are shareable

---

## 5. Read-Only API Tokens

### Token Format

`llmb_` + 32 random bytes (base62 encoded). Only SHA256 hash stored in DB.

### Lifecycle

1. **Create:** Settings → API Tokens → name, project, scopes → plaintext shown once
2. **Auth:** `Authorization: Bearer llmb_...` → hash → lookup → verify not revoked/expired → attach context
3. **Revoke:** Settings → "Revoke" → sets revokedAt

### Scoped Endpoints (versioned)

```
GET /api/v1/projects/:id/metrics     — scores, grade, trends
GET /api/v1/projects/:id/pages       — page-level scores (paginated)
GET /api/v1/projects/:id/issues      — issues (filterable by severity)
GET /api/v1/projects/:id/visibility  — visibility results + trends
```

All read-only. Token must have matching scope and projectId.

### Rate Limits

Per-token via KV: 100 req/min (Starter), 500 req/min (Pro), 2000 req/min (Agency).

---

## 6. Telemetry (PostHog)

### Client-Side

- `posthog-js` in `apps/web`, initialized in `app/layout.tsx`
- User identified after auth with userId, plan, createdAt

### Shared Helper (`apps/web/src/lib/telemetry.ts`)

```ts
export function track(
  event: string,
  properties?: Record<string, unknown>,
): void;
export function identify(userId: string, traits: Record<string, unknown>): void;
export function page(name: string): void;
```

### Events

| Event                   | Location         | Key Properties       |
| ----------------------- | ---------------- | -------------------- |
| scan.started            | Public scan form | domain               |
| scan.completed          | Scan results     | domain, grade, score |
| scan.email_captured     | Email gate       | domain               |
| report.downloaded       | Report list      | format, projectId    |
| quickwin.clicked        | Quick wins       | issueCode, severity  |
| integration.tested      | Integrations tab | integrationType      |
| visibility.check.manual | Visibility page  | provider, query      |
| webhook.configured      | Settings         | channelType          |
| api_token.created       | Settings         | scopes               |
| crawl.started           | Dashboard        | pageCount, plan      |

### Server-Side

`posthog-node` in `apps/api` for events without browser context (scheduled checks, crawl completions).

---

## Plan Tier Summary

| Feature               | Free      | Starter           | Pro           | Agency    |
| --------------------- | --------- | ----------------- | ------------- | --------- |
| Scheduled queries     | 0         | 5 (daily/weekly)  | 25 (all freq) | 100       |
| Notification channels | 1 email   | email + 1 webhook | unlimited     | unlimited |
| API tokens            | 0         | 0                 | 3             | 10        |
| API rate limit        | —         | 100/min           | 500/min       | 2000/min  |
| Telemetry             | all tiers | all tiers         | all tiers     | all tiers |
