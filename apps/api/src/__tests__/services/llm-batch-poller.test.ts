import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (declared before imports)
// ---------------------------------------------------------------------------
const {
  mockRetrieve,
  mockResults,
  mockCrawlGetById,
  mockPageGetById,
  mockProcessBatchResult,
  mockSetCachedScore,
  mockRescore,
  mockMarkStatus,
  mockRecordUsage,
  mockEstimateCost,
} = vi.hoisted(() => ({
  mockRetrieve: vi.fn(),
  mockResults: vi.fn(),
  mockCrawlGetById: vi.fn(),
  mockPageGetById: vi.fn(),
  mockProcessBatchResult: vi.fn(),
  mockSetCachedScore: vi.fn().mockResolvedValue(undefined),
  mockRescore: vi.fn().mockResolvedValue("updated"),
  mockMarkStatus: vi.fn().mockResolvedValue(undefined),
  mockRecordUsage: vi.fn().mockResolvedValue(undefined),
  mockEstimateCost: vi.fn().mockReturnValue(0.4),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { batches: { retrieve: mockRetrieve, results: mockResults } },
  })),
}));

vi.mock("@llm-boost/db", () => ({
  createAppDb: vi.fn().mockReturnValue({}),
  crawlQueries: vi.fn(() => ({ getById: mockCrawlGetById })),
  pageQueries: vi.fn(() => ({ getById: mockPageGetById })),
}));

vi.mock("@llm-boost/llm", () => ({
  LLMScorer: vi.fn().mockImplementation(() => ({
    processBatchResult: mockProcessBatchResult,
  })),
  estimateCostUsd: mockEstimateCost,
  setCachedScore: mockSetCachedScore,
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

vi.mock("../../services/factor-rescoring", () => ({
  buildSiteContext: vi.fn().mockReturnValue({}),
  rescorePageFromStored: mockRescore,
}));

vi.mock("../../services/llm-scoring", () => ({
  LLM_BATCH_KV_PREFIX: "llm-batch:",
  markLLMStatus: mockMarkStatus,
  recordContentScoringUsage: mockRecordUsage,
}));

import { pollLLMScoreBatches } from "../../services/llm-batch-poller";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeKV(keys: { name: string }[], store: Record<string, unknown>) {
  return {
    list: vi.fn().mockResolvedValue({ keys }),
    get: vi.fn(async (name: string) => store[name] ?? null),
    delete: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
  };
}

const META = {
  jobId: "job-1",
  projectId: "proj-1",
  ownerId: "user-1",
  plan: "agency",
  model: "claude-sonnet-5",
  submittedAt: new Date().toISOString(),
};
const SCORES = {
  clarity: 88,
  authority: 80,
  comprehensiveness: 85,
  structure: 86,
  citation_worthiness: 78,
};

describe("pollLLMScoreBatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetCachedScore.mockResolvedValue(undefined);
    mockRescore.mockResolvedValue("updated");
    mockMarkStatus.mockResolvedValue(undefined);
    mockRecordUsage.mockResolvedValue(undefined);
    mockEstimateCost.mockReturnValue(0.4);
    mockCrawlGetById.mockResolvedValue({ id: "job-1", siteContext: null });
    mockPageGetById.mockResolvedValue({
      id: "page-1",
      contentHash: "hash-1",
      url: "https://e.com/",
    });
    mockProcessBatchResult.mockReturnValue(SCORES);
  });

  it("returns early when there are no pending batches", async () => {
    const kv = makeKV([], {});
    const res = await pollLLMScoreBatches({
      d1: {} as never,
      ANTHROPIC_API_KEY: "sk",
      KV: kv as never,
    });
    expect(res).toEqual({ polled: 0, completed: 0 });
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it("applies an ended batch: rescore + KV cache backfill + 50% usage + status ok + key deleted", async () => {
    const kv = makeKV([{ name: "llm-batch:batch_1" }], {
      "llm-batch:batch_1": META,
    });
    mockRetrieve.mockResolvedValue({
      processing_status: "ended",
      request_counts: { succeeded: 1, errored: 0 },
    });
    mockResults.mockResolvedValue([
      {
        custom_id: "page-1",
        result: {
          type: "succeeded",
          message: { usage: { input_tokens: 5000, output_tokens: 50 } },
        },
      },
    ]);

    const res = await pollLLMScoreBatches({
      d1: {} as never,
      ANTHROPIC_API_KEY: "sk",
      KV: kv as never,
    });

    expect(mockRescore).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", llmScores: SCORES }),
    );
    // Cache backfilled so an unchanged re-crawl is free.
    expect(mockSetCachedScore).toHaveBeenCalledWith(
      kv,
      "hash-1",
      SCORES,
      "claude-sonnet-5",
    );
    // One aggregated usage row at 50% of standard price (0.4 * 0.5).
    expect(mockRecordUsage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        inputTokens: 5000,
        outputTokens: 50,
        model: "claude-sonnet-5",
        costUsd: 0.2,
      }),
    );
    expect(mockMarkStatus).toHaveBeenCalledWith(
      kv,
      "job-1",
      expect.objectContaining({ status: "ok", scored: 1, failed: 0 }),
    );
    expect(kv.delete).toHaveBeenCalledWith("llm-batch:batch_1");
    expect(res.completed).toBe(1);
  });

  it("leaves a still-processing batch pending (no apply, no delete)", async () => {
    const kv = makeKV([{ name: "llm-batch:batch_2" }], {
      "llm-batch:batch_2": META,
    });
    mockRetrieve.mockResolvedValue({
      processing_status: "in_progress",
      request_counts: { succeeded: 0, errored: 0 },
    });

    await pollLLMScoreBatches({
      d1: {} as never,
      ANTHROPIC_API_KEY: "sk",
      KV: kv as never,
    });

    expect(mockResults).not.toHaveBeenCalled();
    expect(mockRescore).not.toHaveBeenCalled();
    expect(kv.delete).not.toHaveBeenCalled();
  });

  it("gives up on a gone (expired/not-found) batch: status unavailable + key deleted", async () => {
    const kv = makeKV([{ name: "llm-batch:batch_3" }], {
      "llm-batch:batch_3": META,
    });
    mockRetrieve.mockRejectedValue(new Error("batch not found / expired"));

    await pollLLMScoreBatches({
      d1: {} as never,
      ANTHROPIC_API_KEY: "sk",
      KV: kv as never,
    });

    expect(mockMarkStatus).toHaveBeenCalledWith(
      kv,
      "job-1",
      expect.objectContaining({ status: "unavailable" }),
    );
    expect(kv.delete).toHaveBeenCalledWith("llm-batch:batch_3");
  });
});
