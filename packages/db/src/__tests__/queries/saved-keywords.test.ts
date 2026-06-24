import { describe, it, expect, vi, beforeEach } from "vitest";
import { savedKeywordQueries } from "../../queries/saved-keywords";

// ---------------------------------------------------------------------------
// Mock DB builder — fluent chain where each builder method returns the chain;
// terminal methods are overridden per-test via mockResolvedValueOnce.
// ---------------------------------------------------------------------------

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of [
    "select",
    "insert",
    "delete",
    "from",
    "where",
    "values",
    "orderBy",
    "groupBy",
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.returning = vi.fn().mockResolvedValue([]);

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

  return { chain, db: { ...chain, query: queryProxy } as any };
}

describe("savedKeywordQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof savedKeywordQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = savedKeywordQueries(mock.db);
  });

  it("listByProject returns the project's saved keywords", async () => {
    const kws = [{ id: "k1", projectId: "p1", keyword: "memory care" }];
    mock.db.query.savedKeywords.findMany.mockResolvedValueOnce(kws);

    const result = await queries.listByProject("p1");

    expect(mock.db.query.savedKeywords.findMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual(kws);
  });

  it("create inserts a keyword with a generated id and returns it", async () => {
    const row = { id: "k2", projectId: "p1", keyword: "assisted living" };
    mock.chain.returning.mockResolvedValueOnce([row]);

    const result = await queries.create({
      projectId: "p1",
      keyword: "assisted living",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        keyword: "assisted living",
        id: expect.any(String),
      }),
    );
    expect(result).toEqual(row);
  });

  it("createMany returns [] for an empty list without touching the db", async () => {
    const result = await queries.createMany([]);

    expect(result).toEqual([]);
    expect(mock.chain.insert).not.toHaveBeenCalled();
  });

  it("createMany inserts every row with a generated id", async () => {
    const rows = [{ id: "k3" }, { id: "k4" }];
    mock.chain.returning.mockResolvedValueOnce(rows);

    const result = await queries.createMany([
      { projectId: "p1", keyword: "a" },
      { projectId: "p1", keyword: "b" },
    ]);

    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ keyword: "a", id: expect.any(String) }),
        expect.objectContaining({ keyword: "b", id: expect.any(String) }),
      ]),
    );
    expect(result).toEqual(rows);
  });

  it("remove deletes by id and returns the deleted row", async () => {
    const row = { id: "k5" };
    mock.chain.returning.mockResolvedValueOnce([row]);

    const result = await queries.remove("k5");

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it("countByProject returns the row count", async () => {
    mock.chain.where.mockResolvedValueOnce([{ count: 7 }]);

    const result = await queries.countByProject("p1");

    expect(result).toBe(7);
  });

  it("countByProject returns 0 when there are no rows", async () => {
    mock.chain.where.mockResolvedValueOnce([]);

    const result = await queries.countByProject("p1");

    expect(result).toBe(0);
  });

  it("countByProjects returns an empty map for no project ids", async () => {
    const result = await queries.countByProjects([]);

    expect(result).toEqual(new Map());
    expect(mock.chain.select).not.toHaveBeenCalled();
  });

  it("countByProjects aggregates counts per project", async () => {
    mock.chain.groupBy.mockResolvedValueOnce([
      { projectId: "p1", count: 3 },
      { projectId: "p2", count: 5 },
    ]);

    const result = await queries.countByProjects(["p1", "p2"]);

    expect(result).toEqual(
      new Map([
        ["p1", 3],
        ["p2", 5],
      ]),
    );
  });
});
