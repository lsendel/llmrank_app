import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListPending = vi.fn();
const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);
const mockRetrieve = vi.fn();
const mockResults = vi.fn();
const mockGetByPage = vi.fn();
const mockUpdateDetail = vi.fn().mockResolvedValue(undefined);
const mockProcessBatchResult = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { batches: { retrieve: mockRetrieve, results: mockResults } },
  })),
}));

vi.mock("@llm-boost/db", () => ({
  createAgencyDb: vi.fn(() => ({})),
  batchJobQueries: vi.fn(() => ({
    listPending: mockListPending,
    updateStatus: mockUpdateStatus,
  })),
  scoreQueries: vi.fn(() => ({
    getByPage: mockGetByPage,
    updateDetail: mockUpdateDetail,
  })),
}));

vi.mock("@llm-boost/llm", () => ({
  LLMScorer: vi.fn().mockImplementation(() => ({
    processBatchResult: mockProcessBatchResult,
  })),
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
    })),
  };
});

import { pollPendingBatches } from "../../services/batch-polling-service";

const env = { AGENCY_DB_URL: "postgres://x", ANTHROPIC_API_KEY: "sk-test" };
const hours = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

describe("pollPendingBatches — orphan handling (retrieve-first)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retrieves a stale-but-COMPLETED batch and applies results (never discards)", async () => {
    mockListPending.mockResolvedValue([
      { id: "bj-1", batchId: "batch-1", createdAt: hours(30) }, // 30h old
    ]);
    mockRetrieve.mockResolvedValue({
      processing_status: "ended",
      request_counts: { succeeded: 1, errored: 0 },
    });
    mockResults.mockResolvedValue([
      { custom_id: "page-1", result: { type: "succeeded", message: {} } },
    ]);
    mockProcessBatchResult.mockReturnValue({ clarity: 9 });
    mockGetByPage.mockResolvedValue({ id: "score-1" });

    await pollPendingBatches(env);

    expect(mockRetrieve).toHaveBeenCalledWith("batch-1");
    expect(mockUpdateDetail).toHaveBeenCalledWith("score-1", {
      llmContentScores: { clarity: 9 },
    });
    // Completed, NOT failed — results were applied.
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "bj-1",
      expect.objectContaining({ status: "completed" }),
    );
    expect(mockUpdateStatus).not.toHaveBeenCalledWith(
      "bj-1",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("marks a CONFIRMED-GONE batch failed (404/not found)", async () => {
    mockListPending.mockResolvedValue([
      { id: "bj-2", batchId: "batch-2", createdAt: hours(30) },
    ]);
    mockRetrieve.mockRejectedValue(new Error("404 not found"));

    await pollPendingBatches(env);

    expect(mockRetrieve).toHaveBeenCalledWith("batch-2");
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "bj-2",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("leaves a stale batch with a TRANSIENT error pending (no fail, retry next tick)", async () => {
    mockListPending.mockResolvedValue([
      { id: "bj-5", batchId: "batch-5", createdAt: hours(30) }, // stale
    ]);
    mockRetrieve.mockRejectedValue(new Error("503 service unavailable"));

    await pollPendingBatches(env);

    // Transient — must NOT be marked failed (the batch may still be collectible).
    expect(mockUpdateStatus).not.toHaveBeenCalledWith(
      "bj-5",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("marks a stale STUCK batch failed (still not ended past expiry)", async () => {
    mockListPending.mockResolvedValue([
      { id: "bj-3", batchId: "batch-3", createdAt: hours(30) },
    ]);
    mockRetrieve.mockResolvedValue({
      processing_status: "in_progress",
      request_counts: { succeeded: 0, errored: 0 },
    });

    await pollPendingBatches(env);

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "bj-3",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("does NOT fail a fresh in-progress batch (leaves it pending)", async () => {
    mockListPending.mockResolvedValue([
      { id: "bj-4", batchId: "batch-4", createdAt: hours(1) }, // 1h old
    ]);
    mockRetrieve.mockResolvedValue({
      processing_status: "in_progress",
      request_counts: { succeeded: 0, errored: 0 },
    });

    await pollPendingBatches(env);

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "bj-4",
      expect.objectContaining({ status: "in_progress" }),
    );
    expect(mockUpdateStatus).not.toHaveBeenCalledWith(
      "bj-4",
      expect.objectContaining({ status: "failed" }),
    );
  });
});
