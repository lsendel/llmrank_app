import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildCrawlJob, buildScore } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Stable mock functions that persist across crawlQueries() / scoreQueries()
// calls so we can configure them per test.
// ---------------------------------------------------------------------------

const mockGetByShareToken = vi.fn().mockResolvedValue(null);
const mockListByJobWithPages = vi.fn().mockResolvedValue([]);
const mockGetIssuesByJob = vi.fn().mockResolvedValue([]);

vi.mock("@llm-boost/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/db")>();
  return {
    ...orig,
    crawlQueries: () => ({
      getByShareToken: mockGetByShareToken,
    }),
    scoreQueries: () => ({
      listByJobWithPages: mockListByJobWithPages,
      getIssuesByJob: mockGetIssuesByJob,
    }),
    createDb: orig.createDb,
  };
});

// Mock HTML parser and sitemap for public scan
vi.mock("../../lib/html-parser", () => ({
  parseHtml: vi.fn().mockReturnValue({
    title: "Example Page",
    metaDescription: "An example page description",
    canonicalUrl: "https://example.com",
    wordCount: 500,
    h1: ["Example Page"],
    h2: ["Section 1"],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    schemaTypes: ["Organization"],
    internalLinks: ["/about"],
    externalLinks: ["https://other.com"],
    imagesWithoutAlt: 0,
    hasRobotsMeta: false,
    robotsDirectives: [],
    ogTags: { title: "Example" },
    structuredData: [{ "@type": "Organization" }],
  }),
}));

vi.mock("../../lib/sitemap", () => ({
  analyzeSitemap: vi.fn().mockResolvedValue({
    exists: true,
    isValid: true,
    urlCount: 10,
    staleUrlCount: 0,
  }),
}));

// Mock the score-helpers for shared report
vi.mock("../../services/score-helpers", () => ({
  toAggregateInput: vi.fn().mockImplementation((rows: any[]) =>
    rows.map((r: any) => ({
      overallScore: r.overallScore ?? 0,
      technicalScore: r.technicalScore ?? 0,
      contentScore: r.contentScore ?? 0,
      aiReadinessScore: r.aiReadinessScore ?? 0,
      performanceScore: 0,
    })),
  ),
}));

// Mock global fetch for the public scan endpoint
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Public Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetByShareToken.mockResolvedValue(null);
    mockListByJobWithPages.mockResolvedValue([]);
    mockGetIssuesByJob.mockResolvedValue([]);
  });

  // -----------------------------------------------------------------------
  // GET /api/public/reports/:token
  // -----------------------------------------------------------------------

  describe("GET /api/public/reports/:token", () => {
    it("returns 404 when share token does not exist", async () => {
      mockGetByShareToken.mockResolvedValue(null);

      const res = await request("/api/public/reports/invalid-token");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("not found");
    });

    it("returns 200 with report data and cache headers for valid token", async () => {
      const crawl = buildCrawlJob({
        id: "crawl-1",
        status: "complete",
        pagesScored: 5,
        summary: "Site scored well overall.",
        completedAt: new Date("2024-06-15"),
        shareToken: "valid-token",
        shareEnabled: true,
      });

      mockGetByShareToken.mockResolvedValue(crawl);
      mockListByJobWithPages.mockResolvedValue([
        {
          ...buildScore({ jobId: "crawl-1" }),
          page: { id: "page-1", url: "https://example.com", title: "Home" },
          issueCount: 3,
        },
      ]);
      mockGetIssuesByJob.mockResolvedValue([
        {
          code: "MISSING_TITLE",
          category: "technical",
          severity: "critical",
          message: "Missing title",
          recommendation: "Add a title",
        },
      ]);

      const res = await request("/api/public/reports/valid-token");
      expect(res.status).toBe(200);

      const cacheControl = res.headers.get("cache-control");
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("max-age=3600");

      const body: any = await res.json();
      expect(body.data).toHaveProperty("crawlId", "crawl-1");
      expect(body.data).toHaveProperty("scores");
      expect(body.data.scores).toHaveProperty("overall");
      expect(body.data.scores).toHaveProperty("letterGrade");
      expect(body.data).toHaveProperty("pages");
      expect(body.data.pages).toBeInstanceOf(Array);
      expect(body.data).toHaveProperty("quickWins");
    });

    it("returns report data without auth header (public endpoint)", async () => {
      const crawl = buildCrawlJob({
        id: "crawl-2",
        status: "complete",
        shareToken: "public-token",
        shareEnabled: true,
      });

      mockGetByShareToken.mockResolvedValue(crawl);
      mockListByJobWithPages.mockResolvedValue([]);
      mockGetIssuesByJob.mockResolvedValue([]);

      // Call without Authorization header
      const res = await request("/api/public/reports/public-token", {
        headers: {},
      });
      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/public/scan
  // -----------------------------------------------------------------------

  describe("POST /api/public/scan", () => {
    beforeEach(() => {
      // HTML fetch succeeds
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === "string" && url.includes("robots.txt")) {
          return {
            ok: true,
            text: () => Promise.resolve("User-agent: *\nAllow: /"),
          };
        }
        if (typeof url === "string" && url.includes("llms.txt")) {
          return { ok: false, status: 404 };
        }
        return {
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              "<html><head><title>Test</title></head><body>Hello world</body></html>",
            ),
        };
      });
    });

    it("returns 422 when url is missing", async () => {
      const res = await request("/api/public/scan", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("url");
    });

    it("returns 422 when url is invalid", async () => {
      const res = await request("/api/public/scan", {
        method: "POST",
        json: { url: "not a real url !!!" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("INVALID_DOMAIN");
    });

    it("returns 200 with scan results for valid URL", async () => {
      const res = await request("/api/public/scan", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("url");
      expect(body.data).toHaveProperty("domain");
      expect(body.data).toHaveProperty("scores");
      expect(body.data.scores).toHaveProperty("overall");
      expect(body.data.scores).toHaveProperty("technical");
      expect(body.data.scores).toHaveProperty("content");
      expect(body.data.scores).toHaveProperty("aiReadiness");
      expect(body.data.scores).toHaveProperty("letterGrade");
      expect(body.data).toHaveProperty("issues");
      expect(body.data).toHaveProperty("quickWins");
      expect(body.data).toHaveProperty("meta");
    });

    it("auto-prepends https:// when missing", async () => {
      const res = await request("/api/public/scan", {
        method: "POST",
        json: { url: "example.com" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.url).toContain("https://");
    });

    it("returns 422 when HTML fetch fails", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (
          typeof url === "string" &&
          (url.includes("robots.txt") || url.includes("llms.txt"))
        ) {
          return { ok: false, status: 404 };
        }
        return { ok: false, status: 500 };
      });

      const { analyzeSitemap } = await import("../../lib/sitemap");
      (analyzeSitemap as any).mockResolvedValue({
        exists: false,
        isValid: false,
        urlCount: 0,
        staleUrlCount: 0,
      });

      const res = await request("/api/public/scan", {
        method: "POST",
        json: { url: "https://broken-site.com" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("FETCH_FAILED");
    });

    it("returns 429 when rate limit exceeded", async () => {
      // Fill up the KV rate limit
      const { kv, request: rateLimitReq } = createTestApp();
      await kv.put("public-scan:unknown", "10", { expirationTtl: 3600 });

      const res = await rateLimitReq("/api/public/scan", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      expect(res.status).toBe(429);

      const body: any = await res.json();
      expect(body.error.code).toBe("RATE_LIMIT");
    });

    it("detects AI crawler blocks in robots.txt", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === "string" && url.includes("robots.txt")) {
          return {
            ok: true,
            text: () =>
              Promise.resolve(
                "User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /",
              ),
          };
        }
        if (typeof url === "string" && url.includes("llms.txt")) {
          return { ok: true, text: () => Promise.resolve("# LLMs.txt") };
        }
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve("<html><body>Hello</body></html>"),
        };
      });

      const res = await request("/api/public/scan", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.meta.aiCrawlersBlocked).toContain("GPTBot");
      expect(body.data.meta.aiCrawlersBlocked).toContain("ClaudeBot");
      expect(body.data.meta.hasLlmsTxt).toBe(true);
    });
  });
});
