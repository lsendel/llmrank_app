import { describe, it, expect, vi, beforeEach } from "vitest";
import { integrationQueries } from "../../queries/integrations";

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
  chain.onConflictDoUpdate = vi.fn().mockReturnValue(chain);

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

describe("integrationQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof integrationQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = integrationQueries(mock.db);
  });

  // --- listByProject ---
  it("listByProject returns all integrations for a project", async () => {
    const integrations = [
      { id: "int1", projectId: "p1", provider: "gsc", enabled: true },
      { id: "int2", projectId: "p1", provider: "ga4", enabled: false },
    ];
    mock.db.query.projectIntegrations.findMany.mockResolvedValueOnce(
      integrations,
    );

    const result = await queries.listByProject("p1");

    expect(mock.db.query.projectIntegrations.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  // --- getByProjectAndProvider ---
  it("getByProjectAndProvider returns matching integration", async () => {
    const integration = {
      id: "int1",
      projectId: "p1",
      provider: "gsc",
      enabled: true,
    };
    mock.db.query.projectIntegrations.findFirst.mockResolvedValueOnce(
      integration,
    );

    const result = await queries.getByProjectAndProvider("p1", "gsc");

    expect(mock.db.query.projectIntegrations.findFirst).toHaveBeenCalled();
    expect(result).toEqual(integration);
  });

  it("getByProjectAndProvider returns undefined when not found", async () => {
    const result = await queries.getByProjectAndProvider("p1", "clarity");
    expect(result).toBeUndefined();
  });

  // --- upsert ---
  it("upsert inserts new integration with onConflictDoUpdate", async () => {
    const row = {
      id: "int3",
      projectId: "p1",
      provider: "psi",
      enabled: true,
    };
    mock.chain.returning.mockResolvedValueOnce([row]);

    const result = await queries.upsert({
      projectId: "p1",
      provider: "psi",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        provider: "psi",
        enabled: true,
        encryptedCredentials: null,
        config: {},
        tokenExpiresAt: null,
      }),
    );
    expect(mock.chain.onConflictDoUpdate).toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it("upsert passes encrypted credentials when provided", async () => {
    mock.chain.returning.mockResolvedValueOnce([{ id: "int4" }]);

    await queries.upsert({
      projectId: "p1",
      provider: "gsc",
      encryptedCredentials: "enc_token_123",
    });

    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedCredentials: "enc_token_123",
      }),
    );
  });

  // --- updateEnabled ---
  it("updateEnabled toggles the enabled flag and returns updated row", async () => {
    const updated = { id: "int1", enabled: false };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updateEnabled("int1", false);

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(result).toEqual(updated);
  });

  it("updateEnabled includes updatedAt in the set", async () => {
    mock.chain.returning.mockResolvedValueOnce([{ id: "int1" }]);

    await queries.updateEnabled("int1", true);

    const setArg = mock.chain.set.mock.calls[0][0];
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });

  // --- updateCredentials ---
  it("updateCredentials sets new credentials and token expiry", async () => {
    const expiry = new Date("2026-06-01");
    const updated = {
      id: "int1",
      encryptedCredentials: "new_enc",
      tokenExpiresAt: expiry,
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updateCredentials("int1", "new_enc", expiry);

    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedCredentials: "new_enc",
        tokenExpiresAt: expiry,
      }),
    );
    expect(result).toEqual(updated);
  });

  it("updateCredentials sets tokenExpiresAt to null when not provided", async () => {
    mock.chain.returning.mockResolvedValueOnce([{ id: "int1" }]);

    await queries.updateCredentials("int1", "enc_data");

    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ tokenExpiresAt: null }),
    );
  });

  // --- updateLastSync ---
  it("updateLastSync records sync time and clears error", async () => {
    const updated = {
      id: "int1",
      lastSyncAt: expect.any(Date),
      lastError: null,
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updateLastSync("int1");

    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSyncAt: expect.any(Date),
        lastError: null,
      }),
    );
    expect(result).toEqual(updated);
  });

  it("updateLastSync records error string when provided", async () => {
    mock.chain.returning.mockResolvedValueOnce([{ id: "int1" }]);

    await queries.updateLastSync("int1", "API rate limit exceeded");

    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: "API rate limit exceeded" }),
    );
  });

  // --- remove ---
  it("remove deletes integration by id and projectId", async () => {
    await queries.remove("int1", "p1");

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
  });
});
