import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockProjectGetById = vi.fn();
const mockScoreListByJob = vi.fn().mockResolvedValue([]);
const mockScoreGetIssuesByJob = vi.fn().mockResolvedValue([]);
const mockCrawlUpdateSummary = vi.fn().mockResolvedValue(undefined);
const mockGenerateExecutiveSummary = vi
  .fn()
  .mockResolvedValue("Executive summary text");

vi.mock("@llm-boost/db", () => ({
  createDb: vi.fn().mockReturnValue({}),
  projectQueries: vi.fn(() => ({
    getById: mockProjectGetById,
  })),
  scoreQueries: vi.fn(() => ({
    listByJob: mockScoreListByJob,
    getIssuesByJob: mockScoreGetIssuesByJob,
  })),
  crawlQueries: vi.fn(() => ({
    updateSummary: mockCrawlUpdateSummary,
  })),
}));

vi.mock("@llm-boost/llm", () => ({
  SummaryGenerator: vi.fn().mockImplementation(() => ({
    generateExecutiveSummary: mockGenerateExecutiveSummary,
  })),
}));

vi.mock("@llm-boost/shared", async () => {
  const actual =
    await vi.importActual<typeof import("@llm-boost/shared")>(
      "@llm-boost/shared",
    );
  return {
    ...actual,
    getQuickWins: vi
      .fn()
      .mockReturnValue([{ code: "MISSING_TITLE", impact: "high" }]),
    aggregatePageScores: vi.fn().mockReturnValue({
      overallScore: 82,
      scores: {
        technical: 85,
        content: 80,
        aiReadiness: 78,
        performance: 90,
      },
    }),
  };
});

vi.mock("../../services/score-helpers", () => ({
  toAggregateInput: vi.fn().mockImplementation((rows: unknown[]) => rows),
}));

import { generateCrawlSummary } from "../../services/summary";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateCrawlSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectGetById.mockResolvedValue({
      id: "proj-1",
      name: "My Site",
      domain: "https://example.com",
    });
    mockScoreListByJob.mockResolvedValue([
      {
        id: "score-1",
        overallScore: 85,
        technicalScore: 90,
        contentScore: 80,
        aiReadinessScore: 78,
        detail: {},
      },
    ]);
    mockScoreGetIssuesByJob.mockResolvedValue([
      { code: "MISSING_TITLE", severity: "warning" },
    ]);
  });

  it("generates and stores a summary for a completed crawl", async () => {
    await generateCrawlSummary({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      projectId: "proj-1",
      jobId: "job-1",
    });

    expect(mockGenerateExecutiveSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: "My Site",
        domain: "https://example.com",
        overallScore: 82,
        pagesScored: 1,
      }),
    );
    expect(mockCrawlUpdateSummary).toHaveBeenCalledWith(
      "job-1",
      "Executive summary text",
    );
  });

  it("returns early when project not found", async () => {
    mockProjectGetById.mockResolvedValue(null);

    await generateCrawlSummary({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      projectId: "proj-1",
      jobId: "job-1",
    });

    expect(mockGenerateExecutiveSummary).not.toHaveBeenCalled();
    expect(mockCrawlUpdateSummary).not.toHaveBeenCalled();
  });

  it("returns early when no page scores exist", async () => {
    mockScoreListByJob.mockResolvedValue([]);

    await generateCrawlSummary({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      projectId: "proj-1",
      jobId: "job-1",
    });

    expect(mockGenerateExecutiveSummary).not.toHaveBeenCalled();
    expect(mockCrawlUpdateSummary).not.toHaveBeenCalled();
  });

  it("passes quick wins to the summary generator", async () => {
    await generateCrawlSummary({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      projectId: "proj-1",
      jobId: "job-1",
    });

    expect(mockGenerateExecutiveSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        quickWins: [{ code: "MISSING_TITLE", impact: "high" }],
      }),
    );
  });

  it("passes category scores to the summary generator", async () => {
    await generateCrawlSummary({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      projectId: "proj-1",
      jobId: "job-1",
    });

    expect(mockGenerateExecutiveSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryScores: {
          technical: 85,
          content: 80,
          aiReadiness: 78,
          performance: 90,
        },
      }),
    );
  });
});
