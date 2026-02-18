# AI Report Generation — Design Document

**Date:** 2026-02-18
**Status:** Approved
**Approach:** Narrative-as-a-Service Layer (packages/narrative)

## Overview

Add an AI narrative generation layer that transforms structured scoring data into prose-driven analysis reports. The NarrativeEngine generates section-by-section narratives in parallel via LLM, stores them in the database, and serves them across three surface areas: existing PDF/DOCX reports, dashboard insight cards, and a standalone AI Analysis page.

## Decisions

| Decision      | Choice                                                         |
| ------------- | -------------------------------------------------------------- |
| Architecture  | `packages/narrative` — reusable engine, decoupled from reports |
| Audience      | Adaptive tone (technical vs. business stakeholders)            |
| LLM strategy  | Section-by-section, parallel via `Promise.allSettled`          |
| Editability   | TipTap rich text editor (Agency tier)                          |
| Plan gating   | Pro (read-only, Haiku model) + Agency (editable, Sonnet model) |
| Content scope | Full analysis + recommendations (~2000-4000 words)             |
| Trigger       | Auto-generate after crawl scoring completes                    |

## Data Architecture

### New Table: `narrative_reports`

```sql
narrative_reports
├── id              UUID (PK, defaultRandom)
├── crawl_job_id    UUID (FK → crawl_jobs)
├── project_id      UUID (FK → projects)
├── tone            ENUM ('technical', 'business')
├── status          ENUM ('pending', 'generating', 'ready', 'failed')
├── sections        JSONB  -- array of NarrativeSection objects
├── version         INTEGER (default 1)
├── generated_by    TEXT   -- model ID (e.g., 'claude-sonnet-4-6')
├── token_usage     JSONB  -- { input, output, cost_cents }
├── created_at      TIMESTAMP
├── updated_at      TIMESTAMP
```

Unique constraint on `(crawl_job_id, tone, version)`.

### NarrativeSection Type

```ts
interface NarrativeSection {
  id: string;
  type: NarrativeSectionType;
  title: string;
  content: string; // AI-generated HTML
  editedContent?: string; // user-edited version (Agency), null = unedited
  order: number;
  dataContext: Record<string, unknown>;
}

type NarrativeSectionType =
  | "executive_summary"
  | "technical_analysis"
  | "content_analysis"
  | "ai_readiness_analysis"
  | "performance_analysis"
  | "trend_analysis"
  | "competitive_positioning"
  | "priority_recommendations";
```

`editedContent` stored separately from `content` so users can always reset to the AI-generated original.

## NarrativeEngine (`packages/narrative`)

### Package Structure

```
packages/narrative/
├── src/
│   ├── index.ts
│   ├── engine.ts             -- orchestrator
│   ├── sections/
│   │   ├── executive-summary.ts
│   │   ├── technical-analysis.ts
│   │   ├── content-analysis.ts
│   │   ├── ai-readiness-analysis.ts
│   │   ├── performance-analysis.ts
│   │   ├── trend-analysis.ts
│   │   ├── competitive-positioning.ts
│   │   └── priority-recommendations.ts
│   ├── prompts/
│   │   ├── base-prompt.ts
│   │   ├── section-prompts.ts
│   │   └── tone-adapters.ts
│   ├── types.ts
│   └── utils/
│       ├── data-selector.ts
│       └── token-tracker.ts
├── __tests__/
└── package.json
```

### Engine API

```ts
class NarrativeEngine {
  constructor(llmClient: Anthropic, cache?: KVNamespace);

  async generate(input: NarrativeInput): Promise<NarrativeReport>;

  async regenerateSection(
    sectionType: NarrativeSectionType,
    input: NarrativeInput,
    instructions?: string,
  ): Promise<NarrativeSection>;
}
```

### NarrativeInput

```ts
interface NarrativeInput {
  tone: "technical" | "business";
  crawlJob: CrawlJobSummary;
  categoryScores: CategoryScores;
  issues: Issue[];
  quickWins: QuickWin[];
  contentHealth: ContentHealthMetrics;
  previousCrawl?: CrawlJobSummary; // for trend analysis
  competitors?: CompetitorData[]; // for competitive positioning
  pages: PageScoreSummary[];
}
```

### Parallel Generation

- All applicable sections fire simultaneously via `Promise.allSettled`
- Sections with missing data are skipped (trend analysis without history, competitive without competitor data)
- One section failing doesn't block others — partial results are valid
- Wall-clock time: ~4-6 seconds for all sections

### Tone Adaptation

Tone adapters modify a shared base prompt with audience-specific system instructions (~200 tokens overhead):

- **Technical:** SEO terminology, factor names, code-level recommendations
- **Business:** Impact language, revenue risk, competitive gaps, no jargon

## API Routes

```
POST   /api/crawls/{crawlJobId}/narrative
GET    /api/crawls/{crawlJobId}/narrative
PATCH  /api/crawls/{crawlJobId}/narrative/sections/{sectionId}
POST   /api/crawls/{crawlJobId}/narrative/sections/{sectionType}/regenerate
DELETE /api/crawls/{crawlJobId}/narrative
```

### Generation Trigger

Auto-triggered after crawl scoring completes for Pro/Agency users. Status progression: `pending → generating → ready`.

### Plan Gating

| Endpoint     | Free/Starter | Pro       | Agency    |
| ------------ | ------------ | --------- | --------- |
| Generate     | 403          | allowed   | allowed   |
| Read         | 403          | allowed   | allowed   |
| Edit section | 403          | 403       | allowed   |
| Regenerate   | 403          | 1/section | unlimited |

### Editing Flow (Agency)

PATCH with `{ editedContent: "<p>...</p>" }` stores edits alongside original. `editedContent: null` resets to AI version.

## Frontend — Three Phases

### Phase 1: Inside Existing Reports

- New `<NarrativeSection>` components in `report-template.tsx`
- Detailed reports: all sections. Summary reports: executive_summary + priority_recommendations
- `generate-report-modal.tsx` adds "Include AI narrative" toggle (default on for Pro/Agency)
- Falls back to structured-only format if narrative not yet ready

### Phase 2: Dashboard Integration

- **AI Insight Card** on Overview tab — truncated executive_summary (~150 words) with "Read Full Analysis" link
- **Per-category collapsible panels** — e.g., Issues tab shows technical_analysis narrative above issue table
- **Locked state** for Free/Starter: blurred card with upgrade CTA

### Phase 3: Standalone AI Analysis Page

Route: `/dashboard/projects/{id}/ai-analysis`

- **Tone toggle** — technical ↔ business, generates on first switch
- **Section list** — each section in a TipTap instance (read-only for Pro, editable for Agency)
- **Per-section regenerate** — "↻" button with optional instruction input
- **Export dropdown** — PDF, DOCX, Markdown
- **Version indicator** — "Generated 2h ago · v2" with "View original" link
- **Sticky TOC** — scroll-linked section navigation

## Cost & Caching

### Token Budget

| Section            | Input       | Output     | Cost (Sonnet) |
| ------------------ | ----------- | ---------- | ------------- |
| Executive Summary  | ~2,000      | ~400       | $0.004        |
| Technical Analysis | ~3,000      | ~600       | $0.006        |
| Content Analysis   | ~3,000      | ~600       | $0.006        |
| AI Readiness       | ~2,500      | ~500       | $0.005        |
| Performance        | ~1,500      | ~300       | $0.003        |
| Trend Analysis     | ~2,000      | ~400       | $0.004        |
| Competitive        | ~2,000      | ~400       | $0.004        |
| Recommendations    | ~3,000      | ~800       | $0.007        |
| **Total**          | **~19,000** | **~4,000** | **~$0.04**    |

Haiku (Pro tier): ~$0.004 per narrative. Negligible at scale.

### Caching

- **DB-backed:** Generated narratives served from `narrative_reports` — no LLM call on read
- **No KV cache:** Narratives are unique per crawl + tone (not content-hash-deduplicable)
- **Tone pairs stored independently:** Switching tone is instant after initial generation
- **Version history:** Regeneration bumps version, old versions pruned after 30 days

### Model Selection

- **Pro tier:** Haiku (cost efficiency)
- **Agency tier:** Sonnet (premium quality)
- **Regeneration with custom instructions:** Sonnet regardless of tier

## Error Handling

- **Partial failure:** Narrative marked `ready` with failed sections omitted. UI shows per-section retry.
- **Full failure:** Status `failed`, user sees retry button.
- **Rate limiting:** Max 3 regenerations per section per hour.
- **Timeout:** 30 seconds per section.

## Dependencies

- `@anthropic-ai/sdk` (existing)
- `@tiptap/react` + `@tiptap/starter-kit` (new — Phase 3)
- `packages/db` (new table + queries)
- `packages/shared` (new types)
- `packages/api` (new routes)
