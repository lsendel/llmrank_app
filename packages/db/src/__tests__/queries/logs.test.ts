import { describe, it, expect, vi, beforeEach } from "vitest";
import { logQueries } from "../../queries/logs";

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

describe("logQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof logQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = logQueries(mock.db);
  });

  // --- create ---
  it("create inserts a log upload record and returns it", async () => {
    const logUpload = {
      id: "log1",
      projectId: "p1",
      userId: "u1",
      filename: "access.log",
      totalRequests: 1000,
      crawlerRequests: 200,
      uniqueIPs: 50,
      summary: { googlebot: 150, bingbot: 50 },
    };
    mock.chain.returning.mockResolvedValueOnce([logUpload]);

    const result = await queries.create({
      projectId: "p1",
      userId: "u1",
      filename: "access.log",
      totalRequests: 1000,
      crawlerRequests: 200,
      uniqueIPs: 50,
      summary: { googlebot: 150, bingbot: 50 },
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith({
      projectId: "p1",
      userId: "u1",
      filename: "access.log",
      totalRequests: 1000,
      crawlerRequests: 200,
      uniqueIPs: 50,
      summary: { googlebot: 150, bingbot: 50 },
    });
    expect(result).toEqual(logUpload);
  });

  it("create returns the inserted row with generated id", async () => {
    const logUpload = { id: "log2", filename: "error.log" };
    mock.chain.returning.mockResolvedValueOnce([logUpload]);

    const result = await queries.create({
      projectId: "p1",
      userId: "u1",
      filename: "error.log",
      totalRequests: 500,
      crawlerRequests: 10,
      uniqueIPs: 5,
      summary: {},
    });

    expect(result.id).toBe("log2");
  });

  // --- listByProject ---
  it("listByProject returns log uploads ordered by creation date", async () => {
    const logs = [
      {
        id: "log1",
        filename: "access-2.log",
        createdAt: new Date("2026-02-14"),
      },
      {
        id: "log2",
        filename: "access-1.log",
        createdAt: new Date("2026-02-13"),
      },
    ];
    mock.db.query.logUploads.findMany.mockResolvedValueOnce(logs);

    const result = await queries.listByProject("p1");

    expect(mock.db.query.logUploads.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("listByProject uses default limit of 20", async () => {
    mock.db.query.logUploads.findMany.mockResolvedValueOnce([]);

    await queries.listByProject("p1");

    expect(mock.db.query.logUploads.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    );
  });

  it("listByProject accepts a custom limit", async () => {
    mock.db.query.logUploads.findMany.mockResolvedValueOnce([]);

    await queries.listByProject("p1", 5);

    expect(mock.db.query.logUploads.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
    );
  });

  // --- getById ---
  it("getById returns a log upload by its id", async () => {
    const log = { id: "log1", filename: "access.log" };
    mock.db.query.logUploads.findFirst.mockResolvedValueOnce(log);

    const result = await queries.getById("log1");

    expect(mock.db.query.logUploads.findFirst).toHaveBeenCalled();
    expect(result).toEqual(log);
  });

  it("getById returns undefined when log not found", async () => {
    const result = await queries.getById("log-none");
    expect(result).toBeUndefined();
  });
});
