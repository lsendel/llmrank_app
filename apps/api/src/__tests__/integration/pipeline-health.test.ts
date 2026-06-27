import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../helpers/test-app";

const projectId = "cd19e84d-0b41-4e09-b908-c36bb39ca399";

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

vi.mock("../../middleware/ownership", () => ({
  withOwnership: () => async (c: any, next: any) => {
    c.set("project", {
      id: projectId,
      userId: "test-user-id",
      domain: "families.care",
      crawlSchedule: "manual",
    });
    await next();
  },
}));

const mockCrawlGetLatestByProject = vi.fn();
const mockUserGetById = vi.fn();
const mockKeywordCountByProject = vi.fn();
const mockCompetitorListByProject = vi.fn();
const mockScoreIssuesByJob = vi.fn();

vi.mock("@llm-boost/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/db")>();
  return {
    ...orig,
    crawlQueries: () => ({
      getLatestByProject: mockCrawlGetLatestByProject,
    }),
    userQueries: () => ({
      getById: mockUserGetById,
    }),
    savedKeywordQueries: () => ({
      countByProject: mockKeywordCountByProject,
    }),
    competitorQueries: () => ({
      listByProject: mockCompetitorListByProject,
    }),
    scoreQueries: () => ({
      getIssuesByJob: mockScoreIssuesByJob,
    }),
    createAppDb: orig.createAppDb,
  };
});

vi.mock("@llm-boost/repositories", () => ({
  createProjectRepository: () => ({}),
  createUserRepository: () => ({}),
  createCrawlRepository: () => ({}),
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
}));

describe("Pipeline health-check route", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCrawlGetLatestByProject.mockResolvedValue({
      id: "crawl-1",
      projectId,
      status: "complete",
    });
    mockUserGetById.mockResolvedValue({ id: "test-user-id", plan: "pro" });
    mockKeywordCountByProject.mockResolvedValue(10);
    mockCompetitorListByProject.mockResolvedValue([
      { domain: "aplaceformom.com" },
      { domain: "caring.com" },
    ]);
    mockScoreIssuesByJob.mockResolvedValue([]);
  });

  it("runs the health check from D1-backed project data", async () => {
    const res = await request(`/api/pipeline/${projectId}/health-check`);

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data).toMatchObject({
      projectId,
      crawlJobId: "crawl-1",
      score: 80,
    });
    expect(body.data.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check: "competitors_tracked",
          status: "pass",
        }),
        expect.objectContaining({
          check: "keyword_coverage",
          status: "pass",
        }),
        expect.objectContaining({
          check: "crawl_schedule",
          status: "warn",
        }),
      ]),
    );
  });
});
