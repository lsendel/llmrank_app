# Report Generation System Design

**Date:** 2026-02-15
**Status:** Approved
**Author:** Claude + User

## Overview

Comprehensive report generation system for LLM Boost that produces expert-level SEO/AI-readiness reports in PDF and Word formats. Two report types (Executive Summary and Detailed Technical), stored on Cloudflare R2, generated via a dedicated Queue Worker.

## Goals

1. Delight customers with actionable, expert-level AI-readiness insights
2. Support two report types: concise executive summary and deep technical analysis
3. Output PDF and DOCX formats
4. Store reports on Cloudflare R2 with signed download URLs
5. Include historical trend analysis across crawls
6. Support branding customization (default LLM Boost + optional custom logo/colors)
7. Include competitor analysis and integration data (GSC/GA4/Clarity)
8. Provide ROI estimates for each recommendation

## Report Types

### 1. Executive Summary Report (2-4 pages)

| Section             | Content                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Cover Page          | Logo, project name, domain, report date, "Prepared for [Client]"                                |
| Overall Score       | Score circle with grade, AI-generated executive summary paragraph                               |
| Category Scorecard  | 4 categories (Technical/Content/AI Readiness/Performance) with scores, grades, mini radar chart |
| Top 5 Quick Wins    | Highest-impact fixes with effort estimates and ROI projections                                  |
| Score Trend         | Line chart showing score progression across last N crawls                                       |
| Visibility Snapshot | Share-of-voice bars across ChatGPT/Claude/Perplexity/Gemini                                     |
| Footer              | Branding, generation date                                                                       |

### 2. Detailed Technical Report (10-50+ pages)

Everything in Executive Summary, plus:

| Section                | Content                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Score Breakdown        | Full category-by-category analysis with individual factor scores                                                              |
| Issue Catalog          | All issues grouped by severity then category, with recommendations and code snippets                                          |
| Page-Level Analysis    | Top 20 worst-scoring pages with individual scores and issues                                                                  |
| Issue Heatmap          | Pages x categories matrix with severity color coding                                                                          |
| Content Health         | Word count distribution, LLM quality dimensions chart (clarity, authority, comprehensiveness, structure, citation_worthiness) |
| AI Readiness Deep-Dive | llms.txt status, crawler access audit, structured data coverage                                                               |
| Platform Opportunities | Per-LLM-platform analysis with specific optimization tips                                                                     |
| Competitor Analysis    | Competitor citations by platform, gap identification, competitive positioning                                                 |
| Integration Data       | GSC (queries, impressions, clicks), GA4 (bounce rate, engagement), Clarity (UX scores) — when connected                       |
| Historical Trends      | Multi-crawl comparison tables and charts for all categories                                                                   |
| Action Plan            | 4-tier prioritized roadmap with ROI estimates (see below)                                                                     |
| Appendix               | Full page listing with scores, glossary of SEO/AI terms                                                                       |

## Action Plan Structure

### Priority 1: Critical Fixes (This Week)

- Severity=critical issues, grouped by effort
- Each item: issue description, affected pages count, step-by-step fix, estimated score impact, ROI estimate

### Priority 2: Quick Wins (This Month)

- High-impact + low-effort from ROI Quick Wins engine
- Grouped by category, includes code snippets (meta tags, schema markup, etc.)

### Priority 3: Strategic Improvements (Quarterly)

- Content quality improvements from LLM scoring dimensions
- Platform-specific visibility optimization per LLM
- Integration recommendations

### Priority 4: Long-Term Excellence

- Competitive positioning strategies
- Content gap analysis
- Advanced schema markup strategies

### ROI Estimation Model

Each recommendation includes estimated impact:

- **Score Impact:** Estimated points improvement (from scoring engine deduction weights)
- **Page Reach:** Number of affected pages
- **Visibility Impact:** Estimated change in AI citation probability
- **Traffic Estimate:** When GSC data available, project traffic improvement based on current impressions
- **Revenue Proxy:** When available, based on avg. page value from GA4

Assumptions clearly stated in report footnotes.

## Architecture

```
User clicks "Generate Report"
        |
        v
+---------------------------+
| Hono API (apps/api)       |
| POST /reports/generate    |
| - Validates plan limits   |
| - Creates report record   |
| - Enqueues job to CF Queue|
+------------+--------------+
             | Cloudflare Queue
             v
+---------------------------+
| Report Worker             |
| (apps/report-worker)      |
| - Fetches all analytics   |
| - Aggregates data         |
| - Renders PDF via         |
|   @react-pdf/renderer     |
| - Renders DOCX via docx   |
| - Uploads to R2           |
| - Updates report status   |
+------------+--------------+
             |
             v
+---------------------------+
| Cloudflare R2             |
| reports/{projectId}/      |
|   {reportId}.pdf          |
|   {reportId}.docx         |
+---------------------------+
             |
             v
+---------------------------+
| Download via signed URL   |
| GET /reports/:id/download |
+---------------------------+
```

### API Endpoints

| Method | Path                    | Description                         |
| ------ | ----------------------- | ----------------------------------- |
| POST   | `/reports/generate`     | Request report generation (enqueue) |
| GET    | `/reports`              | List reports for a project          |
| GET    | `/reports/:id`          | Get report status and metadata      |
| GET    | `/reports/:id/download` | Get signed R2 download URL          |
| DELETE | `/reports/:id`          | Delete a report                     |

### Request Body: POST /reports/generate

```json
{
  "projectId": "uuid",
  "crawlJobId": "uuid",
  "type": "summary | detailed",
  "format": "pdf | docx",
  "config": {
    "compareCrawlIds": ["uuid", "uuid"],
    "brandingLogoUrl": "https://...",
    "brandingColor": "#4F46E5",
    "preparedFor": "Client Name",
    "includeSections": ["all"]
  }
}
```

## Database

### New Table: `reports`

| Column      | Type                                            | Description                              |
| ----------- | ----------------------------------------------- | ---------------------------------------- |
| id          | UUID PK                                         | Report ID                                |
| projectId   | UUID FK                                         | Project reference                        |
| crawlJobId  | UUID FK                                         | Primary crawl for this report            |
| userId      | UUID FK                                         | User who requested                       |
| type        | enum('summary','detailed')                      | Report type                              |
| format      | enum('pdf','docx')                              | Output format                            |
| status      | enum('queued','generating','complete','failed') | Generation status                        |
| r2Key       | text                                            | R2 object key                            |
| fileSize    | integer                                         | File size in bytes                       |
| config      | JSONB                                           | Branding, sections, comparison crawl IDs |
| error       | text                                            | Error message if failed                  |
| generatedAt | timestamp                                       | When generation completed                |
| expiresAt   | timestamp                                       | Auto-cleanup date (30 days)              |
| createdAt   | timestamp                                       | Record creation                          |

### New Enums

- `reportTypeEnum`: 'summary', 'detailed'
- `reportFormatEnum`: 'pdf', 'docx'
- `reportStatusEnum`: 'queued', 'generating', 'complete', 'failed'

## Plan Limits

| Resource           | Free         | Starter       | Pro            | Agency           |
| ------------------ | ------------ | ------------- | -------------- | ---------------- |
| Reports/month      | 1 summary    | 5 any         | 20 any         | Unlimited        |
| Report types       | Summary only | Both          | Both           | Both             |
| Branding           | Default only | Default only  | Logo slot      | Full white-label |
| History depth      | Current only | Last 3 crawls | Last 10 crawls | All crawls       |
| Competitor section | No           | Basic         | Full           | Full             |
| Integration data   | No           | No            | Yes            | Yes              |

## Chart Rendering Strategy

PDF charts built with `@react-pdf/renderer` native SVG primitives (no DOM dependency):

- Score circles: SVG arc paths
- Bar charts: SVG rects with labels
- Radar charts: SVG polygons
- Line/trend charts: SVG polylines
- Pie/donut charts: SVG arc paths

For DOCX: render SVG charts to PNG via `sharp` or `resvg-js`, embed as images.

### Chart Components Needed

1. `PdfScoreCircle` — Animated-style score circle with grade
2. `PdfRadarChart` — 4-axis radar for category scores
3. `PdfBarChart` — Horizontal/vertical bars (grade distribution, issue counts)
4. `PdfLineChart` — Trend lines (score over time)
5. `PdfPieChart` — Issue distribution by severity
6. `PdfHeatmap` — Colored grid for page/category matrix
7. `PdfVisibilityBars` — Platform share-of-voice comparison

## Branding System

### Default (All Plans)

- LLM Boost logo in header
- Indigo/blue color scheme
- "Powered by LLM Boost" footer

### Custom (Pro: logo, Agency: full)

- Upload logo → stored in R2 at `branding/{projectId}/logo.{png|svg}`
- Primary color override (used in headers, score colors, chart accents)
- "Prepared for [Client Name]" on cover page
- Optional: remove "Powered by LLM Boost" (Agency only)

Configuration stored in project settings (`projects.settings` JSONB field or new `report_config` JSONB column).

## New Packages & Workers

### `packages/reports`

- `src/types.ts` — Report types, section definitions, config schemas
- `src/data-aggregator.ts` — Fetches and aggregates all data needed for a report
- `src/pdf/` — PDF template components
  - `templates/summary.tsx` — Executive summary layout
  - `templates/detailed.tsx` — Detailed report layout
  - `components/` — Reusable PDF components (charts, tables, headers)
- `src/docx/` — Word document builders
  - `templates/summary.ts` — Executive summary builder
  - `templates/detailed.ts` — Detailed report builder
- `src/charts/` — SVG chart renderers (shared between PDF and DOCX)
- `src/roi.ts` — ROI estimation engine
- `src/competitors.ts` — Competitor analysis aggregation

### `apps/report-worker`

- Cloudflare Worker consuming from Queue
- Bindings: R2 (reports bucket), Queue (consumer), DB (Neon)
- `wrangler.toml` configuration
- Handler: receives queue message → aggregates data → generates document → uploads to R2 → updates DB

## Frontend Changes

### New UI Components

- "Generate Report" button on project overview page
- Report type/format selection modal
- Report history list with status indicators and download links
- Branding configuration in project settings

### New Pages

- `/dashboard/projects/[id]/reports` — Report list and generation UI

## File Storage (R2)

### Key Pattern

```
reports/{projectId}/{reportId}/{filename}.{pdf|docx}
branding/{projectId}/logo.{png|svg}
```

### Lifecycle

- Reports auto-expire after 30 days (R2 lifecycle rule)
- Users can regenerate expired reports
- Download via signed URLs (1-hour expiry)

## Error Handling

- Queue retry: 3 attempts with exponential backoff
- Status tracking: `queued` → `generating` → `complete` | `failed`
- Failed reports show error message in UI with "Retry" button
- Timeout: Worker has 15-minute max execution time (Cloudflare Workers Unbound)

## Security

- Report access requires authenticated user who owns the project
- Signed R2 URLs expire after 1 hour
- Report config validated via Zod schema
- Plan limits enforced at API level before enqueuing

## Testing Strategy

- Unit tests for data aggregation, ROI calculations, chart math
- Integration tests for API endpoints (generate, list, download)
- Visual regression tests for PDF output (snapshot comparison)
- E2E test: generate summary report → verify R2 upload → download
