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

const reporterMocks = vi.hoisted(() => ({
  fetchReportData: vi.fn(),
  aggregateReportData: vi.fn(),
}));

vi.mock("@llm-boost/reports", () => reporterMocks);
const mockScanResultCreate = vi.fn().mockResolvedValue({
  id: "scan-result-1",
  domain: "example.com",
  url: "https://example.com",
  scores: {},
  issues: [],
  quickWins: [],
  createdAt: new Date(),
});
const mockScanResultGetById = vi.fn().mockResolvedValue(null);
const mockLeadCreate = vi.fn().mockResolvedValue({
  id: "lead-1",
  email: "test@example.com",
  createdAt: new Date(),
});
const mockLeadGetById = vi.fn().mockResolvedValue(null);

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
    projectQueries: () => ({
      getById: vi.fn().mockResolvedValue({
        id: "proj-1",
        userId: "user-1",
        name: "Test Project",
        domain: "test.com",
        branding: { primaryColor: "#000" },
      }),
    }),
    scanResultQueries: () => ({
      create: mockScanResultCreate,
      getById: mockScanResultGetById,
    }),
    leadQueries: () => ({
      create: mockLeadCreate,
      getById: mockLeadGetById,
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
// Mock repositories — provide all 5 factories required by createContainer()
// ---------------------------------------------------------------------------

vi.mock("../../repositories", () => ({
  createProjectRepository: () => ({}),
  createUserRepository: () => ({}),
  createCrawlRepository: () => ({}),
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
}));

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
    mockScanResultCreate.mockResolvedValue({
      id: "scan-result-1",
      domain: "example.com",
      url: "https://example.com",
      scores: {},
      issues: [],
      quickWins: [],
      createdAt: new Date(),
    });
    mockScanResultGetById.mockResolvedValue(null);
    mockLeadGetById.mockResolvedValue(null);
    mockLeadCreate.mockResolvedValue({
      id: "lead-1",
      email: "test@example.com",
      createdAt: new Date(),
    });
    reporterMocks.fetchReportData.mockResolvedValue({} as any);
    reporterMocks.aggregateReportData.mockReturnValue({
      crawl: { id: "crawl-1" },
      scores: {
        overall: 85,
        technical: 80,
        content: 82,
        aiReadiness: 84,
        performance: 90,
        letterGrade: "B",
      },
      pages: [
        {
          url: "https://example.com",
          title: "Home",
          overall: 80,
          technical: 78,
          content: 82,
          aiReadiness: 75,
          performance: 90,
          grade: "B",
          issueCount: 3,
        },
      ],
      issues: { total: 5, items: [] },
      readinessCoverage: [
        {
          code: "MISSING_TITLE",
          label: "Title Tags",
          description: "Title coverage",
          pillar: "technical",
          coveragePercent: 60,
          affectedPages: 2,
          totalPages: 5,
        },
      ],
      scoreDeltas: {
        overall: 2,
        technical: 1,
        content: -1,
        aiReadiness: 0,
        performance: 3,
      },
      quickWins: [
        {
          code: "MISSING_TITLE",
          category: "technical",
          severity: "critical",
          message: "Fix titles",
          recommendation: "Add titles",
          effort: "low",
          affectedPages: 2,
          scoreImpact: 8,
          roi: null,
          pillar: "technical",
          owner: "SEO",
          docsUrl: "https://example.com",
        },
      ],
    });
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
        shareLevel: "full",
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
      expect(body.data).toHaveProperty("summaryData");
      expect(body.data).toHaveProperty("pages");
      expect(body.data.pages).toBeInstanceOf(Array);
      expect(body.data).toHaveProperty("quickWins");
      expect(body.data.readinessCoverage).toBeInstanceOf(Array);
      expect(body.data.scoreDeltas).toHaveProperty("overall");
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
      expect(body.data).toHaveProperty("scanResultId", "scan-result-1");
      expect(body.data).toHaveProperty("url");
      expect(body.data).toHaveProperty("domain");
      expect(body.data).toHaveProperty("scores");
      expect(body.data.scores).toHaveProperty("overall");
      expect(body.data.scores).toHaveProperty("technical");
      expect(body.data.scores).toHaveProperty("content");
      expect(body.data.scores).toHaveProperty("aiReadiness");
      expect(body.data.scores).toHaveProperty("letterGrade");
      expect(body.data).toHaveProperty("issues");
      expect(body.data.issues.length).toBeLessThanOrEqual(3);
      expect(body.data).toHaveProperty("quickWins");
      expect(body.data).toHaveProperty("meta");

      // Verify persistence was called
      expect(mockScanResultCreate).toHaveBeenCalledTimes(1);
      expect(mockScanResultCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "example.com",
          url: "https://example.com/",
          scores: expect.objectContaining({ overall: expect.any(Number) }),
          issues: expect.any(Array),
          quickWins: expect.any(Array),
          ipHash: expect.any(String),
        }),
      );
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

    it("persists scan result to database", async () => {
      const res = await request("/api/public/scan", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.scanResultId).toBe("scan-result-1");
      expect(mockScanResultCreate).toHaveBeenCalledTimes(1);
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

  // -----------------------------------------------------------------------
  // GET /api/public/scan-results/:id
  // -----------------------------------------------------------------------

  describe("GET /api/public/scan-results/:id", () => {
    it("returns 404 when scan result does not exist", async () => {
      mockScanResultGetById.mockResolvedValue(null);

      const res = await request("/api/public/scan-results/nonexistent-id");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns partial (gated) results without unlock token", async () => {
      const mockResult = {
        id: "scan-result-1",
        domain: "example.com",
        url: "https://example.com",
        scores: { overall: 85, letterGrade: "B" },
        issues: [
          { code: "ISSUE_1" },
          { code: "ISSUE_2" },
          { code: "ISSUE_3" },
          { code: "ISSUE_4" },
          { code: "ISSUE_5" },
        ],
        quickWins: [{ code: "QW_1" }],
        createdAt: new Date("2026-02-15"),
      };
      mockScanResultGetById.mockResolvedValue(mockResult);

      const res = await request("/api/public/scan-results/scan-result-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.id).toBe("scan-result-1");
      expect(body.data.scores).toEqual({ overall: 85, letterGrade: "B" });
      expect(body.data.issues).toHaveLength(3); // Only top 3
      expect(body.data).not.toHaveProperty("quickWins"); // Gated
    });

    it("returns full results when valid unlock token is provided", async () => {
      const mockResult = {
        id: "scan-result-1",
        domain: "example.com",
        url: "https://example.com",
        scores: { overall: 85, letterGrade: "B" },
        issues: [
          { code: "ISSUE_1" },
          { code: "ISSUE_2" },
          { code: "ISSUE_3" },
          { code: "ISSUE_4" },
          { code: "ISSUE_5" },
        ],
        quickWins: [{ code: "QW_1" }],
        createdAt: new Date("2026-02-15"),
      };
      mockScanResultGetById.mockResolvedValue(mockResult);
      mockLeadGetById.mockResolvedValue({
        id: "lead-1",
        email: "test@example.com",
        scanResultId: "scan-result-1",
      });

      const res = await request(
        "/api/public/scan-results/scan-result-1?token=lead-1",
      );
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.issues).toHaveLength(5); // Full results
      expect(body.data.quickWins).toHaveLength(1); // Included
    });

    it("returns partial results when invalid unlock token is provided", async () => {
      const mockResult = {
        id: "scan-result-1",
        domain: "example.com",
        url: "https://example.com",
        scores: { overall: 85 },
        issues: [{ code: "ISSUE_1" }, { code: "ISSUE_2" }],
        quickWins: [{ code: "QW_1" }],
        createdAt: new Date("2026-02-15"),
      };
      mockScanResultGetById.mockResolvedValue(mockResult);
      mockLeadGetById.mockResolvedValue(null); // Invalid token

      const res = await request(
        "/api/public/scan-results/scan-result-1?token=invalid-token",
      );
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).not.toHaveProperty("quickWins");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/public/leads
  // -----------------------------------------------------------------------

  describe("POST /api/public/leads", () => {
    it("returns 422 when email is missing", async () => {
      const res = await request("/api/public/leads", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when email is invalid", async () => {
      const res = await request("/api/public/leads", {
        method: "POST",
        json: { email: "not-an-email" },
      });
      expect(res.status).toBe(422);
    });

    it("creates a lead with scanResultId", async () => {
      const res = await request("/api/public/leads", {
        method: "POST",
        json: {
          email: "user@example.com",
          source: "public_scan",
          scanResultId: "scan-result-1",
        },
      });
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "lead-1");

      expect(mockLeadCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@example.com",
          source: "public_scan",
          scanResultId: "scan-result-1",
        }),
      );
    });

    it("creates a lead with default source when not provided", async () => {
      const res = await request("/api/public/leads", {
        method: "POST",
        json: { email: "user@example.com" },
      });
      expect(res.status).toBe(201);

      expect(mockLeadCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "shared_report",
        }),
      );
    });
  });
});
