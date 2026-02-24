import { describe, it, expect, vi, beforeEach } from "vitest";
import { projectQueries } from "../../queries/projects";

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

describe("projectQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof projectQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = projectQueries(mock.db);
  });

  // --- listByUser ---
  it("listByUser returns all non-deleted projects for user", async () => {
    const fakeProjects = [
      { id: "p1", userId: "u1", name: "Site A", domain: "a.com" },
      { id: "p2", userId: "u1", name: "Site B", domain: "b.com" },
    ];
    mock.db.query.projects.findMany.mockResolvedValueOnce(fakeProjects);

    const result = await queries.listByUser("u1");

    expect(mock.db.query.projects.findMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual(fakeProjects);
    expect(result).toHaveLength(2);
  });

  it("listByUser returns empty array when user has no projects", async () => {
    mock.db.query.projects.findMany.mockResolvedValueOnce([]);

    const result = await queries.listByUser("u-empty");
    expect(result).toEqual([]);
  });

  it("listByUser passes pagination options", async () => {
    mock.db.query.projects.findMany.mockResolvedValueOnce([]);

    await queries.listByUser("u1", {
      q: "acme",
      sort: "name_asc",
      limit: 10,
      offset: 20,
    });

    expect(mock.db.query.projects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 20,
      }),
    );
  });

  // --- countByUser ---
  it("countByUser returns numeric count", async () => {
    mock.chain.where.mockResolvedValueOnce([{ count: 7 }]);

    const result = await queries.countByUser("u1");

    expect(result).toBe(7);
  });

  // --- getById ---
  it("getById returns project when found", async () => {
    const fakeProject = { id: "p1", name: "Test", domain: "test.com" };
    mock.db.query.projects.findFirst.mockResolvedValueOnce(fakeProject);

    const result = await queries.getById("p1");

    expect(mock.db.query.projects.findFirst).toHaveBeenCalledTimes(1);
    expect(result).toEqual(fakeProject);
  });

  it("getById returns undefined for non-existent project", async () => {
    const result = await queries.getById("nonexistent");
    expect(result).toBeUndefined();
  });

  // --- create ---
  it("create inserts a project with defaults and returns it", async () => {
    const newProject = {
      id: "p3",
      userId: "u1",
      name: "New",
      domain: "new.com",
      settings: {},
    };
    mock.chain.returning.mockResolvedValueOnce([newProject]);

    const result = await queries.create({
      userId: "u1",
      name: "New",
      domain: "new.com",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith({
      userId: "u1",
      name: "New",
      domain: "new.com",
      settings: {},
    });
    expect(result).toEqual(newProject);
  });

  it("create passes custom settings when provided", async () => {
    const settings = { maxPages: 50 };
    mock.chain.returning.mockResolvedValueOnce([{ id: "p4", settings }]);

    await queries.create({
      userId: "u1",
      name: "Custom",
      domain: "custom.com",
      settings,
    });

    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ settings }),
    );
  });

  // --- update ---
  it("update modifies project name and returns updated row", async () => {
    const updated = { id: "p1", name: "Renamed" };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.update("p1", { name: "Renamed" });

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  // --- delete (soft delete) ---
  it("delete sets deletedAt instead of removing the row", async () => {
    await queries.delete("p1");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
  });

  // --- getDueForCrawl ---
  it("getDueForCrawl returns projects due for scheduled crawling", async () => {
    const dueProjects = [
      { id: "p5", name: "Due", crawlSchedule: "weekly", user: { id: "u1" } },
    ];
    mock.db.query.projects.findMany.mockResolvedValueOnce(dueProjects);

    const result = await queries.getDueForCrawl(5);

    expect(mock.db.query.projects.findMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual(dueProjects);
  });

  it("getDueForCrawl uses default limit of 10", async () => {
    mock.db.query.projects.findMany.mockResolvedValueOnce([]);

    await queries.getDueForCrawl();

    expect(mock.db.query.projects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
  });

  // --- updateNextCrawl ---
  it("updateNextCrawl sets the next scheduled crawl time", async () => {
    const nextAt = new Date("2026-03-01T00:00:00Z");

    await queries.updateNextCrawl("p1", nextAt);

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith({ nextCrawlAt: nextAt });
    expect(mock.chain.where).toHaveBeenCalled();
  });
});
