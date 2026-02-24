# Semrush AI SEO Parity — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the 8 feature gaps identified between LLM Rank and Semrush's AI Visibility Toolkit, ordered by impact-to-effort ratio.

**Architecture:** Each feature adds a DB column/table where needed, an API route, and a frontend component. We reuse existing infrastructure — the `VisibilityChecker` already calls LLMs and stores `responseText`, so sentiment extraction piggybacks on that data. All new UI goes into existing tabs (visibility, pages, overview) rather than new pages.

**Tech Stack:** Drizzle ORM (Neon PG), Hono routes, React + Recharts + shadcn/ui, Anthropic Claude for AI analysis.

---

## Phase A: Quick Wins (1-2 days each)

---

### Task 1: Cited Pages Report

**Why:** We already store `urlCited` and `citationPosition` per visibility check. Users need a dedicated view showing *which of their pages* AI platforms actually reference — this is the single most actionable metric for content optimization.

**Files:**
- Create: `apps/web/src/components/visibility/cited-pages-table.tsx`
- Modify: `apps/api/src/routes/visibility.ts` (add GET `/:projectId/cited-pages`)
- Modify: `packages/db/src/queries/visibility.ts` (add `getCitedPages` query)
- Modify: `apps/web/src/lib/api.ts` (add `visibility.getCitedPages()`)
- Modify: `apps/web/src/components/tabs/visibility-tab.tsx` (add section)

**Step 1: Add DB query**

In `packages/db/src/queries/visibility.ts`, add a query that groups visibility_checks by the cited URL extracted from `responseText`, counting how many times each page was cited, by which providers, and with average citation position.

```sql
SELECT
  response_text,
  COUNT(*) FILTER (WHERE url_cited = true) as citation_count,
  array_agg(DISTINCT llm_provider) FILTER (WHERE url_cited = true) as providers,
  AVG(citation_position) FILTER (WHERE url_cited = true) as avg_position
FROM visibility_checks
WHERE project_id = $1 AND url_cited = true
GROUP BY response_text -- will need to extract URL from response
```

However, we don't currently store the *specific URL cited* — just a boolean. We need a new column.

**Step 1a: Add `citedUrl` column to visibility_checks**

In `packages/db/src/schema/features.ts`, add to `visibilityChecks`:
```typescript
citedUrl: text("cited_url"),  // The specific page URL that was cited in the AI response
```

Run: `cd packages/db && npx drizzle-kit generate && npx drizzle-kit push`

**Step 1b: Update LLM response analyzer**

In `packages/llm/src/visibility.ts`, update `analyzeResponse()` to also extract the specific cited URL from `responseText` and return it as `citedUrl: string | null`.

**Step 1c: Add DB query**

In `packages/db/src/queries/visibility.ts`, add:
```typescript
async getCitedPages(projectId: string) {
  return db
    .select({
      citedUrl: visibilityChecks.citedUrl,
      citationCount: sql<number>`count(*)`,
      providers: sql<string[]>`array_agg(distinct ${visibilityChecks.llmProvider})`,
      avgPosition: sql<number>`avg(${visibilityChecks.citationPosition})`,
      lastCited: sql<string>`max(${visibilityChecks.checkedAt})`,
    })
    .from(visibilityChecks)
    .where(and(
      eq(visibilityChecks.projectId, projectId),
      eq(visibilityChecks.urlCited, true),
      isNotNull(visibilityChecks.citedUrl),
    ))
    .groupBy(visibilityChecks.citedUrl)
    .orderBy(desc(sql`count(*)`));
}
```

**Step 2: Add API route**

In `apps/api/src/routes/visibility.ts`, add:
```typescript
visibilityRoutes.get("/:projectId/cited-pages", withOwnership("project"), async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");
  const rows = await visibilityQueries(db).getCitedPages(projectId);
  return c.json({ data: rows });
});
```

**Step 3: Add API client method**

In `apps/web/src/lib/api.ts`, in the `visibility` section:
```typescript
async getCitedPages(projectId: string): Promise<CitedPage[]> {
  const res = await apiClient.get<ApiEnvelope<CitedPage[]>>(
    `/api/visibility/${projectId}/cited-pages`,
  );
  return res.data;
},
```

Add type:
```typescript
export interface CitedPage {
  citedUrl: string;
  citationCount: number;
  providers: string[];
  avgPosition: number;
  lastCited: string;
}
```

**Step 4: Build the component**

Create `apps/web/src/components/visibility/cited-pages-table.tsx`:
- Table with columns: Page URL (truncated, linked), Times Cited, Platforms (badges), Avg Position, Last Cited
- Sort by citation count descending
- Empty state: "No citations found yet. Run visibility checks to see which pages AI platforms reference."
- Use existing `Table`, `TableRow`, `Badge` components from shadcn

**Step 5: Wire into visibility tab**

In `apps/web/src/components/tabs/visibility-tab.tsx`, add a "Cited Pages" card section after the Share of Voice chart.

**Step 6: Commit**
```bash
git add packages/db/ packages/llm/ apps/api/ apps/web/
git commit -m "feat(visibility): add cited pages report showing which pages AI platforms reference"
```

---

### Task 2: AI Crawlability Audit (dedicated view)

**Why:** We already compute `llmsTxtScore`, `robotsTxtScore`, `botAccessScore`, `sitemapScore` in the scoring engine. But they're buried inside per-page scores. Users need a project-level "AI Readiness Audit" card that shows pass/fail for AI-specific technical checks at a glance.

**Files:**
- Create: `apps/web/src/components/visibility/ai-audit-card.tsx`
- Modify: `apps/api/src/routes/crawls.ts` (add GET `/:id/ai-audit`)
- Modify: `apps/web/src/lib/api.ts` (add `crawls.getAIAudit()`)
- Modify: `apps/web/src/components/tabs/overview-tab.tsx` (add card)

**Step 1: Add API route**

In `apps/api/src/routes/crawls.ts`, add a route that aggregates AI-specific scores from the latest crawl:
```typescript
crawlRoutes.get("/:id/ai-audit", withOwnership("crawl"), async (c) => {
  const db = c.get("db");
  const crawlId = c.req.param("id");

  const scores = await scoreQueries(db).listByJob(crawlId);
  const issues = await scoreQueries(db).getIssuesByJob(crawlId);

  // AI-specific issue codes
  const aiIssueCodes = [
    "MISSING_LLMS_TXT", "AI_CRAWLER_BLOCKED", "NO_STRUCTURED_DATA",
    "MISSING_SITEMAP", "MISSING_CANONICAL", "NOINDEX_SET",
    "MISSING_OG_TAGS", "MISSING_META_DESC", "MISSING_TITLE",
  ];

  const aiIssues = issues.filter(i => aiIssueCodes.includes(i.code));
  const totalPages = scores.length;

  // Aggregate scores
  const avgLlmsTxt = scores.reduce((s, r) => s + (r.llmsTxtScore ?? 0), 0) / (totalPages || 1);
  const avgRobotsTxt = scores.reduce((s, r) => s + (r.robotsTxtScore ?? 0), 0) / (totalPages || 1);
  const avgBotAccess = scores.reduce((s, r) => s + (r.botAccessScore ?? 0), 0) / (totalPages || 1);
  const avgSitemap = scores.reduce((s, r) => s + (r.sitemapScore ?? 0), 0) / (totalPages || 1);
  const avgSchema = scores.reduce((s, r) => s + (r.schemaMarkupScore ?? 0), 0) / (totalPages || 1);

  const checks = [
    { name: "llms.txt", score: avgLlmsTxt, status: avgLlmsTxt >= 80 ? "pass" : avgLlmsTxt >= 50 ? "warn" : "fail" },
    { name: "Robots.txt AI Access", score: avgRobotsTxt, status: avgRobotsTxt >= 80 ? "pass" : avgRobotsTxt >= 50 ? "warn" : "fail" },
    { name: "Bot Crawlability", score: avgBotAccess, status: avgBotAccess >= 80 ? "pass" : avgBotAccess >= 50 ? "warn" : "fail" },
    { name: "XML Sitemap", score: avgSitemap, status: avgSitemap >= 80 ? "pass" : avgSitemap >= 50 ? "warn" : "fail" },
    { name: "Structured Data", score: avgSchema, status: avgSchema >= 80 ? "pass" : avgSchema >= 50 ? "warn" : "fail" },
  ];

  return c.json({
    data: {
      checks,
      issueCount: aiIssues.length,
      criticalCount: aiIssues.filter(i => i.severity === "critical").length,
      pagesAudited: totalPages,
    },
  });
});
```

**Step 2: Add API client method**

```typescript
async getAIAudit(crawlId: string): Promise<AIAuditResult> {
  const res = await apiClient.get<ApiEnvelope<AIAuditResult>>(
    `/api/crawls/${crawlId}/ai-audit`,
  );
  return res.data;
},
```

**Step 3: Build the component**

Create `apps/web/src/components/visibility/ai-audit-card.tsx`:
- Card with 5 rows: check name, pass/warn/fail badge, score bar
- Summary at top: "X/5 checks passing" with overall status icon
- Critical issues count if > 0 (red alert)
- Use green/amber/red color coding matching existing grade colors

**Step 4: Add to overview tab**

In the overview tab, add the AI Audit card after the ScoreRadarChart (or in a side column).

**Step 5: Commit**
```bash
git add apps/api/ apps/web/
git commit -m "feat(audit): add dedicated AI crawlability audit card on overview tab"
```

---

## Phase B: High-Value Medium Effort (3-5 days each)

---

### Task 3: Brand Sentiment Analysis

**Why:** This is the highest-value differentiator. Semrush charges $199/mo and users report it's incomplete. We already store `responseText` from every visibility check — we just need an LLM pass to extract *how* AI describes the brand (tone, key attributes, perception). This turns "are we mentioned?" into "what do AI platforms think of us?"

**Files:**
- Modify: `packages/db/src/schema/features.ts` (add columns to `visibilityChecks`)
- Create: `packages/db/src/schema/features.ts` (add `brandSentimentSnapshots` table)
- Modify: `packages/llm/src/visibility.ts` (add `analyzeSentiment()`)
- Create: `apps/api/src/routes/brand-performance.ts` (new route file)
- Create: `apps/api/src/services/brand-sentiment-service.ts`
- Modify: `apps/web/src/lib/api.ts` (add `brand` section)
- Create: `apps/web/src/components/visibility/brand-sentiment-card.tsx`
- Create: `apps/web/src/components/visibility/brand-perception-chart.tsx`
- Modify: `apps/web/src/components/tabs/visibility-tab.tsx` (add section)

**Step 1: Add schema**

In `packages/db/src/schema/features.ts`, add new table:
```typescript
export const brandSentimentSnapshots = pgTable("brand_sentiment_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  period: text("period").notNull(),              // "2026-W08" (ISO week)
  overallSentiment: text("overall_sentiment"),    // "positive" | "neutral" | "negative" | "mixed"
  sentimentScore: real("sentiment_score"),         // -1.0 to 1.0
  keyAttributes: jsonb("key_attributes"),          // ["reliable", "affordable", "innovative"]
  brandNarrative: text("brand_narrative"),          // 2-3 sentence summary of how AI describes brand
  strengthTopics: jsonb("strength_topics"),         // topics where brand is described positively
  weaknessTopics: jsonb("weakness_topics"),         // topics where brand is described negatively
  providerBreakdown: jsonb("provider_breakdown"),   // { chatgpt: { sentiment, attributes }, ... }
  sampleSize: integer("sample_size").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_sentiment_project_period").on(t.projectId, t.period),
]);
```

Also add to `visibilityChecks`:
```typescript
sentiment: text("sentiment"),           // per-check: "positive" | "neutral" | "negative"
brandDescription: text("brand_description"), // extracted snippet of how AI described the brand
```

Run: `cd packages/db && npx drizzle-kit generate && npx drizzle-kit push`

**Step 2: Build sentiment analyzer**

In `packages/llm/src/visibility.ts`, add function:
```typescript
export async function analyzeBrandSentiment(
  responseText: string,
  brandDomain: string,
): Promise<{
  sentiment: "positive" | "neutral" | "negative";
  brandDescription: string | null;
  attributes: string[];
}>
```

This calls Claude Haiku with a focused prompt:
- Input: the `responseText` from a visibility check
- Output: sentiment classification, a 1-sentence brand description extract, and key attributes mentioned
- Cost: ~$0.001 per check (Haiku), acceptable to run on every visibility check

**Step 3: Integrate into visibility check flow**

In `apps/api/src/services/visibility-service.ts`, after `runCheck()` stores results, run `analyzeBrandSentiment()` on each result where `brandMentioned === true`, and update the check with `sentiment` and `brandDescription`.

**Step 4: Build weekly aggregation service**

Create `apps/api/src/services/brand-sentiment-service.ts`:
- `aggregateWeeklySentiment(projectId)` — queries all visibility checks for current week, aggregates per-check sentiments into a `brandSentimentSnapshots` row
- Called by a weekly cron or triggered after each visibility check batch

**Step 5: Add API routes**

Create `apps/api/src/routes/brand-performance.ts`:
```typescript
// GET /brand/:projectId/sentiment — Latest sentiment snapshot
// GET /brand/:projectId/sentiment/history — Weekly trend (last 12 weeks)
// GET /brand/:projectId/perception — How each AI platform describes the brand
```

Register in `apps/api/src/routes/app.tsx`.

**Step 6: Add API client methods**

In `apps/web/src/lib/api.ts`:
```typescript
brand: {
  async getSentiment(projectId: string): Promise<BrandSentiment>,
  async getSentimentHistory(projectId: string): Promise<BrandSentiment[]>,
  async getPerception(projectId: string): Promise<BrandPerception>,
}
```

**Step 7: Build UI components**

`brand-sentiment-card.tsx`:
- Overall sentiment badge (positive/neutral/negative) with color
- Sentiment score gauge (-1 to +1)
- Key attributes as tag pills
- Brand narrative quote block
- "How AI describes you" summary

`brand-perception-chart.tsx`:
- Recharts line chart showing sentiment score over weeks
- Per-provider breakdown as colored dots

**Step 8: Wire into visibility tab**

Add "Brand Perception" section to the visibility tab, gated to Starter+ plan.

**Step 9: Commit**
```bash
git add packages/db/ packages/llm/ apps/api/ apps/web/
git commit -m "feat(brand): add brand sentiment analysis — track how AI platforms describe your brand"
```

---

### Task 4: Brand Performance Dashboard (Weekly SoV Report)

**Why:** Executives need a single view: "How does my brand compare to competitors in AI search this week?" Semrush calls this Brand Performance. We have the data (share of voice, competitor mentions) but lack the executive-friendly dashboard.

**Files:**
- Create: `apps/web/src/components/visibility/brand-performance-dashboard.tsx`
- Create: `apps/web/src/components/visibility/competitor-sov-table.tsx`
- Modify: `apps/api/src/routes/visibility.ts` (add GET `/:projectId/brand-performance`)
- Modify: `apps/web/src/lib/api.ts` (add method)
- Modify: `apps/web/src/components/tabs/visibility-tab.tsx`

**Step 1: Add API route**

GET `/:projectId/brand-performance` that returns:
```typescript
{
  period: "2026-W08",
  yourBrand: { mentionRate, citationRate, sovPercent, trend },
  competitors: [
    { domain, mentionRate, citationRate, sovPercent, trend }
  ],
  topPrompts: [
    { query, yourMentioned, competitorsMentioned: string[] }
  ],
  weekOverWeek: { mentionsDelta, sovDelta, citationsDelta },
}
```

This aggregates from `visibilityChecks` for the current week + previous week.

**Step 2: Add API client**

```typescript
async getBrandPerformance(projectId: string): Promise<BrandPerformance>
```

**Step 3: Build dashboard component**

`brand-performance-dashboard.tsx`:
- Hero row: 3 KPI cards (Your SoV %, Week-over-week change with arrow, Total mentions)
- Competitor comparison table: domain, SoV%, mention rate, citation rate, trend sparkline
- "Top Prompts" section: queries where you appear vs. where competitors beat you
- Color-coded: green if you lead, red if competitor leads

**Step 4: Wire into visibility tab as first section (replaces current header)**

**Step 5: Commit**
```bash
git commit -m "feat(brand): add brand performance dashboard with competitor SoV comparison"
```

---

### Task 5: Source Opportunities

**Why:** Shows external sites that cite competitors in AI responses but don't cite you. These are actionable outreach targets — get backlinks from these sites and AI platforms will start citing you too.

**Files:**
- Modify: `packages/db/src/queries/visibility.ts` (add `getSourceOpportunities`)
- Modify: `apps/api/src/routes/visibility.ts` (add GET `/:projectId/source-opportunities`)
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/visibility/source-opportunities-table.tsx`
- Modify: `apps/web/src/components/tabs/visibility-tab.tsx`

**Step 1: Add DB query**

Extract source domains from `competitorMentions` JSONB where competitor was cited but user wasn't. The `competitorMentions` field stores `{domain, mentioned, position}[]` per check.

```typescript
async getSourceOpportunities(projectId: string) {
  // Get all checks where brand NOT mentioned but competitors ARE
  const checks = await db.query.visibilityChecks.findMany({
    where: and(
      eq(visibilityChecks.projectId, projectId),
      eq(visibilityChecks.brandMentioned, false),
    ),
  });

  // Extract competitor domains that were mentioned
  const competitorCounts = new Map<string, number>();
  for (const check of checks) {
    const mentions = (check.competitorMentions as any[]) ?? [];
    for (const m of mentions) {
      if (m.mentioned) {
        competitorCounts.set(m.domain, (competitorCounts.get(m.domain) || 0) + 1);
      }
    }
  }

  return Array.from(competitorCounts.entries())
    .map(([domain, count]) => ({ domain, mentionCount: count }))
    .sort((a, b) => b.mentionCount - a.mentionCount);
}
```

**Step 2: Add API route**

```typescript
visibilityRoutes.get("/:projectId/source-opportunities", withOwnership("project"), async (c) => {
  // Return domains frequently cited alongside competitors but not you
});
```

**Step 3: Add API client + UI component**

Table with: Competitor Domain, Times Cited (when you weren't), Queries they appear in. Actionable CTA: "Get cited by this source" linking to content gap analysis.

**Step 4: Gate to Pro+ plan**

**Step 5: Commit**
```bash
git commit -m "feat(visibility): add source opportunities — find sites that cite competitors but not you"
```

---

## Phase C: Strategic Differentiators (1-2 weeks each)

---

### Task 6: Prompt Research Tool

**Why:** This is Semrush's biggest investment area. Users need to discover *what prompts/questions* people ask AI about their industry, with volume estimates and difficulty scores. We have keyword discovery but not prompt-specific research.

**Files:**
- Create: `packages/db/src/schema/features.ts` (add `aiPrompts` table)
- Create: `packages/llm/src/prompt-research.ts`
- Create: `apps/api/src/routes/prompt-research.ts`
- Create: `apps/api/src/services/prompt-research-service.ts`
- Create: `apps/web/src/components/visibility/prompt-research-panel.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/tabs/visibility-tab.tsx`

**Step 1: Add schema**

```typescript
export const aiPrompts = pgTable("ai_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  category: text("category"),               // "comparison", "how-to", "recommendation", "review"
  estimatedVolume: integer("estimated_volume"), // monthly estimated asks
  difficulty: real("difficulty"),              // 0-100 how hard to appear
  intent: text("intent"),                     // "informational", "transactional", "navigational"
  yourMentioned: boolean("your_mentioned").default(false),
  competitorsMentioned: jsonb("competitors_mentioned"), // string[]
  source: text("source").notNull().default("discovered"), // "discovered" | "user_added" | "suggested"
  discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
}, (t) => [
  index("idx_prompts_project").on(t.projectId),
]);
```

**Step 2: Build prompt discovery LLM function**

In `packages/llm/src/prompt-research.ts`:
```typescript
export async function discoverPrompts(options: {
  domain: string;
  industry: string;
  siteDescription: string;
  existingKeywords: string[];
  competitors: string[];
}): Promise<DiscoveredPrompt[]>
```

Uses Claude Sonnet to generate realistic AI-style prompts people would ask:
- "Best [industry] tools for [use case]"
- "Compare [brand] vs [competitor]"
- "[Brand] review [year]"
- "How to [solve problem] with [category]"

Returns estimated volume (based on keyword proxies from GSC if available) and difficulty.

**Step 3: Build API routes**

```typescript
// POST /prompt-research/:projectId/discover — Run AI prompt discovery
// GET /prompt-research/:projectId — List discovered prompts
// POST /prompt-research/:projectId/check — Run visibility check for a specific prompt
// DELETE /prompt-research/:projectId/:promptId — Remove prompt
```

**Step 4: Build prompt research service**

Service orchestrates: discover prompts → store in DB → optionally run visibility checks on them → return enriched results with your-mentioned status.

**Step 5: Build UI**

`prompt-research-panel.tsx`:
- "Discover Prompts" button (with Loader2 spinner)
- Table: Prompt text, Category badge, Est. Volume, Difficulty bar, You Mentioned (check/x), Competitors
- Filter by: category, mentioned status, difficulty range
- Action: "Track this prompt" (adds to scheduled visibility checks)
- Empty state: "Discover what people ask AI about your industry"

**Step 6: Gate to Starter+ plan (Free: view 3 prompts, Starter: 20, Pro: 100, Agency: unlimited)**

**Step 7: Commit**
```bash
git commit -m "feat(prompts): add AI prompt research — discover what people ask AI about your industry"
```

---

### Task 7: Monthly Audience Estimate

**Why:** Gives users an estimated reach metric — how many people potentially see AI responses about their brand. It's a "vanity metric" but important for executive reporting and comparing against traditional SEO traffic.

**Files:**
- Modify: `apps/api/src/routes/visibility.ts` (extend AI score response)
- Modify: `apps/web/src/components/visibility/ai-visibility-score-header.tsx`

**Step 1: Add audience estimation to AI score route**

In the existing GET `/:projectId/ai-score` handler, add an audience estimate calculation:
```typescript
// Estimation formula:
// For each query where brand is mentioned, estimate monthly searches
// Use GSC data if available (impressions as proxy), otherwise use tier estimates
// Multiply by AI adoption rate (~15-25% of searches now go through AI)
const estimatedMonthlyAudience = calculateAudienceEstimate(checks, gscData);
```

Add to response:
```typescript
meta: {
  ...existing,
  estimatedMonthlyAudience: number,  // e.g., 12,400
  audienceGrowth: number,            // % change from previous period
}
```

**Step 2: Update score header component**

In `ai-visibility-score-header.tsx`, add a new KPI card showing:
- "Est. Monthly Reach" with the audience number
- Growth arrow (up/down) with percentage

**Step 3: Commit**
```bash
git commit -m "feat(visibility): add monthly audience estimate to AI visibility score"
```

---

### Task 8: Regional/Language Filtering

**Why:** International brands need to know their AI visibility per market. Semrush supports 220+ regions. We start with the top 15 markets and expand.

**Files:**
- Modify: `packages/db/src/schema/features.ts` (add `region` and `language` columns)
- Modify: `packages/llm/src/visibility.ts` (pass locale to LLM calls)
- Modify: `apps/api/src/routes/visibility.ts` (add query params)
- Modify: `apps/web/src/components/tabs/visibility-tab.tsx` (add filter dropdown)
- Modify: `apps/web/src/lib/api.ts` (update method signatures)

**Step 1: Add schema columns**

In `visibilityChecks` table:
```typescript
region: text("region").default("us"),     // ISO 3166-1 alpha-2: "us", "gb", "de", etc.
language: text("language").default("en"), // ISO 639-1: "en", "es", "de", etc.
```

Run migration.

**Step 2: Update LLM provider calls**

In each provider (`checkChatGPT`, `checkClaude`, etc.), add locale context to the prompt:
```
"Answer as if you are responding to a user in {region} who speaks {language}."
```

This ensures AI responses reflect regional brand perception.

**Step 3: Add filter params to API routes**

All visibility routes accept optional `?region=us&language=en` query params. Default to "us"/"en" if not specified. Filter queries accordingly.

**Step 4: Add filter dropdown to visibility tab**

Dropdown at the top of the visibility tab:
```
Region: [Worldwide] [US] [UK] [DE] [FR] [ES] [BR] [JP] [AU] [CA] [IN] [IT] [NL] [SE] [KR]
```

Changing the dropdown re-fetches all visibility data for that region.

**Step 5: Gate regional filtering to Pro+ plan**

Free/Starter: US only. Pro: top 15 regions. Agency: all regions.

**Step 6: Commit**
```bash
git commit -m "feat(visibility): add regional and language filtering for visibility data"
```

---

## Implementation Order & Effort Summary

| # | Feature | Phase | Effort | Plan Gate | Depends On |
|---|---------|-------|--------|-----------|------------|
| 1 | Cited Pages Report | A | 1 day | All plans | Schema migration |
| 2 | AI Crawlability Audit | A | 1 day | All plans | None |
| 3 | Brand Sentiment Analysis | B | 4 days | Starter+ | Schema migration |
| 4 | Brand Performance Dashboard | B | 3 days | Starter+ | Task 3 (sentiment data) |
| 5 | Source Opportunities | B | 2 days | Pro+ | None |
| 6 | Prompt Research Tool | C | 5 days | Starter+ | Schema migration |
| 7 | Monthly Audience Estimate | C | 1 day | All plans | None |
| 8 | Regional/Language Filtering | C | 5 days | Pro+ | Schema migration |

**Total estimated effort: ~22 days**

## Testing Strategy

- Each new API route gets an integration test in `apps/api/src/__tests__/integration/`
- Each new DB query gets a unit test with mock data
- Each new component gets a visual check in the browser (no Storybook in this project)
- Sentiment analysis gets accuracy tests with sample responses (positive/negative/neutral)
- Run `pnpm typecheck` after each task to catch type errors early

## Migration Strategy

- Tasks 1, 3, 6, 8 require schema migrations (new columns or tables)
- Run `drizzle-kit push` for dev, `drizzle-kit generate` for prod migration files
- All new columns are nullable or have defaults — no breaking changes to existing data
- Existing visibility checks without the new columns will return `null` for sentiment/citedUrl/region (graceful degradation)
