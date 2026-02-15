import { describe, it, expect, vi, beforeEach } from "vitest";
import { visibilityQueries } from "../../queries/visibility";

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

  // Make chain thenable for awaited select chains (getTrends)
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

describe("visibilityQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof visibilityQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = visibilityQueries(mock.db);
  });

  // --- create ---
  it("create inserts a visibility check and returns it", async () => {
    const check = {
      id: "v1",
      projectId: "p1",
      llmProvider: "chatgpt",
      query: "best SEO tools",
      brandMentioned: true,
      urlCited: false,
    };
    mock.chain.returning.mockResolvedValueOnce([check]);

    const result = await queries.create({
      projectId: "p1",
      llmProvider: "chatgpt",
      query: "best SEO tools",
      brandMentioned: true,
      urlCited: false,
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(result).toEqual(check);
  });

  it("create handles optional fields correctly", async () => {
    const check = {
      id: "v2",
      projectId: "p1",
      llmProvider: "claude",
      query: "test query",
    };
    mock.chain.returning.mockResolvedValueOnce([check]);

    const result = await queries.create({
      projectId: "p1",
      llmProvider: "claude",
      query: "test query",
    });

    expect(result).toEqual(check);
  });

  // --- listByProject ---
  it("listByProject returns checks ordered by checked_at descending", async () => {
    const checks = [
      { id: "v1", projectId: "p1", query: "query A" },
      { id: "v2", projectId: "p1", query: "query B" },
    ];
    mock.db.query.visibilityChecks.findMany.mockResolvedValueOnce(checks);

    const result = await queries.listByProject("p1");

    expect(mock.db.query.visibilityChecks.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  // --- getById ---
  it("getById returns a visibility check by id", async () => {
    const check = { id: "v1", llmProvider: "perplexity", query: "test" };
    mock.db.query.visibilityChecks.findFirst.mockResolvedValueOnce(check);

    const result = await queries.getById("v1");

    expect(mock.db.query.visibilityChecks.findFirst).toHaveBeenCalled();
    expect(result).toEqual(check);
  });

  it("getById returns undefined for non-existent check", async () => {
    const result = await queries.getById("v-none");
    expect(result).toBeUndefined();
  });

  // --- getTrends ---
  it("getTrends returns weekly aggregated data with number coercion", async () => {
    const rawRows = [
      {
        weekStart: "2026-01-06",
        provider: "chatgpt",
        totalChecks: "5",
        mentionRate: "0.80",
        citationRate: "0.40",
      },
      {
        weekStart: "2026-01-13",
        provider: "claude",
        totalChecks: "3",
        mentionRate: "0.67",
        citationRate: "0.33",
      },
    ];

    mock.chain.then.mockImplementationOnce((resolve: any) => resolve(rawRows));

    const result = await queries.getTrends("p1");

    expect(result).toHaveLength(2);
    // Values should be coerced to numbers
    expect(result[0].mentionRate).toBe(0.8);
    expect(result[0].citationRate).toBe(0.4);
    expect(result[0].totalChecks).toBe(5);
    expect(result[1].mentionRate).toBe(0.67);
    expect(result[1].citationRate).toBe(0.33);
    expect(result[1].totalChecks).toBe(3);
  });

  it("getTrends returns empty array when no data exists", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([]));

    const result = await queries.getTrends("p-empty");

    expect(result).toEqual([]);
  });

  it("getTrends preserves provider name in results", async () => {
    const rawRows = [
      {
        weekStart: "2026-02-10",
        provider: "gemini",
        totalChecks: "2",
        mentionRate: "1.00",
        citationRate: "0.50",
      },
    ];

    mock.chain.then.mockImplementationOnce((resolve: any) => resolve(rawRows));

    const result = await queries.getTrends("p1");

    expect(result[0].provider).toBe("gemini");
    expect(result[0].weekStart).toBe("2026-02-10");
  });
});
