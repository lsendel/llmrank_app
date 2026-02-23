# Design: AI Visibility Tab Improvements

**Date:** 2026-02-18
**Status:** Approved

## Context

The AI Visibility tab (`apps/web/src/components/tabs/visibility-tab.tsx`) currently shows raw data with minimal actionable value:

- **AI Visibility Score endpoint exists but has NO UI** — `GET /api/visibility/:projectId/ai-score` computes a 4-signal score (LLM mentions 40%, AI search 30%, SoV 20%, backlinks 10%) with letter grades, but nothing renders it
- **Free-text query input** — prompt injection risk, users don't know what to search
- **Raw data dumps** — history table and content gaps with no prioritized recommendations
- **Scheduled checks allow hourly/daily** — wasteful, should be weekly/monthly
- **Platform Readiness shows 4 of 7 providers** — missing Copilot, Grok, Gemini AI Mode
- **No trend indicators** — no "up/down vs. last period" signals
- **Share of Voice chart lacks competitor context** — shows own brand only

## Goals

1. Make users immediately understand their AI visibility position and what to do about it
2. Eliminate prompt injection risk by removing free-text query input
3. Integrate with the personas/keywords system for curated query selection
4. Provide actionable, prioritized recommendations based on visibility data
5. Show competitive context in every metric

---

## 1. Executive Dashboard Header

Replace the empty top section with a Score + Trends + Competitive Position trifecta.

### Layout: Three cards in a row

**Card 1 — Overall Score:**

- Large AI Visibility Score (0-100)
- Letter grade (A/B/C/D/F)
- Trend arrow with delta vs. previous period (e.g., "▲ +8 vs last week")
- Color: green ≥80, amber ≥60, red <60

**Card 2 — Signal Breakdown:**

- 4 horizontal progress bars showing each signal's contribution:
  - LLM Mentions (40% weight): X/40 points
  - AI Search Presence (30% weight): X/30 points
  - Share of Voice (20% weight): X/20 points
  - Backlink Authority (10% weight): X/10 points
- Color per bar based on fill percentage

**Card 3 — Quick Competitive Position:**

- Your SoV percentage with trend arrow
- Top 2 competitors' SoV for comparison
- "You're #N out of M tracked brands"

### Data sources

- `GET /api/visibility/:projectId/ai-score` (exists, needs UI rendering)
- New: `GET /api/visibility/:projectId/ai-score/trend` — compares current period vs. previous to compute deltas
- Competitor SoV from existing trends data

### New API endpoint: `GET /api/visibility/:projectId/ai-score/trend`

Returns:

```json
{
  "current": { "overall": 78, "grade": "B", "breakdown": {...} },
  "previous": { "overall": 70, "grade": "C", "breakdown": {...} },
  "delta": 8,
  "direction": "up",
  "period": "weekly"
}
```

Logic: Split visibility checks into current week and previous week, compute AI visibility score for each, return both + delta.

---

## 2. Actionable Recommendations Engine

Below the score header, a "Top Actions" card showing 3-5 prioritized recommendations.

### Recommendation types

| Source                      | Example                                                                                  | Impact Signal                         |
| --------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------- |
| Visibility gaps             | "You're invisible on ChatGPT for 'best SEO tools' — competitor xyz.com is cited instead" | gap severity × provider weight        |
| Platform readiness failures | "Add structured data to improve Gemini visibility (failing critical check)"              | importance level (critical/important) |
| Crawl issues                | "Your llms.txt is missing — ChatGPT and Claude weigh this heavily"                       | platform count affected               |
| SoV trend drops             | "Your Perplexity visibility dropped 20% this week"                                       | magnitude of decline                  |
| Provider coverage gaps      | "You're not tracked on Grok yet — add it to your visibility checks"                      | provider market share                 |

### How recommendations are generated

New endpoint: `POST /api/visibility/:projectId/recommendations`

Server-side logic:

1. Load visibility gaps (queries where competitors cited, user not)
2. Load platform readiness failures (critical/important checks failing)
3. Load latest crawl issues (missing llms.txt, blocked crawlers, etc.)
4. Load SoV trends (detect declining providers)
5. Score each by impact: `provider_weight × severity × recency`
6. Return top 5, sorted by impact score

Each recommendation includes:

- `type`: "gap" | "platform" | "issue" | "trend" | "coverage"
- `title`: Human-readable action item
- `description`: Why this matters + what to do
- `impact`: "high" | "medium" | "low"
- `fixUrl`: Link to the relevant fix (page, issue, or settings)
- `provider`: Which AI provider this affects

### UI component: `<RecommendationsCard>`

- Collapsible card, expanded by default
- Each recommendation: icon + title + impact badge + description + "Fix" button
- "Refresh" button to recompute (rate limited)

---

## 3. Curated Query Selector

Replace the open-text query input with a curated query picker. No free text allowed.

### Query sources

1. **Saved keywords** (`saved_keywords` table) — grouped by funnel stage
2. **Persona sample queries** (`personas.sampleQueries[]`) — grouped by persona name
3. **AI-suggested queries** — from the keyword discovery service

### UI layout

```
Select queries:
┌──────────────────────────────────────────────┐
│ From Keywords:                                │
│  ☑ "best AI SEO tools"         [comparison]  │
│  ☑ "how to optimize for ChatGPT" [education] │
│  ☐ "LLM Rank vs Profound"    [comparison]   │
│                                               │
│ From Personas:                                │
│  ☐ "AI readiness audit tool"  (Mkt Director) │
│  ☐ "improve search visibility" (SEO Manager) │
│                                               │
│ No keywords yet? [Discover Keywords]          │
└──────────────────────────────────────────────┘

Providers: [ChatGPT ✓] [Claude ✓] ... [Grok ✓]

Cost: 2 queries × 7 providers = 14 checks (86 remaining)

[Run Visibility Check]
```

### Changes required

- Modify `POST /api/visibility/check` to accept `keywordIds: string[]` instead of `query: string`
- Server resolves keyword IDs to query strings from DB (never trusts client-sent text)
- Keep backward compatibility: if `query` is sent, validate against existing saved keywords (reject if not found)
- Show "No keywords yet? Discover Keywords" CTA when `saved_keywords` is empty

### Prompt injection prevention

- All queries come from DB records (saved_keywords or persona sampleQueries)
- Server-side: wrap query in structured template before sending to LLM providers:
  ```
  "Provide information about the following topic: {query}"
  ```
- Character validation on keyword creation: max 200 chars, alphanumeric + spaces + basic punctuation only
- Reject keywords containing: `ignore`, `previous instructions`, `system prompt`, code blocks, markdown formatting

---

## 4. Enhanced Share of Voice Chart

Upgrade from "own brand only" to competitive Share of Voice.

### Current state

- Recharts `LineChart` with one `Line` per provider
- Y-axis: 0-100% brand mention rate
- Data: weekly aggregation from `visibility_checks` table

### Improvements

**a) Add competitor lines:**

- For each tracked competitor, add a dashed line on the same chart
- Color-code: solid lines = your brand, dashed = competitors
- Legend shows all tracked brands

**b) Provider filter dropdown:**

- "All Providers" (default), or filter to a single provider
- When filtered, chart shows only that provider's data with more detail

**c) Persona/keyword filter:**

- Once keywords are linked to personas, filter SoV by persona
- "How do I rank for Marketing Director queries vs. Technical Evaluator queries?"

**d) Trend indicators on chart header:**

- Per-provider trend badges: "ChatGPT ▲ +12%", "Perplexity ▼ -5%"
- Computed from latest week vs. previous week

### Data changes

Modify `GET /api/visibility/:projectId/trends` to accept optional query params:

- `?provider=chatgpt` — filter to single provider
- `?includeCompetitors=true` — include competitor mention rates (from `competitorMentions` JSONB)

The competitor data already exists in each visibility check's `competitorMentions` field — just needs to be aggregated in the trends SQL query.

---

## 5. Scheduled Checks Hardening

### Frequency restriction

Remove `hourly` and `daily` options. Only allow:

- `weekly` — runs every 7 days
- `monthly` — runs on the 1st of each month

Update:

- Schema: change `scheduleFrequencyEnum` values to `["weekly", "monthly"]`
- API: reject `hourly`/`daily` in create/update endpoints
- UI: remove hourly/daily options from frequency dropdown
- Migration: convert existing hourly/daily schedules to weekly

### Query source change

Scheduled checks no longer accept free-text queries. Instead:

- User selects which saved keywords to include in the schedule
- Store `keywordIds: uuid[]` instead of `query: text`
- When schedule fires, resolve keyword IDs to current query strings from DB
- If a keyword is deleted, it's automatically removed from schedules

### Schema changes

Modify `scheduled_visibility_queries`:

- Add: `keywordIds uuid[] NOT NULL DEFAULT '{}'`
- Deprecate: `query text` (keep for migration, stop using)

---

## 6. Platform Readiness — Expand to 7 Providers

### Currently: 4 platforms

ChatGPT, Claude, Perplexity, Gemini

### Add 3 more platforms

**Copilot:**

- Bing-based, traditional SEO signals matter most
- Key checks: structured data, meta tags, sitemap, robots.txt, mobile-friendly
- Weights: Technical 0.35, Content 0.25, AI Readiness 0.15, Performance 0.25

**Grok:**

- Content-heavy, favors fresh and engaging content
- Key checks: content freshness, social signals, direct answers, thin content
- Weights: Technical 0.15, Content 0.40, AI Readiness 0.25, Performance 0.20 (already exists in `PLATFORM_WEIGHTS`)

**Gemini AI Mode:**

- Citation-oriented, structured data heavy
- Key checks: structured data, citation-worthy content, source attribution, URL presence
- Weights: Technical 0.25, Content 0.30, AI Readiness 0.35, Performance 0.10

### Changes required

1. Add `PLATFORM_REQUIREMENTS` entries for copilot, grok, gemini_ai_mode in `packages/shared/src/constants/platform-requirements.ts`
2. Add `PLATFORM_WEIGHTS` for copilot and gemini_ai_mode in `packages/scoring/src/platforms.ts` (grok already exists)
3. Update `PlatformReadinessMatrix` component to render 7 cards instead of 4 (responsive grid: 3+3+1 or 4+3)

---

## 7. Component Layout (Complete Tab Structure)

The redesigned AI Visibility tab renders in this order:

```
1. [Executive Dashboard Header]
   - Score card | Signal breakdown | Competitive position

2. [Recommendations Card]
   - Top 3-5 prioritized actions with fix CTAs

3. [Platform Readiness Matrix]  (existing, expanded to 7)
   - 7 platform cards + factor matrix

4. [Share of Voice Chart]  (enhanced)
   - Provider filter + competitor overlay + trend badges

5. [Run Visibility Check]  (curated queries)
   - Keyword/persona query picker + provider toggles

6. [Competitor Comparison]  (existing)
   - Query × competitor grid + "Why them?" analysis

7. [Scheduled Checks]  (hardened)
   - Weekly/monthly only, keyword-based

8. [Check History]  (existing)
   - Table with filters

9. [Content Gaps]  (existing)
   - Queries where competitors are cited but you're not
```

---

## Implementation Priority

1. Executive Dashboard Header (highest user impact — shows score for the first time)
2. Curated Query Selector (security fix — removes prompt injection risk)
3. Recommendations Engine (highest value-add — tells users what to do)
4. Scheduled Checks Hardening (security + simplification)
5. Enhanced Share of Voice Chart (better competitive context)
6. Platform Readiness expansion to 7 (completeness)
