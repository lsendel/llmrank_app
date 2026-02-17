import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  crawlInsightQueries,
  pageInsightQueries,
} from "../../queries/insights";

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);

  const transaction = vi.fn(async (cb: (tx: typeof chain) => Promise<void>) => {
    await cb(chain as any);
  });

  const db = { ...chain, transaction } as any;
  return { db, chain, transaction };
}

describe("crawlInsightQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof crawlInsightQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = crawlInsightQueries(mock.db);
  });

  it("replaceForCrawl deletes previous rows and inserts new ones", async () => {
    const rows = [
      {
        crawlId: "crawl-1",
        projectId: "proj-1",
        category: "summary",
        type: "score_summary",
        headline: "Summary",
        data: { foo: "bar" },
      },
    ];

    await queries.replaceForCrawl("crawl-1", rows as any);

    expect(mock.transaction).toHaveBeenCalled();
    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith(rows);
  });

  it("replaceForCrawl only deletes when rows are empty", async () => {
    await queries.replaceForCrawl("crawl-1", []);

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.insert).not.toHaveBeenCalled();
  });

  it("listByCrawl selects rows by crawl id", async () => {
    mock.chain.where.mockResolvedValueOnce([{ id: "ci1" }]);
    const result = await queries.listByCrawl("crawl-1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(result).toEqual([{ id: "ci1" }]);
  });
});

describe("pageInsightQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof pageInsightQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = pageInsightQueries(mock.db);
  });

  it("replaceForCrawl deletes and inserts page insights", async () => {
    const rows = [
      {
        crawlId: "crawl-1",
        projectId: "proj-1",
        pageId: "page-1",
        url: "https://example.com/",
        category: "issue",
        type: "page_snapshot",
        headline: "Fix",
        data: { code: "X" },
      },
    ];

    await queries.replaceForCrawl("crawl-1", rows as any);

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith(rows);
  });

  it("replaceForCrawl only deletes for empty rows", async () => {
    await queries.replaceForCrawl("crawl-1", []);
    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.insert).not.toHaveBeenCalled();
  });

  it("listByCrawl returns rows", async () => {
    mock.chain.where.mockResolvedValueOnce([{ id: "pi1" }]);
    const result = await queries.listByCrawl("crawl-1");
    expect(result).toEqual([{ id: "pi1" }]);
  });
});
