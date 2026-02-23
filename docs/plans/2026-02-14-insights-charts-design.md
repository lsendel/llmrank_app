# Insights Charts Design

## Overview

Add 7 data visualization components inspired by RustySEO's charting patterns, adapted for LLM Rank's AI-first SEO platform. Full-stack: new API endpoints + Recharts-based frontend components.

## Architecture Decision

**Single insights endpoint** (`GET /api/crawls/:id/insights`) returns all lightweight aggregations in one response. Two additional endpoints for heavier/different-lifecycle data (crawler timeline, issue heatmap).

Rationale: Workers benefit from fewer cold starts, all chart data derives from the same crawl, and a single SWR call prevents loading waterfalls.

## API Endpoints

### 1. `GET /api/crawls/:crawlId/insights`

Returns aggregated analytics for a completed crawl.

```typescript
interface CrawlInsights {
  issueDistribution: {
    bySeverity: { severity: string; count: number }[];
    byCategory: { category: string; count: number }[];
    total: number;
  };
  scoreRadar: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  };
  gradeDistribution: {
    grade: string;
    count: number;
    percentage: number;
  }[];
  contentRatio: {
    avgWordCount: number;
    avgHtmlToTextRatio: number;
    pagesAboveThreshold: number;
    totalPages: number;
  };
  crawlProgress: {
    found: number;
    crawled: number;
    scored: number;
    errored: number;
    status: string;
  };
}
```

SQL approach: fan out 4 queries in parallel using `Promise.all`:

- `SELECT severity, COUNT(*) FROM issues WHERE job_id = ? GROUP BY severity`
- `SELECT letter_grade, COUNT(*) FROM page_scores WHERE job_id = ? GROUP BY letter_grade`
- `SELECT AVG(word_count), COUNT(*) FROM pages WHERE crawl_id = ?`
- Crawl progress from `crawl_jobs` row

### 2. `GET /api/logs/:projectId/crawler-timeline`

Returns time-series data of AI crawler hits parsed from uploaded server logs.

```typescript
interface CrawlerTimelinePoint {
  timestamp: string; // ISO date (bucketed by hour or day)
  gptbot: number;
  claudebot: number;
  perplexitybot: number;
  googlebot: number;
  bingbot: number;
  other: number;
}
```

Query param: `?range=7d|30d|90d|all` (default 30d)

### 3. `GET /api/crawls/:crawlId/issue-heatmap`

Returns per-page issue matrix for the heatmap visualization.

```typescript
interface IssueHeatmapData {
  categories: string[]; // column headers
  pages: {
    url: string;
    pageId: string;
    issues: Record<string, "critical" | "warning" | "info" | "pass">;
  }[];
}
```

Limited to top 50 pages sorted by issue count descending.

## Frontend Components

All in `apps/web/src/components/charts/`.

| Component                      | Chart Type        | Library             | Props                                              |
| ------------------------------ | ----------------- | ------------------- | -------------------------------------------------- |
| `issue-distribution-chart.tsx` | Donut             | Recharts PieChart   | `{ bySeverity, byCategory, total }`                |
| `score-radar-chart.tsx`        | Spider            | Recharts RadarChart | `{ technical, content, aiReadiness, performance }` |
| `grade-distribution-chart.tsx` | Horizontal Bar    | Recharts BarChart   | `{ grades[] }`                                     |
| `content-ratio-gauge.tsx`      | Half-circle gauge | Custom SVG          | `{ ratio, threshold }`                             |
| `crawl-progress-chart.tsx`     | Donut             | Recharts PieChart   | `{ found, crawled, scored, errored }`              |
| `crawler-timeline-chart.tsx`   | Stacked Area      | Recharts AreaChart  | `{ data[], range }`                                |
| `issue-heatmap.tsx`            | Grid              | Custom divs         | `{ categories, pages[] }`                          |

### Design Patterns (from RustySEO)

- Every chart wrapped in shadcn `Card` with `CardHeader`/`CardContent`/`CardFooter`
- Footer contains **actionable context** (e.g., "23 pages missing schema markup")
- Color thresholds: green (good) / amber (warning) / red (critical)
- Tooltips on hover with formatted values
- Empty states with helpful messaging
- Dark mode support via CSS variables

## UI Placement

| Chart                    | Location                                        | When Visible               |
| ------------------------ | ----------------------------------------------- | -------------------------- |
| Issue Distribution Donut | Overview tab, below Quick Wins                  | After crawl completes      |
| Grade Distribution Bar   | Overview tab, between AI Summary and Quick Wins | After crawl completes      |
| Score Radar              | Page detail, Overview tab (beside ScoreCircle)  | When page has scores       |
| Content Ratio Gauge      | Page detail, Content tab                        | When extracted data exists |
| Crawl Progress Donut     | Crawl detail page, replaces text status         | During/after crawl         |
| AI Crawler Timeline      | Strategy tab, new section                       | When log uploads exist     |
| Issue Heatmap            | Issues tab, above issue cards                   | After crawl completes      |

## Data Flow

```
Project Overview Tab
  └─ useApiSWR("insights-{crawlId}")
       └─ GET /api/crawls/:id/insights
            ├─ <IssueDistributionChart />
            ├─ <GradeDistributionChart />
            └─ <CrawlProgressChart />

Page Detail
  └─ Uses existing page score data (no new endpoint)
       ├─ <ScoreRadarChart />
       └─ <ContentRatioGauge />

Strategy Tab
  └─ useApiSWR("crawler-timeline-{projectId}")
       └─ GET /api/logs/:projectId/crawler-timeline
            └─ <CrawlerTimelineChart />

Issues Tab
  └─ useApiSWR("issue-heatmap-{crawlId}")
       └─ GET /api/crawls/:crawlId/issue-heatmap
            └─ <IssueHeatmap />
```

## Implementation Order

1. API: insights service + route (covers charts 1, 3, 4, 5)
2. Frontend: Issue Distribution Donut + Grade Distribution Bar (highest visual impact)
3. Frontend: Score Radar + Content Ratio Gauge (page-level, use existing data)
4. API: issue-heatmap endpoint + frontend component
5. Frontend: Crawl Progress Donut (replaces text on crawl page)
6. API: crawler-timeline endpoint + frontend component
7. Integration: wire all charts into their tab locations
8. Tests: API service tests + component smoke tests
