import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiTokenQueries } from "../../queries/api-tokens";

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

  // Make the chain itself thenable for awaited select chains
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

describe("apiTokenQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof apiTokenQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = apiTokenQueries(mock.db);
  });

  // --- create ---
  it("create inserts and returns token", async () => {
    const newToken = {
      id: "tok1",
      userId: "u1",
      projectId: "p1",
      name: "My Token",
      tokenHash: "hash123",
      tokenPrefix: "llmb_",
      scopes: ["read", "write"],
      expiresAt: null,
    };
    mock.chain.returning.mockResolvedValueOnce([newToken]);

    const result = await queries.create({
      userId: "u1",
      projectId: "p1",
      type: "api",
      name: "My Token",
      tokenHash: "hash123",
      tokenPrefix: "llmb_",
      scopes: ["read", "write"],
      expiresAt: null,
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        projectId: "p1",
        name: "My Token",
        tokenHash: "hash123",
        tokenPrefix: "llmb_",
        scopes: ["read", "write"],
      }),
    );
    expect(result).toEqual(newToken);
  });

  // --- findByHash ---
  it("findByHash returns token when found", async () => {
    const token = {
      id: "tok1",
      userId: "u1",
      tokenHash: "hash123",
      revokedAt: null,
      expiresAt: null,
    };
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([token]));

    const result = await queries.findByHash("hash123");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(token);
  });

  it("findByHash returns null when not found", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([]));

    const result = await queries.findByHash("nonexistent");

    expect(result).toBeNull();
  });

  it("findByHash returns null for expired token", async () => {
    const pastDate = new Date("2020-01-01");
    const token = {
      id: "tok1",
      userId: "u1",
      tokenHash: "hash123",
      revokedAt: null,
      expiresAt: pastDate,
    };
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([token]));

    const result = await queries.findByHash("hash123");

    expect(result).toBeNull();
  });

  // --- listByUser ---
  it("listByUser returns list of tokens", async () => {
    const tokens = [
      { id: "tok1", name: "Token A", userId: "u1" },
      { id: "tok2", name: "Token B", userId: "u1" },
    ];
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve(tokens));

    const result = await queries.listByUser("u1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(mock.chain.orderBy).toHaveBeenCalled();
    expect(result).toEqual(tokens);
  });

  // --- revoke ---
  it("revoke updates revokedAt and returns token", async () => {
    const revokedToken = {
      id: "tok1",
      revokedAt: expect.any(Date),
    };
    mock.chain.returning.mockResolvedValueOnce([revokedToken]);

    const result = await queries.revoke("tok1");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(revokedToken);
  });

  it("revoke returns null when token not found", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.revoke("nonexistent");

    expect(result).toBeNull();
  });

  // --- updateLastUsed ---
  it("updateLastUsed updates lastUsedAt timestamp", async () => {
    await queries.updateLastUsed("tok1");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ lastUsedAt: expect.any(Date) }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
  });

  // --- countByUser ---
  it("countByUser returns count based on row length", async () => {
    const rows = [{ id: "tok1" }, { id: "tok2" }, { id: "tok3" }];
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve(rows));

    const result = await queries.countByUser("u1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toBe(3);
  });

  it("countByUser returns 0 when user has no active tokens", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([]));

    const result = await queries.countByUser("u-empty");

    expect(result).toBe(0);
  });
});
