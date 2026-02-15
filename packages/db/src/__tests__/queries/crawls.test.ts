import { describe, it, expect, vi, beforeEach } from "vitest";
import { crawlQueries } from "../../queries/crawls";

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

  // Make the chain itself thenable for awaited select chains
  // (e.g., `await db.select().from().innerJoin().where()`)
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

describe("crawlQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof crawlQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = crawlQueries(mock.db);
  });

  // --- create ---
  it("create inserts a new crawl job with pending status", async () => {
    const newJob = {
      id: "j1",
      projectId: "p1",
      status: "pending",
      config: { maxPages: 10 },
    };
    mock.chain.returning.mockResolvedValueOnce([newJob]);

    const result = await queries.create({
      projectId: "p1",
      config: { maxPages: 10 },
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith({
      projectId: "p1",
      config: { maxPages: 10 },
      status: "pending",
    });
    expect(result).toEqual(newJob);
  });

  // --- updateStatus ---
  it("updateStatus updates status fields and returns updated job", async () => {
    const updated = { id: "j1", status: "crawling", pagesFound: 5 };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updateStatus("j1", {
      status: "crawling",
      pagesFound: 5,
    });

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith({
      status: "crawling",
      pagesFound: 5,
    });
    expect(result).toEqual(updated);
  });

  it("updateStatus can set error message on failure", async () => {
    const updated = { id: "j1", status: "failed", errorMessage: "timeout" };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updateStatus("j1", {
      status: "failed",
      errorMessage: "timeout",
    });

    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorMessage: "timeout" }),
    );
    expect(result).toEqual(updated);
  });

  // --- getById ---
  it("getById retrieves a crawl job by id", async () => {
    const job = { id: "j1", status: "complete" };
    mock.db.query.crawlJobs.findFirst.mockResolvedValueOnce(job);

    const result = await queries.getById("j1");

    expect(mock.db.query.crawlJobs.findFirst).toHaveBeenCalled();
    expect(result).toEqual(job);
  });

  // --- getLatestByProject ---
  it("getLatestByProject returns completed crawl when available", async () => {
    const completed = { id: "j2", status: "complete", projectId: "p1" };
    mock.db.query.crawlJobs.findFirst.mockResolvedValueOnce(completed);

    const result = await queries.getLatestByProject("p1");

    expect(result).toEqual(completed);
  });

  it("getLatestByProject falls back to most recent of any status", async () => {
    // First call (completed) returns undefined
    mock.db.query.crawlJobs.findFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: "j3", status: "crawling" });

    const result = await queries.getLatestByProject("p1");

    expect(mock.db.query.crawlJobs.findFirst).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: "j3", status: "crawling" });
  });

  // --- listByProject ---
  it("listByProject returns all jobs for a project", async () => {
    const jobs = [
      { id: "j1", status: "complete" },
      { id: "j2", status: "pending" },
    ];
    mock.db.query.crawlJobs.findMany.mockResolvedValueOnce(jobs);

    const result = await queries.listByProject("p1");

    expect(mock.db.query.crawlJobs.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  // --- generateShareToken ---
  it("generateShareToken sets a UUID token and enables sharing", async () => {
    const updated = { id: "j1", shareToken: "some-uuid", shareEnabled: true };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.generateShareToken("j1");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        shareToken: expect.any(String),
        shareEnabled: true,
        sharedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual(updated);
  });

  // --- getByShareToken ---
  it("getByShareToken finds a crawl by share token", async () => {
    const shared = { id: "j1", shareToken: "tok-abc", shareEnabled: true };
    mock.db.query.crawlJobs.findFirst.mockResolvedValueOnce(shared);

    const result = await queries.getByShareToken("tok-abc");

    expect(mock.db.query.crawlJobs.findFirst).toHaveBeenCalled();
    expect(result).toEqual(shared);
  });

  // --- disableSharing ---
  it("disableSharing sets shareEnabled to false", async () => {
    const updated = { id: "j1", shareEnabled: false };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.disableSharing("j1");

    expect(mock.chain.set).toHaveBeenCalledWith({ shareEnabled: false });
    expect(result).toEqual(updated);
  });

  // --- updateSummary ---
  it("updateSummary sets the summary text", async () => {
    const updated = { id: "j1", summary: "Site scored 85 overall." };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updateSummary("j1", "Site scored 85 overall.");

    expect(mock.chain.set).toHaveBeenCalledWith({
      summary: "Site scored 85 overall.",
    });
    expect(result).toEqual(updated);
  });

  // --- getStatsForUser ---
  it("getStatsForUser returns total crawls and average score", async () => {
    // The function runs two SELECT chains that resolve via the chain.then
    // First call: count
    mock.chain.then
      .mockImplementationOnce((resolve: any) => resolve([{ total: 15 }]))
      // Second call: avg
      .mockImplementationOnce((resolve: any) => resolve([{ avg: 82.5 }]));

    const result = await queries.getStatsForUser("u1");

    expect(result).toEqual({ totalCrawls: 15, avgScore: 83 }); // 82.5 rounds to 83
  });

  it("getStatsForUser returns zeros when no data", async () => {
    mock.chain.then
      .mockImplementationOnce((resolve: any) => resolve([{ total: 0 }]))
      .mockImplementationOnce((resolve: any) => resolve([{ avg: 0 }]));

    const result = await queries.getStatsForUser("u-empty");

    expect(result).toEqual({ totalCrawls: 0, avgScore: 0 });
  });

  // --- getRecentForUser ---
  it("getRecentForUser returns crawls with letter grades", async () => {
    const rows = [
      {
        id: "j1",
        projectId: "p1",
        status: "complete",
        pagesFound: 10,
        pagesCrawled: 10,
        pagesScored: 10,
        errorMessage: null,
        summary: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
        projectName: "Site A",
      },
    ];
    const scoreRows = [{ jobId: "j1", avg: 92 }];

    // First .then: select crawl rows
    mock.chain.then
      .mockImplementationOnce((resolve: any) => resolve(rows))
      // Second .then: select score rows
      .mockImplementationOnce((resolve: any) => resolve(scoreRows));

    const result = await queries.getRecentForUser("u1", 10);

    expect(result).toHaveLength(1);
    expect(result[0].overallScore).toBe(92);
    expect(result[0].letterGrade).toBe("A");
  });

  it("getRecentForUser assigns correct letter grades for each score range", async () => {
    const makeRow = (id: string) => ({
      id,
      projectId: "p1",
      status: "complete",
      pagesFound: 1,
      pagesCrawled: 1,
      pagesScored: 1,
      errorMessage: null,
      summary: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      projectName: "Test",
    });

    const rows = [
      makeRow("j-a"),
      makeRow("j-b"),
      makeRow("j-c"),
      makeRow("j-d"),
      makeRow("j-f"),
    ];

    const scoreRows = [
      { jobId: "j-a", avg: 95 },
      { jobId: "j-b", avg: 85 },
      { jobId: "j-c", avg: 75 },
      { jobId: "j-d", avg: 65 },
      { jobId: "j-f", avg: 50 },
    ];

    mock.chain.then
      .mockImplementationOnce((resolve: any) => resolve(rows))
      .mockImplementationOnce((resolve: any) => resolve(scoreRows));

    const result = await queries.getRecentForUser("u1");

    expect(result[0].letterGrade).toBe("A");
    expect(result[1].letterGrade).toBe("B");
    expect(result[2].letterGrade).toBe("C");
    expect(result[3].letterGrade).toBe("D");
    expect(result[4].letterGrade).toBe("F");
  });

  it("getRecentForUser returns empty array when no crawls exist", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([]));

    const result = await queries.getRecentForUser("u-none");

    expect(result).toEqual([]);
  });
});
