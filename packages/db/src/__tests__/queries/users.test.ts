import { describe, it, expect, vi, beforeEach } from "vitest";
import { userQueries } from "../../queries/users";

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

describe("userQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof userQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = userQueries(mock.db);
  });

  // --- getById ---
  it("getById calls findFirst with the correct user id", async () => {
    const fakeUser = { id: "u1", email: "a@b.com", plan: "free" };
    mock.db.query.users.findFirst.mockResolvedValueOnce(fakeUser);

    const result = await queries.getById("u1");

    expect(mock.db.query.users.findFirst).toHaveBeenCalledTimes(1);
    expect(result).toEqual(fakeUser);
  });

  it("getById returns undefined when user not found", async () => {
    mock.db.query.users.findFirst.mockResolvedValueOnce(undefined);

    const result = await queries.getById("nonexistent");
    expect(result).toBeUndefined();
  });

  // --- getByEmail ---
  it("getByEmail calls findFirst and returns matching user", async () => {
    const fakeUser = { id: "u2", email: "test@test.com", plan: "pro" };
    mock.db.query.users.findFirst.mockResolvedValueOnce(fakeUser);

    const result = await queries.getByEmail("test@test.com");

    expect(mock.db.query.users.findFirst).toHaveBeenCalled();
    expect(result).toEqual(fakeUser);
  });

  // --- getByClerkId ---
  it("getByClerkId calls findFirst and returns matching user", async () => {
    const fakeUser = { id: "u3", clerkId: "clerk_abc", email: "c@d.com" };
    mock.db.query.users.findFirst.mockResolvedValueOnce(fakeUser);

    const result = await queries.getByClerkId("clerk_abc");

    expect(mock.db.query.users.findFirst).toHaveBeenCalled();
    expect(result).toEqual(fakeUser);
  });

  // --- upsertFromClerk ---
  it("upsertFromClerk returns existing user when found", async () => {
    const existing = { id: "u4", clerkId: "clerk_xyz", email: "e@f.com" };
    mock.db.query.users.findFirst.mockResolvedValueOnce(existing);

    const result = await queries.upsertFromClerk(
      "clerk_xyz",
      "e@f.com",
      "Name",
    );

    expect(result).toEqual(existing);
    // Should NOT call insert if user already exists
    expect(mock.chain.insert).not.toHaveBeenCalled();
  });

  it("upsertFromClerk inserts and returns new user when not found", async () => {
    mock.db.query.users.findFirst.mockResolvedValueOnce(undefined);
    const newUser = {
      id: "u5",
      clerkId: "clerk_new",
      email: "new@test.com",
      name: "New",
    };
    mock.chain.returning.mockResolvedValueOnce([newUser]);

    const result = await queries.upsertFromClerk(
      "clerk_new",
      "new@test.com",
      "New",
    );

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith({
      clerkId: "clerk_new",
      email: "new@test.com",
      name: "New",
    });
    expect(result).toEqual(newUser);
  });

  // --- create ---
  it("create inserts a new user and returns it", async () => {
    const newUser = { id: "u6", email: "created@test.com", name: "Created" };
    mock.chain.returning.mockResolvedValueOnce([newUser]);

    const result = await queries.create({
      email: "created@test.com",
      name: "Created",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith({
      email: "created@test.com",
      name: "Created",
    });
    expect(result).toEqual(newUser);
  });

  // --- updateProfile ---
  it("updateProfile updates name and returns updated user", async () => {
    const updated = { id: "u7", name: "Updated Name", phone: null };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updateProfile("u7", { name: "Updated Name" });

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  // --- updatePlan ---
  it("updatePlan sets plan and stripeSubId", async () => {
    await queries.updatePlan("u8", "pro", "sub_123");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "pro", stripeSubId: "sub_123" }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
  });

  // --- decrementCrawlCredits ---
  it("decrementCrawlCredits returns true when a row is updated", async () => {
    mock.chain.returning.mockResolvedValueOnce([{ remaining: 9 }]);

    const result = await queries.decrementCrawlCredits("u9");

    expect(result).toBe(true);
    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
  });

  it("decrementCrawlCredits returns false when no row is updated", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.decrementCrawlCredits("u10");

    expect(result).toBe(false);
  });

  // --- resetCrawlCreditsForPlan ---
  it("resetCrawlCreditsForPlan updates credits for the given plan", async () => {
    await queries.resetCrawlCreditsForPlan("starter", 10);

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ crawlCreditsRemaining: 10 }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
  });
});
