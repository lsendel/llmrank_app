# Business Growth: 10 Features Design

## Context

LLM Rank has strong technical infrastructure but leaves revenue on the table through:

- No engagement loops (users don't come back without logging in)
- No visible usage limits or upgrade prompts (free users don't know what they're missing)
- No trial mechanism (paid features invisible to free users)
- Existing features hidden behind tabs users never discover

## Features

### 1. Weekly Email Digest

**Goal:** Re-engage users without requiring login.

**Implementation:**

- New `digest-service.ts` — runs on `0 9 * * 1` (Monday 9 AM) cron
- Aggregates per-project: score delta since last digest, new critical issues, visibility changes, competitor moves
- Renders with React Email template: score card + top 3 action items + CTA button
- Sends via Resend (already integrated)
- User pref: `digestFrequency: "weekly" | "monthly" | "none"` on users table
- Unsubscribe link in footer

**Data flow:** Cron trigger → query all users with digestFrequency != "none" → per-project aggregate → template render → Resend send

### 2. Score Change Alerts

**Goal:** Create urgency when something goes wrong.

**Implementation:**

- Hook into existing `regression-service.ts` (already detects score drops)
- Extend to emit notifications via all configured channels (email, Slack, webhook)
- Alert triggers: score drop >5pts, new critical issue, AI crawler blocked, noindex detected
- Frontend: alert banner on project page when unacknowledged alerts exist
- DB: `alerts` table (projectId, type, severity, message, acknowledgedAt)

### 3. Usage Meter in Dashboard

**Goal:** Show users their consumption to drive upgrade urgency.

**Implementation:**

- New `UsageMeter` component in sidebar or dashboard header
- Fetches `GET /api/usage/summary` (already exists in billing routes)
- Shows: crawls used/limit, visibility checks used/limit, reports used/limit
- Color coding: green (<50%), yellow (50-80%), red (>80%)
- "Upgrade" link when any meter >80%
- Updates on every page load (cached 5 min)

### 4. Smart Upgrade Prompts

**Goal:** Show paid feature value at point of need.

**Implementation:**

- New `UpgradePrompt` component — contextual banner with feature preview
- Placement:
  - Issues tab: "Sort by AI priority" locked behind Pro badge
  - Competitors tab: "Compare with 5 competitors" for Starter users
  - Integrations tab: "Connect Google Search Console" locked for free
  - Reports tab: "Schedule weekly reports" locked for free/Starter
  - Visibility tab: "Track 100 keywords" locked for free
- Each prompt shows: feature name, what plan unlocks it, "Try Free for 14 Days" CTA
- Dismissible per-session (localStorage)

### 5. 14-Day Pro Trial

**Goal:** Let free users experience Pro features before committing.

**Implementation:**

- DB: `trialStartedAt`, `trialEndsAt` columns on users table
- API: `POST /api/billing/start-trial` — sets trial dates, temporarily grants Pro limits
- Plan resolution: if user.trialEndsAt > now, use Pro limits; else use actual plan
- Frontend: trial banner showing days remaining + "Subscribe to keep access"
- Post-trial: revert to free limits, send "Your trial ended" email with comparison
- Guard: one trial per user (check trialStartedAt not null)

### 6. Platform Optimization Guides

**Goal:** Differentiate from competitors with actionable per-LLM guides.

**Implementation:**

- Static content: 7 guide pages (ChatGPT, Claude, Perplexity, Gemini, Copilot, Grok, Gemini AI Mode)
- Dynamic content: pull user's current scores and issues per platform
- Template: "Your ChatGPT readiness: 80/100. Top 3 fixes: [linked to issues]"
- New tab section in AI Visibility or standalone route `/dashboard/projects/:id/guides/:platform`
- Content sourced from existing `PLATFORM_REQUIREMENTS` in shared package
- Pro+ feature: personalized recommendations; Free users see generic guide

### 7. Scheduled Crawls UI

**Goal:** Increase crawl frequency = more data = more engagement.

**Implementation:**

- Backend: `crawlSchedule` enum already exists in schema (weekly/monthly/none)
- API: `PATCH /api/projects/:id` already accepts settings updates
- Cron: `*/5 * * * *` handler already checks for due scheduled crawls
- Frontend: add toggle in Settings tab → Crawl Settings section
- Options: "Off", "Weekly (every Monday)", "Monthly (1st of month)"
- Show next scheduled crawl date
- Plan gate: Free=none, Starter=monthly, Pro/Agency=weekly

### 8. Content Gap Analysis

**Goal:** Show users what content they're missing vs competitors.

**Implementation:**

- New service: `content-gap-service.ts`
- Compare: user's crawled page topics vs competitor crawled page topics
- Use LLM to extract topic clusters from page titles/content
- Output: "Competitors cover [Topic X] — you don't. Here's a suggested outline."
- Frontend: new section in Competitors tab or Strategy tab
- AI-generated outlines: 3-5 bullet points per gap (Haiku, cheap)
- Plan gate: Starter sees gaps list, Pro+ sees AI outlines

### 9. Fix Tracking Workflow

**Goal:** Turn issue reports into actionable task lists.

**Implementation:**

- DB: `issue_status` enum (open, in_progress, fixed, wont_fix) + `fixedAt` timestamp on issues table
- API: `PATCH /api/issues/:id/status` — update issue status
- Frontend: status dropdown on each IssueCard, filter by status in Issues tab
- Dashboard metric: "Fix rate: 12/39 issues resolved (31%)"
- Post-crawl: auto-detect if previously-fixed issues reappear → reopen + alert
- Bulk actions: "Mark selected as fixed" button

### 10. Crawl Comparison View

**Goal:** Show progress between crawls to encourage repeat usage.

**Implementation:**

- New component: `CrawlComparisonView`
- Select two crawls from History tab → side-by-side comparison
- Shows: score deltas per category, new/resolved issues, page count changes
- Visual: green/red arrows for improvements/regressions
- Issue diff: "3 issues fixed, 2 new issues introduced"
- API: `GET /api/crawls/compare?crawlA=:id&crawlB=:id` — returns diff data
- Link from History tab: "Compare with previous" button on each crawl

## Implementation Order

Grouped by dependency and impact:

**Wave 1 (quick wins, 1-2 days each):**

1. Usage Meter (#3) — pure frontend
2. Smart Upgrade Prompts (#4) — pure frontend
3. Scheduled Crawls UI (#7) — backend ready, frontend only
4. Fix Tracking (#9) — small DB migration + UI

**Wave 2 (medium effort, 2-3 days each):** 5. Score Change Alerts (#2) — extends existing regression service 6. Crawl Comparison (#10) — new API + component 7. 14-Day Pro Trial (#5) — billing logic + UI

**Wave 3 (deeper work, 3-5 days each):** 8. Weekly Email Digest (#1) — email templates + cron 9. Platform Guides (#6) — content + dynamic personalization 10. Content Gap Analysis (#8) — LLM + competitor data

## Success Metrics

| Feature          | KPI                     | Target             |
| ---------------- | ----------------------- | ------------------ |
| Email Digest     | Weekly active users     | +20%               |
| Score Alerts     | Issue fix rate          | +30%               |
| Usage Meter      | Free→Paid conversion    | +10%               |
| Upgrade Prompts  | Upgrade click rate      | 5% of impressions  |
| Pro Trial        | Trial→Paid conversion   | 25%                |
| Platform Guides  | Page views/session      | +15%               |
| Scheduled Crawls | Crawls/user/month       | +40%               |
| Content Gap      | Strategy tab engagement | +25%               |
| Fix Tracking     | Issues marked resolved  | 40% within 30 days |
| Crawl Comparison | Repeat crawl rate       | +20%               |
