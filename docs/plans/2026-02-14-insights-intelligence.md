# Intelligence Fusion & Improvement Progress Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fuse 12+ data sources into cross-referenced intelligence, track improvement progress across crawls, and generate value-added suggestions that combine scoring + LLM + enrichment + visibility data.

**Architecture:** New `progress-service.ts` compares scores/issues across crawl jobs matched by URL. New `intelligence-service` methods fuse scoring + LLM + enrichments + visibility into composite insights computed on-the-fly (no new tables). Extended recommendation engine accepts optional enrichment data for ROI-weighted suggestions.

**Tech Stack:** TypeScript, Vitest, Hono, Drizzle ORM, Zod, existing repository pattern

**Depends on:** `2026-02-14-extension-port.md` (platform scores, recommendations, content type, strengths)

---

### Task 1: Progress Tracking Types & Schemas

**Files:**

- Modify: `packages/shared/src/schemas/scoring.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/__tests__/domain/progress.test.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/__tests__/domain/progress.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ProjectProgressSchema,
  PageProgressSchema,
  CategoryDeltaSchema,
} from "../../schemas/scoring";

describe("progress schemas", () => {
  it("validates a project progress response", () => {
    const data = {
      currentCrawlId: "c1",
      previousCrawlId: "c2",
      scoreDelta: 8,
      currentScore: 72,
      previousScore: 64,
      categoryDeltas: {
        technical: { current: 75, previous: 68, delta: 7 },
        content: { current: 80, previous: 70, delta: 10 },
        aiReadiness: { current: 65, previous: 60, delta: 5 },
        performance: { current: 70, previous: 62, delta: 8 },
      },
      issuesFixed: 12,
      issuesNew: 3,
      issuesPersisting: 18,
      gradeChanges: { improved: 5, regressed: 1, unchanged: 14 },
      velocity: 4.2,
      topImprovedPages: [
        { url: "https://example.com/a", delta: 15, current: 85 },
      ],
      topRegressedPages: [
        { url: "https://example.com/b", delta: -8, current: 52 },
      ],
    };
    expect(ProjectProgressSchema.safeParse(data).success).toBe(true);
  });

  it("validates a page progress entry", () => {
    const data = {
      url: "https://example.com/page",
      currentScore: 78,
      previousScore: 65,
      delta: 13,
      issuesFixed: ["MISSING_H1", "THIN_CONTENT"],
      issuesNew: ["MISSING_SCHEMA"],
      categoryDeltas: {
        technical: { current: 80, previous: 70, delta: 10 },
        content: { current: 85, previous: 60, delta: 25 },
        aiReadiness: { current: 70, previous: 65, delta: 5 },
        performance: { current: 75, previous: 70, delta: 5 },
      },
    };
    expect(PageProgressSchema.safeParse(data).success).toBe(true);
  });

  it("rejects category delta with missing fields", () => {
    const data = { current: 80 }; // missing previous and delta
    expect(CategoryDeltaSchema.safeParse(data).success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm vitest run packages/shared/src/__tests__/domain/progress.test.ts`
Expected: FAIL — `ProjectProgressSchema` not exported

**Step 3: Write the schemas**

Add to `packages/shared/src/schemas/scoring.ts`:

```ts
// --- Progress tracking schemas ---

export const CategoryDeltaSchema = z.object({
  current: z.number(),
  previous: z.number(),
  delta: z.number(),
});

export const PageProgressSchema = z.object({
  url: z.string(),
  currentScore: z.number(),
  previousScore: z.number(),
  delta: z.number(),
  issuesFixed: z.array(z.string()),
  issuesNew: z.array(z.string()),
  categoryDeltas: z.object({
    technical: CategoryDeltaSchema,
    content: CategoryDeltaSchema,
    aiReadiness: CategoryDeltaSchema,
    performance: CategoryDeltaSchema,
  }),
});

export const ProjectProgressSchema = z.object({
  currentCrawlId: z.string(),
  previousCrawlId: z.string(),
  scoreDelta: z.number(),
  currentScore: z.number(),
  previousScore: z.number(),
  categoryDeltas: z.object({
    technical: CategoryDeltaSchema,
    content: CategoryDeltaSchema,
    aiReadiness: CategoryDeltaSchema,
    performance: CategoryDeltaSchema,
  }),
  issuesFixed: z.number(),
  issuesNew: z.number(),
  issuesPersisting: z.number(),
  gradeChanges: z.object({
    improved: z.number(),
    regressed: z.number(),
    unchanged: z.number(),
  }),
  velocity: z.number(), // avg points gained per crawl
  topImprovedPages: z.array(
    z.object({ url: z.string(), delta: z.number(), current: z.number() }),
  ),
  topRegressedPages: z.array(
    z.object({ url: z.string(), delta: z.number(), current: z.number() }),
  ),
});

export type CategoryDelta = z.infer<typeof CategoryDeltaSchema>;
export type PageProgress = z.infer<typeof PageProgressSchema>;
export type ProjectProgress = z.infer<typeof ProjectProgressSchema>;
```

Verify `packages/shared/src/index.ts` already exports `"./schemas/scoring"` (it does).

**Step 4: Run test to verify it passes**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm vitest run packages/shared/src/__tests__/domain/progress.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/shared/src/schemas/scoring.ts packages/shared/src/__tests__/domain/progress.test.ts
git commit -m "feat(shared): add progress tracking Zod schemas"
```

---

### Task 2: Progress Tracking Service

**Files:**

- Create: `apps/api/src/services/progress-service.ts`
- Test: `apps/api/src/__tests__/services/progress-service.test.ts`

**Step 1: Write the failing test**

Create `apps/api/src/__tests__/services/progress-service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createProgressService } from "../../services/progress-service";
import type { ProjectProgressSchema } from "@llm-boost/shared";

// Minimal stubs matching repository interfaces
function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    crawls: {
      getById: vi.fn(),
      listByProject: vi.fn(),
      getLatestByProject: vi.fn(),
      ...overrides.crawls,
    },
    projects: {
      getById: vi.fn(),
      ...overrides.projects,
    },
    scores: {
      listByJob: vi.fn(),
      getIssuesByJob: vi.fn(),
      listByJobWithPages: vi.fn(),
      getByPageWithIssues: vi.fn(),
      createBatch: vi.fn(),
      createIssues: vi.fn(),
      ...overrides.scores,
    },
    pages: {
      listByJob: vi.fn(),
      getById: vi.fn(),
      createBatch: vi.fn(),
      ...overrides.pages,
    },
  };
}

describe("progress-service", () => {
  const userId = "u1";
  const projectId = "p1";

  it("computes score deltas between two crawls", async () => {
    const deps = makeDeps();
    deps.projects.getById.mockResolvedValue({ id: projectId, userId });
    deps.crawls.listByProject.mockResolvedValue([
      {
        id: "crawl-2",
        projectId,
        status: "complete",
        createdAt: new Date("2026-02-14"),
      },
      {
        id: "crawl-1",
        projectId,
        status: "complete",
        createdAt: new Date("2026-02-07"),
      },
    ]);

    // Current crawl (crawl-2) pages + scores
    deps.pages.listByJob.mockImplementation((jobId: string) => {
      if (jobId === "crawl-2")
        return Promise.resolve([
          {
            id: "pg-a2",
            url: "https://ex.com/a",
            jobId: "crawl-2",
            wordCount: 500,
          },
          {
            id: "pg-b2",
            url: "https://ex.com/b",
            jobId: "crawl-2",
            wordCount: 300,
          },
        ]);
      if (jobId === "crawl-1")
        return Promise.resolve([
          {
            id: "pg-a1",
            url: "https://ex.com/a",
            jobId: "crawl-1",
            wordCount: 450,
          },
          {
            id: "pg-b1",
            url: "https://ex.com/b",
            jobId: "crawl-1",
            wordCount: 300,
          },
        ]);
      return Promise.resolve([]);
    });

    deps.scores.listByJob.mockImplementation((jobId: string) => {
      if (jobId === "crawl-2")
        return Promise.resolve([
          {
            pageId: "pg-a2",
            overallScore: 80,
            technicalScore: 85,
            contentScore: 82,
            aiReadinessScore: 75,
            lighthousePerf: 0.7,
          },
          {
            pageId: "pg-b2",
            overallScore: 60,
            technicalScore: 65,
            contentScore: 58,
            aiReadinessScore: 55,
            lighthousePerf: 0.6,
          },
        ]);
      if (jobId === "crawl-1")
        return Promise.resolve([
          {
            pageId: "pg-a1",
            overallScore: 65,
            technicalScore: 70,
            contentScore: 60,
            aiReadinessScore: 65,
            lighthousePerf: 0.5,
          },
          {
            pageId: "pg-b1",
            overallScore: 55,
            technicalScore: 60,
            contentScore: 52,
            aiReadinessScore: 50,
            lighthousePerf: 0.5,
          },
        ]);
      return Promise.resolve([]);
    });

    deps.scores.getIssuesByJob.mockImplementation((jobId: string) => {
      if (jobId === "crawl-2")
        return Promise.resolve([
          {
            pageId: "pg-a2",
            code: "MISSING_SCHEMA",
            category: "technical",
            severity: "warning",
          },
        ]);
      if (jobId === "crawl-1")
        return Promise.resolve([
          {
            pageId: "pg-a1",
            code: "MISSING_H1",
            category: "content",
            severity: "critical",
          },
          {
            pageId: "pg-a1",
            code: "MISSING_SCHEMA",
            category: "technical",
            severity: "warning",
          },
          {
            pageId: "pg-b1",
            code: "THIN_CONTENT",
            category: "content",
            severity: "warning",
          },
        ]);
      return Promise.resolve([]);
    });

    const service = createProgressService(deps as any);
    const result = await service.getProjectProgress(userId, projectId);

    // Score deltas
    expect(result.currentCrawlId).toBe("crawl-2");
    expect(result.previousCrawlId).toBe("crawl-1");
    expect(result.currentScore).toBe(70); // avg(80, 60)
    expect(result.previousScore).toBe(60); // avg(65, 55)
    expect(result.scoreDelta).toBe(10);

    // Issue tracking: crawl-1 had MISSING_H1, MISSING_SCHEMA, THIN_CONTENT
    // crawl-2 has only MISSING_SCHEMA → MISSING_H1 fixed, THIN_CONTENT fixed
    expect(result.issuesFixed).toBe(2); // MISSING_H1 + THIN_CONTENT
    expect(result.issuesNew).toBe(0);
    expect(result.issuesPersisting).toBe(1); // MISSING_SCHEMA

    // Top improved pages
    expect(result.topImprovedPages[0].url).toBe("https://ex.com/a");
    expect(result.topImprovedPages[0].delta).toBe(15);
  });

  it("returns null when only one crawl exists", async () => {
    const deps = makeDeps();
    deps.projects.getById.mockResolvedValue({ id: projectId, userId });
    deps.crawls.listByProject.mockResolvedValue([
      { id: "crawl-1", projectId, status: "complete", createdAt: new Date() },
    ]);

    const service = createProgressService(deps as any);
    const result = await service.getProjectProgress(userId, projectId);
    expect(result).toBeNull();
  });

  it("throws NOT_FOUND for wrong user", async () => {
    const deps = makeDeps();
    deps.projects.getById.mockResolvedValue({
      id: projectId,
      userId: "other-user",
    });

    const service = createProgressService(deps as any);
    await expect(
      service.getProjectProgress(userId, projectId),
    ).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm vitest run apps/api/src/__tests__/services/progress-service.test.ts`
Expected: FAIL — module `../../services/progress-service` not found

**Step 3: Implement the progress service**

Create `apps/api/src/services/progress-service.ts`:

```ts
import type {
  CrawlRepository,
  ProjectRepository,
  ScoreRepository,
  PageRepository,
} from "../repositories";
import { ServiceError } from "./errors";

export interface ProgressServiceDeps {
  crawls: CrawlRepository;
  projects: ProjectRepository;
  scores: ScoreRepository;
  pages: PageRepository;
}

function avg(nums: number[]): number {
  return nums.length
    ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
    : 0;
}

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function createProgressService(deps: ProgressServiceDeps) {
  async function assertAccess(userId: string, projectId: string) {
    const project = await deps.projects.getById(projectId);
    if (!project || project.userId !== userId) {
      throw new ServiceError("NOT_FOUND", 404, "Project not found");
    }
    return project;
  }

  return {
    async getProjectProgress(userId: string, projectId: string) {
      await assertAccess(userId, projectId);

      // Get last two completed crawls
      const allCrawls = await deps.crawls.listByProject(projectId);
      const completedCrawls = allCrawls
        .filter((c: any) => c.status === "complete")
        .slice(0, 2); // already sorted desc by createdAt

      if (completedCrawls.length < 2) return null;

      const [current, previous] = completedCrawls;

      // Parallel fetch: scores, issues, and pages for both crawls
      const [
        currentScores,
        previousScores,
        currentIssues,
        previousIssues,
        currentPages,
        previousPages,
      ] = await Promise.all([
        deps.scores.listByJob(current.id),
        deps.scores.listByJob(previous.id),
        deps.scores.getIssuesByJob(current.id),
        deps.scores.getIssuesByJob(previous.id),
        deps.pages.listByJob(current.id),
        deps.pages.listByJob(previous.id),
      ]);

      // Build URL→score maps for matching pages across crawls
      const currentPageUrlMap = new Map(
        currentPages.map((p: any) => [p.id, p.url]),
      );
      const previousPageUrlMap = new Map(
        previousPages.map((p: any) => [p.id, p.url]),
      );

      const currentScoreByUrl = new Map<string, any>();
      for (const s of currentScores) {
        const url = currentPageUrlMap.get(s.pageId);
        if (url) currentScoreByUrl.set(url, s);
      }

      const previousScoreByUrl = new Map<string, any>();
      for (const s of previousScores) {
        const url = previousPageUrlMap.get(s.pageId);
        if (url) previousScoreByUrl.set(url, s);
      }

      // Compute overall score averages
      const currentAvg = avg(currentScores.map((s: any) => s.overallScore));
      const previousAvg = avg(previousScores.map((s: any) => s.overallScore));

      // Category averages
      const catAvg = (scores: any[], field: string) =>
        avg(scores.map((s: any) => s[field]).filter((v: any) => v != null));

      const categoryDeltas = {
        technical: {
          current: catAvg(currentScores, "technicalScore"),
          previous: catAvg(previousScores, "technicalScore"),
          delta:
            catAvg(currentScores, "technicalScore") -
            catAvg(previousScores, "technicalScore"),
        },
        content: {
          current: catAvg(currentScores, "contentScore"),
          previous: catAvg(previousScores, "contentScore"),
          delta:
            catAvg(currentScores, "contentScore") -
            catAvg(previousScores, "contentScore"),
        },
        aiReadiness: {
          current: catAvg(currentScores, "aiReadinessScore"),
          previous: catAvg(previousScores, "aiReadinessScore"),
          delta:
            catAvg(currentScores, "aiReadinessScore") -
            catAvg(previousScores, "aiReadinessScore"),
        },
        performance: {
          current:
            catAvg(currentScores, "lighthousePerf") != null
              ? Math.round(catAvg(currentScores, "lighthousePerf") || 0)
              : 0,
          previous:
            catAvg(previousScores, "lighthousePerf") != null
              ? Math.round(catAvg(previousScores, "lighthousePerf") || 0)
              : 0,
          delta: 0,
        },
      };
      categoryDeltas.performance.delta =
        categoryDeltas.performance.current -
        categoryDeltas.performance.previous;

      // Issue tracking: match by issue code + URL across crawls
      const previousIssuesByUrl = new Map<string, Set<string>>();
      for (const issue of previousIssues) {
        const url = previousPageUrlMap.get(issue.pageId);
        if (!url) continue;
        if (!previousIssuesByUrl.has(url))
          previousIssuesByUrl.set(url, new Set());
        previousIssuesByUrl.get(url)!.add(issue.code);
      }

      const currentIssuesByUrl = new Map<string, Set<string>>();
      for (const issue of currentIssues) {
        const url = currentPageUrlMap.get(issue.pageId);
        if (!url) continue;
        if (!currentIssuesByUrl.has(url))
          currentIssuesByUrl.set(url, new Set());
        currentIssuesByUrl.get(url)!.add(issue.code);
      }

      // Flatten all unique issue codes per crawl (global)
      const allPreviousCodes = new Set<string>();
      for (const codes of previousIssuesByUrl.values()) {
        for (const c of codes) allPreviousCodes.add(c);
      }
      const allCurrentCodes = new Set<string>();
      for (const codes of currentIssuesByUrl.values()) {
        for (const c of codes) allCurrentCodes.add(c);
      }

      // Count issue instances (code@url pairs) for fixed/new/persisting
      let issuesFixed = 0;
      let issuesNew = 0;
      let issuesPersisting = 0;

      // Check each URL that exists in previous crawl
      const allUrls = new Set([
        ...previousIssuesByUrl.keys(),
        ...currentIssuesByUrl.keys(),
      ]);
      for (const url of allUrls) {
        const prev = previousIssuesByUrl.get(url) ?? new Set();
        const curr = currentIssuesByUrl.get(url) ?? new Set();
        for (const code of prev) {
          if (curr.has(code)) issuesPersisting++;
          else issuesFixed++;
        }
        for (const code of curr) {
          if (!prev.has(code)) issuesNew++;
        }
      }

      // Grade changes: compare matched pages
      let improved = 0;
      let regressed = 0;
      let unchanged = 0;

      const pageDeltas: { url: string; delta: number; current: number }[] = [];

      for (const [url, currScore] of currentScoreByUrl) {
        const prevScore = previousScoreByUrl.get(url);
        if (!prevScore) continue;
        const d = currScore.overallScore - prevScore.overallScore;
        pageDeltas.push({ url, delta: d, current: currScore.overallScore });

        const currGrade = letterGrade(currScore.overallScore);
        const prevGrade = letterGrade(prevScore.overallScore);
        if (currGrade < prevGrade)
          improved++; // A < B alphabetically
        else if (currGrade > prevGrade) regressed++;
        else unchanged++;
      }

      // Sort for top improved / regressed
      const sorted = [...pageDeltas].sort((a, b) => b.delta - a.delta);
      const topImproved = sorted.filter((p) => p.delta > 0).slice(0, 5);
      const topRegressed = sorted.filter((p) => p.delta < 0).slice(0, 5);

      // Velocity: average score improvement across all completed crawls
      // Simplified: (current - previous) / 1 = delta per crawl
      const velocity = Math.round((currentAvg - previousAvg) * 10) / 10;

      return {
        currentCrawlId: current.id,
        previousCrawlId: previous.id,
        scoreDelta: currentAvg - previousAvg,
        currentScore: currentAvg,
        previousScore: previousAvg,
        categoryDeltas,
        issuesFixed,
        issuesNew,
        issuesPersisting,
        gradeChanges: { improved, regressed, unchanged },
        velocity,
        topImprovedPages: topImproved,
        topRegressedPages: topRegressed,
      };
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm vitest run apps/api/src/__tests__/services/progress-service.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add apps/api/src/services/progress-service.ts apps/api/src/__tests__/services/progress-service.test.ts
git commit -m "feat(api): add progress tracking service with cross-crawl comparison"
```

---

### Task 3: Progress Tracking API Route

**Files:**

- Modify: `apps/api/src/routes/projects.ts`
- Modify: `apps/api/src/index.ts` (if needed for new route mounting)

**Step 1: Add the route handler**

Add to `apps/api/src/routes/projects.ts` (after the DELETE handler, before closing):

```ts
import { createProgressService } from "../services/progress-service";
import { createPageRepository } from "../repositories";

// ---------------------------------------------------------------------------
// GET /:id/progress — Cross-crawl improvement progress
// ---------------------------------------------------------------------------

projectRoutes.get("/:id/progress", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const service = createProgressService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    scores: createScoreRepository(db),
    pages: createPageRepository(db),
  });

  try {
    const data = await service.getProjectProgress(userId, projectId);
    if (!data) {
      return c.json({
        data: null,
        message: "Need at least 2 completed crawls",
      });
    }
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

Note: `createPageRepository` may already be imported — check and add to the existing import statement if not already present.

**Step 2: Verify the route loads**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter @llm-boost/api typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add apps/api/src/routes/projects.ts
git commit -m "feat(api): add GET /api/projects/:id/progress endpoint"
```

---

### Task 4: Intelligence Fusion Types

**Files:**

- Modify: `packages/shared/src/schemas/scoring.ts`
- Test: `packages/shared/src/__tests__/domain/intelligence.test.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/__tests__/domain/intelligence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  PlatformOpportunitySchema,
  CitationReadinessSchema,
  FusedInsightsSchema,
} from "../../schemas/scoring";

describe("intelligence fusion schemas", () => {
  it("validates platform opportunity", () => {
    const data = {
      platform: "chatgpt",
      currentScore: 72,
      opportunityScore: 18, // how much room to improve
      topTips: ["Add structured FAQ schema", "Increase authority signals"],
      visibilityRate: 0.35, // 35% of visibility checks mention brand
    };
    expect(PlatformOpportunitySchema.safeParse(data).success).toBe(true);
  });

  it("validates citation readiness", () => {
    const data = {
      score: 78,
      components: {
        factCitability: 82,
        llmCitationWorthiness: 75,
        schemaQuality: 80,
        structuredDataCount: 4,
      },
      topCitableFacts: [
        {
          content: "AI SEO tools reduce optimization time by 60%",
          citabilityScore: 92,
        },
      ],
    };
    expect(CitationReadinessSchema.safeParse(data).success).toBe(true);
  });

  it("validates full fused insights", () => {
    const data = {
      aiVisibilityReadiness: 68,
      platformOpportunities: [
        {
          platform: "perplexity",
          currentScore: 58,
          opportunityScore: 32,
          topTips: ["Add publication dates", "Improve freshness signals"],
          visibilityRate: null,
        },
      ],
      contentHealthMatrix: {
        scoring: 72,
        llmQuality: 78,
        engagement: null, // no GA4 data
        uxQuality: null, // no Clarity data
      },
      roiQuickWins: [
        {
          issueCode: "MISSING_SCHEMA",
          scoreImpact: 8,
          estimatedTrafficImpact: 1200,
          effort: "low",
          affectedPages: 5,
        },
      ],
    };
    expect(FusedInsightsSchema.safeParse(data).success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm vitest run packages/shared/src/__tests__/domain/intelligence.test.ts`
Expected: FAIL — schemas not exported

**Step 3: Add the schemas**

Add to `packages/shared/src/schemas/scoring.ts`:

```ts
// --- Intelligence fusion schemas ---

export const PlatformOpportunitySchema = z.object({
  platform: z.string(),
  currentScore: z.number(),
  opportunityScore: z.number(), // 100 - currentScore
  topTips: z.array(z.string()),
  visibilityRate: z.number().nullable(), // null if no visibility data
});

export const CitationReadinessSchema = z.object({
  score: z.number(),
  components: z.object({
    factCitability: z.number(),
    llmCitationWorthiness: z.number(),
    schemaQuality: z.number(),
    structuredDataCount: z.number(),
  }),
  topCitableFacts: z.array(
    z.object({
      content: z.string(),
      citabilityScore: z.number(),
    }),
  ),
});

export const ROIQuickWinSchema = z.object({
  issueCode: z.string(),
  scoreImpact: z.number(),
  estimatedTrafficImpact: z.number().nullable(), // null if no GSC data
  effort: z.enum(["low", "medium", "high"]),
  affectedPages: z.number(),
});

export const ContentHealthMatrixSchema = z.object({
  scoring: z.number(),
  llmQuality: z.number().nullable(),
  engagement: z.number().nullable(), // from GA4
  uxQuality: z.number().nullable(), // from Clarity
});

export const FusedInsightsSchema = z.object({
  aiVisibilityReadiness: z.number(),
  platformOpportunities: z.array(PlatformOpportunitySchema),
  contentHealthMatrix: ContentHealthMatrixSchema,
  roiQuickWins: z.array(ROIQuickWinSchema),
});

export type PlatformOpportunity = z.infer<typeof PlatformOpportunitySchema>;
export type CitationReadiness = z.infer<typeof CitationReadinessSchema>;
export type ROIQuickWin = z.infer<typeof ROIQuickWinSchema>;
export type ContentHealthMatrix = z.infer<typeof ContentHealthMatrixSchema>;
export type FusedInsights = z.infer<typeof FusedInsightsSchema>;
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm vitest run packages/shared/src/__tests__/domain/intelligence.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/shared/src/schemas/scoring.ts packages/shared/src/__tests__/domain/intelligence.test.ts
git commit -m "feat(shared): add intelligence fusion Zod schemas"
```

---

### Task 5: Intelligence Fusion Service

**Files:**

- Create: `apps/api/src/services/intelligence-service.ts`
- Test: `apps/api/src/__tests__/services/intelligence-service.test.ts`

Note: There is already an `insights-service.ts` (for chart data: issue distribution, grade distribution, etc.). This new service is `intelligence-service.ts` — it produces cross-source fused intelligence. They are complementary, not overlapping.

**Step 1: Write the failing test**

Create `apps/api/src/__tests__/services/intelligence-service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createIntelligenceService } from "../../services/intelligence-service";

function makeDeps(overrides: Record<string, any> = {}) {
  return {
    crawls: {
      getById: vi.fn(),
      getLatestByProject: vi.fn(),
      ...overrides.crawls,
    },
    projects: {
      getById: vi.fn(),
      ...overrides.projects,
    },
    scores: {
      listByJob: vi.fn(),
      listByJobWithPages: vi.fn(),
      getIssuesByJob: vi.fn(),
      getByPageWithIssues: vi.fn(),
      createBatch: vi.fn(),
      createIssues: vi.fn(),
      ...overrides.scores,
    },
    pages: {
      listByJob: vi.fn(),
      getById: vi.fn(),
      createBatch: vi.fn(),
      ...overrides.pages,
    },
    enrichments: {
      listByPage: vi.fn().mockResolvedValue([]),
      ...overrides.enrichments,
    },
    visibility: {
      listByProject: vi.fn().mockResolvedValue([]),
      getTrends: vi.fn().mockResolvedValue([]),
      ...overrides.visibility,
    },
  };
}

describe("intelligence-service", () => {
  const userId = "u1";
  const crawlId = "c1";
  const projectId = "p1";

  it("computes AI visibility readiness from scoring + LLM data", async () => {
    const deps = makeDeps();
    deps.crawls.getById.mockResolvedValue({ id: crawlId, projectId });
    deps.projects.getById.mockResolvedValue({ id: projectId, userId });
    deps.scores.listByJob.mockResolvedValue([
      {
        pageId: "pg1",
        overallScore: 75,
        technicalScore: 80,
        contentScore: 78,
        aiReadinessScore: 70,
        lighthousePerf: 0.65,
        detail: {
          llmContentScores: {
            clarity: 80,
            authority: 70,
            comprehensiveness: 75,
            structure: 85,
            citation_worthiness: 72,
          },
        },
      },
    ]);
    deps.scores.getIssuesByJob.mockResolvedValue([
      {
        pageId: "pg1",
        code: "MISSING_SCHEMA",
        category: "technical",
        severity: "warning",
      },
    ]);
    deps.pages.listByJob.mockResolvedValue([
      { id: "pg1", url: "https://ex.com/a", wordCount: 800 },
    ]);

    const service = createIntelligenceService(deps as any);
    const result = await service.getFusedInsights(userId, crawlId);

    expect(result.aiVisibilityReadiness).toBeGreaterThan(0);
    expect(result.aiVisibilityReadiness).toBeLessThanOrEqual(100);
    expect(result.contentHealthMatrix.scoring).toBe(75);
    expect(result.contentHealthMatrix.llmQuality).toBeGreaterThan(0);
    expect(result.contentHealthMatrix.engagement).toBeNull(); // no GA4 data
    expect(result.roiQuickWins.length).toBeGreaterThan(0);
    expect(result.roiQuickWins[0].issueCode).toBe("MISSING_SCHEMA");
  });

  it("includes platform opportunities when platform scores exist", async () => {
    const deps = makeDeps();
    deps.crawls.getById.mockResolvedValue({ id: crawlId, projectId });
    deps.projects.getById.mockResolvedValue({ id: projectId, userId });
    deps.scores.listByJob.mockResolvedValue([
      {
        pageId: "pg1",
        overallScore: 72,
        technicalScore: 75,
        contentScore: 70,
        aiReadinessScore: 68,
        lighthousePerf: 0.6,
        platformScores: {
          chatgpt: { score: 78, grade: "C", tips: ["Improve authority"] },
          perplexity: {
            score: 55,
            grade: "F",
            tips: ["Add dates", "Add citations"],
          },
          claude: { score: 72, grade: "C", tips: ["Better structure"] },
          gemini: { score: 80, grade: "B", tips: [] },
          grok: { score: 60, grade: "D", tips: ["Add freshness"] },
        },
        detail: {},
      },
    ]);
    deps.scores.getIssuesByJob.mockResolvedValue([]);
    deps.pages.listByJob.mockResolvedValue([
      { id: "pg1", url: "https://ex.com/a", wordCount: 1000 },
    ]);

    const service = createIntelligenceService(deps as any);
    const result = await service.getFusedInsights(userId, crawlId);

    expect(result.platformOpportunities.length).toBe(5);
    // Perplexity should have highest opportunity (lowest score)
    const perplexity = result.platformOpportunities.find(
      (p: any) => p.platform === "perplexity",
    );
    expect(perplexity).toBeDefined();
    expect(perplexity!.opportunityScore).toBe(45); // 100 - 55
    expect(perplexity!.topTips.length).toBeGreaterThan(0);
  });

  it("gracefully handles missing enrichment data", async () => {
    const deps = makeDeps();
    deps.crawls.getById.mockResolvedValue({ id: crawlId, projectId });
    deps.projects.getById.mockResolvedValue({ id: projectId, userId });
    deps.scores.listByJob.mockResolvedValue([
      {
        pageId: "pg1",
        overallScore: 70,
        technicalScore: 72,
        contentScore: 68,
        aiReadinessScore: 65,
        lighthousePerf: 0.6,
        detail: {},
      },
    ]);
    deps.scores.getIssuesByJob.mockResolvedValue([]);
    deps.pages.listByJob.mockResolvedValue([
      { id: "pg1", url: "https://ex.com/a", wordCount: 500 },
    ]);
    // enrichments.listByPage returns [] (no data)
    // visibility returns [] (no data)

    const service = createIntelligenceService(deps as any);
    const result = await service.getFusedInsights(userId, crawlId);

    // Should still work — nullable fields are null
    expect(result.contentHealthMatrix.engagement).toBeNull();
    expect(result.contentHealthMatrix.uxQuality).toBeNull();
    expect(result.platformOpportunities.length).toBe(0); // no platform scores
    expect(result.roiQuickWins.length).toBe(0); // no issues
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm vitest run apps/api/src/__tests__/services/intelligence-service.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the intelligence service**

Create `apps/api/src/services/intelligence-service.ts`:

```ts
import { ISSUE_DEFINITIONS } from "@llm-boost/shared";
import type {
  CrawlRepository,
  ProjectRepository,
  ScoreRepository,
  PageRepository,
  EnrichmentRepository,
  VisibilityRepository,
} from "../repositories";
import { ServiceError } from "./errors";

export interface IntelligenceServiceDeps {
  crawls: CrawlRepository;
  projects: ProjectRepository;
  scores: ScoreRepository;
  pages: PageRepository;
  enrichments: EnrichmentRepository;
  visibility: VisibilityRepository;
}

function avg(nums: number[]): number {
  return nums.length
    ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
    : 0;
}

export function createIntelligenceService(deps: IntelligenceServiceDeps) {
  async function assertAccess(userId: string, crawlId: string) {
    const crawl = await deps.crawls.getById(crawlId);
    if (!crawl) throw new ServiceError("NOT_FOUND", 404, "Crawl not found");
    const project = await deps.projects.getById(crawl.projectId);
    if (!project || project.userId !== userId) {
      throw new ServiceError("NOT_FOUND", 404, "Not found");
    }
    return { crawl, project };
  }

  return {
    async getFusedInsights(userId: string, crawlId: string) {
      const { project } = await assertAccess(userId, crawlId);

      const [allScores, allIssues, allPages] = await Promise.all([
        deps.scores.listByJob(crawlId),
        deps.scores.getIssuesByJob(crawlId),
        deps.pages.listByJob(crawlId),
      ]);

      // --- AI Visibility Readiness ---
      // Composite: avg(aiReadinessScore) weighted 60% + avg(LLM citation_worthiness) weighted 40%
      const aiReadinessScores = allScores
        .map((s: any) => s.aiReadinessScore)
        .filter((v: any): v is number => v != null);
      const llmCitationScores = allScores
        .map(
          (s: any) => (s.detail as any)?.llmContentScores?.citation_worthiness,
        )
        .filter((v: any): v is number => v != null);

      const avgAiReadiness = avg(aiReadinessScores);
      const avgCitationWorthiness = avg(llmCitationScores);

      let aiVisibilityReadiness: number;
      if (llmCitationScores.length > 0) {
        aiVisibilityReadiness = Math.round(
          avgAiReadiness * 0.6 + avgCitationWorthiness * 0.4,
        );
      } else {
        aiVisibilityReadiness = avgAiReadiness;
      }

      // --- Platform Opportunities ---
      // Aggregate platform scores from all pages (if extension port has been applied)
      const platformOpportunities: any[] = [];
      const platformAgg = new Map<
        string,
        { scores: number[]; tips: Set<string> }
      >();

      for (const score of allScores) {
        const ps = (score as any).platformScores;
        if (!ps) continue;
        for (const [platform, data] of Object.entries(ps) as [string, any][]) {
          if (!platformAgg.has(platform)) {
            platformAgg.set(platform, { scores: [], tips: new Set() });
          }
          const agg = platformAgg.get(platform)!;
          agg.scores.push(data.score);
          if (data.tips) {
            for (const tip of data.tips) agg.tips.add(tip);
          }
        }
      }

      // Optionally include visibility rates per platform
      let visibilityRateByPlatform = new Map<string, number>();
      try {
        const trends = await deps.visibility.getTrends(project.id);
        for (const t of trends as any[]) {
          if (t.provider && t.mentionRate != null) {
            visibilityRateByPlatform.set(t.provider, t.mentionRate);
          }
        }
      } catch {
        // Visibility data is optional
      }

      for (const [platform, agg] of platformAgg) {
        const avgScore = avg(agg.scores);
        platformOpportunities.push({
          platform,
          currentScore: avgScore,
          opportunityScore: 100 - avgScore,
          topTips: [...agg.tips].slice(0, 3),
          visibilityRate: visibilityRateByPlatform.get(platform) ?? null,
        });
      }
      // Sort by opportunity (highest gap first)
      platformOpportunities.sort(
        (a, b) => b.opportunityScore - a.opportunityScore,
      );

      // --- Content Health Matrix ---
      const avgOverall = avg(allScores.map((s: any) => s.overallScore));
      const llmScores = allScores
        .map((s: any) => {
          const lcs = (s.detail as any)?.llmContentScores;
          if (!lcs) return null;
          const vals = [
            lcs.clarity,
            lcs.authority,
            lcs.comprehensiveness,
            lcs.structure,
            lcs.citation_worthiness,
          ].filter((v: any): v is number => v != null);
          return vals.length
            ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length
            : null;
        })
        .filter((v: any): v is number => v != null);
      const avgLlm = llmScores.length ? avg(llmScores) : null;

      // GA4 + Clarity data (check enrichments for first page as sample — real impl would aggregate)
      let engagementScore: number | null = null;
      let uxScore: number | null = null;

      if (allPages.length > 0) {
        try {
          const enrichments = await deps.enrichments.listByPage(allPages[0].id);
          for (const e of enrichments) {
            const data = e.data as any;
            if (e.provider === "ga4" && data?.bounceRate != null) {
              // Convert bounce rate to engagement score (lower bounce = higher engagement)
              engagementScore = Math.round(
                Math.max(0, 100 - data.bounceRate * 100),
              );
            }
            if (e.provider === "clarity" && data?.engagementScore != null) {
              uxScore = Math.round(data.engagementScore);
            }
          }
        } catch {
          // Enrichments are optional
        }
      }

      // --- ROI Quick Wins ---
      // Group issues by code, count affected pages, lookup score impact from ISSUE_DEFINITIONS
      const issueCountByCode = new Map<string, number>();
      for (const issue of allIssues) {
        issueCountByCode.set(
          issue.code,
          (issueCountByCode.get(issue.code) ?? 0) + 1,
        );
      }

      const roiQuickWins: any[] = [];
      for (const [code, affectedPages] of issueCountByCode) {
        const def = ISSUE_DEFINITIONS.find((d: any) => d.code === code);
        if (!def) continue;
        roiQuickWins.push({
          issueCode: code,
          scoreImpact: Math.abs(def.scoreImpact),
          estimatedTrafficImpact: null, // GSC enrichment would go here in future
          effort: def.effortLevel,
          affectedPages,
        });
      }
      // Sort by total impact (scoreImpact × affectedPages) desc
      roiQuickWins.sort(
        (a, b) =>
          b.scoreImpact * b.affectedPages - a.scoreImpact * a.affectedPages,
      );

      return {
        aiVisibilityReadiness,
        platformOpportunities,
        contentHealthMatrix: {
          scoring: avgOverall,
          llmQuality: avgLlm,
          engagement: engagementScore,
          uxQuality: uxScore,
        },
        roiQuickWins: roiQuickWins.slice(0, 10),
      };
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm vitest run apps/api/src/__tests__/services/intelligence-service.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add apps/api/src/services/intelligence-service.ts apps/api/src/__tests__/services/intelligence-service.test.ts
git commit -m "feat(api): add intelligence fusion service combining scoring + LLM + enrichments"
```

---

### Task 6: Intelligence Fusion API Endpoint

**Files:**

- Modify: `apps/api/src/routes/insights.ts`

**Step 1: Add the fused insights endpoint**

Add to `apps/api/src/routes/insights.ts`:

```ts
import {
  createEnrichmentRepository,
  createVisibilityRepository,
} from "../repositories";
import { createIntelligenceService } from "../services/intelligence-service";

// GET /api/crawls/:crawlId/fused-insights
insightsRoutes.get("/:crawlId/fused-insights", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("crawlId");

  const service = createIntelligenceService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    scores: createScoreRepository(db),
    pages: createPageRepository(db),
    enrichments: createEnrichmentRepository(db),
    visibility: createVisibilityRepository(db),
  });

  try {
    const data = await service.getFusedInsights(userId, crawlId);
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

Check that `createVisibilityRepository` is already exported from `../repositories` (it is — see `repositories/index.ts:177`).

**Step 2: Typecheck**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter @llm-boost/api typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/api/src/routes/insights.ts
git commit -m "feat(api): add GET /api/crawls/:id/fused-insights endpoint"
```

---

### Task 7: Page-Level Citation Readiness

**Files:**

- Create: `packages/scoring/src/citation-readiness.ts`
- Test: `packages/scoring/src/__tests__/citation-readiness.test.ts`

This computes a per-page "Citation Readiness" score from available data sources.

**Step 1: Write the failing test**

Create `packages/scoring/src/__tests__/citation-readiness.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeCitationReadiness } from "../citation-readiness";

describe("computeCitationReadiness", () => {
  it("computes score from all available data", () => {
    const result = computeCitationReadiness({
      llmCitationWorthiness: 80,
      schemaTypes: ["Article", "FAQPage", "BreadcrumbList"],
      structuredDataCount: 3,
      externalLinks: 12,
      facts: [
        { content: "AI reduces SEO time by 60%", citabilityScore: 92 },
        { content: "Market grew to $5B in 2025", citabilityScore: 88 },
      ],
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.components.factCitability).toBeGreaterThan(0);
    expect(result.components.llmCitationWorthiness).toBe(80);
    expect(result.components.schemaQuality).toBeGreaterThan(0);
    expect(result.topCitableFacts.length).toBe(2);
    expect(result.topCitableFacts[0].citabilityScore).toBe(92); // sorted desc
  });

  it("works with no facts and no LLM data", () => {
    const result = computeCitationReadiness({
      llmCitationWorthiness: null,
      schemaTypes: [],
      structuredDataCount: 0,
      externalLinks: 0,
      facts: [],
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.components.factCitability).toBe(0);
    expect(result.components.llmCitationWorthiness).toBe(0);
    expect(result.topCitableFacts.length).toBe(0);
  });

  it("rewards high-citability schema types", () => {
    const withSchema = computeCitationReadiness({
      llmCitationWorthiness: 70,
      schemaTypes: ["Article", "FAQPage"],
      structuredDataCount: 2,
      externalLinks: 5,
      facts: [],
    });
    const withoutSchema = computeCitationReadiness({
      llmCitationWorthiness: 70,
      schemaTypes: [],
      structuredDataCount: 0,
      externalLinks: 5,
      facts: [],
    });

    expect(withSchema.score).toBeGreaterThan(withoutSchema.score);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm vitest run packages/scoring/src/__tests__/citation-readiness.test.ts`
Expected: FAIL — module not found

**Step 3: Implement citation readiness**

Create `packages/scoring/src/citation-readiness.ts`:

```ts
interface CitationReadinessInput {
  llmCitationWorthiness: number | null;
  schemaTypes: string[];
  structuredDataCount: number;
  externalLinks: number;
  facts: { content: string; citabilityScore: number }[];
}

interface CitationReadinessResult {
  score: number;
  components: {
    factCitability: number;
    llmCitationWorthiness: number;
    schemaQuality: number;
    structuredDataCount: number;
  };
  topCitableFacts: { content: string; citabilityScore: number }[];
}

// Schema types that make content more citable by LLMs
const HIGH_CITABILITY_SCHEMAS = new Set([
  "Article",
  "NewsArticle",
  "BlogPosting",
  "ScholarlyArticle",
  "FAQPage",
  "HowTo",
  "TechArticle",
  "Dataset",
  "Report",
]);

export function computeCitationReadiness(
  input: CitationReadinessInput,
): CitationReadinessResult {
  // 1. Fact citability: average of top facts' scores (0-100)
  const sortedFacts = [...input.facts].sort(
    (a, b) => b.citabilityScore - a.citabilityScore,
  );
  const topFacts = sortedFacts.slice(0, 5);
  const factCitability = topFacts.length
    ? Math.round(
        topFacts.reduce((s, f) => s + f.citabilityScore, 0) / topFacts.length,
      )
    : 0;

  // 2. LLM citation worthiness (0-100, or 0 if unavailable)
  const llmScore = input.llmCitationWorthiness ?? 0;

  // 3. Schema quality: bonus for having high-citability schema types (0-100)
  const citableSchemaCount = input.schemaTypes.filter((t) =>
    HIGH_CITABILITY_SCHEMAS.has(t),
  ).length;
  const schemaQuality = Math.min(
    100,
    citableSchemaCount * 30 + (input.structuredDataCount > 0 ? 10 : 0),
  );

  // 4. External links as authority signal (0-20 bonus, capped)
  const linkBonus = Math.min(20, input.externalLinks * 2);

  // Weighted composite:
  // - LLM citation worthiness: 35% (if available, otherwise redistribute)
  // - Fact citability: 30%
  // - Schema quality: 25%
  // - Link authority bonus: 10%
  let score: number;
  if (input.llmCitationWorthiness != null) {
    score = Math.round(
      llmScore * 0.35 +
        factCitability * 0.3 +
        schemaQuality * 0.25 +
        linkBonus * 0.5,
    );
  } else {
    // Redistribute LLM weight to facts and schema
    score = Math.round(
      factCitability * 0.5 + schemaQuality * 0.35 + linkBonus * 0.75,
    );
  }
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    components: {
      factCitability,
      llmCitationWorthiness: llmScore,
      schemaQuality,
      structuredDataCount: input.structuredDataCount,
    },
    topCitableFacts: topFacts,
  };
}
```

Export from `packages/scoring/src/index.ts`:

```ts
export { computeCitationReadiness } from "./citation-readiness";
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm vitest run packages/scoring/src/__tests__/citation-readiness.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/scoring/src/citation-readiness.ts packages/scoring/src/__tests__/citation-readiness.test.ts packages/scoring/src/index.ts
git commit -m "feat(scoring): add citation readiness composite scorer"
```

---

### Task 8: Frontend Types & API Client

**Files:**

- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add types for progress and fused insights**

Add to `apps/web/src/lib/api.ts` (in the types section):

```ts
// Progress tracking
export interface CategoryDelta {
  current: number;
  previous: number;
  delta: number;
}

export interface ProjectProgress {
  currentCrawlId: string;
  previousCrawlId: string;
  scoreDelta: number;
  currentScore: number;
  previousScore: number;
  categoryDeltas: {
    technical: CategoryDelta;
    content: CategoryDelta;
    aiReadiness: CategoryDelta;
    performance: CategoryDelta;
  };
  issuesFixed: number;
  issuesNew: number;
  issuesPersisting: number;
  gradeChanges: { improved: number; regressed: number; unchanged: number };
  velocity: number;
  topImprovedPages: { url: string; delta: number; current: number }[];
  topRegressedPages: { url: string; delta: number; current: number }[];
}

// Intelligence fusion
export interface PlatformOpportunity {
  platform: string;
  currentScore: number;
  opportunityScore: number;
  topTips: string[];
  visibilityRate: number | null;
}

export interface FusedInsights {
  aiVisibilityReadiness: number;
  platformOpportunities: PlatformOpportunity[];
  contentHealthMatrix: {
    scoring: number;
    llmQuality: number | null;
    engagement: number | null;
    uxQuality: number | null;
  };
  roiQuickWins: {
    issueCode: string;
    scoreImpact: number;
    estimatedTrafficImpact: number | null;
    effort: "low" | "medium" | "high";
    affectedPages: number;
  }[];
}
```

Add API methods:

```ts
// In the api object's projects section:
progress: async (token: string, projectId: string): Promise<ProjectProgress | null> => {
  const res = await apiFetch(`/api/projects/${projectId}/progress`, { token });
  return res.data;
},

// In the api object's crawls section (or insights):
fusedInsights: async (token: string, crawlId: string): Promise<FusedInsights> => {
  const res = await apiFetch(`/api/crawls/${crawlId}/fused-insights`, { token });
  return res.data;
},
```

**Step 2: Typecheck**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter web typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add progress and fused insights types + API client methods"
```

---

### Task 9: Full Typecheck & Integration Verification

**Files:** All modified packages

**Step 1: Build shared package**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter @llm-boost/shared build`
Expected: PASS

**Step 2: Build scoring package**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter @llm-boost/scoring build`
Expected: PASS

**Step 3: Typecheck API**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter @llm-boost/api typecheck`
Expected: PASS

**Step 4: Run all tests**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm test`
Expected: All existing tests PASS + new tests PASS

**Step 5: Commit (if any fixes needed)**

```bash
git add -A && git commit -m "chore: fix any type errors from intelligence fusion integration"
```

---

## Summary

| Task | What                                      | Tests     |
| ---- | ----------------------------------------- | --------- |
| 1    | Progress tracking Zod schemas             | 3         |
| 2    | Progress service (cross-crawl comparison) | 3         |
| 3    | Progress API route                        | typecheck |
| 4    | Intelligence fusion Zod schemas           | 3         |
| 5    | Intelligence fusion service               | 3         |
| 6    | Fused insights API endpoint               | typecheck |
| 7    | Citation readiness scorer                 | 3         |
| 8    | Frontend types + API client               | typecheck |
| 9    | Full integration verification             | all       |

**Total new tests:** 15
**New files:** 6 (3 services/modules + 3 test files)
**Modified files:** 4 (2 schema files, 1 route, 1 frontend API)

## Relationship to Extension Port Plan

This plan **depends on** the extension port plan for:

- `platformScores` column on `page_scores` (used by intelligence fusion Task 5)
- Recommendation engine with all 48 templates (extended by ROI quick wins)
- Content type detection (available for future content-type-aware insights)

However, **Task 1-3 (progress tracking)** can be implemented immediately with zero dependencies on the extension port.
