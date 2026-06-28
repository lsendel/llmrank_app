import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListPending = vi.fn();
const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);
const mockRetrieve = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { batches: { retrieve: mockRetrieve } },
  })),
}));

vi.mock("@llm-boost/db", () => ({
  createAgencyDb: vi.fn(() => ({})),
  batchJobQueries: vi.fn(() => ({
    listPending: mockListPending,
    updateStatus: mockUpdateStatus,
  })),
  scoreQueries: vi.fn(() => ({})),
}));

vi.mock("@llm-boost/llm", () => ({
  LLMScorer: vi.fn().mockImplementation(() => ({})),
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

describe("pollPendingBatches — orphan handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks a batch older than 26h failed and never retrieves it", async () => {
    const old = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30h
    mockListPending.mockResolvedValue([
      { id: "bj-1", batchId: "batch-1", createdAt: old },
    ]);

    const res = await pollPendingBatches(env);

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "bj-1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(res.polled).toBe(1);
  });

  it("retrieves (does not orphan-fail) a fresh batch", async () => {
    const fresh = new Date(Date.now() - 60 * 60 * 1000); // 1h
    mockListPending.mockResolvedValue([
      { id: "bj-2", batchId: "batch-2", createdAt: fresh },
    ]);
    mockRetrieve.mockResolvedValue({
      processing_status: "in_progress",
      request_counts: { succeeded: 0, errored: 0 },
    });

    await pollPendingBatches(env);

    expect(mockRetrieve).toHaveBeenCalledWith("batch-2");
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "bj-2",
      expect.objectContaining({ status: "in_progress" }),
    );
    expect(mockUpdateStatus).not.toHaveBeenCalledWith(
      "bj-2",
      expect.objectContaining({ status: "failed" }),
    );
  });
});
