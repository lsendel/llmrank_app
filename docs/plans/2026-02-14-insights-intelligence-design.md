# Design: Intelligence Fusion, Value-Added Insights & Improvement Progress

**Date:** 2026-02-14
**Depends on:** `2026-02-14-extension-port.md` (platform scores, recommendations, content type, strengths)

## Context

The SaaS has 12+ data sources displayed in isolated silos: scoring engine (4 categories, 37 factors), LLM content scores (5 dimensions), visibility checks (5 providers), enrichments (GSC, PSI, GA4, Clarity), fact extraction, topic clusters, personas, and crawl history. Users see raw numbers but lack cross-source intelligence that answers: "What should I actually do?", "Am I getting better?", and "Where's my biggest opportunity?"

## Three Pillars

### 1. Improvement Progress Tracking

Compare scores across crawls to show trajectory.

**Project-level progress:**

- Score trend (overall + per-category) across all completed crawls
- Issue resolution rate: issues fixed vs. new issues between consecutive crawls
- Grade migration: how many pages moved up/down a grade
- Velocity: average points gained per crawl

**Page-level progress:**

- Score delta between current and previous crawl (matched by URL)
- Issues fixed / issues new / issues persisting
- Category-level deltas

**Data model:** No new tables. Computed by joining `page_scores` and `issues` across two `crawl_jobs` for the same project, matched by page URL.

**API:**

- `GET /api/projects/:id/progress` — project-level comparison (latest vs. previous crawl)
- Response includes: `scoreDelta`, `issuesFixed`, `issuesNew`, `gradeChanges`, `velocity`, `categoryDeltas`, `topImprovedPages`, `topRegressedPages`

### 2. Intelligence Fusion (Cross-Source Insights)

Combine multiple data sources into composite intelligence scores computed on-the-fly.

**Project-level insights (extend existing `GET /api/crawls/:id/insights`):**

| Insight                  | Data Sources Combined                                                               | Output                                      |
| ------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| AI Visibility Readiness  | ai_readiness score + LLM citation_worthiness + visibility check citation rates      | Composite 0-100 score                       |
| Platform Opportunity Map | Platform scores (from extension port) + visibility check mention rates per provider | Which platforms offer most upside           |
| Content Health Matrix    | Scoring categories + LLM scores + enrichment engagement (GA4, Clarity)              | Multi-dimensional health rating             |
| ROI Quick Wins           | Quick wins + GSC impressions/clicks + effort level                                  | Priority sorted by estimated traffic impact |

**Page-level insights (extend `GET /api/pages/:id/scores` response):**

| Insight               | Data Sources Combined                                                                     | Output           |
| --------------------- | ----------------------------------------------------------------------------------------- | ---------------- |
| Citation Readiness    | Fact citability scores + LLM citation_worthiness + structured data quality + schema types | Score 0-100      |
| Content Effectiveness | Scoring + GA4 bounce rate + Clarity scroll depth + LLM comprehensiveness                  | Score 0-100      |
| Platform Breakdown    | Platform scores + per-platform tips + visibility data per provider                        | 5 platform cards |

**Architecture:** New `intelligence-service.ts` reads from existing repositories. No new tables — everything computed on-the-fly. Service accepts optional enrichment/visibility data (graceful when missing — just omits those dimensions).

### 3. Value-Added Suggestions

Smarter suggestions that combine ALL data sources, not just scoring issues.

**Beyond issue-based recommendations:**

- GSC-informed priorities: "Your /pricing page ranks #8 for 'ai seo pricing' (2,400 impressions/mo). Fixing MISSING_SCHEMA could push it to page 1." (Combines: issues + GSC data)
- Platform-specific action plans: "To improve Claude visibility: add structured FAQ schema (+12 pts), increase external citations (+8 pts)" (Combines: platform scores + recommendations)
- Engagement-informed suggestions: "Your /blog/guide has high bounce rate (78%) despite good content score (85). Consider adding a table of contents and summary at top." (Combines: scoring + GA4 + Clarity)
- Competitor-gap suggestions: "Competitor X is cited by Perplexity for 'ai seo tools' but you're not. Your page scores 72 vs. their estimated 85+." (Combines: visibility checks + scoring)

**Implementation:** Extend the recommendation engine (from extension port Task 4) with an optional `enrichments` parameter. When enrichment data is available, generate bonus suggestions. When not available, the engine still works with scoring data alone.

## What NOT to Build

- No pre-computed/stored intelligence (compute on-the-fly)
- No new tables (use existing data)
- No separate microservice (runs in the same Workers API)
- No achievement/gamification system (extension had this, not needed for SaaS)
- No real-time dashboard (existing SWR polling is sufficient)

## API Changes Summary

| Endpoint                         | Change                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `GET /api/projects/:id/progress` | **New** — cross-crawl comparison                                               |
| `GET /api/crawls/:id/insights`   | **Extend** — add fused intelligence fields                                     |
| `GET /api/pages/:id/scores`      | **Extend** — add citation readiness, content effectiveness, platform breakdown |

## Frontend Changes Summary

| Component                  | Location                     | Description                                                          |
| -------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| Progress summary card      | Project overview tab         | Score delta badge, issues fixed/new, grade migration                 |
| Score trend with deltas    | History tab                  | Enhance existing ScoreTrendChart with category breakdowns and deltas |
| Platform opportunity cards | Overview tab or Strategy tab | 5 platform cards showing score + opportunity + top tips              |
| Citation readiness badge   | Page detail                  | Composite badge from fact extraction + LLM + schema                  |
| ROI quick wins             | Overview tab                 | Enhanced quick wins sorted by traffic potential                      |

## Implementation Order

1. **Progress tracking** (highest standalone value, no dependency on extension port)
2. **Intelligence fusion service** (depends on extension port for platform scores)
3. **Value-added suggestions** (extends recommendation engine from extension port)
4. **Frontend components** (displays all of the above)
