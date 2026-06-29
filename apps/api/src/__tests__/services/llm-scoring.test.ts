import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks - must be declared before imports
// ---------------------------------------------------------------------------

const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockUpdateDetail = vi.fn().mockResolvedValue(undefined);
const mockClearIssues = vi.fn().mockResolvedValue(undefined);
const mockCreateIssues = vi.fn().mockResolvedValue(undefined);
const mockScoreContent = vi.fn();
const mockListByJob = vi.fn().mockResolvedValue([]);
const mockListPagesByJob = vi.fn().mockResolvedValue([]);
const mockBatchCreate = vi.fn();
const mockBatchJobCreate = vi.fn().mockResolvedValue({ id: "bj-1" });
const mockWorkersScoreContent = vi.fn();

vi.mock("@llm-boost/db", () => ({
  createAppDb: vi.fn().mockReturnValue({}),
  createAgencyDb: vi.fn().mockReturnValue({}),
  scoreQueries: vi.fn(() => ({
    update: mockUpdate,
    updateDetail: mockUpdateDetail,
    clearIssues: mockClearIssues,
    createIssues: mockCreateIssues,
    listByJob: mockListByJob,
  })),
  pageQueries: vi.fn(() => ({
    listByJob: mockListPagesByJob,
  })),
  batchJobQueries: vi.fn(() => ({
    create: mockBatchJobCreate,
  })),
}));

vi.mock("@llm-boost/llm", () => ({
  LLMScorer: vi.fn().mockImplementation(() => ({
    scoreContent: mockScoreContent,
    buildBatchRequests: vi.fn().mockImplementation(async (pages: any[]) => ({
      cached: [],
      requests: pages.map((p: any) => ({ custom_id: p.pageId })),
    })),
    anthropicClient: {
      messages: { batches: { create: mockBatchCreate } },
    },
  })),
  WorkersAiScorer: vi.fn().mockImplementation(() => ({
    scoreContent: mockWorkersScoreContent,
  })),
}));

vi.mock("@llm-boost/scoring", () => ({
  scorePage: vi.fn().mockReturnValue({
    overallScore: 81,
    technicalScore: 80,
    contentScore: 82,
    aiReadinessScore: 83,
    performanceScore: 79,
    letterGrade: "B",
    platformScores: {},
    issues: [],
  }),
  generateRecommendations: vi.fn().mockReturnValue([]),
}));

vi.mock("@llm-boost/shared", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/shared")>();
  return {
    ...orig,
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    })),
  };
});

import {
  runLLMScoring,
  rescoreLLM,
  htmlToScoringText,
} from "../../services/llm-scoring";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockR2Bucket(
  objects: Record<string, { body: string; gzip?: boolean }> = {},
): R2Bucket {
  return {
    get: vi.fn(async (key: string) => {
      const obj = objects[key];
      if (!obj) return null;

      if (obj.gzip) {
        // Create a simple mock for gzip objects
        return {
          body: {
            pipeThrough: vi.fn().mockReturnValue(new ReadableStream()),
          },
          httpMetadata: { contentEncoding: "gzip" },
          text: vi.fn().mockResolvedValue(obj.body),
        };
      }

      return {
        body: new ReadableStream(),
        httpMetadata: {},
        text: vi.fn().mockResolvedValue(obj.body),
      };
    }),
  } as unknown as R2Bucket;
}

function baseLLMInput(overrides: Record<string, unknown> = {}) {
  return {
    databaseUrl: "postgresql://test",
    anthropicApiKey: "sk-test",
    kvNamespace: undefined,
    r2Bucket: createMockR2Bucket({
      "raw/page1.html": {
        body: "<html><body><p>" + "word ".repeat(250) + "</p></body></html>",
      },
    }),
    batchPages: [
      {
        url: "https://example.com/page1",
        status_code: 200,
        title: "Test",
        meta_description: "desc",
        canonical_url: "https://example.com/page1",
        word_count: 500,
        content_hash: "hash123",
        html_r2_key: "raw/page1.html",
        timing_ms: 100,
        redirect_chain: [],
        extracted: {
          h1: [],
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
    insertedPages: [{ id: "page-1", url: "https://example.com/page1" }],
    insertedScores: [{ id: "score-1", pageId: "page-1" }],
    ...overrides,
  };
}

// Five uncached pages → above BATCH_THRESHOLD → exercises the batch path.
function fivePageInput() {
  const r2Objects: Record<string, { body: string }> = {};
  const batchPages = Array.from({ length: 5 }, (_, i) => {
    const key = `raw/page${i}.html`;
    r2Objects[key] = {
      body: "<html><body><p>" + "word ".repeat(250) + "</p></body></html>",
    };
    return {
      ...baseLLMInput().batchPages[0],
      url: `https://example.com/page${i}`,
      content_hash: `hash${i}`,
      html_r2_key: key,
    };
  });
  return {
    ...baseLLMInput(),
    projectId: "11111111-1111-1111-1111-111111111111",
    r2Bucket: createMockR2Bucket(r2Objects),
    batchPages,
    insertedPages: batchPages.map((_, i) => ({
      id: `page-${i}`,
      url: `https://example.com/page${i}`,
    })),
    insertedScores: batchPages.map((_, i) => ({
      id: `score-${i}`,
      pageId: `page-${i}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests - runLLMScoring
// ---------------------------------------------------------------------------

describe("runLLMScoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScoreContent.mockResolvedValue({
      clarity: 8,
      authority: 7,
      structure: 9,
    });
  });

  it("scores a page and updates aggregate score fields", async () => {
    const input = baseLLMInput();
    await runLLMScoring(input as any);

    expect(mockScoreContent).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      "score-1",
      expect.objectContaining({
        overallScore: 81,
        detail: expect.objectContaining({
          llmContentScores: { clarity: 8, authority: 7, structure: 9 },
        }),
      }),
    );
    expect(mockClearIssues).toHaveBeenCalledWith("page-1");
    expect(mockCreateIssues).toHaveBeenCalledWith([]);
  });

  it("skips pages with word_count < 200", async () => {
    const input = baseLLMInput({
      batchPages: [
        {
          ...baseLLMInput().batchPages[0],
          word_count: 100,
          content_hash: "hash123",
        },
      ],
    });
    await runLLMScoring(input as any);

    expect(mockScoreContent).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("skips pages without content_hash", async () => {
    const input = baseLLMInput({
      batchPages: [
        {
          ...baseLLMInput().batchPages[0],
          word_count: 500,
          content_hash: null,
        },
      ],
    });
    await runLLMScoring(input as any);

    expect(mockScoreContent).not.toHaveBeenCalled();
  });

  it("skips when no score row exists for index", async () => {
    const input = baseLLMInput({ insertedScores: [] });
    await runLLMScoring(input as any);

    expect(mockScoreContent).not.toHaveBeenCalled();
  });

  it("skips when R2 object not found", async () => {
    const input = baseLLMInput({
      r2Bucket: createMockR2Bucket({}), // empty - no objects
    });
    await runLLMScoring(input as any);

    expect(mockScoreContent).not.toHaveBeenCalled();
  });

  it("skips when scorer returns null", async () => {
    mockScoreContent.mockResolvedValue(null);
    const input = baseLLMInput();
    await runLLMScoring(input as any);

    expect(mockScoreContent).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("catches errors and continues without throwing", async () => {
    mockScoreContent.mockRejectedValue(new Error("LLM API error"));
    const input = baseLLMInput();

    await expect(runLLMScoring(input as any)).resolves.toBeUndefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  describe("batch path cost-resilience", () => {
    it("does NOT sync re-charge when the batch submits but bookkeeping fails", async () => {
      mockScoreContent.mockResolvedValue({ contentQuality: 80 });
      // Anthropic accepts (and bills) the batch...
      mockBatchCreate.mockResolvedValueOnce({ id: "batch-123" });
      // ...but persisting the batch_jobs row fails.
      mockBatchJobCreate.mockRejectedValueOnce(new Error("supabase down"));

      await expect(
        runLLMScoring(fivePageInput() as any),
      ).resolves.toBeUndefined();

      expect(mockBatchCreate).toHaveBeenCalledTimes(1);
      // The batch is already running/billed — must NOT re-score each page.
      expect(mockScoreContent).not.toHaveBeenCalled();
    });

    it("still falls back to sync when the batch SUBMISSION itself fails", async () => {
      mockScoreContent.mockResolvedValue({ contentQuality: 80 });
      // A transient (non-usage-limit) submit error → sync fallback is correct
      // here because no batch was accepted, so there is no double-charge.
      mockBatchCreate.mockRejectedValueOnce(
        new Error("transient network blip"),
      );

      await runLLMScoring(fivePageInput() as any);

      expect(mockScoreContent).toHaveBeenCalled();
      // bookkeeping never reached on a submit failure
      expect(mockBatchJobCreate).not.toHaveBeenCalled();
    });

    it("does NOT sync-fallback on a hard usage-limit submit error", async () => {
      mockScoreContent.mockResolvedValue({ contentQuality: 80 });
      mockBatchCreate.mockRejectedValueOnce(
        new Error("Your credit balance is too low"),
      );

      await runLLMScoring(fivePageInput() as any);

      // usage_limit short-circuits — pages keep deterministic scores, no storm.
      expect(mockScoreContent).not.toHaveBeenCalled();
    });

    it("scores synchronously (no batch) when projectId is missing", async () => {
      // Without a projectId the batch_jobs row can't be persisted, so an
      // already-billed batch would be orphaned. Score via sync instead.
      mockScoreContent.mockResolvedValue({ contentQuality: 80 });

      await runLLMScoring({ ...fivePageInput(), projectId: undefined } as any);

      expect(mockBatchCreate).not.toHaveBeenCalled();
      expect(mockScoreContent).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests - rescoreLLM
// ---------------------------------------------------------------------------

describe("rescoreLLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScoreContent.mockResolvedValue({
      clarity: 9,
      authority: 8,
      structure: 9,
    });
  });

  it("re-scores all pages in a job and returns results", async () => {
    mockListByJob.mockResolvedValue([{ id: "score-1", pageId: "page-1" }]);
    mockListPagesByJob.mockResolvedValue([
      {
        id: "page-1",
        url: "https://example.com/page1",
        wordCount: 500,
        contentHash: "hash123",
        r2RawKey: "raw/page1.html",
      },
    ]);

    const r2 = createMockR2Bucket({
      "raw/page1.html": {
        body: "<html><body><p>" + "word ".repeat(250) + "</p></body></html>",
      },
    });

    const result = await rescoreLLM({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      r2Bucket: r2,
      jobId: "job-1",
    } as any);

    expect(result.jobId).toBe("job-1");
    expect(result.total).toBe(1);
    expect(result.results[0].status).toBe("scored");
    expect(mockUpdateDetail).toHaveBeenCalledTimes(1);
  });

  it("reports no_page when page not found for score", async () => {
    mockListByJob.mockResolvedValue([
      { id: "score-1", pageId: "page-missing" },
    ]);
    mockListPagesByJob.mockResolvedValue([]);

    const result = await rescoreLLM({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      r2Bucket: createMockR2Bucket(),
      jobId: "job-1",
    } as any);

    expect(result.results[0].status).toBe("no_page");
  });

  it("reports skipped_thin for pages with low word count", async () => {
    mockListByJob.mockResolvedValue([{ id: "score-1", pageId: "page-1" }]);
    mockListPagesByJob.mockResolvedValue([
      {
        id: "page-1",
        url: "https://example.com/thin",
        wordCount: 50,
        contentHash: "hash",
        r2RawKey: "raw/thin.html",
      },
    ]);

    const result = await rescoreLLM({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      r2Bucket: createMockR2Bucket(),
      jobId: "job-1",
    } as any);

    expect(result.results[0].status).toBe("skipped_thin");
  });

  it("reports skipped_thin for pages without content hash", async () => {
    mockListByJob.mockResolvedValue([{ id: "score-1", pageId: "page-1" }]);
    mockListPagesByJob.mockResolvedValue([
      {
        id: "page-1",
        url: "https://example.com/nohash",
        wordCount: 500,
        contentHash: null,
        r2RawKey: "raw/nohash.html",
      },
    ]);

    const result = await rescoreLLM({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      r2Bucket: createMockR2Bucket(),
      jobId: "job-1",
    } as any);

    expect(result.results[0].status).toBe("skipped_thin");
  });

  it("reports no_r2_key when page has no R2 key", async () => {
    mockListByJob.mockResolvedValue([{ id: "score-1", pageId: "page-1" }]);
    mockListPagesByJob.mockResolvedValue([
      {
        id: "page-1",
        url: "https://example.com/nokey",
        wordCount: 500,
        contentHash: "hash",
        r2RawKey: null,
      },
    ]);

    const result = await rescoreLLM({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      r2Bucket: createMockR2Bucket(),
      jobId: "job-1",
    } as any);

    expect(result.results[0].status).toBe("no_r2_key");
  });

  it("reports r2_not_found when R2 object is missing", async () => {
    mockListByJob.mockResolvedValue([{ id: "score-1", pageId: "page-1" }]);
    mockListPagesByJob.mockResolvedValue([
      {
        id: "page-1",
        url: "https://example.com/page1",
        wordCount: 500,
        contentHash: "hash",
        r2RawKey: "raw/missing.html",
      },
    ]);

    const result = await rescoreLLM({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      r2Bucket: createMockR2Bucket({}), // empty
      jobId: "job-1",
    } as any);

    expect(result.results[0].status).toBe("r2_not_found");
  });

  it("reports scorer_returned_null when LLM returns null", async () => {
    mockScoreContent.mockResolvedValue(null);
    mockListByJob.mockResolvedValue([{ id: "score-1", pageId: "page-1" }]);
    mockListPagesByJob.mockResolvedValue([
      {
        id: "page-1",
        url: "https://example.com/page1",
        wordCount: 500,
        contentHash: "hash",
        r2RawKey: "raw/page1.html",
      },
    ]);

    const result = await rescoreLLM({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      r2Bucket: createMockR2Bucket({
        "raw/page1.html": {
          body: "<html><body>" + "word ".repeat(250) + "</body></html>",
        },
      }),
      jobId: "job-1",
    } as any);

    expect(result.results[0].status).toBe("scorer_returned_null");
  });

  it("reports error when scoring throws", async () => {
    mockScoreContent.mockRejectedValue(new Error("API rate limit"));
    mockListByJob.mockResolvedValue([{ id: "score-1", pageId: "page-1" }]);
    mockListPagesByJob.mockResolvedValue([
      {
        id: "page-1",
        url: "https://example.com/page1",
        wordCount: 500,
        contentHash: "hash",
        r2RawKey: "raw/page1.html",
      },
    ]);

    const result = await rescoreLLM({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      r2Bucket: createMockR2Bucket({
        "raw/page1.html": {
          body: "<html><body>" + "word ".repeat(250) + "</body></html>",
        },
      }),
      jobId: "job-1",
    } as any);

    expect(result.results[0].status).toContain("error");
    expect(result.results[0].status).toContain("API rate limit");
  });

  it("reports too_short when extracted text has < 50 words", async () => {
    mockListByJob.mockResolvedValue([{ id: "score-1", pageId: "page-1" }]);
    mockListPagesByJob.mockResolvedValue([
      {
        id: "page-1",
        url: "https://example.com/page1",
        wordCount: 500,
        contentHash: "hash",
        r2RawKey: "raw/page1.html",
      },
    ]);

    // HTML with very little actual text content (tags stripped leaves <50 words)
    const result = await rescoreLLM({
      databaseUrl: "postgresql://test",
      anthropicApiKey: "sk-test",
      r2Bucket: createMockR2Bucket({
        "raw/page1.html": {
          body: "<html><body><p>Short text</p></body></html>",
        },
      }),
      jobId: "job-1",
    } as any);

    expect(result.results[0].status).toMatch(/too_short/);
  });
});

describe("htmlToScoringText", () => {
  it("strips <script> contents (e.g. JSON-LD) so they are not scored as text", () => {
    const html = `<html><body><h1>Cuidado en Costa Rica</h1><p>Regulado por el Ministerio de Salud.</p><script type="application/ld+json">{"@type":"FAQPage","name":"CONAPAM Ley 1850 CPSAM"}</script></body></html>`;
    const text = htmlToScoringText(html);
    expect(text).toContain("Cuidado en Costa Rica");
    expect(text).toContain("Ministerio de Salud");
    // JSON-LD content must NOT leak into the scoreable text
    expect(text).not.toContain("FAQPage");
    expect(text).not.toContain("Ley 1850");
    expect(text).not.toContain("@type");
  });

  it("strips <style> blocks and HTML comments", () => {
    const html = `<html><head><style>.a{color:red}</style></head><body><!-- hidden note --><p>Contenido visible</p></body></html>`;
    const text = htmlToScoringText(html);
    expect(text).toBe("Contenido visible");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("hidden note");
  });

  it("collapses whitespace and trims", () => {
    expect(htmlToScoringText("<p>  hello   world  </p>")).toBe("hello world");
  });
});

describe("runWorkersAiScoring (worker path: input.ai + input.d1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when a page fails to score, so the outbox event retries", async () => {
    mockWorkersScoreContent.mockRejectedValue(
      new Error("Workers AI produced no usable content scores"),
    );
    const input = { ...baseLLMInput(), ai: {}, d1: {} };
    // Re-throw lets the outbox processor bump attempts + re-schedule instead of
    // marking the event completed with the page silently keeping an inflated score.
    await expect(runLLMScoring(input as any)).rejects.toThrow(
      /Workers AI content scoring failed/,
    );
  });

  it("resolves (no throw) when every page scores", async () => {
    mockWorkersScoreContent.mockResolvedValue({
      clarity: 80,
      authority: 70,
      comprehensiveness: 75,
      structure: 80,
      citation_worthiness: 60,
    });
    const input = { ...baseLLMInput(), ai: {}, d1: {} };
    await expect(runLLMScoring(input as any)).resolves.toBeUndefined();
  });
});
