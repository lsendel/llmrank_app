import { describe, it, expect, vi, beforeEach } from "vitest";
import { createIngestService } from "../../services/ingest-service";
import {
  createMockCrawlRepo,
  createMockPageRepo,
  createMockScoreRepo,
  createMockOutboxRepo,
  createMockProjectRepo,
  createMockUserRepo,
} from "../helpers/mock-repositories";
import {
  buildCrawlJob,
  buildProject,
  buildPage,
  buildScore,
} from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  mockPlatformScores,
  mockRecommendations,
  mockDetectContentType,
  mockGenerateRecommendations,
  mockScorePage,
} = vi.hoisted(() => {
  const platformScores = {
    chatgpt: { score: 82, grade: "B", tips: ["tip"] },
    perplexity: { score: 80, grade: "B", tips: ["tip"] },
    claude: { score: 78, grade: "C", tips: ["tip"] },
    gemini: { score: 85, grade: "B", tips: ["tip"] },
    grok: { score: 76, grade: "C", tips: ["tip"] },
  };

  const recommendations = [
    {
      issueCode: "MISSING_CANONICAL",
      title: "Add canonical",
      description: "Desc",
      priority: "high",
      effort: "quick",
      impact: "high",
      estimatedImprovement: 5,
      affectedPlatforms: ["chatgpt"],
    },
  ];

  const detectContentType = vi.fn().mockReturnValue({
    type: "blog_post",
    confidence: 0.8,
    signals: [],
  });

  const generateRecommendations = vi.fn().mockReturnValue(recommendations);

  const scorePage = vi.fn().mockReturnValue({
    overallScore: 85,
    technicalScore: 90,
    contentScore: 80,
    aiReadinessScore: 85,
    performanceScore: 70,
    letterGrade: "B",
    platformScores,
    issues: [
      {
        category: "technical",
        severity: "warning",
        code: "MISSING_CANONICAL",
        message: "Missing canonical URL",
        recommendation: "Add a canonical URL",
        data: null,
      },
    ],
  });

  return {
    mockPlatformScores: platformScores,
    mockRecommendations: recommendations,
    mockDetectContentType: detectContentType,
    mockGenerateRecommendations: generateRecommendations,
    mockScorePage: scorePage,
  };
});

vi.mock("@llm-boost/scoring", () => ({
  scorePage: mockScorePage,
  detectContentType: mockDetectContentType,
  generateRecommendations: mockGenerateRecommendations,
}));

vi.mock("../../services/llm-scoring", () => ({
  runLLMScoring: vi.fn().mockResolvedValue(undefined),
  rescoreLLM: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/enrichments", () => ({
  runIntegrationEnrichments: vi.fn().mockResolvedValue(undefined),
}));

const persistSummaryMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

vi.mock("../../services/summary", () => ({
  generateCrawlSummary: vi.fn().mockResolvedValue(undefined),
  persistCrawlSummaryData: persistSummaryMock,
}));

vi.mock("../../services/notification-service", () => ({
  createNotificationService: vi.fn().mockReturnValue({
    sendCrawlComplete: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../services/frontier-service", () => ({
  createFrontierService: vi.fn().mockReturnValue({
    isSeen: vi.fn().mockResolvedValue(false),
    markSeen: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@llm-boost/db", () => ({
  createDb: vi.fn().mockReturnValue({}),
  projectQueries: vi.fn().mockReturnValue({
    getById: vi.fn().mockResolvedValue({
      id: "proj-1",
      pipelineSettings: { autoRunOnCrawl: false },
    }),
  }),
  outboxEvents: { crawlCompleted: "crawl.completed" },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validBatchPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    job_id: "crawl-1",
    batch_index: 0,
    is_final: false,
    pages: [
      {
        url: "https://example.com/page1",
        status_code: 200,
        title: "Test Page",
        meta_description: "A test page",
        canonical_url: "https://example.com/page1",
        word_count: 500,
        content_hash: "abc123",
        html_r2_key: "raw/page1.html",
        timing_ms: 150,
        redirect_chain: [],
        extracted: {
          h1: ["Test"],
          h2: [],
          h3: [],
          h4: [],
          h5: [],
          h6: [],
          schema_types: [],
          internal_links: [],
          external_links: [],
          images_without_alt: 0,
          has_robots_meta: false,
          robots_directives: [],
          text_length: 6000,
          html_length: 15000,
        },
        lighthouse: null,
      },
    ],
    stats: {
      pages_found: 10,
      pages_crawled: 1,
      pages_errored: 0,
      elapsed_s: 5,
    },
    ...overrides,
  });
}

function makeMockEnv(): any {
  return {
    databaseUrl: "postgresql://test",
    r2: {} as R2Bucket,
  };
}

function makeMockCtx(): any {
  return {
    waitUntil: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IngestService", () => {
  let crawls: ReturnType<typeof createMockCrawlRepo>;
  let pages: ReturnType<typeof createMockPageRepo>;
  let scores: ReturnType<typeof createMockScoreRepo>;
  let outbox: ReturnType<typeof createMockOutboxRepo>;
  let _projects: ReturnType<typeof createMockProjectRepo>;
  let _users: ReturnType<typeof createMockUserRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    crawls = createMockCrawlRepo({
      getById: vi.fn().mockResolvedValue(
        buildCrawlJob({
          id: "crawl-1",
          status: "pending",
          projectId: "proj-1",
        }),
      ),
    });
    pages = createMockPageRepo({
      createBatch: vi.fn().mockResolvedValue([
        buildPage({
          id: "page-1",
          url: "https://example.com/page1",
          projectId: "proj-1",
        }),
      ]),
    });
    scores = createMockScoreRepo({
      createBatch: vi.fn().mockResolvedValue([buildScore({ id: "score-1" })]),
    });
    outbox = createMockOutboxRepo();
    _projects = createMockProjectRepo();
    _users = createMockUserRepo();
  });

  // ---- Validation ----

  it("rejects invalid JSON", async () => {
    const service = createIngestService({ crawls, pages, scores });
    await expect(
      service.processBatch({
        rawBody: "not json{{{",
        env: makeMockEnv(),
        executionCtx: makeMockCtx(),
      }),
    ).rejects.toThrow("Invalid JSON payload");
  });

  it("rejects payload that fails schema validation", async () => {
    const service = createIngestService({ crawls, pages, scores });
    await expect(
      service.processBatch({
        rawBody: JSON.stringify({ bad: "data" }),
        env: makeMockEnv(),
        executionCtx: makeMockCtx(),
      }),
    ).rejects.toThrow("Invalid batch payload");
  });

  it("throws NOT_FOUND when crawl job does not exist", async () => {
    crawls.getById.mockResolvedValue(undefined);
    const service = createIngestService({ crawls, pages, scores });
    await expect(
      service.processBatch({
        rawBody: validBatchPayload(),
        env: makeMockEnv(),
        executionCtx: makeMockCtx(),
      }),
    ).rejects.toThrow("Crawl job not found");
  });

  // ---- Status transitions ----

  it("transitions pending job to crawling on first batch", async () => {
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload(),
      env: makeMockEnv(),
      executionCtx: makeMockCtx(),
    });

    expect(crawls.updateStatus).toHaveBeenCalledWith(
      "crawl-1",
      expect.objectContaining({ status: "crawling" }),
    );
  });

  it("transitions queued job to crawling on first batch", async () => {
    crawls.getById.mockResolvedValue(
      buildCrawlJob({ id: "crawl-1", status: "queued", projectId: "proj-1" }),
    );
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload(),
      env: makeMockEnv(),
      executionCtx: makeMockCtx(),
    });

    // First call transitions to crawling
    expect(crawls.updateStatus).toHaveBeenCalledWith(
      "crawl-1",
      expect.objectContaining({ status: "crawling" }),
    );
  });

  it("stores platform scores, recommendations, and detected content type", async () => {
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload(),
      env: makeMockEnv(),
      executionCtx: makeMockCtx(),
    });

    const pageRow = pages.createBatch.mock.calls[0][0][0];
    expect(pageRow.contentType).toBe("blog_post");
    expect(pageRow.textLength).toBe(6000);
    expect(pageRow.htmlLength).toBe(15000);

    const scoreRow = scores.createBatch.mock.calls[0][0][0];
    expect(scoreRow.platformScores).toEqual(mockPlatformScores);
    expect(scoreRow.recommendations).toEqual(mockRecommendations);
    expect(mockGenerateRecommendations).toHaveBeenCalled();
  });

  it("does not re-transition already crawling job", async () => {
    crawls.getById.mockResolvedValue(
      buildCrawlJob({ id: "crawl-1", status: "crawling", projectId: "proj-1" }),
    );
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload(),
      env: makeMockEnv(),
      executionCtx: makeMockCtx(),
    });

    // updateStatus is called for scoring + final status, but not for initial transition
    const calls = crawls.updateStatus.mock.calls;
    const transitionCall = calls.find(
      (c: any) => c[1].status === "crawling" && c[1].startedAt,
    );
    expect(transitionCall).toBeUndefined();
  });

  // ---- Page insertion and scoring ----

  it("inserts pages and creates scores", async () => {
    const service = createIngestService({ crawls, pages, scores, outbox });
    const result = await service.processBatch({
      rawBody: validBatchPayload(),
      env: makeMockEnv(),
      executionCtx: makeMockCtx(),
    });

    expect(pages.createBatch).toHaveBeenCalledTimes(1);
    expect(scores.createBatch).toHaveBeenCalledTimes(1);
    expect(scores.createIssues).toHaveBeenCalledTimes(1);
    expect(result.pages_processed).toBe(1);
    expect(result.job_id).toBe("crawl-1");
  });

  it("creates issue rows from scoring results", async () => {
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload(),
      env: makeMockEnv(),
      executionCtx: makeMockCtx(),
    });

    expect(scores.createIssues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          pageId: "page-1",
          jobId: "crawl-1",
          code: "MISSING_CANONICAL",
        }),
      ]),
    );
  });

  // ---- Final batch ----

  it("sets status to complete on final batch", async () => {
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload({ is_final: true }),
      env: makeMockEnv(),
      executionCtx: makeMockCtx(),
    });

    const lastStatusCall = crawls.updateStatus.mock.calls.at(-1);
    expect(lastStatusCall?.[1]).toMatchObject({
      status: "complete",
      completedAt: expect.any(Date),
    });
  });

  it("keeps status as crawling for non-final batch", async () => {
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload({ is_final: false }),
      env: makeMockEnv(),
      executionCtx: makeMockCtx(),
    });

    const lastStatusCall = crawls.updateStatus.mock.calls.at(-1);
    expect(lastStatusCall?.[1]).toMatchObject({ status: "crawling" });
  });

  // ---- Return value ----

  it("returns batch summary with correct fields", async () => {
    const service = createIngestService({ crawls, pages, scores, outbox });
    const result = await service.processBatch({
      rawBody: validBatchPayload({ batch_index: 3 }),
      env: makeMockEnv(),
      executionCtx: makeMockCtx(),
    });

    expect(result).toEqual({
      job_id: "crawl-1",
      batch_index: 3,
      pages_processed: 1,
      is_final: false,
    });
  });

  // ---- rescoreLLMJob ----

  it("throws when anthropic key is not set for rescore", () => {
    const service = createIngestService({ crawls, pages, scores });
    expect(() =>
      service.rescoreLLMJob({
        jobId: "crawl-1",
        env: { ...makeMockEnv(), anthropicApiKey: undefined },
      }),
    ).toThrow("ANTHROPIC_API_KEY not set");
  });

  it("calls rescoreLLM when anthropic key is set", () => {
    const service = createIngestService({ crawls, pages, scores });
    const env = {
      ...makeMockEnv(),
      anthropicApiKey: "sk-test",
      kvNamespace: undefined,
    };
    // Should not throw
    expect(() =>
      service.rescoreLLMJob({ jobId: "crawl-1", env }),
    ).not.toThrow();
  });

  // ---- Post-processing paths ----

  it("enqueues LLM scoring via outbox when anthropicApiKey is set and outbox exists", async () => {
    const env = {
      ...makeMockEnv(),
      anthropicApiKey: "sk-test",
    };
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload(),
      env,
      executionCtx: makeMockCtx(),
    });

    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: "llm_scoring" }),
    );
  });

  it("uses waitUntil when outbox is not available", async () => {
    const env = {
      ...makeMockEnv(),
      anthropicApiKey: "sk-test",
    };
    const ctx = makeMockCtx();
    const service = createIngestService({ crawls, pages, scores });
    await service.processBatch({
      rawBody: validBatchPayload(),
      env,
      executionCtx: ctx,
    });

    // When no outbox, should use waitUntil for deferred processing
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it("enqueues integration enrichments on final batch when keys are set", async () => {
    const env = {
      ...makeMockEnv(),
      integrationKey: "int-key",
      googleClientId: "goog-id",
      googleClientSecret: "goog-secret",
    };
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload({ is_final: true }),
      env,
      executionCtx: makeMockCtx(),
    });

    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: "integration_enrichment" }),
    );
  });

  it("does not enqueue enrichments when not final batch", async () => {
    const env = {
      ...makeMockEnv(),
      integrationKey: "int-key",
      googleClientId: "goog-id",
      googleClientSecret: "goog-secret",
    };
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload({ is_final: false }),
      env,
      executionCtx: makeMockCtx(),
    });

    const enrichmentCalls = outbox.enqueue.mock.calls.filter(
      (c: any) => c[0]?.type === "integration_enrichment",
    );
    expect(enrichmentCalls).toHaveLength(0);
  });

  it("enqueues crawl summary on final batch when anthropicApiKey is set", async () => {
    const env = {
      ...makeMockEnv(),
      anthropicApiKey: "sk-test",
    };
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload({ is_final: true }),
      env,
      executionCtx: makeMockCtx(),
    });

    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: "crawl_summary" }),
    );
  });

  it("does not enqueue summary when not final batch", async () => {
    const env = {
      ...makeMockEnv(),
      anthropicApiKey: "sk-test",
    };
    const service = createIngestService({ crawls, pages, scores, outbox });
    await service.processBatch({
      rawBody: validBatchPayload({ is_final: false }),
      env,
      executionCtx: makeMockCtx(),
    });

    const summaryCalls = outbox.enqueue.mock.calls.filter(
      (c: any) => c[0]?.type === "crawl_summary",
    );
    expect(summaryCalls).toHaveLength(0);
  });

  it("invalidates KV cache on final batch when kvNamespace and projects are available", async () => {
    const mockKv = {
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const env = {
      ...makeMockEnv(),
      kvNamespace: mockKv as any,
    };
    const ctx = makeMockCtx();
    const service = createIngestService({
      crawls,
      pages,
      scores,
      outbox,
      projects: createMockProjectRepo({
        getById: vi.fn().mockResolvedValue(buildProject()),
      }),
    });

    await service.processBatch({
      rawBody: validBatchPayload({ is_final: true }),
      env,
      executionCtx: ctx,
    });

    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it("sends notification on final batch when resendApiKey is set", async () => {
    const env = {
      ...makeMockEnv(),
      resendApiKey: "re_test_key",
    };
    const ctx = makeMockCtx();
    const projectsRepo = createMockProjectRepo({
      getById: vi.fn().mockResolvedValue(buildProject()),
    });
    const usersRepo = createMockUserRepo();
    const service = createIngestService({
      crawls,
      pages,
      scores,
      outbox,
      projects: projectsRepo,
      users: usersRepo,
    });

    await service.processBatch({
      rawBody: validBatchPayload({ is_final: true }),
      env,
      executionCtx: ctx,
    });

    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  // ---- Frontier / Queue integration ----
  // Note: frontier service is created internally and uses KV/Queue from env.
  // Testing at this level requires deeper mocking of createFrontierService.

  // ---- Multiple pages ----

  it("processes multiple pages in a single batch", async () => {
    pages.createBatch.mockResolvedValue([
      buildPage({
        id: "page-1",
        url: "https://example.com/page1",
        projectId: "proj-1",
      }),
      buildPage({
        id: "page-2",
        url: "https://example.com/page2",
        projectId: "proj-1",
      }),
    ]);
    scores.createBatch.mockResolvedValue([
      buildScore({ id: "score-1" }),
      buildScore({ id: "score-2" }),
    ]);

    const twoPagePayload = JSON.stringify({
      job_id: "crawl-1",
      batch_index: 0,
      is_final: false,
      pages: [
        {
          url: "https://example.com/page1",
          status_code: 200,
          title: "Page 1",
          meta_description: "Desc 1",
          canonical_url: "https://example.com/page1",
          word_count: 500,
          content_hash: "hash1",
          html_r2_key: "raw/p1.html",
          timing_ms: 100,
          redirect_chain: [],
          extracted: {
            h1: ["P1"],
            h2: [],
            h3: [],
            h4: [],
            h5: [],
            h6: [],
            schema_types: [],
            internal_links: [],
            external_links: [],
            images_without_alt: 0,
            has_robots_meta: false,
            robots_directives: [],
          },
          lighthouse: null,
        },
        {
          url: "https://example.com/page2",
          status_code: 200,
          title: "Page 2",
          meta_description: "Desc 2",
          canonical_url: "https://example.com/page2",
          word_count: 800,
          content_hash: "hash2",
          html_r2_key: "raw/p2.html",
          timing_ms: 200,
          redirect_chain: [],
          extracted: {
            h1: ["P2"],
            h2: [],
            h3: [],
            h4: [],
            h5: [],
            h6: [],
            schema_types: [],
            internal_links: [],
            external_links: [],
            images_without_alt: 0,
            has_robots_meta: false,
            robots_directives: [],
          },
          lighthouse: null,
        },
      ],
      stats: {
        pages_found: 20,
        pages_crawled: 2,
        pages_errored: 0,
        elapsed_s: 10,
      },
    });

    const service = createIngestService({ crawls, pages, scores, outbox });
    const result = await service.processBatch({
      rawBody: twoPagePayload,
      env: makeMockEnv(),
      executionCtx: makeMockCtx(),
    });

    expect(result.pages_processed).toBe(2);
    expect(pages.createBatch).toHaveBeenCalledTimes(1);
    expect(scores.createBatch).toHaveBeenCalledTimes(1);
  });
});
