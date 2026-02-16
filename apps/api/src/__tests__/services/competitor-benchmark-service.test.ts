import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCompetitorBenchmarkService } from "../../services/competitor-benchmark-service";

// ---------------------------------------------------------------------------
// Mock modules used by the service
// ---------------------------------------------------------------------------

// Mock parseHtml
vi.mock("../../lib/html-parser", () => ({
  parseHtml: vi.fn().mockReturnValue({
    title: "Competitor Page",
    metaDescription: "A competitor page description",
    canonicalUrl: "https://competitor.com",
    wordCount: 500,
    h1: ["Main Heading"],
    h2: ["Sub Heading"],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    schemaTypes: ["WebPage"],
    internalLinks: ["/about", "/contact"],
    externalLinks: ["https://example.com"],
    imagesWithoutAlt: 0,
    hasRobotsMeta: false,
    robotsDirectives: [],
    ogTags: { "og:title": "Competitor" },
    structuredData: [],
  }),
}));

// Mock analyzeSitemap
vi.mock("../../lib/sitemap", () => ({
  analyzeSitemap: vi.fn().mockResolvedValue({
    exists: true,
    isValid: true,
    urlCount: 50,
    staleUrlCount: 0,
    urls: [],
    lastmodDates: [],
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDeps() {
  return {
    competitorBenchmarks: {
      create: vi.fn().mockResolvedValue({
        id: "bench-1",
        projectId: "proj-1",
        competitorDomain: "competitor.com",
        overallScore: 72,
        technicalScore: 80,
        contentScore: 65,
        aiReadinessScore: 70,
        performanceScore: 75,
        letterGrade: "C",
        issueCount: 5,
        topIssues: ["MISSING_META_DESC", "NO_STRUCTURED_DATA"],
        crawledAt: new Date(),
      }),
      listByProject: vi.fn().mockResolvedValue([]),
      getLatest: vi.fn().mockResolvedValue(undefined),
    },
    competitors: {
      listByProject: vi.fn().mockResolvedValue([]),
      add: vi
        .fn()
        .mockResolvedValue({ id: "comp-1", domain: "competitor.com" }),
    },
  };
}

function mockHtmlResponse(status = 200) {
  return new Response(
    "<html><head><title>Test</title></head><body>Content</body></html>",
    {
      status,
      headers: { "Content-Type": "text/html" },
    },
  );
}

function mockTextResponse(text: string, ok = true) {
  return new Response(text, { status: ok ? 200 : 404 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CompetitorBenchmarkService", () => {
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();

    // Default fetch mock: HTML ok, robots ok, llms 404
    mockFetch.mockImplementation((url: string | URL | Request) => {
      const urlStr =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      if (urlStr.includes("robots.txt"))
        return Promise.resolve(mockTextResponse("User-agent: *\nAllow: /"));
      if (urlStr.includes("llms.txt"))
        return Promise.resolve(mockTextResponse("", false));
      return Promise.resolve(mockHtmlResponse());
    });
  });

  // ---- benchmarkCompetitor success ----

  it("benchmarks a competitor and stores the result", async () => {
    const service = createCompetitorBenchmarkService(deps);
    const result = await service.benchmarkCompetitor({
      projectId: "proj-1",
      competitorDomain: "competitor.com",
      competitorLimit: 5,
    });

    expect(result).toBeDefined();
    expect(result.id).toBe("bench-1");
    expect(deps.competitors.add).toHaveBeenCalledWith(
      "proj-1",
      "competitor.com",
    );
    expect(deps.competitorBenchmarks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-1",
        competitorDomain: "competitor.com",
      }),
    );
  });

  // ---- Doesn't re-add existing competitor ----

  it("does not add competitor again if already tracked", async () => {
    deps.competitors.listByProject.mockResolvedValue([
      { id: "comp-1", domain: "competitor.com" },
    ]);

    const service = createCompetitorBenchmarkService(deps);
    await service.benchmarkCompetitor({
      projectId: "proj-1",
      competitorDomain: "competitor.com",
      competitorLimit: 5,
    });

    expect(deps.competitors.add).not.toHaveBeenCalled();
  });

  // ---- Plan limit reached ----

  it("throws PLAN_LIMIT_REACHED when competitor limit exceeded", async () => {
    deps.competitors.listByProject.mockResolvedValue([
      { id: "comp-1", domain: "other1.com" },
      { id: "comp-2", domain: "other2.com" },
      { id: "comp-3", domain: "other3.com" },
    ]);

    const service = createCompetitorBenchmarkService(deps);
    await expect(
      service.benchmarkCompetitor({
        projectId: "proj-1",
        competitorDomain: "new-competitor.com",
        competitorLimit: 3,
      }),
    ).rejects.toThrow("Competitor limit reached");
  });

  // ---- Fetch failure ----

  it("throws when competitor page cannot be fetched", async () => {
    mockFetch.mockImplementation((url: string | URL | Request) => {
      const urlStr =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      if (urlStr.includes("robots.txt"))
        return Promise.resolve(mockTextResponse(""));
      if (urlStr.includes("llms.txt"))
        return Promise.resolve(mockTextResponse("", false));
      return Promise.resolve(new Response("Not Found", { status: 404 }));
    });

    const service = createCompetitorBenchmarkService(deps);
    await expect(
      service.benchmarkCompetitor({
        projectId: "proj-1",
        competitorDomain: "nonexistent.com",
        competitorLimit: 5,
      }),
    ).rejects.toThrow("Could not fetch");
  });

  // ---- Stores correct scoring data ----

  it("passes scoring result to competitorBenchmarks.create", async () => {
    const service = createCompetitorBenchmarkService(deps);
    await service.benchmarkCompetitor({
      projectId: "proj-1",
      competitorDomain: "competitor.com",
      competitorLimit: 5,
    });

    expect(deps.competitorBenchmarks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-1",
        competitorDomain: "competitor.com",
        overallScore: expect.any(Number),
        technicalScore: expect.any(Number),
        contentScore: expect.any(Number),
        aiReadinessScore: expect.any(Number),
        performanceScore: expect.any(Number),
        letterGrade: expect.any(String),
        issueCount: expect.any(Number),
        topIssues: expect.any(Array),
      }),
    );
  });

  // ---- getComparison ----

  it("getComparison returns score deltas", async () => {
    deps.competitorBenchmarks.listByProject.mockResolvedValue([
      {
        competitorDomain: "competitor.com",
        overallScore: 72,
        technicalScore: 80,
        contentScore: 65,
        aiReadinessScore: 70,
        performanceScore: 75,
        letterGrade: "C",
        crawledAt: new Date(),
      },
    ]);

    const service = createCompetitorBenchmarkService(deps);
    const result = await service.getComparison({
      projectId: "proj-1",
      projectScores: {
        overall: 85,
        technical: 90,
        content: 80,
        aiReadiness: 82,
        performance: 88,
        letterGrade: "B",
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].comparison.overall).toBe(13); // 85 - 72
    expect(result[0].comparison.technical).toBe(10); // 90 - 80
    expect(result[0].comparison.content).toBe(15); // 80 - 65
    expect(result[0].comparison.aiReadiness).toBe(12); // 82 - 70
    expect(result[0].comparison.performance).toBe(13); // 88 - 75
    expect(result[0].competitorDomain).toBe("competitor.com");
  });

  // ---- getComparison with no benchmarks ----

  it("getComparison returns empty array when no benchmarks exist", async () => {
    deps.competitorBenchmarks.listByProject.mockResolvedValue([]);

    const service = createCompetitorBenchmarkService(deps);
    const result = await service.getComparison({
      projectId: "proj-1",
      projectScores: {
        overall: 85,
        technical: 90,
        content: 80,
        aiReadiness: 82,
        performance: 88,
        letterGrade: "B",
      },
    });

    expect(result).toHaveLength(0);
  });

  // ---- getComparison deduplicates by domain (takes latest) ----

  it("getComparison deduplicates by domain, keeping first occurrence", async () => {
    deps.competitorBenchmarks.listByProject.mockResolvedValue([
      {
        competitorDomain: "competitor.com",
        overallScore: 80,
        technicalScore: 85,
        contentScore: 75,
        aiReadinessScore: 78,
        performanceScore: 82,
        letterGrade: "B",
        crawledAt: new Date("2026-02-16"),
      },
      {
        competitorDomain: "competitor.com",
        overallScore: 60,
        technicalScore: 65,
        contentScore: 55,
        aiReadinessScore: 58,
        performanceScore: 62,
        letterGrade: "D",
        crawledAt: new Date("2026-02-10"),
      },
    ]);

    const service = createCompetitorBenchmarkService(deps);
    const result = await service.getComparison({
      projectId: "proj-1",
      projectScores: {
        overall: 85,
        technical: 90,
        content: 80,
        aiReadiness: 82,
        performance: 88,
        letterGrade: "B",
      },
    });

    // Should only return one entry per domain
    expect(result).toHaveLength(1);
    // The first entry in the list is the one kept
    expect(result[0].scores.overall).toBe(80);
  });
});
