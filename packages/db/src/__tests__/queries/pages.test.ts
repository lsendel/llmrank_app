import { describe, it, expect, vi, beforeEach } from "vitest";
import { pageQueries } from "../../queries/pages";

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

describe("pageQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof pageQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = pageQueries(mock.db);
  });

  // --- createBatch ---
  it("createBatch inserts multiple pages in a single call", async () => {
    const inserted = [
      { id: "pg1", jobId: "j1", projectId: "p1", url: "https://example.com/" },
      {
        id: "pg2",
        jobId: "j1",
        projectId: "p1",
        url: "https://example.com/about",
      },
    ];
    mock.chain.returning.mockResolvedValueOnce(inserted);

    const result = await queries.createBatch([
      { jobId: "j1", projectId: "p1", url: "https://example.com/" },
      { jobId: "j1", projectId: "p1", url: "https://example.com/about" },
    ]);

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("createBatch returns empty array for empty input without querying", async () => {
    const result = await queries.createBatch([]);

    expect(result).toEqual([]);
    expect(mock.chain.insert).not.toHaveBeenCalled();
  });

  it("createBatch passes optional fields when provided", async () => {
    const row = {
      jobId: "j1",
      projectId: "p1",
      url: "https://example.com/",
      title: "Home",
      statusCode: 200,
      wordCount: 500,
      contentHash: "abc123",
    };
    mock.chain.returning.mockResolvedValueOnce([{ id: "pg1", ...row }]);

    const result = await queries.createBatch([row]);

    expect(mock.chain.values).toHaveBeenCalledWith([row]);
    expect(result).toHaveLength(1);
  });

  // --- getById ---
  it("getById returns a page by its id", async () => {
    const page = { id: "pg1", url: "https://example.com/", title: "Home" };
    mock.db.query.pages.findFirst.mockResolvedValueOnce(page);

    const result = await queries.getById("pg1");

    expect(mock.db.query.pages.findFirst).toHaveBeenCalled();
    expect(result).toEqual(page);
  });

  it("getById returns undefined for non-existent page", async () => {
    const result = await queries.getById("pg-none");
    expect(result).toBeUndefined();
  });

  // --- listByJob ---
  it("listByJob returns all pages for a crawl job", async () => {
    const pages = [
      { id: "pg1", jobId: "j1", url: "https://example.com/" },
      { id: "pg2", jobId: "j1", url: "https://example.com/about" },
    ];
    mock.db.query.pages.findMany.mockResolvedValueOnce(pages);

    const result = await queries.listByJob("j1");

    expect(mock.db.query.pages.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("listByJob returns empty array when job has no pages", async () => {
    mock.db.query.pages.findMany.mockResolvedValueOnce([]);

    const result = await queries.listByJob("j-empty");
    expect(result).toEqual([]);
  });
});
