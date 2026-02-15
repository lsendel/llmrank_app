import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks - must be declared before imports
// ---------------------------------------------------------------------------

const mockUpdateDetail = vi.fn().mockResolvedValue(undefined);
const mockScoreContent = vi.fn();
const mockListByJob = vi.fn().mockResolvedValue([]);
const mockListPagesByJob = vi.fn().mockResolvedValue([]);

vi.mock("@llm-boost/db", () => ({
  createDb: vi.fn().mockReturnValue({}),
  scoreQueries: vi.fn(() => ({
    updateDetail: mockUpdateDetail,
    listByJob: mockListByJob,
  })),
  pageQueries: vi.fn(() => ({
    listByJob: mockListPagesByJob,
  })),
}));

vi.mock("@llm-boost/llm", () => ({
  LLMScorer: vi.fn().mockImplementation(() => ({
    scoreContent: mockScoreContent,
  })),
}));

vi.mock("../../lib/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { runLLMScoring, rescoreLLM } from "../../services/llm-scoring";

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

  it("scores a page and updates the detail", async () => {
    const input = baseLLMInput();
    await runLLMScoring(input as any);

    expect(mockScoreContent).toHaveBeenCalledTimes(1);
    expect(mockUpdateDetail).toHaveBeenCalledWith("score-1", {
      llmContentScores: { clarity: 8, authority: 7, structure: 9 },
    });
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
    expect(mockUpdateDetail).not.toHaveBeenCalled();
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
    expect(mockUpdateDetail).not.toHaveBeenCalled();
  });

  it("catches errors and continues without throwing", async () => {
    mockScoreContent.mockRejectedValue(new Error("LLM API error"));
    const input = baseLLMInput();

    await expect(runLLMScoring(input as any)).resolves.toBeUndefined();
    expect(mockUpdateDetail).not.toHaveBeenCalled();
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
