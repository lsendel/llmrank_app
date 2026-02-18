# Meta & Social Visibility Layer — Design Document

**Date:** 2026-02-18
**Approach:** Hybrid (Approach C) — New "Meta & Social" tab + OG health factors integrated into core page scoring

## Overview

Add a Meta-focused "visibility layer" to LLM Boost with three modules:

1. **OG Health Scoring** — Enhanced Open Graph validation with 5 new scoring factors feeding into the existing per-page scoring engine
2. **Meta AI Readiness Scorecard** — Claude-powered project-level analysis of entity clarity, topical focus, FAQ content, citeability, and social signals
3. **Social Entity Consistency** — Detect social profile links from crawled pages, flag missing profiles, and generate recommended bio/about copy for messaging alignment

All modules use the existing Claude/TypeScript stack (no Python service). Analysis runs through `packages/llm` with Claude Haiku.

## Module 1: OG Health Scoring

### New Scoring Factors

Added to the existing `meta_tags` scoring dimension in `packages/scoring`:

| Factor Code                  | Severity | Deduction | Trigger                                                                   |
| ---------------------------- | -------- | --------- | ------------------------------------------------------------------------- |
| `MISSING_OG_TAGS`            | info     | -5        | (existing — unchanged) Missing og:title/description/image                 |
| `OG_TITLE_MISMATCH`          | info     | -3        | og:title significantly differs from `<title>` (>60% Levenshtein distance) |
| `OG_DESC_TOO_SHORT`          | info     | -2        | og:description < 55 chars or > 200 chars                                  |
| `OG_IMAGE_MISSING_OR_BROKEN` | warning  | -5        | og:image URL returns non-200 or image < 200x200px                         |
| `OG_IMAGE_BAD_RATIO`         | info     | -2        | og:image aspect ratio not ~1.91:1 (Meta's recommended 1200x630)           |
| `OG_URL_MISMATCH`            | warning  | -3        | og:url doesn't match canonical URL                                        |

### Data Requirements

**New field on `ExtractedData`** (Rust crawler + TypeScript models):

```
og_image_meta: {
  width: number;
  height: number;
  status_code: number;
  content_type: string;
} | null
```

The Rust crawler sends a HEAD request to the `og:image` URL (with timeout) and captures response status + image dimensions. Only done when og:image is present.

### UI Integration

Each page detail view gets a **"Test in Meta"** button linking to:
`https://developers.facebook.com/tools/debug/?q={encodeURIComponent(page_url)}`

## Module 2: Meta AI Readiness Scorecard

### Analysis Dimensions

Project-level analysis (not per-page). Runs on-demand via button click.

| Dimension               | Score Range | Data Source                                        | What Claude Evaluates                                 |
| ----------------------- | ----------- | -------------------------------------------------- | ----------------------------------------------------- |
| Topical Clarity         | 0-100       | Page titles, H1s, meta descriptions                | Clear focused topic vs scattered subjects             |
| Entity Definition       | 0-100       | Schema Organization/Person/LocalBusiness + content | Brand clearly defined with name, category, services   |
| FAQ & Q&A Content       | 0-100       | Schema FAQPage/QAPage + H2 patterns                | Question-answer content AI can extract                |
| Content Citeability     | 0-100       | Existing LLM content scoring data                  | Structured for AI citation (claims, stats, authority) |
| Social Presence Signals | 0-100       | Detected social links from external_links          | Facebook/Instagram links present and discoverable     |

**Overall score** = average of 5 dimensions. Letter grade (A-F, same scale as AI Visibility Score).

### Execution Flow

1. User clicks "Analyze Meta AI Readiness"
2. API gathers latest crawl data: titles, H1s, meta descriptions, schema types, external links (~50 pages)
3. Single Claude Haiku call with structured prompt → returns JSON scorecard with scores + recommendations
4. Stored in `meta_ai_analyses` table
5. UI renders scorecard with dimension progress bars + prioritized recommendation list

### Cost

~1 Haiku call per analysis ≈ $0.001-0.003. Available on all tiers; frequency gated by plan limits if needed.

## Module 3: Social Entity Consistency

### Step 1: Social Link Detection (No LLM)

Pattern-match `external_links` across all crawled pages:

| Platform  | Pattern                                       | Extracts          |
| --------- | --------------------------------------------- | ----------------- |
| Facebook  | `facebook.com/*`, `fb.com/*`                  | Page/profile slug |
| Instagram | `instagram.com/*`                             | Handle            |
| X/Twitter | `twitter.com/*`, `x.com/*`                    | Handle            |
| LinkedIn  | `linkedin.com/company/*`, `linkedin.com/in/*` | Slug              |
| YouTube   | `youtube.com/*`, `youtube.com/@*`             | Channel           |
| TikTok    | `tiktok.com/@*`                               | Handle            |

Deduplicated at project level. Stored as `socialProfiles` in analysis results.

### Step 2: Missing Profile Recommendations (No LLM)

If zero Facebook or Instagram links detected → surface recommendation to add them to site footer.

### Step 3: Consistency Analysis (LLM, On-Demand)

Bundled with the Section 2 scorecard analysis (single Claude call handles both):

1. Gather from crawl: brand name (og:site_name or schema Organization.name), homepage description, services/categories
2. Claude prompt evaluates messaging consistency between site identity and social profile URLs
3. Returns: consistency score (0-100), flagged gaps, recommended bio/about copy per platform

**YAGNI:** We do NOT scrape actual social profiles. Claude evaluates based on what the website says and recommends what profiles should say.

## Database Changes

### New Table: `meta_ai_analyses`

```sql
CREATE TABLE meta_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL,
  grade VARCHAR(2) NOT NULL,
  dimension_scores JSONB NOT NULL,      -- { topicalClarity, entityDefinition, faqContent, citeability, socialSignals }
  recommendations JSONB NOT NULL,       -- prioritized list from Claude
  social_profiles JSONB NOT NULL,       -- detected: [{ platform, url, handle }]
  consistency_analysis JSONB,           -- { score, mismatches, recommendedCopy }
  analyzed_at TIMESTAMP DEFAULT NOW()
);
```

### New Issue Codes in `packages/shared`

5 new codes: `OG_TITLE_MISMATCH`, `OG_DESC_TOO_SHORT`, `OG_IMAGE_MISSING_OR_BROKEN`, `OG_IMAGE_BAD_RATIO`, `OG_URL_MISMATCH`

### ExtractedData Extension

New optional field `og_image_meta` on both Rust `ExtractedData` and TypeScript `ExtractedDataSchema`.

## API Routes

| Method | Path                                | Auth      | Description                                 |
| ------ | ----------------------------------- | --------- | ------------------------------------------- |
| POST   | `/api/meta-ai/:projectId/analyze`   | User auth | Trigger Claude analysis, store result       |
| GET    | `/api/meta-ai/:projectId/latest`    | User auth | Return latest analysis for project          |
| GET    | `/api/meta-ai/:projectId/og-issues` | User auth | Aggregate OG health issues from page_scores |

## UI: Meta & Social Tab

New tab on project dashboard with `Share2` icon from lucide-react. Placed after "AI Visibility".

### Layout

```
Row 1 (3 cards):
┌─────────────────────┬──────────────────────┬──────────────────────┐
│ Meta AI Readiness    │ OG Health Summary    │ Social Profiles      │
│ Score (0-100, grade) │ X/Y pages pass       │ Detected: FB, IG, X  │
│ [Analyze] button     │ Top issues list      │ Missing: LinkedIn     │
└─────────────────────┴──────────────────────┴──────────────────────┘

Row 2 (2 cards):
┌──────────────────────────────┬──────────────────────────────────────┐
│ OG Issues Table              │ Entity Consistency                   │
│ URL | og:title | og:image |  │ Brand name: ✓ consistent             │
│ status | "Test in Meta" link │ Description: ⚠ mismatch              │
│                              │ Recommended bios per platform        │
└──────────────────────────────┴──────────────────────────────────────┘

Row 3 (full width):
┌─────────────────────────────────────────────────────────────────────┐
│ Meta AI Readiness Breakdown                                         │
│ Topical Clarity  ████████░░ 78/100                                  │
│ Entity Definition ██████░░░░ 60/100                                 │
│ FAQ Content      ███░░░░░░░ 30/100                                  │
│ Citeability      ████████░░ 80/100                                  │
│ Social Signals   █████░░░░░ 50/100                                  │
│ Recommendations: (prioritized list)                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Architecture Summary

No new services or infrastructure. Everything runs through:

- **Rust crawler** — enhanced OG image HEAD request
- **packages/scoring** — 5 new OG factors in meta_tags dimension
- **packages/llm** — Claude Haiku prompt for readiness scorecard + consistency analysis
- **packages/db** — new `meta_ai_analyses` table
- **apps/api** — 3 new routes under `/api/meta-ai`
- **apps/web** — new "Meta & Social" tab component
