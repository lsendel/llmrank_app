import { describe, it, expect, vi, beforeEach } from "vitest";
import { leadQueries } from "../../queries/leads";
import type { AppDatabase } from "../../d1-client";

// ---------------------------------------------------------------------------
// Mock DB builder – chainable drizzle-like object
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
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);

  chain.then = vi
    .fn()
    .mockImplementation((resolve: (val: unknown) => void) => resolve([]));

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

  return {
    chain,
    queryHandlers,
    db: { ...chain, query: queryProxy } as unknown as AppDatabase,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("leadQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof leadQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = leadQueries(mock.db);
  });

  // --- create ---
  it("create inserts with defaults and returns lead", async () => {
    const lead = {
      id: "lead1",
      email: "test@example.com",
      reportToken: null,
      source: "shared_report",
      scanResultId: null,
    };
    mock.chain.returning.mockResolvedValueOnce([lead]);

    const result = await queries.create({ email: "test@example.com" });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        reportToken: null,
        source: "shared_report",
        scanResultId: null,
      }),
    );
    expect(result).toEqual(lead);
  });

  it("create passes optional fields when provided", async () => {
    const lead = {
      id: "lead2",
      email: "test@example.com",
      reportToken: "tok-abc",
      source: "landing_page",
      scanResultId: "scan1",
    };
    mock.chain.returning.mockResolvedValueOnce([lead]);

    const result = await queries.create({
      email: "test@example.com",
      reportToken: "tok-abc",
      source: "landing_page",
      scanResultId: "scan1",
    });

    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        reportToken: "tok-abc",
        source: "landing_page",
        scanResultId: "scan1",
      }),
    );
    expect(result).toEqual(lead);
  });

  // --- getById ---
  it("getById returns lead when found", async () => {
    const lead = {
      id: "lead1",
      email: "test@example.com",
      source: "shared_report",
    };
    mock.chain.then.mockImplementationOnce((resolve: (val: unknown) => void) =>
      resolve([lead]),
    );

    const result = await queries.getById("lead1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(lead);
  });

  it("getById returns null when not found", async () => {
    mock.chain.then.mockImplementationOnce((resolve: (val: unknown) => void) =>
      resolve([]),
    );

    const result = await queries.getById("nonexistent");

    expect(result).toBeNull();
  });

  // --- findByEmail ---
  it("findByEmail returns lead", async () => {
    const lead = {
      id: "lead1",
      email: "found@example.com",
      source: "shared_report",
    };
    mock.chain.then.mockImplementationOnce((resolve: (val: unknown) => void) =>
      resolve([lead]),
    );

    const result = await queries.findByEmail("found@example.com");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(mock.chain.orderBy).toHaveBeenCalled();
    expect(result).toEqual(lead);
  });

  it("findByEmail returns null when not found", async () => {
    mock.chain.then.mockImplementationOnce((resolve: (val: unknown) => void) =>
      resolve([]),
    );

    const result = await queries.findByEmail("missing@example.com");

    expect(result).toBeNull();
  });

  // --- markConverted ---
  it("markConverted updates and returns lead", async () => {
    const updated = {
      id: "lead1",
      email: "test@example.com",
      convertedAt: expect.any(Date),
      projectId: "p1",
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.markConverted("lead1", "p1");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        convertedAt: expect.any(Date),
        projectId: "p1",
      }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  it("markConverted returns null when lead not found", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.markConverted("nonexistent", "p1");

    expect(result).toBeNull();
  });

  // --- deleteOldUnconverted ---
  it("deleteOldUnconverted returns count of deleted rows", async () => {
    const deletedRows = [{ id: "lead1" }, { id: "lead2" }, { id: "lead3" }];
    mock.chain.returning.mockResolvedValueOnce(deletedRows);

    const result = await queries.deleteOldUnconverted(30);

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toBe(3);
  });

  it("deleteOldUnconverted returns 0 when nothing to delete", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.deleteOldUnconverted(30);

    expect(result).toBe(0);
  });
});
