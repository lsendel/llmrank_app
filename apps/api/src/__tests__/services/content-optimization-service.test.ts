import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPages = [
  {
    id: "page-1",
    url: "https://example.com/blog",
    title: "Blog",
    wordCount: 200,
  },
];
const mockScores = [
  {
    pageId: "page-1",
    aiReadinessScore: 40,
    contentScore: 50,
    overallScore: 45,
  },
];
const mockIssues = [
  {
    pageId: "page-1",
    code: "LOW_WORD_COUNT",
    message: "Content too thin",
    pageUrl: "https://example.com/blog",
  },
];

const mockListByJob = vi.fn().mockResolvedValue(mockPages);
const mockScoreListByJob = vi.fn().mockResolvedValue(mockScores);
const mockGetIssuesByJob = vi.fn().mockResolvedValue(mockIssues);

vi.mock("@llm-boost/db", () => ({
  pageQueries: () => ({ listByJob: mockListByJob }),
  scoreQueries: () => ({
    listByJob: mockScoreListByJob,
    getIssuesByJob: mockGetIssuesByJob,
  }),
  createDb: vi.fn().mockReturnValue({}),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              improvements: [
                {
                  type: "content_depth",
                  suggestion: "Add specific statistics and data points",
                  priority: "high",
                },
                {
                  type: "structure",
                  suggestion: "Add FAQ section with schema markup",
                  priority: "medium",
                },
              ],
            }),
          },
        ],
      }),
    },
  })),
}));

import { runContentOptimization } from "../../services/content-optimization-service";

describe("ContentOptimizationService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates improvement suggestions for low-scoring pages", async () => {
    const result = await runContentOptimization({
      databaseUrl: "postgresql://test",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
      anthropicApiKey: "sk-test",
      limit: 10,
    });

    expect(result).toBeDefined();
    expect(result.pagesAnalyzed).toBe(1);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].improvements).toHaveLength(2);
  });

  it("returns empty results when no pages have scores", async () => {
    mockScoreListByJob.mockResolvedValueOnce([]);
    mockGetIssuesByJob.mockResolvedValueOnce([]);

    const result = await runContentOptimization({
      databaseUrl: "postgresql://test",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
      anthropicApiKey: "sk-test",
    });

    expect(result.pagesAnalyzed).toBe(0);
    expect(result.suggestions).toHaveLength(0);
  });
});
