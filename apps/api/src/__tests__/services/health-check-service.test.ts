import { describe, it, expect, vi, beforeEach } from "vitest";

const mockProject = {
  id: "proj-1",
  userId: "user-1",
  domain: "https://example.com",
  crawlSchedule: "manual",
  pipelineSettings: {},
};

const mockUser = { id: "user-1", plan: "pro" as const, trialEndsAt: null };

const mockKeywordCount = vi.fn().mockResolvedValue(2);
const mockCompetitors = vi.fn().mockResolvedValue([]);
const mockIssues = vi.fn().mockResolvedValue([
  { code: "AI_CRAWLER_BLOCKED", severity: "critical", pageId: "p1" },
  { code: "MISSING_LLMS_TXT", severity: "critical", pageId: "p1" },
]);

vi.mock("@llm-boost/db", () => ({
  createDb: vi.fn().mockReturnValue({}),
  projectQueries: () => ({
    getById: vi.fn().mockResolvedValue(mockProject),
  }),
  userQueries: () => ({
    getById: vi.fn().mockResolvedValue(mockUser),
  }),
  savedKeywordQueries: () => ({
    countByProject: mockKeywordCount,
  }),
  competitorQueries: () => ({
    listByProject: mockCompetitors,
  }),
  scoreQueries: () => ({
    getIssuesByJob: mockIssues,
  }),
}));

import { runHealthCheck } from "../../services/health-check-service";

describe("HealthCheckService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("flags missing competitors", async () => {
    const result = await runHealthCheck({
      databaseUrl: "postgresql://test",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        check: "competitors_tracked",
        status: "fail",
        autoFixable: true,
      }),
    );
  });

  it("flags low keyword count", async () => {
    const result = await runHealthCheck({
      databaseUrl: "postgresql://test",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        check: "keyword_coverage",
        status: "fail",
      }),
    );
  });

  it("flags manual crawl schedule on paid plan", async () => {
    const result = await runHealthCheck({
      databaseUrl: "postgresql://test",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        check: "crawl_schedule",
        status: "warn",
      }),
    );
  });

  it("includes critical issues from crawl", async () => {
    const result = await runHealthCheck({
      databaseUrl: "postgresql://test",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        check: "ai_crawler_access",
        status: "fail",
      }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        check: "llms_txt",
        status: "fail",
      }),
    );
  });

  it("computes a score based on pass ratio", async () => {
    const result = await runHealthCheck({
      databaseUrl: "postgresql://test",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
    });

    // All 5 checks fail/warn, so score should be 0
    expect(result.score).toBe(0);
  });
});
