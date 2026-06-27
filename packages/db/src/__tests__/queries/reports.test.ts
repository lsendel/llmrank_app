import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportQueries } from "../../queries/reports";

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

describe("reportQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof reportQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = reportQueries(mock.db);
  });

  // --- create ---
  it("create inserts a report and returns it", async () => {
    const report = {
      id: "r1",
      projectId: "p1",
      userId: "u1",
      format: "pdf",
      type: "summary",
      status: "pending",
    };
    mock.chain.returning.mockResolvedValueOnce([report]);

    const result = await queries.create({
      id: "r1",
      projectId: "p1",
      userId: "u1",
      crawlJobId: "c1",
      format: "pdf" as any,
      type: "summary" as any,
      status: "pending" as any,
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalled();
    expect(result).toEqual(report);
  });

  it("create generates an id when the caller omits one", async () => {
    const report = {
      id: "generated-report-id",
      projectId: "p1",
      userId: "u1",
      crawlJobId: "c1",
      format: "pdf",
      type: "summary",
      status: "queued",
    };
    mock.chain.returning.mockResolvedValueOnce([report]);

    const result = await queries.create({
      projectId: "p1",
      userId: "u1",
      crawlJobId: "c1",
      format: "pdf" as any,
      type: "summary" as any,
      status: "queued" as any,
    } as any);

    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        projectId: "p1",
      }),
    );
    expect(result).toEqual(report);
  });

  // --- getById ---
  it("getById calls findFirst and returns report", async () => {
    const report = {
      id: "r1",
      projectId: "p1",
      format: "pdf",
      status: "completed",
    };
    mock.db.query.reports.findFirst.mockResolvedValueOnce(report);

    const result = await queries.getById("r1");

    expect(mock.db.query.reports.findFirst).toHaveBeenCalled();
    expect(result).toEqual(report);
  });

  it("getById returns undefined when not found", async () => {
    const result = await queries.getById("r-none");

    expect(result).toBeUndefined();
  });

  // --- listByProject ---
  it("listByProject returns list with limit", async () => {
    const reports = [
      { id: "r1", projectId: "p1", status: "completed" },
      { id: "r2", projectId: "p1", status: "pending" },
    ];
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve(reports));

    const result = await queries.listByProject("p1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(mock.chain.orderBy).toHaveBeenCalled();
    expect(mock.chain.limit).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  // --- countThisMonth ---
  it("countThisMonth returns count from SQL result", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) =>
      resolve([{ count: 3 }]),
    );

    const result = await queries.countThisMonth("u1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toBe(3);
  });

  it("countThisMonth returns 0 when no rows", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([]));

    const result = await queries.countThisMonth("u1");

    expect(result).toBe(0);
  });

  // --- updateStatus ---
  it("updateStatus calls update with status", async () => {
    await queries.updateStatus("r1", "complete");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
  });

  it("updateStatus passes extra fields when provided", async () => {
    await queries.updateStatus("r1", "complete", {
      r2Key: "reports/r1.pdf",
    } as any);

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalled();
  });

  // --- delete ---
  it("delete calls delete on db", async () => {
    await queries.delete("r1");

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
  });
});
