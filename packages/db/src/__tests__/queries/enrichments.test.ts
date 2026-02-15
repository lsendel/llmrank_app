import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichmentQueries } from "../../queries/enrichments";

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

describe("enrichmentQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof enrichmentQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = enrichmentQueries(mock.db);
  });

  // --- createBatch ---
  it("createBatch inserts enrichment rows and returns them", async () => {
    const rows = [
      {
        id: "e1",
        pageId: "pg1",
        jobId: "j1",
        provider: "gsc" as const,
        data: { clicks: 50 },
      },
    ];
    mock.chain.returning.mockResolvedValueOnce(rows);

    const result = await queries.createBatch([
      { pageId: "pg1", jobId: "j1", provider: "gsc", data: { clicks: 50 } },
    ]);

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBe("gsc");
  });

  it("createBatch returns empty array for empty input without inserting", async () => {
    const result = await queries.createBatch([]);

    expect(result).toEqual([]);
    expect(mock.chain.insert).not.toHaveBeenCalled();
  });

  it("createBatch handles multiple providers in one batch", async () => {
    const rows = [
      {
        id: "e1",
        pageId: "pg1",
        jobId: "j1",
        provider: "gsc" as const,
        data: {},
      },
      {
        id: "e2",
        pageId: "pg1",
        jobId: "j1",
        provider: "psi" as const,
        data: {},
      },
      {
        id: "e3",
        pageId: "pg2",
        jobId: "j1",
        provider: "ga4" as const,
        data: {},
      },
    ];
    mock.chain.returning.mockResolvedValueOnce(rows);

    const result = await queries.createBatch([
      { pageId: "pg1", jobId: "j1", provider: "gsc", data: {} },
      { pageId: "pg1", jobId: "j1", provider: "psi", data: {} },
      { pageId: "pg2", jobId: "j1", provider: "ga4", data: {} },
    ]);

    expect(result).toHaveLength(3);
  });

  // --- listByPage ---
  it("listByPage returns all enrichments for a page", async () => {
    const enrichments = [
      { id: "e1", pageId: "pg1", provider: "gsc", data: { clicks: 50 } },
      { id: "e2", pageId: "pg1", provider: "psi", data: { speed: 90 } },
    ];
    mock.db.query.pageEnrichments.findMany.mockResolvedValueOnce(enrichments);

    const result = await queries.listByPage("pg1");

    expect(mock.db.query.pageEnrichments.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("listByPage returns empty array when no enrichments exist", async () => {
    const result = await queries.listByPage("pg-none");
    expect(result).toEqual([]);
  });

  // --- listByJobAndProvider ---
  it("listByJobAndProvider filters by both job and provider", async () => {
    const enrichments = [
      {
        id: "e1",
        pageId: "pg1",
        jobId: "j1",
        provider: "gsc",
        data: { clicks: 50 },
      },
    ];
    mock.db.query.pageEnrichments.findMany.mockResolvedValueOnce(enrichments);

    const result = await queries.listByJobAndProvider("j1", "gsc");

    expect(mock.db.query.pageEnrichments.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("listByJobAndProvider returns empty when provider does not match", async () => {
    mock.db.query.pageEnrichments.findMany.mockResolvedValueOnce([]);

    const result = await queries.listByJobAndProvider("j1", "clarity");
    expect(result).toEqual([]);
  });
});
