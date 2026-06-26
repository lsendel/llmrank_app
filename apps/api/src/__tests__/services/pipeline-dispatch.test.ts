import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockUpdateStatus } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdateStatus: vi.fn(),
}));

vi.mock("@llm-boost/db", () => ({
  pipelineRunQueries: () => ({
    create: mockCreate,
    updateStatus: mockUpdateStatus,
  }),
}));

vi.mock("../../middleware/hmac", () => ({
  signPayload: vi.fn(async () => ({ signature: "sig", timestamp: "123" })),
}));

import { dispatchInsightsPipeline } from "../../services/pipeline-dispatch";

const CONFIG = {
  reportServiceUrl: "https://reports.example",
  sharedSecret: "secret",
  anthropicApiKey: "ak",
  perplexityApiKey: "pk",
  xaiApiKey: "xk",
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DB = {} as any;

function res(ok: boolean, status: number, body = "") {
  return { ok, status, text: async () => body };
}

describe("dispatchInsightsPipeline", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockCreate.mockReset().mockResolvedValue({ id: "run-1" });
    mockUpdateStatus.mockReset().mockResolvedValue(undefined);
  });

  it("creates a run and returns pending on a successful dispatch", async () => {
    const fetchMock = vi.fn(async () => res(true, 200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchInsightsPipeline(DB, "p1", "c1", CONFIG);

    expect(result).toEqual({ runId: "run-1", status: "pending" });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", crawlJobId: "c1" }),
    );
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Dispatches to the report service with HMAC headers.
    expect(fetchMock).toHaveBeenCalledWith(
      "https://reports.example/pipeline/run",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Signature": "sig" }),
      }),
    );
  });

  it("retries once after a cold-start failure, then succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect timeout")) // cold machine
      .mockResolvedValueOnce(res(true, 200)); // warm machine
    vi.stubGlobal("fetch", fetchMock);

    const p = dispatchInsightsPipeline(DB, "p1", "c1", CONFIG);
    await vi.advanceTimersByTimeAsync(5000); // skip the inter-attempt delay
    const result = await p;

    expect(result.status).toBe("pending");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("records the failure on the run (not swallowed) when both attempts fail", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res(false, 503, "service unavailable")),
    );

    const p = dispatchInsightsPipeline(DB, "p1", "c1", CONFIG);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await p;

    expect(result.status).toBe("failed");
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "run-1",
      "failed",
      expect.objectContaining({
        error: expect.stringContaining("Failed to dispatch pipeline"),
      }),
    );
    vi.useRealTimers();
  });
});
