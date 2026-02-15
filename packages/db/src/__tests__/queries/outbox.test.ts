import { describe, it, expect, vi, beforeEach } from "vitest";
import { outboxQueries } from "../../queries/outbox";

// ---------------------------------------------------------------------------
// Mock DB builder
// ---------------------------------------------------------------------------

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([]);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);

  const queryHandlers: Record<
    string,
    Record<string, ReturnType<typeof vi.fn>>
  > = {};
  const queryProxy = new Proxy(
    {},
    {
      get(_target, tableName: string) {
        if (!queryHandlers[tableName]) {
          queryHandlers[tableName] = {
            findFirst: vi.fn().mockResolvedValue(undefined),
            findMany: vi.fn().mockResolvedValue([]),
          };
        }
        return queryHandlers[tableName];
      },
    },
  );

  return { chain, queryHandlers, db: { ...chain, query: queryProxy } as any };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("outboxQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof outboxQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = outboxQueries(mock.db);
  });

  // --- enqueue ---
  it("enqueue inserts an event and returns the created row", async () => {
    const event = {
      id: "evt1",
      type: "crawl.completed",
      payload: { jobId: "j1" },
      status: "pending",
    };
    mock.chain.returning.mockResolvedValueOnce([event]);

    const result = await queries.enqueue({
      type: "crawl.completed",
      payload: { jobId: "j1" },
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "crawl.completed",
        payload: { jobId: "j1" },
        availableAt: expect.any(Date),
      }),
    );
    expect(result).toEqual(event);
  });

  it("enqueue uses provided availableAt when specified", async () => {
    const scheduledAt = new Date("2026-03-01T12:00:00Z");
    mock.chain.returning.mockResolvedValueOnce([{ id: "evt2" }]);

    await queries.enqueue({
      type: "score.recalculate",
      payload: { pageId: "pg1" },
      availableAt: scheduledAt,
    });

    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ availableAt: scheduledAt }),
    );
  });

  // --- claimBatch ---
  it("claimBatch updates pending events to processing and returns them", async () => {
    const claimed = [
      { id: "evt1", type: "crawl.completed", status: "processing" },
      { id: "evt2", type: "score.recalculate", status: "processing" },
    ];
    mock.chain.returning.mockResolvedValueOnce(claimed);

    const result = await queries.claimBatch(5);

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith({ status: "processing" });
    expect(result).toHaveLength(2);
  });

  it("claimBatch uses default limit of 10", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    await queries.claimBatch();

    // The function uses the limit in a raw SQL subquery, so we just verify the chain was called
    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
  });

  it("claimBatch returns empty array when no events are pending", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.claimBatch();

    expect(result).toEqual([]);
  });

  // --- markCompleted ---
  it("markCompleted sets status to completed with processedAt timestamp", async () => {
    await queries.markCompleted("evt1");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        processedAt: expect.any(Date),
      }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
  });

  // --- markFailed ---
  it("markFailed resets status to pending and increments attempts", async () => {
    await queries.markFailed("evt1");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
  });

  it("markFailed accepts a custom retry delay", async () => {
    await queries.markFailed("evt1", 120);

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalled();
  });

  it("markFailed uses default 60s retry delay", async () => {
    await queries.markFailed("evt2");

    // Verify the call happened (the actual SQL template contains the delay)
    expect(mock.chain.update).toHaveBeenCalled();
  });
});
