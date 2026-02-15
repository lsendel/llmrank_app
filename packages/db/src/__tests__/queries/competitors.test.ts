import { describe, it, expect, vi, beforeEach } from "vitest";
import { competitorQueries } from "../../queries/competitors";

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

describe("competitorQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof competitorQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = competitorQueries(mock.db);
  });

  // --- getById ---
  it("getById returns a competitor by id", async () => {
    const competitor = { id: "c1", projectId: "p1", domain: "competitor.com" };
    mock.db.query.competitors.findFirst.mockResolvedValueOnce(competitor);

    const result = await queries.getById("c1");

    expect(mock.db.query.competitors.findFirst).toHaveBeenCalled();
    expect(result).toEqual(competitor);
  });

  it("getById returns undefined when competitor not found", async () => {
    const result = await queries.getById("c-none");
    expect(result).toBeUndefined();
  });

  // --- listByProject ---
  it("listByProject returns all competitors for a project", async () => {
    const competitors = [
      { id: "c1", projectId: "p1", domain: "rival-a.com" },
      { id: "c2", projectId: "p1", domain: "rival-b.com" },
    ];
    mock.db.query.competitors.findMany.mockResolvedValueOnce(competitors);

    const result = await queries.listByProject("p1");

    expect(mock.db.query.competitors.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("listByProject returns empty array when project has no competitors", async () => {
    const result = await queries.listByProject("p-empty");
    expect(result).toEqual([]);
  });

  // --- add ---
  it("add inserts a new competitor and returns it", async () => {
    const competitor = { id: "c3", projectId: "p1", domain: "new-rival.com" };
    mock.chain.returning.mockResolvedValueOnce([competitor]);

    const result = await queries.add("p1", "new-rival.com");

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith({
      projectId: "p1",
      domain: "new-rival.com",
    });
    expect(result).toEqual(competitor);
  });

  // --- remove ---
  it("remove deletes a competitor and returns the deleted row", async () => {
    const deleted = { id: "c1", projectId: "p1", domain: "removed.com" };
    mock.chain.returning.mockResolvedValueOnce([deleted]);

    const result = await queries.remove("c1");

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(deleted);
  });

  it("remove returns undefined when competitor does not exist", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.remove("c-nonexistent");

    expect(result).toBeUndefined();
  });
});
