import { describe, it, expect, vi } from "vitest";
import { ISSUE_DEFINITIONS } from "@llm-boost/shared";
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
    // Denominator: this single page was LLM-scored, so 1 of 1.
    expect(result.contentHealthMatrix.llmScoredPages).toBe(1);
    expect(result.contentHealthMatrix.totalPages).toBe(1);
    expect(result.contentHealthMatrix.engagement).toBeNull(); // no GA4 data
    expect(result.roiQuickWins.length).toBeGreaterThan(0);
    expect(result.roiQuickWins[0].issueCode).toBe("NO_STRUCTURED_DATA");
  });

  it("averages LLM Quality only over LLM-scored pages and exposes the denominator", async () => {
    const deps = makeDeps();
    deps.crawls.getById.mockResolvedValue({ id: crawlId, projectId });
    deps.projects.getById.mockResolvedValue({ id: projectId, userId });
    // 3 pages, only 1 LLM-scored (top-N gating). llmQuality must reflect the
    // scored page alone; the 2 unscored pages must NOT drag it toward null/0.
    deps.scores.listByJob.mockResolvedValue([
      {
        pageId: "pg1",
        overallScore: 70,
        technicalScore: 80,
        contentScore: 74,
        aiReadinessScore: 70,
        detail: {
          llmContentScores: {
            clarity: 80,
            authority: 80,
            comprehensiveness: 80,
            structure: 80,
            citation_worthiness: 80,
          },
        },
      },
      {
        pageId: "pg2",
        overallScore: 91,
        technicalScore: 86,
        contentScore: 92,
        aiReadinessScore: 81,
        detail: {},
      },
      {
        pageId: "pg3",
        overallScore: 90,
        technicalScore: 85,
        contentScore: 92,
        aiReadinessScore: 80,
        detail: null,
      },
    ]);
    deps.scores.getIssuesByJob.mockResolvedValue([]);
    deps.pages.listByJob.mockResolvedValue([
      { id: "pg1", url: "https://ex.com/a", wordCount: 800 },
      { id: "pg2", url: "https://ex.com/b", wordCount: 800 },
      { id: "pg3", url: "https://ex.com/c", wordCount: 800 },
    ]);

    const service = createIntelligenceService(deps as any);
    const result = await service.getFusedInsights(userId, crawlId);

    // Average over the single scored page (all dims = 80), not diluted by the 2
    // unscored pages.
    expect(result.contentHealthMatrix.llmQuality).toBe(80);
    expect(result.contentHealthMatrix.llmScoredPages).toBe(1);
    expect(result.contentHealthMatrix.totalPages).toBe(3);
  });

  it("returns null LLM Quality with a zero numerator when no page is LLM-scored", async () => {
    const deps = makeDeps();
    deps.crawls.getById.mockResolvedValue({ id: crawlId, projectId });
    deps.projects.getById.mockResolvedValue({ id: projectId, userId });
    deps.scores.listByJob.mockResolvedValue([
      {
        pageId: "pg1",
        overallScore: 91,
        technicalScore: 86,
        contentScore: 92,
        aiReadinessScore: 81,
        detail: {},
      },
    ]);
    deps.scores.getIssuesByJob.mockResolvedValue([]);
    deps.pages.listByJob.mockResolvedValue([
      { id: "pg1", url: "https://ex.com/a", wordCount: 800 },
    ]);

    const service = createIntelligenceService(deps as any);
    const result = await service.getFusedInsights(userId, crawlId);

    expect(result.contentHealthMatrix.llmQuality).toBeNull();
    expect(result.contentHealthMatrix.llmScoredPages).toBe(0);
    expect(result.contentHealthMatrix.totalPages).toBe(1);
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

  it("derives per-provider platform tips from actual issues, weighted by provider", async () => {
    const deps = makeDeps();
    deps.crawls.getById.mockResolvedValue({ id: crawlId, projectId });
    deps.projects.getById.mockResolvedValue({ id: projectId, userId });
    deps.scores.listByJob.mockResolvedValue([
      {
        pageId: "pg1",
        overallScore: 70,
        technicalScore: 70,
        contentScore: 65,
        aiReadinessScore: 60,
        lighthousePerf: 0.6,
        platformScores: {
          chatgpt: { score: 70, grade: "C", tips: ["STATIC chatgpt tip"] },
          copilot: { score: 65, grade: "D", tips: ["STATIC copilot tip"] },
        },
        detail: {},
      },
    ]);
    // One issue per category, equal counts → only the provider's category
    // weighting moves the ranking. (all three have |scoreImpact| 15)
    const issueRows: any[] = [];
    for (const code of [
      "MISSING_TITLE",
      "THIN_CONTENT",
      "NO_STRUCTURED_DATA",
    ]) {
      for (let i = 0; i < 3; i++) issueRows.push({ pageId: `pg${i}`, code });
    }
    deps.scores.getIssuesByJob.mockResolvedValue(issueRows);
    deps.pages.listByJob.mockResolvedValue([
      { id: "pg1", url: "https://ex.com/a", wordCount: 800 },
    ]);

    const service = createIntelligenceService(deps as any);
    const result = await service.getFusedInsights(userId, crawlId);

    const chatgpt = result.platformOpportunities.find(
      (p: any) => p.platform === "chatgpt",
    );
    const copilot = result.platformOpportunities.find(
      (p: any) => p.platform === "copilot",
    );

    // ChatGPT weights ai_readiness (.5) > content (.3) > technical (.1).
    expect(chatgpt!.topTips[0]).toBe(
      ISSUE_DEFINITIONS.NO_STRUCTURED_DATA.recommendation,
    );
    // Copilot weights technical (.35) > content (.25) > ai_readiness (.15).
    expect(copilot!.topTips[0]).toBe(
      ISSUE_DEFINITIONS.MISSING_TITLE.recommendation,
    );
    // Data-driven tips replaced the static placeholder copy.
    expect(chatgpt!.topTips).not.toContain("STATIC chatgpt tip");
    expect(copilot!.topTips).not.toContain("STATIC copilot tip");
  });

  it("falls back to static platform tips when there are no issues", async () => {
    const deps = makeDeps();
    deps.crawls.getById.mockResolvedValue({ id: crawlId, projectId });
    deps.projects.getById.mockResolvedValue({ id: projectId, userId });
    deps.scores.listByJob.mockResolvedValue([
      {
        pageId: "pg1",
        overallScore: 70,
        technicalScore: 70,
        contentScore: 65,
        aiReadinessScore: 60,
        lighthousePerf: 0.6,
        platformScores: {
          chatgpt: {
            score: 70,
            grade: "C",
            tips: ["Static fallback A", "Static fallback B"],
          },
        },
        detail: {},
      },
    ]);
    deps.scores.getIssuesByJob.mockResolvedValue([]); // no issues
    deps.pages.listByJob.mockResolvedValue([
      { id: "pg1", url: "https://ex.com/a", wordCount: 800 },
    ]);

    const service = createIntelligenceService(deps as any);
    const result = await service.getFusedInsights(userId, crawlId);

    const chatgpt = result.platformOpportunities.find(
      (p: any) => p.platform === "chatgpt",
    );
    expect(chatgpt!.topTips).toEqual([
      "Static fallback A",
      "Static fallback B",
    ]);
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
