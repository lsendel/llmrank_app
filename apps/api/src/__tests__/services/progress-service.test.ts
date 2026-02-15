import { describe, it, expect, vi } from "vitest";
import { createProgressService } from "../../services/progress-service";

// Minimal stubs matching repository interfaces
function makeDeps() {
  return {
    crawls: {
      getById: vi.fn(),
      listByProject: vi.fn(),
      getLatestByProject: vi.fn(),
    },
    projects: {
      getById: vi.fn(),
    },
    scores: {
      listByJob: vi.fn(),
      getIssuesByJob: vi.fn(),
      listByJobWithPages: vi.fn(),
      getByPageWithIssues: vi.fn(),
      createBatch: vi.fn(),
      createIssues: vi.fn(),
    },
    pages: {
      listByJob: vi.fn(),
      getById: vi.fn(),
      createBatch: vi.fn(),
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

    expect(result).not.toBeNull();
    // Score deltas
    expect(result!.currentCrawlId).toBe("crawl-2");
    expect(result!.previousCrawlId).toBe("crawl-1");
    expect(result!.currentScore).toBe(70); // avg(80, 60)
    expect(result!.previousScore).toBe(60); // avg(65, 55)
    expect(result!.scoreDelta).toBe(10);

    // Issue tracking: crawl-1 had MISSING_H1, MISSING_SCHEMA, THIN_CONTENT
    // crawl-2 has only MISSING_SCHEMA → MISSING_H1 fixed, THIN_CONTENT fixed
    expect(result!.issuesFixed).toBe(2); // MISSING_H1 + THIN_CONTENT
    expect(result!.issuesNew).toBe(0);
    expect(result!.issuesPersisting).toBe(1); // MISSING_SCHEMA

    // Top improved pages
    expect(result!.topImprovedPages[0].url).toBe("https://ex.com/a");
    expect(result!.topImprovedPages[0].delta).toBe(15);
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
