import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationChannelQueries } from "../../queries/notification-channels";

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

describe("notificationChannelQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof notificationChannelQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = notificationChannelQueries(mock.db);
  });

  // --- create ---
  it("create inserts a channel and returns it", async () => {
    const channel = {
      id: "nc1",
      userId: "u1",
      projectId: null,
      channelType: "email",
      config: { address: "user@example.com" },
      eventTypes: ["crawl_complete", "score_drop"],
    };
    mock.chain.returning.mockResolvedValueOnce([channel]);

    const result = await queries.create({
      userId: "u1",
      channelType: "email",
      config: { address: "user@example.com" },
      eventTypes: ["crawl_complete", "score_drop"],
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith({
      id: expect.any(String),
      userId: "u1",
      projectId: null,
      channelType: "email",
      config: JSON.stringify({ address: "user@example.com" }),
      eventTypes: JSON.stringify(["crawl_complete", "score_drop"]),
    });
    expect(result).toEqual(channel);
  });

  // --- listByUser ---
  it("listByUser returns list of channels for a user", async () => {
    const channels = [
      { id: "nc1", userId: "u1", channelType: "email" },
      { id: "nc2", userId: "u1", channelType: "webhook" },
    ];
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve(channels));

    const result = await queries.listByUser("u1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(mock.chain.orderBy).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  // --- getById ---
  it("getById returns channel when found", async () => {
    const channel = {
      id: "nc1",
      userId: "u1",
      channelType: "email",
      config: { address: "test@example.com" },
    };
    mock.chain.then.mockImplementationOnce((resolve: any) =>
      resolve([channel]),
    );

    const result = await queries.getById("nc1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(channel);
  });

  it("getById returns null when not found", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([]));

    const result = await queries.getById("nc-none");

    expect(result).toBeNull();
  });

  // --- update ---
  it("update updates and returns the channel", async () => {
    const updated = {
      id: "nc1",
      userId: "u1",
      channelType: "email",
      enabled: false,
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.update("nc1", { enabled: false });

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  // --- delete ---
  it("delete calls delete on db", async () => {
    await queries.delete("nc1");

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
  });

  // --- countByUser ---
  it("countByUser returns count based on row length", async () => {
    const rows = [
      { id: "nc1", userId: "u1" },
      { id: "nc2", userId: "u1" },
      { id: "nc3", userId: "u1" },
    ];
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve(rows));

    const result = await queries.countByUser("u1");

    expect(result).toBe(3);
  });

  // --- findByEventType ---
  it("findByEventType filters channels by event type and enabled status", async () => {
    const channels = [
      {
        id: "nc1",
        userId: "u1",
        projectId: null,
        channelType: "email",
        enabled: true,
        eventTypes: ["crawl_complete", "score_drop"],
      },
      {
        id: "nc2",
        userId: "u1",
        projectId: null,
        channelType: "webhook",
        enabled: false,
        eventTypes: ["crawl_complete"],
      },
      {
        id: "nc3",
        userId: "u1",
        projectId: "p1",
        channelType: "slack_incoming",
        enabled: true,
        eventTypes: ["score_drop"],
      },
    ];
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve(channels));

    const result = await queries.findByEventType("u1", "score_drop");

    // nc1 matches (enabled, has score_drop, no projectId restriction)
    // nc2 excluded (not enabled)
    // nc3 matches (enabled, has score_drop, projectId is set but no projectId filter passed)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("nc1");
  });
});
