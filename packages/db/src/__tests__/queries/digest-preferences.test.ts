import { describe, it, expect, vi, beforeEach } from "vitest";
import { digestPreferenceQueries } from "../../queries/digest-preferences";

// ---------------------------------------------------------------------------
// Mock DB builder – chainable drizzle-like object
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

describe("digestPreferenceQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof digestPreferenceQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = digestPreferenceQueries(mock.db);
  });

  // --- getPreferences ---
  it("getPreferences returns prefs from findFirst", async () => {
    const prefs = {
      digestFrequency: "weekly",
      digestDay: 1,
      lastDigestSentAt: new Date("2026-02-10"),
    };
    mock.db.query.users.findFirst.mockResolvedValueOnce(prefs);

    const result = await queries.getPreferences("u1");

    expect(mock.db.query.users.findFirst).toHaveBeenCalled();
    expect(result).toEqual(prefs);
  });

  it("getPreferences returns null when user not found", async () => {
    mock.db.query.users.findFirst.mockResolvedValueOnce(undefined);

    const result = await queries.getPreferences("nonexistent");

    expect(result).toBeNull();
  });

  // --- updatePreferences ---
  it("updatePreferences updates and returns prefs", async () => {
    const updated = {
      digestFrequency: "monthly",
      digestDay: 15,
      lastDigestSentAt: null,
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updatePreferences("u1", {
      digestFrequency: "monthly",
      digestDay: 15,
    });

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        digestFrequency: "monthly",
        digestDay: 15,
        updatedAt: expect.any(String),
      }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  // --- getUsersDueForDigest ---
  it("getUsersDueForDigest returns due users", async () => {
    const dueUsers = [
      {
        id: "u1",
        email: "a@b.com",
        digestFrequency: "weekly",
        digestDay: 1,
        lastDigestSentAt: null,
      },
      {
        id: "u2",
        email: "c@d.com",
        digestFrequency: "weekly",
        digestDay: 1,
        lastDigestSentAt: new Date("2026-01-01"),
      },
    ];
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve(dueUsers));

    const cutoff = new Date("2026-02-10");
    const result = await queries.getUsersDueForDigest("weekly", cutoff);

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(dueUsers);
    expect(result).toHaveLength(2);
  });

  // --- markDigestSent ---
  it("markDigestSent calls update with lastDigestSentAt", async () => {
    await queries.markDigestSent("u1");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastDigestSentAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
  });
});
