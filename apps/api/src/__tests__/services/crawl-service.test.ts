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

// Mock signPayload and fetch
vi.mock("../../middleware/hmac", () => ({
  signPayload: vi.fn().mockResolvedValue({
    signature: "hmac-sha256=abc123",
    timestamp: "1700000000",
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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
    mockFetch.mockResolvedValue({
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
      expect(mockFetch).toHaveBeenCalledWith(
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
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      });
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(
        service.requestCrawl({
          userId: "user-1",
          projectId: "proj-1",
          requestUrl: "https://api.test",
          env,
        }),
      ).rejects.toThrow("Failed to connect to crawler service");
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
  });

  describe("getCrawl", () => {
    it("returns crawl with scores for completed job", async () => {
      crawls.getById.mockResolvedValueOnce(
        buildCrawlJob({ status: "complete", summary: "Summary text" }),
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
    });

    it("throws NOT_FOUND for nonexistent crawl", async () => {
      const service = createCrawlService({ crawls, projects, users, scores });

      await expect(service.getCrawl("user-1", "nope")).rejects.toThrow(
        "Crawl not found",
      );
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
