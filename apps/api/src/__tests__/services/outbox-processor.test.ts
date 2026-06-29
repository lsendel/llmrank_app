import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — the processor's handlers are stubbed so we exercise ONLY the drain
// loop (ordering, bounded concurrency, completed/failed bookkeeping). pMap (the
// concurrency primitive) is intentionally left real.
// ---------------------------------------------------------------------------

const { mockRunLLMScoring, mockRunEnrichments, mockGenerateSummary } =
  vi.hoisted(() => ({
    mockRunLLMScoring: vi.fn(),
    mockRunEnrichments: vi.fn(),
    mockGenerateSummary: vi.fn(),
  }));

vi.mock("@llm-boost/db", () => ({
  createAppDb: (d1: unknown) => d1,
  outboxEvents: {
    status: "status",
    availableAt: "availableAt",
    type: "type",
    attempts: "attempts",
    id: "id",
  },
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));

vi.mock("@llm-boost/shared", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

vi.mock("../../services/llm-scoring", () => ({
  runLLMScoring: mockRunLLMScoring,
}));
vi.mock("../../services/enrichments", () => ({
  runIntegrationEnrichments: mockRunEnrichments,
}));
vi.mock("../../services/summary", () => ({
  generateCrawlSummary: mockGenerateSummary,
}));

import { processOutboxEvents } from "../../services/outbox-processor";

// ---------------------------------------------------------------------------
// Fake D1 chain
// ---------------------------------------------------------------------------

function makeDb(events: Array<Record<string, unknown>>) {
  const setCalls: Array<Record<string, unknown>> = [];
  let orderByCalled = false;

  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => {
    orderByCalled = true;
    return chain;
  });
  // First .limit() resolves the main batch select; the second resolves the
  // stale-event sweep (kept empty here).
  chain.limit = vi.fn().mockResolvedValueOnce(events).mockResolvedValueOnce([]);
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn((v: Record<string, unknown>) => {
    setCalls.push(v);
    return chain;
  });
  // Make the chain awaitable so `await db.update().set().where()` resolves while
  // the select path (which ends in the resolved .limit()) is unaffected.
  chain.then = (resolve: (v: unknown) => void) => resolve(undefined);

  return { db: chain, setCalls, orderByCalled: () => orderByCalled };
}

function evt(id: string, type = "llm_scoring") {
  return {
    id,
    type,
    payload: JSON.stringify({ jobId: `job-${id}` }),
    attempts: 0,
    status: "pending",
    availableAt: "2026-06-29T07:00:00.000Z",
  };
}

describe("processOutboxEvents — bounded-parallel drain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests oldest-available-first ordering", async () => {
    const { db, orderByCalled } = makeDb([evt("a")]);
    mockRunLLMScoring.mockResolvedValue(undefined);

    await processOutboxEvents(db as any, { AI: {} as any });

    expect(orderByCalled()).toBe(true);
  });

  it("processes the batch concurrently (capped) and marks each completed", async () => {
    const events = Array.from({ length: 8 }, (_, i) => evt(`e${i}`));
    const { db, setCalls } = makeDb(events);

    let inFlight = 0;
    let peak = 0;
    mockRunLLMScoring.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      // Yield so workers genuinely overlap rather than resolving in lockstep.
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });

    const result = await processOutboxEvents(db as any, { AI: {} as any });

    expect(mockRunLLMScoring).toHaveBeenCalledTimes(8);
    expect(result.processed).toBe(8);
    expect(result.failed).toBe(0);
    // Proves real parallelism without exceeding the EVENT_CONCURRENCY cap (4).
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(4);
    // Every event marked completed.
    const completed = setCalls.filter((s) => s.status === "completed");
    expect(completed).toHaveLength(8);
  });

  it("isolates failures: a throwing event is retried, the rest still complete", async () => {
    const events = [evt("ok1"), evt("bad"), evt("ok2")];
    const { db, setCalls } = makeDb(events);

    mockRunLLMScoring.mockImplementation(async (input: any) => {
      if (input.jobId === "job-bad") throw new Error("scoring boom");
    });

    const result = await processOutboxEvents(db as any, { AI: {} as any });

    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
    // The failed event is re-queued (attempts bumped), not marked completed.
    const retried = setCalls.filter((s) => "attempts" in s);
    expect(retried).toHaveLength(1);
    expect(retried[0].attempts).toBe(1);
    expect(setCalls.filter((s) => s.status === "completed")).toHaveLength(2);
  });
});
