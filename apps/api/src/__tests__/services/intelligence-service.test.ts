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
        code: "NO_STRUCTURED_DATA",
        category: "ai_readiness",
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
    expect(result.roiQuickWins[0].issueCode).toBe("NO_STRUCTURED_DATA");
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
