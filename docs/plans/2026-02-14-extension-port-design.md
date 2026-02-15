# Design: Port LLMRank Extension Components to SaaS

**Date:** 2026-02-14
**Source:** `/Users/lsendel/Projects/llm` (Chrome Extension, `@llmrank/*`)
**Target:** `/Users/lsendel/Projects/LLMRank_app` (SaaS, `@llm-boost/*`)

## Context

The LLMRank Chrome Extension is a client-side content analyzer with a more mature scoring system (7 categories, content-type adaptive, 5 per-platform scores) than the SaaS (4 categories, single score). Both share the same product vision. This design ports the extension's valuable components into the SaaS architecture.

## Current State Comparison

| Aspect                 | Extension                                                                             | SaaS                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Scoring categories     | 7 (structure, readability, authority, freshness, citation, technical, infrastructure) | 4 (technical, content, ai-readiness, performance)    |
| Platform scores        | 5 per-platform weighted (ChatGPT, Perplexity, Claude, Gemini, Grok)                   | Single overall                                       |
| Recommendations        | 20+ templates with effort/impact/steps/examples                                       | Issues with code + message                           |
| Content type detection | 10 types, adaptive scoring profiles                                                   | None                                                 |
| Input                  | Raw text + HTML (client-side parsing)                                                 | `PageData` with pre-extracted data from Rust crawler |

## Components to Port

### 1. Platform-Specific Scoring (Priority: Highest)

**What:** Research-validated weights for 5 LLM platforms (680M+ citation analysis). Each platform weights factor categories differently (e.g., ChatGPT: authority 42%, structure 22%; Perplexity: freshness 28%, technical 20%).

**Source files:**

- `packages/scoring/src/platforms.ts` — weight tables, `calculatePlatformScores()`
- `packages/types/src/index.ts` — `LLMPlatform`, `PlatformScore`, `PlatformWeights`

**Adaptation:**

- Map extension's 7 categories to SaaS's 4 category scores as inputs
- Mapping: structure → content, readability → content, authority → ai-readiness, freshness → content, citation → ai-readiness, technical → technical, infrastructure → ai-readiness
- Create `packages/scoring/src/platforms.ts` with adapted weights
- Add `platform_scores` jsonb column to `page_scores` table

**Output shape:**

```ts
interface PlatformScores {
  chatgpt: { score: number; grade: string; tips: string[] };
  perplexity: { score: number; grade: string; tips: string[] };
  claude: { score: number; grade: string; tips: string[] };
  gemini: { score: number; grade: string; tips: string[] };
  grok: { score: number; grade: string; tips: string[] };
}
```

### 2. Recommendation Engine (Priority: High)

**What:** 20+ structured recommendation templates with priority, effort, impact, before/after examples, estimated score improvements, and step-by-step instructions.

**Source files:**

- `packages/scoring/src/recommendations.ts` — templates, `generateRecommendations()`
- `packages/types/src/index.ts` — `Recommendation`, `RecommendationPriority`, etc.

**Adaptation:**

- Map extension factor IDs to SaaS `Issue` codes as triggers
- Port template data (title, description, steps, examples, effort, impact)
- Add `recommendations` jsonb column to `page_scores` or keep as computed output
- API: include recommendations in page score response

**Trigger mapping examples:**

- Extension `structure-heading-hierarchy` maxScore 70 → SaaS `MISSING_H1` or `HEADING_HIERARCHY`
- Extension `add-author-info` → SaaS `MISSING_AUTHOR` (new issue code if needed)

### 3. Content-Type Detection (Priority: Medium-High)

**What:** Detect page type (Blog, Encyclopedia, Academic, News, etc.) from URL patterns, schema markup, and semantic signals. Use for adaptive scoring.

**Source files:**

- `packages/scoring/src/utils/content-type-detector.ts` — detection logic
- `packages/scoring/src/config/content-type-profiles.ts` — per-type scoring profiles

**Adaptation:**

- Port URL pattern matching (works as-is with page URL)
- Port schema-based detection (SaaS has `extracted.schema_types`)
- Add `content_type` column to `pages` table
- Optionally use content-type profiles to adjust factor weights

### 4. New Factor Analyzers (Priority: Medium)

Port scoring heuristics (not HTML parsing) from these extension modules:

**Authority** (`factors/authority.ts` + `brand-recognition.ts`):

- E-E-A-T signals: author detection, credential keywords
- Brand recognition: domain tier classification
- External citation quality scoring
- Adapt: use `extracted.structured_data` and `extracted.external_links`

**Freshness** (`factors/freshness.ts`):

- Publication/update date detection
- Temporal reference scoring
- Content staleness signals
- Adapt: use `extracted.structured_data` for dates, page metadata

**Readability** (`factors/readability.ts`):

- Flesch-Kincaid grade level calculation
- Sentence length analysis
- Paragraph structure scoring
- Adapt: needs word-level text; may use `extracted.text_content` or word count

**Comprehensiveness** (`factors/comprehensiveness.ts`):

- Content depth and coverage analysis
- Adapt: use heading count, word count, section analysis from extracted data

These would be added as sub-factors within existing SaaS categories or as new standalone factors.

### 5. LLMs.txt Generator (Priority: Medium-Low)

**What:** Generate llms.txt files per the llmstxt.org specification.

**Source files:**

- `packages/scoring/src/llms-txt.ts`

**Adaptation:**

- Port as utility in `apps/api/src/services/`
- New endpoint: `POST /api/projects/:id/llms-txt`
- Gate behind Starter+ plans
- No DB changes needed (generates on demand)

### 6. Platform Tips (Priority: Low, Easy)

**What:** Pre-written optimization advice per platform.

**Source:** `PLATFORM_TIPS` constant in `platforms.ts`

**Adaptation:** Port as static data, display alongside platform scores in UI.

## What NOT to Port

- Chrome extension UI, manifest, service worker
- HTML parser (`utils/html-parser.ts`) — Rust crawler already extracts this
- Service worker caching — SaaS uses Cloudflare KV
- Local AI rewrites (`window.ai` / Gemini Nano) — Chrome-only
- Achievement/gamification system — not needed for SaaS
- Playwright E2E tests — different architecture

## Key Technical Decision

**Extension analyzers take `(content: string, html?: string)` and re-parse HTML.**
**SaaS has `PageData.extracted` with pre-parsed data from the Rust crawler.**

We port the **scoring logic and heuristics**, adapting input signatures to consume `PageData` / `ExtractedData`. We do NOT port the HTML parsing code.

## Database Changes

```sql
-- Add to pages table
ALTER TABLE pages ADD COLUMN content_type TEXT DEFAULT 'unknown';

-- Add to page_scores table
ALTER TABLE page_scores ADD COLUMN platform_scores JSONB;
ALTER TABLE page_scores ADD COLUMN recommendations JSONB;
```

## API Changes

- `GET /api/pages/:id/scores` — include `platformScores` and `recommendations` in response
- `POST /api/projects/:id/llms-txt` — new endpoint (Starter+)

## Frontend Changes

- Page detail view: add platform score breakdown cards (5 platforms)
- Page detail view: add recommendations tab with steps/examples
- Project overview: show dominant content type
- Strategy tab: use platform scores for insights
