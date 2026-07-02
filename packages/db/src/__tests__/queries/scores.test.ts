import { describe, it, expect, vi, beforeEach } from "vitest";
import { scoreQueries } from "../../queries/scores";

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

describe("scoreQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof scoreQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = scoreQueries(mock.db);
  });

  // --- create ---
  it("create inserts a score and returns it", async () => {
    const score = { id: "s1", pageId: "pg1", jobId: "j1", overallScore: 85 };
    mock.chain.returning.mockResolvedValueOnce([score]);

    const result = await queries.create({
      pageId: "pg1",
      jobId: "j1",
      overallScore: 85,
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        pageId: "pg1",
        jobId: "j1",
        overallScore: 85,
      }),
    );
    expect(result).toEqual(score);
  });

  // --- createBatch ---
  it("createBatch inserts multiple scores in one call", async () => {
    const scores = [
      { id: "s1", pageId: "pg1", jobId: "j1", overallScore: 90 },
      { id: "s2", pageId: "pg2", jobId: "j1", overallScore: 75 },
    ];
    mock.chain.returning.mockResolvedValueOnce(scores);

    const result = await queries.createBatch([
      { pageId: "pg1", jobId: "j1", overallScore: 90 },
      { pageId: "pg2", jobId: "j1", overallScore: 75 },
    ]);

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("createBatch returns empty array for empty input", async () => {
    const result = await queries.createBatch([]);

    expect(result).toEqual([]);
    expect(mock.chain.insert).not.toHaveBeenCalled();
  });

  // --- getByPage ---
  it("getByPage returns the score for a specific page", async () => {
    const score = { id: "s1", pageId: "pg1", overallScore: 88 };
    mock.db.query.pageScores.findFirst.mockResolvedValueOnce(score);

    const result = await queries.getByPage("pg1");

    expect(mock.db.query.pageScores.findFirst).toHaveBeenCalled();
    // deserializeScore adds parsed detail/platformScores/recommendations.
    expect(result).toMatchObject(score);
  });

  it("getByPage returns undefined when no score exists", async () => {
    const result = await queries.getByPage("pg-none");
    expect(result).toBeUndefined();
  });

  // --- listByJob ---
  it("listByJob returns all scores for a given job", async () => {
    const scores = [
      { id: "s1", jobId: "j1", overallScore: 90 },
      { id: "s2", jobId: "j1", overallScore: 70 },
    ];
    mock.db.query.pageScores.findMany.mockResolvedValueOnce(scores);

    const result = await queries.listByJob("j1");

    expect(mock.db.query.pageScores.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  // --- createIssues ---
  it("createIssues inserts issue rows and returns them", async () => {
    const issueRows = [
      {
        id: "i1",
        pageId: "pg1",
        jobId: "j1",
        category: "technical" as const,
        severity: "critical" as const,
        code: "MISSING_TITLE",
        message: "Page has no title tag",
      },
    ];
    mock.chain.returning.mockResolvedValueOnce(issueRows);

    const result = await queries.createIssues([
      {
        pageId: "pg1",
        jobId: "j1",
        category: "technical",
        severity: "critical",
        code: "MISSING_TITLE",
        message: "Page has no title tag",
      },
    ]);

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("MISSING_TITLE");
  });

  it("createIssues returns empty array for empty input", async () => {
    const result = await queries.createIssues([]);

    expect(result).toEqual([]);
    expect(mock.chain.insert).not.toHaveBeenCalled();
  });

  // --- getIssuesByPage ---
  it("getIssuesByPage returns all issues for a page", async () => {
    const pageIssues = [
      { id: "i1", pageId: "pg1", code: "MISSING_TITLE" },
      { id: "i2", pageId: "pg1", code: "SHORT_CONTENT" },
    ];
    mock.db.query.issues.findMany.mockResolvedValueOnce(pageIssues);

    const result = await queries.getIssuesByPage("pg1");

    expect(mock.db.query.issues.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  // --- getIssuesByJob ---
  it("getIssuesByJob returns all issues for a crawl job", async () => {
    const jobIssues = [{ id: "i1", jobId: "j1", code: "HTTP_STATUS" }];
    mock.db.query.issues.findMany.mockResolvedValueOnce(jobIssues);

    const result = await queries.getIssuesByJob("j1");

    expect(mock.db.query.issues.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("countIssuesByCode aggregates SQL-side (select→groupBy→orderBy, no row load)", async () => {
    const aggregated = [
      {
        code: "THIN_CONTENT",
        category: "content",
        severity: "warning",
        count: 106,
      },
      {
        code: "NOINDEX_SET",
        category: "technical",
        severity: "critical",
        count: 7,
      },
    ];
    mock.chain.orderBy.mockResolvedValueOnce(aggregated);

    const result = await queries.countIssuesByCode("j1");

    expect(result).toEqual(aggregated);
    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.groupBy).toHaveBeenCalled();
    // Must never load raw issue rows for aggregation
    expect(mock.db.query.issues.findMany).not.toHaveBeenCalled();
  });

  it("getIssuesByJob pages through large result sets in chunks (no unbounded query)", async () => {
    // A full 500-row first chunk must trigger a cursor-paged refetch; a short
    // second chunk stops the loop. This keeps a large crawl's issues off a
    // single (throw-prone) D1 response.
    const chunk1 = Array.from({ length: 500 }, (_, i) => ({
      id: `issue-${String(i).padStart(4, "0")}`,
      pageId: "pg1",
      code: "X",
    }));
    const chunk2 = [{ id: "issue-9999", pageId: "pg1", code: "X" }];
    mock.db.query.issues.findMany
      .mockResolvedValueOnce(chunk1)
      .mockResolvedValueOnce(chunk2);
    mock.db.query.pages.findMany.mockResolvedValueOnce([
      { id: "pg1", url: "https://example.com/" },
    ]);

    const result = await queries.getIssuesByJob("j1");

    // Two issue fetches (full chunk → refetch, short chunk → stop).
    expect(mock.db.query.issues.findMany).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(501);
    expect(result[0].pageUrl).toBe("https://example.com/");
  });

  // --- getByPageWithIssues ---
  it("getByPageWithIssues returns score and issues together", async () => {
    const score = { id: "s1", pageId: "pg1", overallScore: 82 };
    const pageIssues = [{ id: "i1", pageId: "pg1", code: "MISSING_TITLE" }];

    mock.db.query.pageScores.findFirst.mockResolvedValueOnce(score);
    mock.db.query.issues.findMany.mockResolvedValueOnce(pageIssues);

    const result = await queries.getByPageWithIssues("pg1");

    expect(result.score).toMatchObject(score);
    expect(result.issues).toEqual(pageIssues);
  });

  it("getByPageWithIssues returns null score when no score exists", async () => {
    mock.db.query.pageScores.findFirst.mockResolvedValueOnce(undefined);
    mock.db.query.issues.findMany.mockResolvedValueOnce([]);

    const result = await queries.getByPageWithIssues("pg-none");

    expect(result.score).toBeNull();
    expect(result.issues).toEqual([]);
  });

  // --- listByJobWithPages ---
  it("listByJobWithPages merges scores, pages, and issue counts", async () => {
    const scores = [
      { id: "s1", pageId: "pg1", jobId: "j1", overallScore: 90 },
      { id: "s2", pageId: "pg2", jobId: "j1", overallScore: 70 },
    ];
    const pageRows = [
      { id: "pg1", url: "https://example.com/a", jobId: "j1" },
      { id: "pg2", url: "https://example.com/b", jobId: "j1" },
    ];
    const jobIssues = [
      { id: "i1", pageId: "pg1", jobId: "j1" },
      { id: "i2", pageId: "pg1", jobId: "j1" },
      { id: "i3", pageId: "pg2", jobId: "j1" },
    ];

    mock.db.query.pageScores.findMany.mockResolvedValueOnce(scores);
    mock.db.query.pages.findMany.mockResolvedValueOnce(pageRows);
    mock.db.query.issues.findMany.mockResolvedValueOnce(jobIssues);

    const result = await queries.listByJobWithPages("j1");

    expect(result).toHaveLength(2);
    expect(result[0].page).toEqual(pageRows[0]);
    expect(result[0].issueCount).toBe(2);
    expect(result[1].page).toEqual(pageRows[1]);
    expect(result[1].issueCount).toBe(1);
  });

  it("listByJobWithPages returns empty array when no scores exist", async () => {
    mock.db.query.pageScores.findMany.mockResolvedValueOnce([]);
    mock.db.query.pages.findMany.mockResolvedValueOnce([]);
    mock.db.query.issues.findMany.mockResolvedValueOnce([]);

    const result = await queries.listByJobWithPages("j-empty");

    expect(result).toEqual([]);
  });

  it("listByJobWithPages sets issueCount to 0 when page has no issues", async () => {
    const scores = [{ id: "s1", pageId: "pg1", jobId: "j1", overallScore: 95 }];
    const pageRows = [{ id: "pg1", url: "https://example.com", jobId: "j1" }];

    mock.db.query.pageScores.findMany.mockResolvedValueOnce(scores);
    mock.db.query.pages.findMany.mockResolvedValueOnce(pageRows);
    mock.db.query.issues.findMany.mockResolvedValueOnce([]);

    const result = await queries.listByJobWithPages("j1");

    expect(result[0].issueCount).toBe(0);
  });

  it("listByJobWithPages passes offset through to the paginated query", async () => {
    mock.db.query.pageScores.findMany.mockResolvedValueOnce([]);

    await queries.listByJobWithPages("j1", { limit: 10, offset: 40 });

    expect(mock.db.query.pageScores.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 11, offset: 40 }),
    );
  });

  // --- countByJob / aggregateByJob ---
  it("countByJob returns the SQL-side count for the job", async () => {
    mock.chain.where.mockResolvedValueOnce([{ n: 2000 }]);

    const n = await queries.countByJob("j1");

    expect(n).toBe(2000);
    expect(mock.chain.select).toHaveBeenCalled();
  });

  it("countByJob returns 0 when no row comes back", async () => {
    mock.chain.where.mockResolvedValueOnce([]);

    expect(await queries.countByJob("j-empty")).toBe(0);
  });

  it("aggregateByJob returns SQL-side count and category averages", async () => {
    mock.chain.where.mockResolvedValueOnce([
      {
        totalPages: 2000,
        avgOverall: 87.4,
        avgTechnical: 91.2,
        avgContent: 78.9,
        avgAiReadiness: 88.1,
      },
    ]);

    const agg = await queries.aggregateByJob("j1");

    expect(agg).toEqual({
      totalPages: 2000,
      avgOverall: 87.4,
      avgTechnical: 91.2,
      avgContent: 78.9,
      avgAiReadiness: 88.1,
    });
  });

  it("aggregateByJob returns an empty aggregate when the job has no scores", async () => {
    mock.chain.where.mockResolvedValueOnce([]);

    const agg = await queries.aggregateByJob("j-empty");

    expect(agg).toEqual({
      totalPages: 0,
      avgOverall: null,
      avgTechnical: null,
      avgContent: null,
      avgAiReadiness: null,
    });
  });

  // --- updateDetail ---
  it("updateDetail patches the detail JSONB column", async () => {
    const updated = { id: "s1", detail: { contentAnalysis: { score: 90 } } };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updateDetail("s1", {
      contentAnalysis: { score: 90 },
    });

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  // --- JSON column deserialization (detail / platform_scores / recommendations) ---
  // Columns are TEXT-stored JSON; reads must parse them back to objects, else
  // consumers that do Object.entries(platformScores) iterate the string's
  // characters ("0","1","2"…) — the "0/100 +100 potential" platform-card bug.
  it("listAllByJob parses platform_scores/detail JSON text into objects", async () => {
    const platformScores = {
      chatgpt: { score: 73, grade: "C", tips: ["t"] },
      claude: { score: 60, grade: "D", tips: [] },
    };
    mock.db.query.pageScores.findMany.mockResolvedValueOnce([
      {
        id: "s1",
        jobId: "j1",
        overallScore: 77,
        platformScores: JSON.stringify(platformScores),
        detail: JSON.stringify({ llmContentScores: { quality: 80 } }),
        recommendations: null,
      },
    ]);

    const [row] = await queries.listAllByJob("j1");

    expect(row.platformScores).toEqual(platformScores);
    // Regression guard: real platform keys, not character indices.
    expect(Object.keys(row.platformScores as unknown as object)).toEqual([
      "chatgpt",
      "claude",
    ]);
    expect(
      (row.detail as unknown as { llmContentScores: { quality: number } })
        .llmContentScores.quality,
    ).toBe(80);
  });

  it("deserialization is idempotent when columns are already objects", async () => {
    const platformScores = { chatgpt: { score: 73 } };
    mock.db.query.pageScores.findMany.mockResolvedValueOnce([
      {
        id: "s1",
        jobId: "j1",
        platformScores,
        detail: { a: 1 },
        recommendations: null,
      },
    ]);

    const [row] = await queries.listAllByJob("j1");

    expect(row.platformScores).toEqual(platformScores);
    expect(row.detail).toEqual({ a: 1 });
  });

  it("deserialization returns null for malformed JSON instead of crashing", async () => {
    mock.db.query.pageScores.findMany.mockResolvedValueOnce([
      {
        id: "s1",
        jobId: "j1",
        platformScores: "{not json",
        detail: null,
        recommendations: null,
      },
    ]);

    const [row] = await queries.listAllByJob("j1");

    expect(row.platformScores).toBeNull();
  });
});
