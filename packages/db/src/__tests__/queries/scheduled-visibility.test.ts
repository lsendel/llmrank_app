import { describe, it, expect, vi, beforeEach } from "vitest";
import { scheduledVisibilityQueryQueries } from "../../queries/scheduled-visibility";

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
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);

  chain.then = vi.fn().mockImplementation((resolve: any) => resolve([]));

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

describe("scheduledVisibilityQueryQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof scheduledVisibilityQueryQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = scheduledVisibilityQueryQueries(mock.db);
  });

  // --- create ---
  it("create inserts with computed nextRunAt", async () => {
    const row = {
      id: "sv1",
      projectId: "p1",
      query: "best seo tools",
      providers: ["chatgpt", "claude"],
      frequency: "daily",
      nextRunAt: new Date(),
    };
    mock.chain.returning.mockResolvedValueOnce([row]);

    const result = await queries.create({
      projectId: "p1",
      query: "best seo tools",
      providers: ["chatgpt", "claude"],
      frequency: "daily",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalled();
    // The values call should include a nextRunAt computed from the frequency
    const valuesArg = mock.chain.values.mock.calls[0][0];
    expect(valuesArg).toHaveProperty("nextRunAt");
    expect(typeof valuesArg.nextRunAt).toBe("string");
    expect(result).toEqual(row);
  });

  // --- listByProject ---
  it("listByProject returns list of scheduled queries", async () => {
    const rows = [
      { id: "sv1", projectId: "p1", query: "test query 1" },
      { id: "sv2", projectId: "p1", query: "test query 2" },
    ];
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve(rows));

    const result = await queries.listByProject("p1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(mock.chain.orderBy).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  // --- getById ---
  it("getById returns row when found", async () => {
    const row = {
      id: "sv1",
      projectId: "p1",
      query: "best seo tools",
      frequency: "daily",
    };
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([row]));

    const result = await queries.getById("sv1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it("getById returns null when not found", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([]));

    const result = await queries.getById("sv-none");

    expect(result).toBeNull();
  });

  // --- update ---
  it("update updates and returns the row", async () => {
    const updated = {
      id: "sv1",
      projectId: "p1",
      query: "updated query",
      enabled: true,
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.update("sv1", { query: "updated query" });

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  it("update recomputes nextRunAt when frequency changes", async () => {
    const updated = {
      id: "sv1",
      projectId: "p1",
      frequency: "weekly",
      nextRunAt: new Date(),
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    await queries.update("sv1", { frequency: "weekly" });

    expect(mock.chain.set).toHaveBeenCalled();
    const setArg = mock.chain.set.mock.calls[0][0];
    expect(setArg).toHaveProperty("nextRunAt");
    expect(typeof setArg.nextRunAt).toBe("string");
    expect(setArg.frequency).toBe("weekly");
  });

  it("update returns null when row does not exist", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.update("sv-none", { enabled: false });

    expect(result).toBeNull();
  });

  // --- delete ---
  it("delete calls delete on db", async () => {
    await queries.delete("sv1");

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
  });

  // --- getDueQueries ---
  it("getDueQueries returns queries that are due", async () => {
    const now = new Date();
    const dueRows = [
      { id: "sv1", query: "test", enabled: true, nextRunAt: now },
      { id: "sv2", query: "test2", enabled: true, nextRunAt: now },
    ];
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve(dueRows));

    const result = await queries.getDueQueries(now);

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(mock.chain.limit).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("getDueQueries returns empty array when none are due", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([]));

    const result = await queries.getDueQueries(new Date());

    expect(result).toEqual([]);
  });

  // --- markRun ---
  it("markRun updates lastRunAt and nextRunAt", async () => {
    const updated = {
      id: "sv1",
      lastRunAt: new Date(),
      nextRunAt: new Date(),
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.markRun("sv1", "daily");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalled();
    const setArg = mock.chain.set.mock.calls[0][0];
    expect(setArg).toHaveProperty("lastRunAt");
    expect(typeof setArg.lastRunAt).toBe("string");
    expect(setArg).toHaveProperty("nextRunAt");
    expect(typeof setArg.nextRunAt).toBe("string");
    expect(result).toEqual(updated);
  });

  it("markRun returns null when row does not exist", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.markRun("sv-none", "hourly");

    expect(result).toBeNull();
  });

  // --- countByProject ---
  it("countByProject returns count from SQL result", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) =>
      resolve([{ count: 5 }]),
    );

    const result = await queries.countByProject("p1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toBe(5);
  });

  it("countByProject returns 0 when no rows", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([]));

    const result = await queries.countByProject("p-empty");

    expect(result).toBe(0);
  });
});
