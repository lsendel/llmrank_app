# Insights Charts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 7 data visualization charts (Issue Distribution Donut, Score Radar, Grade Distribution Bar, Content Ratio Gauge, Crawl Progress Donut, AI Crawler Timeline, Issue Heatmap) with a full-stack approach: new API endpoints + Recharts frontend components.

**Architecture:** A single `GET /api/crawls/:id/insights` endpoint returns aggregated chart data (issue distribution, grade distribution, content ratio, crawl progress) in one response. Two additional endpoints serve the crawler timeline (`GET /api/logs/:projectId/crawler-timeline`) and issue heatmap (`GET /api/crawls/:id/issue-heatmap`). Frontend components use Recharts (already installed) in shadcn Card wrappers.

**Tech Stack:** Hono (API routes), Drizzle ORM (SQL queries), Recharts (charts), shadcn/ui Card (wrappers), Vitest (tests).

---

## Task 1: Insights Service — Core Aggregation Logic

**Files:**

- Create: `apps/api/src/services/insights-service.ts`
- Test: `apps/api/src/__tests__/services/insights-service.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/api/src/__tests__/services/insights-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInsightsService } from "../../services/insights-service";
import {
  createMockCrawlRepo,
  createMockProjectRepo,
  createMockUserRepo,
  createMockScoreRepo,
  createMockPageRepo,
} from "../helpers/mock-repositories";
import {
  buildProject,
  buildUser,
  buildCrawlJob,
  buildScore,
} from "../helpers/factories";

describe("InsightsService", () => {
  let crawls: ReturnType<typeof createMockCrawlRepo>;
  let projects: ReturnType<typeof createMockProjectRepo>;
  let users: ReturnType<typeof createMockUserRepo>;
  let scores: ReturnType<typeof createMockScoreRepo>;
  let pages: ReturnType<typeof createMockPageRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    projects = createMockProjectRepo({
      getById: vi.fn().mockResolvedValue(buildProject()),
    });
    users = createMockUserRepo({
      getById: vi.fn().mockResolvedValue(buildUser()),
    });
    crawls = createMockCrawlRepo({
      getById: vi
        .fn()
        .mockResolvedValue(
          buildCrawlJob({
            status: "complete",
            pagesFound: 10,
            pagesCrawled: 10,
            pagesScored: 10,
          }),
        ),
    });
    scores = createMockScoreRepo({
      listByJob: vi
        .fn()
        .mockResolvedValue([
          buildScore({
            overallScore: 95,
            technicalScore: 90,
            contentScore: 85,
            aiReadinessScore: 92,
          }),
          buildScore({
            id: "s2",
            pageId: "p2",
            overallScore: 72,
            technicalScore: 65,
            contentScore: 70,
            aiReadinessScore: 68,
          }),
          buildScore({
            id: "s3",
            pageId: "p3",
            overallScore: 55,
            technicalScore: 50,
            contentScore: 60,
            aiReadinessScore: 45,
          }),
        ]),
      getIssuesByJob: vi.fn().mockResolvedValue([
        {
          id: "i1",
          pageId: "p1",
          jobId: "crawl-1",
          category: "technical",
          severity: "critical",
          code: "MISSING_TITLE",
          message: "m",
        },
        {
          id: "i2",
          pageId: "p2",
          jobId: "crawl-1",
          category: "content",
          severity: "warning",
          code: "LOW_WORD_COUNT",
          message: "m",
        },
        {
          id: "i3",
          pageId: "p2",
          jobId: "crawl-1",
          category: "technical",
          severity: "critical",
          code: "HTTP_ERROR",
          message: "m",
        },
      ]),
    });
    pages = createMockPageRepo({
      listByJob: vi.fn().mockResolvedValue([
        {
          id: "p1",
          jobId: "crawl-1",
          wordCount: 1200,
          url: "https://example.com/",
        },
        {
          id: "p2",
          jobId: "crawl-1",
          wordCount: 300,
          url: "https://example.com/about",
        },
        {
          id: "p3",
          jobId: "crawl-1",
          wordCount: 800,
          url: "https://example.com/blog",
        },
      ]),
    });
  });

  describe("getInsights", () => {
    it("returns issue distribution grouped by severity and category", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        users,
        scores,
        pages,
      });
      const result = await service.getInsights("user-1", "crawl-1");

      expect(result.issueDistribution.total).toBe(3);
      expect(result.issueDistribution.bySeverity).toContainEqual({
        severity: "critical",
        count: 2,
      });
      expect(result.issueDistribution.bySeverity).toContainEqual({
        severity: "warning",
        count: 1,
      });
      expect(result.issueDistribution.byCategory).toContainEqual({
        category: "technical",
        count: 2,
      });
      expect(result.issueDistribution.byCategory).toContainEqual({
        category: "content",
        count: 1,
      });
    });

    it("returns grade distribution with correct letter grades", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        users,
        scores,
        pages,
      });
      const result = await service.getInsights("user-1", "crawl-1");

      // 95 -> A, 72 -> B-, 55 -> D
      const grades = result.gradeDistribution.map((g) => g.grade);
      expect(grades).toContain("A");
      expect(grades).toContain("C");
      expect(grades).toContain("F");
      expect(result.gradeDistribution.reduce((s, g) => s + g.count, 0)).toBe(3);
    });

    it("returns score radar with averages across all pages", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        users,
        scores,
        pages,
      });
      const result = await service.getInsights("user-1", "crawl-1");

      // avg technical: (90+65+50)/3 ≈ 68
      expect(result.scoreRadar.technical).toBeCloseTo(68.3, 0);
      expect(result.scoreRadar.content).toBeCloseTo(71.7, 0);
    });

    it("returns content ratio with avg word count", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        users,
        scores,
        pages,
      });
      const result = await service.getInsights("user-1", "crawl-1");

      // avg: (1200+300+800)/3 ≈ 767
      expect(result.contentRatio.avgWordCount).toBeCloseTo(766.7, 0);
      expect(result.contentRatio.totalPages).toBe(3);
    });

    it("returns crawl progress from job data", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        users,
        scores,
        pages,
      });
      const result = await service.getInsights("user-1", "crawl-1");

      expect(result.crawlProgress.found).toBe(10);
      expect(result.crawlProgress.status).toBe("complete");
    });

    it("throws NOT_FOUND for non-existent crawl", async () => {
      crawls.getById.mockResolvedValue(null);
      const service = createInsightsService({
        crawls,
        projects,
        users,
        scores,
        pages,
      });
      await expect(service.getInsights("user-1", "crawl-1")).rejects.toThrow(
        "NOT_FOUND",
      );
    });

    it("throws NOT_FOUND if user does not own project", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createInsightsService({
        crawls,
        projects,
        users,
        scores,
        pages,
      });
      await expect(service.getInsights("user-1", "crawl-1")).rejects.toThrow();
    });
  });

  describe("getIssueHeatmap", () => {
    it("returns pages with per-category issue severity", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        users,
        scores,
        pages,
      });
      const result = await service.getIssueHeatmap("user-1", "crawl-1");

      expect(result.categories).toContain("technical");
      expect(result.categories).toContain("content");
      expect(result.pages.length).toBeGreaterThan(0);

      const page2 = result.pages.find((p) => p.pageId === "p2");
      expect(page2?.issues.technical).toBe("critical");
      expect(page2?.issues.content).toBe("warning");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter api exec vitest run src/__tests__/services/insights-service.test.ts`
Expected: FAIL — module not found

**Step 3: Write the insights service**

```typescript
// apps/api/src/services/insights-service.ts
import { ERROR_CODES } from "@llm-boost/shared";
import type {
  CrawlRepository,
  ProjectRepository,
  UserRepository,
  ScoreRepository,
  PageRepository,
} from "../repositories";
import { ServiceError } from "./errors";

export interface InsightsServiceDeps {
  crawls: CrawlRepository;
  projects: ProjectRepository;
  users: UserRepository;
  scores: ScoreRepository;
  pages: PageRepository;
}

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function createInsightsService(deps: InsightsServiceDeps) {
  async function assertAccess(userId: string, crawlId: string) {
    const crawl = await deps.crawls.getById(crawlId);
    if (!crawl) {
      throw new ServiceError("NOT_FOUND", 404, "Crawl not found");
    }
    const project = await deps.projects.getById(crawl.projectId);
    if (!project || project.userId !== userId) {
      throw new ServiceError("NOT_FOUND", 404, "Not found");
    }
    return { crawl, project };
  }

  return {
    async getInsights(userId: string, crawlId: string) {
      const { crawl } = await assertAccess(userId, crawlId);

      const [allScores, allIssues, allPages] = await Promise.all([
        deps.scores.listByJob(crawlId),
        deps.scores.getIssuesByJob(crawlId),
        deps.pages.listByJob(crawlId),
      ]);

      // Issue distribution
      const sevMap = new Map<string, number>();
      const catMap = new Map<string, number>();
      for (const issue of allIssues) {
        sevMap.set(issue.severity, (sevMap.get(issue.severity) ?? 0) + 1);
        catMap.set(issue.category, (catMap.get(issue.category) ?? 0) + 1);
      }

      // Grade distribution
      const gradeMap = new Map<string, number>();
      for (const score of allScores) {
        const g = letterGrade(score.overallScore);
        gradeMap.set(g, (gradeMap.get(g) ?? 0) + 1);
      }

      // Score radar (averages)
      const avg = (arr: (number | null)[]) => {
        const nums = arr.filter((n): n is number => n != null);
        return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      };

      // Content ratio
      const wordCounts = allPages.map((p) => p.wordCount ?? 0);
      const avgWordCount = wordCounts.length
        ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
        : 0;
      const GOOD_WORD_COUNT = 300;

      return {
        issueDistribution: {
          bySeverity: Array.from(sevMap, ([severity, count]) => ({
            severity,
            count,
          })),
          byCategory: Array.from(catMap, ([category, count]) => ({
            category,
            count,
          })),
          total: allIssues.length,
        },
        gradeDistribution: ["A", "B", "C", "D", "F"].map((grade) => ({
          grade,
          count: gradeMap.get(grade) ?? 0,
          percentage: allScores.length
            ? Math.round(((gradeMap.get(grade) ?? 0) / allScores.length) * 100)
            : 0,
        })),
        scoreRadar: {
          technical:
            Math.round(avg(allScores.map((s) => s.technicalScore)) * 10) / 10,
          content:
            Math.round(avg(allScores.map((s) => s.contentScore)) * 10) / 10,
          aiReadiness:
            Math.round(avg(allScores.map((s) => s.aiReadinessScore)) * 10) / 10,
          performance:
            Math.round(
              avg(
                allScores.map((s) =>
                  s.lighthousePerf != null ? s.lighthousePerf * 100 : null,
                ),
              ) * 10,
            ) / 10,
        },
        contentRatio: {
          avgWordCount: Math.round(avgWordCount * 10) / 10,
          avgHtmlToTextRatio: 0, // Requires raw HTML — stub for now
          pagesAboveThreshold: wordCounts.filter((w) => w >= GOOD_WORD_COUNT)
            .length,
          totalPages: allPages.length,
        },
        crawlProgress: {
          found: crawl.pagesFound,
          crawled: crawl.pagesCrawled,
          scored: crawl.pagesScored,
          errored: crawl.errorMessage ? 1 : 0,
          status: crawl.status,
        },
      };
    },

    async getIssueHeatmap(userId: string, crawlId: string) {
      await assertAccess(userId, crawlId);

      const [allIssues, allPages] = await Promise.all([
        deps.scores.getIssuesByJob(crawlId),
        deps.pages.listByJob(crawlId),
      ]);

      const categories = [...new Set(allIssues.map((i) => i.category))].sort();

      // Group issues by page, take worst severity per category
      const pageIssueMap = new Map<string, Map<string, string>>();
      for (const issue of allIssues) {
        if (!pageIssueMap.has(issue.pageId)) {
          pageIssueMap.set(issue.pageId, new Map());
        }
        const catMap = pageIssueMap.get(issue.pageId)!;
        const current = catMap.get(issue.category);
        if (!current || severityRank(issue.severity) > severityRank(current)) {
          catMap.set(issue.category, issue.severity);
        }
      }

      // Sort pages by issue count desc, limit to 50
      const pageIssueCounts = new Map<string, number>();
      for (const issue of allIssues) {
        pageIssueCounts.set(
          issue.pageId,
          (pageIssueCounts.get(issue.pageId) ?? 0) + 1,
        );
      }

      const sortedPages = allPages
        .sort(
          (a, b) =>
            (pageIssueCounts.get(b.id) ?? 0) - (pageIssueCounts.get(a.id) ?? 0),
        )
        .slice(0, 50);

      return {
        categories,
        pages: sortedPages.map((p) => {
          const catIssues = pageIssueMap.get(p.id) ?? new Map();
          const issues: Record<string, string> = {};
          for (const cat of categories) {
            issues[cat] = catIssues.get(cat) ?? "pass";
          }
          return { url: p.url, pageId: p.id, issues };
        }),
      };
    },
  };
}

function severityRank(sev: string): number {
  if (sev === "critical") return 3;
  if (sev === "warning") return 2;
  if (sev === "info") return 1;
  return 0;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter api exec vitest run src/__tests__/services/insights-service.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/api/src/services/insights-service.ts apps/api/src/__tests__/services/insights-service.test.ts
git commit -m "feat: add insights service with issue/grade/score aggregations"
```

---

## Task 2: Insights API Route

**Files:**

- Create: `apps/api/src/routes/insights.ts`
- Modify: `apps/api/src/index.ts` (add route mount)

**Step 1: Create the route file**

```typescript
// apps/api/src/routes/insights.ts
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  createCrawlRepository,
  createProjectRepository,
  createUserRepository,
  createScoreRepository,
  createPageRepository,
} from "../repositories";
import { createInsightsService } from "../services/insights-service";
import { handleServiceError } from "../services/errors";

export const insightsRoutes = new Hono<AppEnv>();

insightsRoutes.use("*", authMiddleware);

// GET /api/crawls/:crawlId/insights
insightsRoutes.get("/:crawlId/insights", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("crawlId");

  const service = createInsightsService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
    pages: createPageRepository(db),
  });

  try {
    const data = await service.getInsights(userId, crawlId);
    c.header("Cache-Control", "public, max-age=3600");
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/crawls/:crawlId/issue-heatmap
insightsRoutes.get("/:crawlId/issue-heatmap", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("crawlId");

  const service = createInsightsService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
    pages: createPageRepository(db),
  });

  try {
    const data = await service.getIssueHeatmap(userId, crawlId);
    c.header("Cache-Control", "public, max-age=3600");
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 2: Mount routes in index.ts**

Add import: `import { insightsRoutes } from "./routes/insights";`

Mount alongside existing crawl routes: `app.route("/api/crawls", insightsRoutes);`

Note: Since `crawlRoutes` is already mounted at `/api/crawls`, mount insights routes at the same base so URLs like `/api/crawls/:id/insights` work. Hono merges routes — the insights routes won't conflict because they have distinct path patterns (`/:crawlId/insights` vs `/:id`).

**Step 3: Run typecheck to verify**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter api exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/api/src/routes/insights.ts apps/api/src/index.ts
git commit -m "feat: add insights and issue-heatmap API routes"
```

---

## Task 3: Crawler Timeline API (Log Service Extension)

**Files:**

- Modify: `apps/api/src/services/log-service.ts` (add `getCrawlerTimeline` method)
- Modify: `apps/api/src/routes/logs.ts` (add route)
- Test: `apps/api/src/__tests__/services/insights-service.test.ts` (add timeline tests)

**Step 1: Write the failing test**

Add to `insights-service.test.ts` (or a new `log-timeline.test.ts`):

```typescript
describe("getCrawlerTimeline", () => {
  it("aggregates bot breakdown from log summaries into time series", async () => {
    const logRepo = createMockLogRepo({
      listByProject: vi.fn().mockResolvedValue([
        {
          id: "log-1",
          projectId: "proj-1",
          filename: "access.log",
          totalRequests: 100,
          crawlerRequests: 30,
          uniqueIPs: 50,
          summary: {
            totalRequests: 100,
            crawlerRequests: 30,
            uniqueIPs: 50,
            botBreakdown: [
              { bot: "GPTBot", count: 10 },
              { bot: "ClaudeBot", count: 8 },
              { bot: "PerplexityBot", count: 5 },
              { bot: "Googlebot", count: 7 },
            ],
            statusBreakdown: [],
            topPaths: [],
          },
          createdAt: new Date("2024-01-15"),
        },
      ]),
    });

    const service = createLogService({
      logs: logRepo,
      projects: createMockProjectRepo({
        getById: vi.fn().mockResolvedValue(buildProject()),
      }),
    });
    const timeline = await service.getCrawlerTimeline("user-1", "proj-1");

    expect(timeline.length).toBe(1);
    expect(timeline[0].gptbot).toBe(10);
    expect(timeline[0].claudebot).toBe(8);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter api exec vitest run src/__tests__/services/insights-service.test.ts`
Expected: FAIL — getCrawlerTimeline not defined

**Step 3: Add `getCrawlerTimeline` to log-service.ts**

Add this method to the return object in `createLogService`:

```typescript
async getCrawlerTimeline(userId: string, projectId: string) {
  await assertOwnership(userId, projectId);
  const uploads = await deps.logs.listByProject(projectId);

  return uploads.map((upload) => {
    const bots = (upload.summary as any)?.botBreakdown ?? [];
    const botMap: Record<string, number> = {};
    for (const b of bots) {
      const key = b.bot.toLowerCase().replace(/[^a-z]/g, "");
      botMap[key] = (botMap[key] ?? 0) + b.count;
    }
    return {
      timestamp: upload.createdAt,
      gptbot: botMap.gptbot ?? 0,
      claudebot: botMap.claudebot ?? 0,
      perplexitybot: botMap.perplexitybot ?? 0,
      googlebot: botMap.googlebot ?? 0,
      bingbot: botMap.bingbot ?? 0,
      other: Object.entries(botMap)
        .filter(([k]) => !["gptbot", "claudebot", "perplexitybot", "googlebot", "bingbot"].includes(k))
        .reduce((sum, [, v]) => sum + v, 0),
    };
  });
},
```

**Step 4: Add route to logs.ts**

```typescript
// GET /api/logs/:projectId/crawler-timeline
logRoutes.get("/:projectId/crawler-timeline", async (c) => {
  // ... same auth/service pattern as existing log routes
  const data = await service.getCrawlerTimeline(userId, projectId);
  return c.json({ data });
});
```

**Step 5: Run tests to verify they pass**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter api exec vitest run`
Expected: All PASS

**Step 6: Commit**

```bash
git add apps/api/src/services/log-service.ts apps/api/src/routes/logs.ts apps/api/src/__tests__/services/insights-service.test.ts
git commit -m "feat: add crawler timeline API endpoint"
```

---

## Task 4: Frontend API Client Extensions

**Files:**

- Modify: `apps/web/src/lib/api.ts` (add types + methods)

**Step 1: Add types and API methods**

Add these types after existing interfaces in `api.ts`:

```typescript
export interface CrawlInsights {
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

export interface IssueHeatmapData {
  categories: string[];
  pages: {
    url: string;
    pageId: string;
    issues: Record<string, string>;
  }[];
}

export interface CrawlerTimelinePoint {
  timestamp: string;
  gptbot: number;
  claudebot: number;
  perplexitybot: number;
  googlebot: number;
  bingbot: number;
  other: number;
}
```

Add API methods inside `api.crawls`:

```typescript
async getInsights(token: string, crawlId: string): Promise<CrawlInsights> {
  const res = await apiClient.get<ApiEnvelope<CrawlInsights>>(
    `/api/crawls/${crawlId}/insights`,
    { token },
  );
  return res.data;
},

async getIssueHeatmap(token: string, crawlId: string): Promise<IssueHeatmapData> {
  const res = await apiClient.get<ApiEnvelope<IssueHeatmapData>>(
    `/api/crawls/${crawlId}/issue-heatmap`,
    { token },
  );
  return res.data;
},
```

Add API method inside `api.logs`:

```typescript
async getCrawlerTimeline(token: string, projectId: string): Promise<CrawlerTimelinePoint[]> {
  const res = await apiClient.get<ApiEnvelope<CrawlerTimelinePoint[]>>(
    `/api/logs/${projectId}/crawler-timeline`,
    { token },
  );
  return res.data;
},
```

**Step 2: Run typecheck**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter web exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add insights, heatmap, timeline types and API methods"
```

---

## Task 5: Issue Distribution Donut Chart

**Files:**

- Create: `apps/web/src/components/charts/issue-distribution-chart.tsx`

**Step 1: Create the component**

```typescript
// apps/web/src/components/charts/issue-distribution-chart.tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "hsl(0, 84%, 60%)",     // red
  warning: "hsl(38, 92%, 50%)",     // amber
  info: "hsl(217, 91%, 60%)",       // blue
};

interface Props {
  bySeverity: { severity: string; count: number }[];
  byCategory: { category: string; count: number }[];
  total: number;
}

export function IssueDistributionChart({ bySeverity, byCategory, total }: Props) {
  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Issue Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No issues found — great job!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" />
          Issue Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={bySeverity}
              dataKey="count"
              nameKey="severity"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              strokeWidth={2}
            >
              {bySeverity.map((entry) => (
                <Cell
                  key={entry.severity}
                  fill={SEVERITY_COLORS[entry.severity] ?? "#888"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            {/* Center label */}
            <text x="50%" y="48%" textAnchor="middle" className="fill-foreground text-2xl font-bold">
              {total}
            </text>
            <text x="50%" y="58%" textAnchor="middle" className="fill-muted-foreground text-xs">
              issues
            </text>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {bySeverity.find((s) => s.severity === "critical")?.count ?? 0} critical
        {" · "}
        {bySeverity.find((s) => s.severity === "warning")?.count ?? 0} warnings
        {" · "}
        {byCategory.length} categories affected
      </CardFooter>
    </Card>
  );
}
```

**Step 2: Run typecheck**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter web exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/components/charts/issue-distribution-chart.tsx
git commit -m "feat: add issue distribution donut chart component"
```

---

## Task 6: Grade Distribution Bar Chart

**Files:**

- Create: `apps/web/src/components/charts/grade-distribution-chart.tsx`

**Step 1: Create the component**

```typescript
// apps/web/src/components/charts/grade-distribution-chart.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const GRADE_COLORS: Record<string, string> = {
  A: "hsl(142, 71%, 45%)",  // green
  B: "hsl(142, 50%, 55%)",  // light green
  C: "hsl(48, 96%, 53%)",   // yellow
  D: "hsl(25, 95%, 53%)",   // orange
  F: "hsl(0, 84%, 60%)",    // red
};

interface Props {
  grades: { grade: string; count: number; percentage: number }[];
}

export function GradeDistributionChart({ grades }: Props) {
  const total = grades.reduce((s, g) => s + g.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Grade Distribution
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {total} pages
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={grades} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="grade"
              tick={{ fontSize: 14, fontWeight: 600 }}
              width={30}
              className="fill-foreground"
            />
            <Tooltip
              formatter={(value: number, _name: string, props: any) => [
                `${value} pages (${props.payload.percentage}%)`,
                "Count",
              ]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
              {grades.map((entry) => (
                <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] ?? "#888"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/charts/grade-distribution-chart.tsx
git commit -m "feat: add grade distribution horizontal bar chart"
```

---

## Task 7: Score Radar Chart

**Files:**

- Create: `apps/web/src/components/charts/score-radar-chart.tsx`

**Step 1: Create the component**

```typescript
// apps/web/src/components/charts/score-radar-chart.tsx
"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crosshair } from "lucide-react";

interface Props {
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
  className?: string;
}

export function ScoreRadarChart({ technical, content, aiReadiness, performance, className }: Props) {
  const data = [
    { dimension: "Technical", score: technical, fullMark: 100 },
    { dimension: "Content", score: content, fullMark: 100 },
    { dimension: "AI Ready", score: aiReadiness, fullMark: 100 },
    { dimension: "Perf", score: performance, fullMark: 100 },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Crosshair className="h-4 w-4" />
          Score Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart data={data}>
            <PolarGrid className="stroke-muted" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              className="fill-muted-foreground"
            />
            <Radar
              dataKey="score"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
              dot={{ r: 4, fill: "hsl(var(--primary))" }}
            />
            <Tooltip
              formatter={(value: number) => [`${Math.round(value)} / 100`, "Score"]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/charts/score-radar-chart.tsx
git commit -m "feat: add score radar chart for 4 scoring dimensions"
```

---

## Task 8: Content Ratio Gauge

**Files:**

- Create: `apps/web/src/components/charts/content-ratio-gauge.tsx`

**Step 1: Create the component**

Uses SVG directly (matches existing `ScoreCircle` pattern — no extra library needed):

```typescript
// apps/web/src/components/charts/content-ratio-gauge.tsx
"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  avgWordCount: number;
  pagesAboveThreshold: number;
  totalPages: number;
}

export function ContentRatioGauge({ avgWordCount, pagesAboveThreshold, totalPages }: Props) {
  const percentage = totalPages > 0 ? Math.round((pagesAboveThreshold / totalPages) * 100) : 0;

  // Half-circle gauge via SVG arc
  const radius = 70;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (percentage / 100) * circumference;

  const color =
    percentage >= 80 ? "stroke-success" :
    percentage >= 50 ? "stroke-warning" :
    "stroke-destructive";

  const textColor =
    percentage >= 80 ? "text-success" :
    percentage >= 50 ? "text-warning" :
    "text-destructive";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Content Depth
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <svg width="180" height="100" viewBox="0 0 180 100">
          {/* Background arc */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-muted/30"
          />
          {/* Foreground arc */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={cn(color, "transition-all duration-1000")}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="-mt-6 text-center">
          <span className={cn("text-3xl font-bold", textColor)}>{percentage}%</span>
          <p className="text-xs text-muted-foreground mt-1">
            pages with 300+ words
          </p>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground justify-center">
        Avg. {Math.round(avgWordCount).toLocaleString()} words per page
      </CardFooter>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/charts/content-ratio-gauge.tsx
git commit -m "feat: add content ratio half-circle gauge"
```

---

## Task 9: Crawl Progress Donut

**Files:**

- Create: `apps/web/src/components/charts/crawl-progress-chart.tsx`

**Step 1: Create the component**

```typescript
// apps/web/src/components/charts/crawl-progress-chart.tsx
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";

const COLORS = {
  scored: "hsl(142, 71%, 45%)",    // green
  crawled: "hsl(217, 91%, 60%)",   // blue
  pending: "hsl(var(--muted))",    // gray
  errored: "hsl(0, 84%, 60%)",    // red
};

interface Props {
  found: number;
  crawled: number;
  scored: number;
  errored: number;
  status: string;
}

export function CrawlProgressChart({ found, crawled, scored, errored, status }: Props) {
  const pending = Math.max(0, found - crawled);
  const crawledNotScored = Math.max(0, crawled - scored - errored);
  const isActive = status !== "complete" && status !== "failed";

  const data = [
    { name: "Scored", value: scored },
    { name: "Crawled", value: crawledNotScored },
    { name: "Pending", value: pending },
    { name: "Errored", value: errored },
  ].filter((d) => d.value > 0);

  const colorMap: Record<string, string> = {
    Scored: COLORS.scored,
    Crawled: COLORS.crawled,
    Pending: COLORS.pending,
    Errored: COLORS.errored,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {isActive ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-success" />
          )}
          Crawl Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={colorMap[entry.name] ?? "#888"} />
              ))}
            </Pie>
            <text x="50%" y="46%" textAnchor="middle" className="fill-foreground text-2xl font-bold">
              {scored}/{found}
            </text>
            <text x="50%" y="56%" textAnchor="middle" className="fill-muted-foreground text-xs">
              scored
            </text>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/charts/crawl-progress-chart.tsx
git commit -m "feat: add crawl progress donut chart"
```

---

## Task 10: AI Crawler Timeline Chart

**Files:**

- Create: `apps/web/src/components/charts/crawler-timeline-chart.tsx`

**Step 1: Create the component**

```typescript
// apps/web/src/components/charts/crawler-timeline-chart.tsx
"use client";

import { useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot } from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type CrawlerTimelinePoint } from "@/lib/api";

const BOT_COLORS: Record<string, string> = {
  gptbot: "#10a37f",
  claudebot: "#d97706",
  perplexitybot: "#6366f1",
  googlebot: "#3b82f6",
  bingbot: "#ef4444",
  other: "#6b7280",
};

const BOT_LABELS: Record<string, string> = {
  gptbot: "GPTBot",
  claudebot: "ClaudeBot",
  perplexitybot: "PerplexityBot",
  googlebot: "Googlebot",
  bingbot: "Bingbot",
  other: "Other",
};

export function CrawlerTimelineChart({ projectId }: { projectId: string }) {
  const { data: timeline, isLoading } = useApiSWR<CrawlerTimelinePoint[]>(
    `crawler-timeline-${projectId}`,
    useCallback(
      (token: string) => api.logs.getCrawlerTimeline(token, projectId),
      [projectId],
    ),
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            AI Crawler Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading timeline...</p>
        </CardContent>
      </Card>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            AI Crawler Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Upload server logs to see which AI crawlers visit your site.
          </p>
        </CardContent>
      </Card>
    );
  }

  const bots = ["gptbot", "claudebot", "perplexitybot", "googlebot", "bingbot", "other"] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" />
          AI Crawler Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <Tooltip
              labelFormatter={(v) => new Date(v).toLocaleDateString()}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend formatter={(value: string) => BOT_LABELS[value] ?? value} />
            {bots.map((bot) => (
              <Area
                key={bot}
                type="monotone"
                dataKey={bot}
                stackId="1"
                stroke={BOT_COLORS[bot]}
                fill={BOT_COLORS[bot]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/charts/crawler-timeline-chart.tsx
git commit -m "feat: add AI crawler timeline stacked area chart"
```

---

## Task 11: Issue Heatmap Component

**Files:**

- Create: `apps/web/src/components/charts/issue-heatmap.tsx`

**Step 1: Create the component**

```typescript
// apps/web/src/components/charts/issue-heatmap.tsx
"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type IssueHeatmapData } from "@/lib/api";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500",
  warning: "bg-amber-400",
  info: "bg-blue-400",
  pass: "bg-green-200 dark:bg-green-900",
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Tech",
  content: "Content",
  ai_readiness: "AI",
  performance: "Perf",
  schema: "Schema",
  llm_visibility: "LLM",
};

export function IssueHeatmap({ crawlId, projectId }: { crawlId: string; projectId: string }) {
  const { data: heatmap, isLoading } = useApiSWR<IssueHeatmapData>(
    `issue-heatmap-${crawlId}`,
    useCallback(
      (token: string) => api.crawls.getIssueHeatmap(token, crawlId),
      [crawlId],
    ),
  );

  if (isLoading || !heatmap || heatmap.pages.length === 0) {
    return null; // Don't render empty heatmap
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Grid3x3 className="h-4 w-4" />
          Issue Heatmap
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            Top {heatmap.pages.length} pages by issue count
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground pb-2 pr-4 min-w-[200px]">
                Page
              </th>
              {heatmap.categories.map((cat) => (
                <th key={cat} className="text-center font-medium text-muted-foreground pb-2 px-1 min-w-[50px]">
                  {CATEGORY_LABELS[cat] ?? cat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.pages.map((page) => (
              <tr key={page.pageId} className="border-t border-border">
                <td className="py-1.5 pr-4 truncate max-w-[250px]">
                  <Link
                    href={`/dashboard/projects/${projectId}/pages/${page.pageId}`}
                    className="hover:underline text-foreground"
                  >
                    {new URL(page.url).pathname}
                  </Link>
                </td>
                {heatmap.categories.map((cat) => (
                  <td key={cat} className="py-1.5 px-1 text-center">
                    <div
                      className={cn(
                        "mx-auto h-4 w-4 rounded-sm",
                        SEVERITY_STYLES[page.issues[cat] ?? "pass"],
                      )}
                      title={`${cat}: ${page.issues[cat] ?? "pass"}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/charts/issue-heatmap.tsx
git commit -m "feat: add issue heatmap grid component"
```

---

## Task 12: Wire Charts Into Dashboard Tabs

**Files:**

- Modify: `apps/web/src/components/tabs/overview-tab.tsx` (add Issue Donut + Grade Bar)
- Modify: `apps/web/src/components/tabs/issues-tab.tsx` (add Issue Heatmap above cards)
- Modify: `apps/web/src/components/tabs/strategy-tab.tsx` (add Crawler Timeline)
- Modify: `apps/web/src/app/dashboard/projects/[id]/pages/[pageId]/page.tsx` (add Score Radar + Content Gauge)
- Modify: `apps/web/src/app/dashboard/crawl/[id]/page.tsx` (add Crawl Progress)

**Step 1: Add insights data fetching to the overview tab**

In `overview-tab.tsx`, add a `useApiSWR` call for insights and render `<IssueDistributionChart>` and `<GradeDistributionChart>` between the AI Summary and Quick Wins sections.

```typescript
// Add import
import { IssueDistributionChart } from "@/components/charts/issue-distribution-chart";
import { GradeDistributionChart } from "@/components/charts/grade-distribution-chart";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type CrawlInsights } from "@/lib/api";
import { useCallback } from "react";

// Inside OverviewTab, after latestCrawl check:
const { data: insights } = useApiSWR<CrawlInsights>(
  latestCrawl?.id ? `insights-${latestCrawl.id}` : null,
  useCallback(
    (token: string) => api.crawls.getInsights(token, latestCrawl!.id),
    [latestCrawl?.id],
  ),
);

// Add after AI Summary card, before Quick Wins:
{insights && (
  <div className="grid gap-6 md:grid-cols-2">
    <IssueDistributionChart
      bySeverity={insights.issueDistribution.bySeverity}
      byCategory={insights.issueDistribution.byCategory}
      total={insights.issueDistribution.total}
    />
    <GradeDistributionChart grades={insights.gradeDistribution} />
  </div>
)}
```

**Step 2: Add Issue Heatmap to issues tab**

In `issues-tab.tsx`, add `crawlId` and `projectId` props, render `<IssueHeatmap>` above filters.

```typescript
import { IssueHeatmap } from "@/components/charts/issue-heatmap";

// Add to component before the filter buttons:
<IssueHeatmap crawlId={crawlId} projectId={projectId} />
```

**Step 3: Add Score Radar to page detail overview**

In page detail `page.tsx`, add `<ScoreRadarChart>` alongside the existing ScoreCircle in the overview tab grid.

```typescript
import { ScoreRadarChart } from "@/components/charts/score-radar-chart";

// Replace the simple ScoreCircle card with a grid that includes radar:
<div className="grid gap-6 lg:grid-cols-[auto_auto_1fr]">
  <Card className="flex items-center justify-center p-8">
    <ScoreCircle score={page.score.overallScore} size={160} label="Overall Score" />
  </Card>
  <ScoreRadarChart
    technical={page.score.technicalScore ?? 0}
    content={page.score.contentScore ?? 0}
    aiReadiness={page.score.aiReadinessScore ?? 0}
    performance={(detail.performanceScore as number) ?? 0}
  />
  {/* existing category breakdown card */}
</div>
```

**Step 4: Add Content Ratio Gauge to page detail content tab**

```typescript
import { ContentRatioGauge } from "@/components/charts/content-ratio-gauge";

// Add at the top of Content tab, before Heading Hierarchy:
<ContentRatioGauge
  avgWordCount={page.wordCount ?? 0}
  pagesAboveThreshold={page.wordCount && page.wordCount >= 300 ? 1 : 0}
  totalPages={1}
/>
```

**Step 5: Add Crawler Timeline to strategy tab**

```typescript
import { CrawlerTimelineChart } from "@/components/charts/crawler-timeline-chart";

// Add before Topic Cluster Map:
<CrawlerTimelineChart projectId={projectId} />
```

**Step 6: Add Crawl Progress to crawl detail page**

In `apps/web/src/app/dashboard/crawl/[id]/page.tsx`, add `<CrawlProgressChart>`.

```typescript
import { CrawlProgressChart } from "@/components/charts/crawl-progress-chart";

// Add in the crawl detail view:
<CrawlProgressChart
  found={crawl.pagesFound}
  crawled={crawl.pagesCrawled}
  scored={crawl.pagesScored}
  errored={crawl.pagesErrored}
  status={crawl.status}
/>
```

**Step 7: Run typecheck**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm typecheck`
Expected: No errors

**Step 8: Commit**

```bash
git add apps/web/src/components/tabs/overview-tab.tsx apps/web/src/components/tabs/issues-tab.tsx apps/web/src/components/tabs/strategy-tab.tsx apps/web/src/app/dashboard/projects/[id]/pages/[pageId]/page.tsx apps/web/src/app/dashboard/crawl/[id]/page.tsx
git commit -m "feat: wire all 7 insight charts into dashboard tabs"
```

---

## Task 13: Final Typecheck and Test Run

**Step 1: Run all tests**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm test`
Expected: All passing

**Step 2: Run full typecheck**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm typecheck`
Expected: No errors

**Step 3: Verify build**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm build`
Expected: Build succeeds

---

## Summary

| Task | What                      | Files                                 |
| ---- | ------------------------- | ------------------------------------- |
| 1    | Insights service + tests  | `services/insights-service.ts`, test  |
| 2    | Insights API routes       | `routes/insights.ts`, `index.ts`      |
| 3    | Crawler timeline API      | `log-service.ts`, `routes/logs.ts`    |
| 4    | Frontend API client types | `api.ts`                              |
| 5    | Issue Distribution Donut  | `charts/issue-distribution-chart.tsx` |
| 6    | Grade Distribution Bar    | `charts/grade-distribution-chart.tsx` |
| 7    | Score Radar               | `charts/score-radar-chart.tsx`        |
| 8    | Content Ratio Gauge       | `charts/content-ratio-gauge.tsx`      |
| 9    | Crawl Progress Donut      | `charts/crawl-progress-chart.tsx`     |
| 10   | Crawler Timeline          | `charts/crawler-timeline-chart.tsx`   |
| 11   | Issue Heatmap             | `charts/issue-heatmap.tsx`            |
| 12   | Wire into dashboard       | 5 tab/page files                      |
| 13   | Verify build              | typecheck + tests                     |
