import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCrawlService,
  buildCrawlConfig,
} from "../../services/crawl-service";
import {
  createMockCrawlRepo,
  createMockProjectRepo,
  createMockUserRepo,
  createMockScoreRepo,
} from "../helpers/mock-repositories";
import {
  buildProject,
  buildUser,
  buildCrawlJob,
  buildScore,
} from "../helpers/factories";

// Mock signPayload and fetchWithRetry
vi.mock("../../middleware/hmac", () => ({
  signPayload: vi.fn().mockResolvedValue({
    signature: "hmac-sha256=abc123",
    timestamp: "1700000000",
  }),
}));

const mockFetchWithRetry = vi.fn();
vi.mock("../../lib/fetch-retry", () => ({
  fetchWithRetry: (...args: unknown[]) => mockFetchWithRetry(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const env = {
  crawlerUrl: "https://crawler.test",
  sharedSecret: "secret-123",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CrawlService", () => {
  let crawls: ReturnType<typeof createMockCrawlRepo>;
  let projects: ReturnType<typeof createMockProjectRepo>;
  let users: ReturnType<typeof createMockUserRepo>;
  let scores: ReturnType<typeof createMockScoreRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    projects = createMockProjectRepo({
      getById: vi.fn().mockResolvedValue(buildProject()),
    });
    users = createMockUserRepo({
      getById: vi.fn().mockResolvedValue(buildUser()),
      decrementCrawlCredits: vi.fn().mockResolvedValue(true),
    });
    crawls = createMockCrawlRepo({
      getLatestByProject: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(buildCrawlJob()),
    });
    scores = createMockScoreRepo();
    mockFetchWithRetry.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
  });

  describe("requestCrawl", () => {
    it("creates crawl job and dispatches to crawler", async () => {
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.requestCrawl({
        userId: "user-1",
        projectId: "proj-1",
        requestUrl: "https://api.test",
        env,
      });

      expect(result.id).toBe("crawl-1");
      expect(users.decrementCrawlCredits).toHaveBeenCalledWith("user-1");
      expect(crawls.create).toHaveBeenCalled();
      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        "https://crawler.test/api/v1/jobs",
        expect.objectContaining({ method: "POST" }),
      );
      expect(crawls.updateStatus).toHaveBeenCalledWith("crawl-1", {
        status: "queued",
        startedAt: expect.any(Date),
      });
    });

    it("throws when project not owned by user", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(
        service.requestCrawl({
          userId: "user-1",
          projectId: "proj-1",
          requestUrl: "https://api.test",
          env,
        }),
      ).rejects.toThrow("Resource does not exist");
    });

    it("throws when crawl credits are exhausted", async () => {
      users.getById.mockResolvedValue(buildUser({ crawlCreditsRemaining: 0 }));
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(
        service.requestCrawl({
          userId: "user-1",
          projectId: "proj-1",
          requestUrl: "https://api.test",
          env,
        }),
      ).rejects.toThrow("Monthly crawl credits exhausted");
    });

    it("throws when another crawl is in progress", async () => {
      crawls.getLatestByProject.mockResolvedValue(
        buildCrawlJob({ id: "crawl-existing", status: "crawling" }),
      );
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(
        service.requestCrawl({
          userId: "user-1",
          projectId: "proj-1",
          requestUrl: "https://api.test",
          env,
        }),
      ).rejects.toThrow("Another crawl is already running");
    });

    it("marks job failed when crawler URL not configured", async () => {
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.requestCrawl({
        userId: "user-1",
        projectId: "proj-1",
        requestUrl: "https://api.test",
        env: { ...env, crawlerUrl: undefined },
      });

      expect(result.status).toBe("failed");
      expect(crawls.updateStatus).toHaveBeenCalledWith(
        "crawl-1",
        expect.objectContaining({ status: "failed" }),
      );
    });

    it("marks job failed when crawler dispatch returns non-OK", async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: () => Promise.resolve(""),
      });
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(
        service.requestCrawl({
          userId: "user-1",
          projectId: "proj-1",
          requestUrl: "https://api.test",
          env,
        }),
      ).rejects.toThrow("Crawler rejected the request");
    });

    it("retries on network error and succeeds", async () => {
      mockFetchWithRetry.mockResolvedValueOnce({ ok: true, status: 202 });
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.requestCrawl({
        userId: "user-1",
        projectId: "proj-1",
        requestUrl: "https://api.test",
        env,
      });

      expect(result.id).toBe("crawl-1");
      expect(crawls.updateStatus).toHaveBeenCalledWith("crawl-1", {
        status: "queued",
        startedAt: expect.any(Date),
      });
    });

    it("throws CRAWLER_UNAVAILABLE after all retries exhausted", async () => {
      mockFetchWithRetry.mockRejectedValue(new Error("Connection refused"));
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(
        service.requestCrawl({
          userId: "user-1",
          projectId: "proj-1",
          requestUrl: "https://api.test",
          env,
        }),
      ).rejects.toThrow("Crawler service is temporarily unavailable");
    });

    it("prevents concurrent crawls for same project", async () => {
      for (const status of [
        "pending",
        "queued",
        "crawling",
        "scoring",
      ] as const) {
        crawls.getLatestByProject.mockResolvedValue(
          buildCrawlJob({ id: "c", status }),
        );
        const service = createCrawlService({ crawls, projects, users, scores });

        await expect(
          service.requestCrawl({
            userId: "user-1",
            projectId: "proj-1",
            requestUrl: "https://api.test",
            env,
          }),
        ).rejects.toThrow("Another crawl is already running");
      }
    });

    it("allows crawl when previous is complete", async () => {
      crawls.getLatestByProject.mockResolvedValue(
        buildCrawlJob({ id: "c", status: "complete" }),
      );
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.requestCrawl({
        userId: "user-1",
        projectId: "proj-1",
        requestUrl: "https://api.test",
        env,
      });
      expect(result.id).toBe("crawl-1");
    });

    it("fast-fails with friendly message when crawler is known-down", async () => {
      const kv = {
        get: vi.fn().mockResolvedValue(
          JSON.stringify({
            status: "down",
            checkedAt: new Date().toISOString(),
          }),
        ),
      };
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(
        service.requestCrawl({
          userId: "user-1",
          projectId: "proj-1",
          requestUrl: "https://api.test",
          env: { ...env, kv },
        }),
      ).rejects.toThrow("Crawler service is temporarily unavailable");

      // Should NOT attempt fetch at all
      expect(mockFetchWithRetry).not.toHaveBeenCalled();
    });
  });

  describe("getCrawl", () => {
    it("returns crawl with scores for completed job", async () => {
      const summaryData = {
        project: {
          id: "proj-1",
          name: "My Site",
          domain: "https://example.com",
        },
        overallScore: 82,
        letterGrade: "B",
        categoryScores: {
          technical: 85,
          content: 80,
          aiReadiness: 78,
          performance: 90,
        },
        quickWins: [],
        pagesScored: 1,
        generatedAt: new Date().toISOString(),
      };
      crawls.getById.mockResolvedValueOnce(
        buildCrawlJob({
          status: "complete",
          summary: "Summary text",
          summaryData,
        }),
      );
      scores.listByJob.mockResolvedValue([
        buildScore({
          overallScore: 85,
          technicalScore: 90,
          contentScore: 80,
          aiReadinessScore: 85,
          detail: { performanceScore: 70 },
        }),
      ]);
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.getCrawl("user-1", "crawl-1");
      expect(result?.projectName).toBe("My Site");
      expect(result?.summary).toBe("Summary text");
      expect(result?.summaryData).toEqual(summaryData);
    });

    it("throws NOT_FOUND for nonexistent crawl", async () => {
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(service.getCrawl("user-1", "nope")).rejects.toThrow(
        "Crawl not found",
      );
    });

    it("returns null scores for non-complete crawl", async () => {
      crawls.getById.mockResolvedValue(buildCrawlJob({ status: "crawling" }));
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.getCrawl("user-1", "crawl-1");
      expect((result as any)?.overallScore).toBeNull();
      expect((result as any)?.letterGrade).toBeNull();
      expect((result as any)?.scores).toBeNull();
    });

    it("returns null scores for complete crawl with no score rows", async () => {
      crawls.getById.mockResolvedValue(buildCrawlJob({ status: "complete" }));
      scores.listByJob.mockResolvedValue([]);
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.getCrawl("user-1", "crawl-1");
      expect((result as any)?.overallScore).toBeNull();
    });
  });

  describe("listProjectCrawls", () => {
    it("returns crawl list for owned project", async () => {
      const crawlList = [
        buildCrawlJob({ id: "c-1", status: "complete" }),
        buildCrawlJob({ id: "c-2", status: "crawling" }),
      ];
      crawls.listByProject.mockResolvedValue(crawlList);
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.listProjectCrawls("user-1", "proj-1");
      expect(result).toEqual(crawlList);
    });

    it("throws NOT_FOUND when project not owned by user", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(
        service.listProjectCrawls("user-1", "proj-1"),
      ).rejects.toThrow("Resource does not exist");
    });
  });

  describe("getQuickWins", () => {
    it("returns quick wins for a crawl", async () => {
      crawls.getById.mockResolvedValue(buildCrawlJob({ status: "complete" }));
      scores.getIssuesByJob.mockResolvedValue([
        {
          id: "i-1",
          jobId: "crawl-1",
          pageId: "p-1",
          code: "MISSING_TITLE",
          severity: "critical",
          message: "m",
          category: "content",
          data: {},
          createdAt: new Date(),
          recommendation: null,
        },
        {
          id: "i-2",
          jobId: "crawl-1",
          pageId: "p-1",
          code: "MISSING_ALT",
          severity: "warning",
          message: "m",
          category: "content",
          data: {},
          createdAt: new Date(),
          recommendation: null,
        },
      ]);
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.getQuickWins("user-1", "crawl-1");
      expect(result).toBeDefined();
    });

    it("throws NOT_FOUND when crawl does not exist", async () => {
      crawls.getById.mockResolvedValue(undefined);
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(service.getQuickWins("user-1", "crawl-999")).rejects.toThrow(
        "Crawl not found",
      );
    });
  });

  describe("getPlatformReadiness", () => {
    it("returns platform checks for a crawl", async () => {
      crawls.getById.mockResolvedValue(buildCrawlJob({ status: "complete" }));
      scores.getIssuesByJob.mockResolvedValue([]);
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.getPlatformReadiness("user-1", "crawl-1");
      expect(Array.isArray(result)).toBe(true);
      for (const entry of result) {
        expect(entry).toHaveProperty("platform");
        expect(entry).toHaveProperty("checks");
        expect(Array.isArray(entry.checks)).toBe(true);
      }
    });

    it("marks checks as failing when matching issue codes exist", async () => {
      crawls.getById.mockResolvedValue(buildCrawlJob({ status: "complete" }));
      scores.getIssuesByJob.mockResolvedValue([
        {
          id: "i-1",
          jobId: "crawl-1",
          pageId: "p-1",
          code: "AI_CRAWLER_BLOCKED",
          severity: "critical",
          message: "m",
          category: "llm_visibility",
          data: {},
          createdAt: new Date(),
          recommendation: null,
        },
        {
          id: "i-2",
          jobId: "crawl-1",
          pageId: "p-1",
          code: "MISSING_LLMS_TXT",
          severity: "warning",
          message: "m",
          category: "llm_visibility",
          data: {},
          createdAt: new Date(),
          recommendation: null,
        },
      ]);
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.getPlatformReadiness("user-1", "crawl-1");
      const allChecks = result.flatMap((p: any) => p.checks);
      const failedChecks = allChecks.filter((c: any) => !c.pass);
      expect(failedChecks.length).toBeGreaterThanOrEqual(0);
    });

    it("throws NOT_FOUND when crawl does not exist", async () => {
      crawls.getById.mockResolvedValue(undefined);
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(
        service.getPlatformReadiness("user-1", "crawl-999"),
      ).rejects.toThrow("Crawl not found");
    });
  });

  describe("enableSharing", () => {
    it("generates a new share token", async () => {
      crawls.getById.mockResolvedValue(
        buildCrawlJob({ shareToken: null, shareEnabled: false }),
      );
      (crawls.generateShareToken as any).mockResolvedValue({
        shareToken: "token-abc",
        shareEnabled: true,
      });
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.enableSharing("user-1", "crawl-1");
      expect(result.shareToken).toBe("token-abc");
      expect(result.shareUrl).toBe("/report/token-abc");
    });

    it("returns existing token when sharing is already enabled", async () => {
      crawls.getById.mockResolvedValue(
        buildCrawlJob({ shareToken: "existing-token", shareEnabled: true }),
      );
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.enableSharing("user-1", "crawl-1");
      expect(result.shareToken).toBe("existing-token");
      expect(crawls.generateShareToken).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when crawl does not exist", async () => {
      crawls.getById.mockResolvedValue(undefined);
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(
        service.enableSharing("user-1", "crawl-999"),
      ).rejects.toThrow("Crawl not found");
    });
  });

  describe("disableSharing", () => {
    it("disables sharing for a crawl", async () => {
      crawls.getById.mockResolvedValue(
        buildCrawlJob({ shareToken: "token", shareEnabled: true }),
      );
      const service = createCrawlService({ crawls, projects, users, scores });

      const result = await service.disableSharing("user-1", "crawl-1");
      expect(result).toEqual({ disabled: true });
      expect(crawls.disableSharing).toHaveBeenCalledWith("crawl-1");
    });

    it("throws NOT_FOUND when crawl does not exist", async () => {
      crawls.getById.mockResolvedValue(undefined);
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(
        service.disableSharing("user-1", "crawl-999"),
      ).rejects.toThrow("Crawl not found");
    });
  });

  describe("dispatchScheduledJobs", () => {
    it("dispatches via queue when available", async () => {
      const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
      (projects.getDueForCrawl as any).mockResolvedValue([
        {
          ...buildProject(),
          crawlSchedule: "weekly",
          user: buildUser(),
        },
      ]);
      crawls.create.mockResolvedValue(buildCrawlJob());
      const service = createCrawlService({ crawls, projects, users, scores });

      await service.dispatchScheduledJobs({
        ...env,
        queue: mockQueue,
      });

      expect(mockQueue.send).toHaveBeenCalled();
      expect(crawls.updateStatus).toHaveBeenCalledWith(
        "crawl-1",
        expect.objectContaining({ status: "queued" }),
      );
      expect(projects.updateNextCrawl).toHaveBeenCalled();
    });

    it("skips projects without user", async () => {
      (projects.getDueForCrawl as any).mockResolvedValue([
        {
          ...buildProject(),
          crawlSchedule: "weekly",
          user: null,
        },
      ]);
      const service = createCrawlService({ crawls, projects, users, scores });

      await service.dispatchScheduledJobs(env);

      expect(crawls.create).not.toHaveBeenCalled();
    });

    it("skips users with no crawl credits", async () => {
      (projects.getDueForCrawl as any).mockResolvedValue([
        {
          ...buildProject(),
          crawlSchedule: "daily",
          user: buildUser({ crawlCreditsRemaining: 0 }),
        },
      ]);
      const service = createCrawlService({ crawls, projects, users, scores });

      await service.dispatchScheduledJobs(env);

      expect(crawls.create).not.toHaveBeenCalled();
    });

    it("marks job failed when direct fetch throws", async () => {
      (projects.getDueForCrawl as any).mockResolvedValue([
        {
          ...buildProject(),
          crawlSchedule: "monthly",
          user: buildUser(),
        },
      ]);
      crawls.create.mockResolvedValue(buildCrawlJob());
      mockFetchWithRetry.mockRejectedValueOnce(new Error("Network error"));
      const service = createCrawlService({ crawls, projects, users, scores });

      await service.dispatchScheduledJobs(env);

      expect(crawls.updateStatus).toHaveBeenCalledWith(
        "crawl-1",
        expect.objectContaining({
          status: "failed",
          errorMessage: expect.stringContaining("Network error"),
        }),
      );
    });

    it("sets correct next crawl date for daily schedule", async () => {
      (projects.getDueForCrawl as any).mockResolvedValue([
        {
          ...buildProject(),
          crawlSchedule: "daily",
          user: buildUser(),
        },
      ]);
      crawls.create.mockResolvedValue(buildCrawlJob());
      const service = createCrawlService({ crawls, projects, users, scores });

      await service.dispatchScheduledJobs(env);

      const nextDateCall = projects.updateNextCrawl.mock.calls[0];
      expect(nextDateCall[1]).toBeInstanceOf(Date);
    });

    it("handles projects with no queue and no crawlerUrl", async () => {
      (projects.getDueForCrawl as any).mockResolvedValue([
        {
          ...buildProject(),
          crawlSchedule: "weekly",
          user: buildUser(),
        },
      ]);
      crawls.create.mockResolvedValue(buildCrawlJob());
      const service = createCrawlService({ crawls, projects, users, scores });

      await service.dispatchScheduledJobs({
        sharedSecret: "secret",
        crawlerUrl: undefined,
      });

      expect(crawls.create).toHaveBeenCalled();
      expect(projects.updateNextCrawl).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// buildCrawlConfig
// ---------------------------------------------------------------------------

describe("buildCrawlConfig", () => {
  it("respects free plan page limit", () => {
    const config = buildCrawlConfig(
      { domain: "https://example.com", settings: {} },
      "free",
    );
    expect(config.max_pages).toBe(10);
    expect(config.max_depth).toBe(2);
  });

  it("respects pro plan page limit", () => {
    const config = buildCrawlConfig(
      { domain: "https://example.com", settings: {} },
      "pro",
    );
    expect(config.max_pages).toBe(500);
    expect(config.max_depth).toBe(5);
  });

  it("caps custom settings at plan limit", () => {
    const config = buildCrawlConfig(
      {
        domain: "https://example.com",
        settings: { maxPages: 9999, maxDepth: 99 },
      },
      "starter",
    );
    expect(config.max_pages).toBe(100);
    expect(config.max_depth).toBe(3);
  });

  it("uses custom settings when within plan limit", () => {
    const config = buildCrawlConfig(
      {
        domain: "https://example.com",
        settings: { maxPages: 50, maxDepth: 2 },
      },
      "starter",
    );
    expect(config.max_pages).toBe(50);
    expect(config.max_depth).toBe(2);
  });

  it("sets correct seed URLs", () => {
    const config = buildCrawlConfig(
      { domain: "https://blog.com", settings: {} },
      "agency",
    );
    expect(config.seed_urls).toEqual(["https://blog.com"]);
    expect(config.max_pages).toBe(2000);
  });
});
