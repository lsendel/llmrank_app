import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportScheduleQueries } from "../../queries/report-schedules";

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

describe("reportScheduleQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof reportScheduleQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = reportScheduleQueries(mock.db);
  });

  // --- create ---
  it("create inserts a schedule and returns it", async () => {
    const schedule = {
      id: "rs1",
      projectId: "p1",
      format: "pdf",
      type: "summary",
      recipientEmail: "user@example.com",
    };
    mock.chain.returning.mockResolvedValueOnce([schedule]);

    const result = await queries.create({
      projectId: "p1",
      format: "pdf",
      type: "summary",
      recipientEmail: "user@example.com",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith({
      id: expect.any(String),
      projectId: "p1",
      format: "pdf",
      type: "summary",
      recipientEmail: "user@example.com",
    });
    expect(result).toEqual(schedule);
  });

  // --- listByProject ---
  it("listByProject calls findMany with projectId", async () => {
    const schedules = [
      { id: "rs1", projectId: "p1", format: "pdf" },
      { id: "rs2", projectId: "p1", format: "docx" },
    ];
    mock.db.query.reportSchedules.findMany.mockResolvedValueOnce(schedules);

    const result = await queries.listByProject("p1");

    expect(mock.db.query.reportSchedules.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("listByProject returns empty array when no schedules exist", async () => {
    const result = await queries.listByProject("p-empty");

    expect(result).toEqual([]);
  });

  // --- getById ---
  it("getById calls findFirst and returns schedule", async () => {
    const schedule = {
      id: "rs1",
      projectId: "p1",
      format: "pdf",
      type: "detailed",
    };
    mock.db.query.reportSchedules.findFirst.mockResolvedValueOnce(schedule);

    const result = await queries.getById("rs1");

    expect(mock.db.query.reportSchedules.findFirst).toHaveBeenCalled();
    expect(result).toEqual(schedule);
  });

  it("getById returns undefined when not found", async () => {
    const result = await queries.getById("rs-none");

    expect(result).toBeUndefined();
  });

  // --- getActiveByProject ---
  it("getActiveByProject calls findMany with projectId and enabled filter", async () => {
    const active = [
      { id: "rs1", projectId: "p1", enabled: true, format: "pdf" },
    ];
    mock.db.query.reportSchedules.findMany.mockResolvedValueOnce(active);

    const result = await queries.getActiveByProject("p1");

    expect(mock.db.query.reportSchedules.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].enabled).toBe(true);
  });

  it("getActiveByProject returns empty array when no active schedules", async () => {
    const result = await queries.getActiveByProject("p-empty");

    expect(result).toEqual([]);
  });

  // --- update ---
  it("update updates and returns the schedule", async () => {
    const updated = {
      id: "rs1",
      projectId: "p1",
      format: "docx",
      enabled: false,
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.update("rs1", {
      format: "docx",
      enabled: false,
    });

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  // --- delete ---
  it("delete calls delete on db", async () => {
    await queries.delete("rs1");

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
  });
});
