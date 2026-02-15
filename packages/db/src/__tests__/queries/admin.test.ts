import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminQueries } from "../../queries/admin";

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

  // thenable for select chains
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

describe("adminQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof adminQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = adminQueries(mock.db);
  });

  // --- getStats ---
  it("getStats returns dashboard statistics with correct shape", async () => {
    // getStats runs many queries sequentially; each resolves via `then`
    // 1. MRR result (groupBy planCode)
    // 2. active subscribers
    // 3. total users
    // 4. churning subscriptions
    // 5. total revenue
    // 6. failed payments
    // 7. pending jobs
    // 8. running jobs
    // 9. failed jobs (24h)
    // 10. avg duration
    // 11. outbox pending
    mock.chain.then
      .mockImplementationOnce((r: any) => r([{ planCode: "pro", count: 3 }])) // mrrResult
      .mockImplementationOnce((r: any) => r([{ value: 5 }])) // activeResult
      .mockImplementationOnce((r: any) => r([{ value: 20 }])) // totalResult
      .mockImplementationOnce((r: any) => r([{ value: 1 }])) // churningResult
      .mockImplementationOnce((r: any) => r([{ value: 29700 }])) // revenueResult
      .mockImplementationOnce((r: any) => r([{ value: 2 }])) // failedResult
      .mockImplementationOnce((r: any) => r([{ value: 3 }])) // pendingJobs
      .mockImplementationOnce((r: any) => r([{ value: 1 }])) // runningJobs
      .mockImplementationOnce((r: any) => r([{ value: 0 }])) // failedJobs
      .mockImplementationOnce((r: any) => r([{ value: 180 }])) // avgDuration (seconds)
      .mockImplementationOnce((r: any) => r([{ value: 4 }])); // outboxPending

    const result = await queries.getStats();

    // MRR: pro = 14900 cents * 3 = 44700 cents => $447
    expect(result.mrr).toBe(447);
    expect(result.mrrByPlan).toEqual({ pro: 447 });
    expect(result.totalRevenue).toBe(297); // 29700 cents => $297
    expect(result.failedPayments).toBe(2);
    expect(result.activeSubscribers).toBe(5);
    expect(result.totalCustomers).toBe(20);
    // churnRate = (1/5) * 100 = 20.00
    expect(result.churnRate).toBe(20);
    expect(result.ingestHealth).toEqual({
      pendingJobs: 3,
      runningJobs: 1,
      failedLast24h: 0,
      avgCompletionMinutes: 3, // 180s / 60 = 3
      outboxPending: 4,
    });
  });

  it("getStats handles zero active subscribers without division by zero", async () => {
    mock.chain.then
      .mockImplementationOnce((r: any) => r([])) // no MRR
      .mockImplementationOnce((r: any) => r([{ value: 0 }])) // 0 active
      .mockImplementationOnce((r: any) => r([{ value: 0 }])) // 0 total
      .mockImplementationOnce((r: any) => r([{ value: 0 }])) // 0 churning
      .mockImplementationOnce((r: any) => r([{ value: 0 }])) // 0 revenue
      .mockImplementationOnce((r: any) => r([{ value: 0 }])) // 0 failed
      .mockImplementationOnce((r: any) => r([{ value: 0 }])) // 0 pending
      .mockImplementationOnce((r: any) => r([{ value: 0 }])) // 0 running
      .mockImplementationOnce((r: any) => r([{ value: 0 }])) // 0 failed24h
      .mockImplementationOnce((r: any) => r([{ value: 0 }])) // 0 avg
      .mockImplementationOnce((r: any) => r([{ value: 0 }])); // 0 outbox

    const result = await queries.getStats();

    expect(result.churnRate).toBe(0);
    expect(result.mrr).toBe(0);
  });

  // --- getCustomers ---
  it("getCustomers returns paginated customer list", async () => {
    const customerRows = [
      {
        id: "u1",
        email: "a@b.com",
        name: "Alice",
        plan: "pro",
        createdAt: new Date(),
      },
    ];

    // First .then: customer rows
    mock.chain.then
      .mockImplementationOnce((r: any) => r(customerRows))
      // Second .then: total count
      .mockImplementationOnce((r: any) => r([{ value: 1 }]));

    const result = await queries.getCustomers({ page: 1, limit: 25 });

    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 1,
      totalPages: 1,
    });
  });

  it("getCustomers defaults to page 1 limit 25 when not specified", async () => {
    mock.chain.then
      .mockImplementationOnce((r: any) => r([]))
      .mockImplementationOnce((r: any) => r([{ value: 0 }]));

    const result = await queries.getCustomers({});

    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(25);
  });

  it("getCustomers calculates totalPages correctly", async () => {
    mock.chain.then
      .mockImplementationOnce((r: any) => r([]))
      .mockImplementationOnce((r: any) => r([{ value: 51 }]));

    const result = await queries.getCustomers({ page: 1, limit: 25 });

    expect(result.pagination.totalPages).toBe(3); // ceil(51/25) = 3
  });

  // --- getCustomerDetail ---
  it("getCustomerDetail returns user with subscriptions and payments", async () => {
    const user = { id: "u1", email: "a@b.com", plan: "pro" };
    mock.db.query.users.findFirst.mockResolvedValueOnce(user);

    const subs = [{ id: "sub1", userId: "u1", planCode: "pro" }];
    const pays = [{ id: "pay1", userId: "u1", amountCents: 14900 }];

    // Promise.all resolves two select chains
    mock.chain.then
      .mockImplementationOnce((r: any) => r(subs))
      .mockImplementationOnce((r: any) => r(pays));

    const result = await queries.getCustomerDetail("u1");

    expect(result).not.toBeNull();
    expect(result!.user).toEqual(user);
    expect(result!.subscriptions).toEqual(subs);
    expect(result!.payments).toEqual(pays);
  });

  it("getCustomerDetail returns null when user not found", async () => {
    mock.db.query.users.findFirst.mockResolvedValueOnce(undefined);

    const result = await queries.getCustomerDetail("u-none");

    expect(result).toBeNull();
  });

  // --- getIngestDetails ---
  it("getIngestDetails returns pending, running, failed jobs and outbox events", async () => {
    const pendingJobs = [{ id: "j1", status: "pending" }];
    const runningJobs = [{ id: "j2", status: "crawling" }];
    const failedJobs = [
      { id: "j3", status: "failed", errorMessage: "timeout" },
    ];
    const outbox = [{ id: "evt1", type: "crawl.completed", attempts: 0 }];

    mock.chain.then
      .mockImplementationOnce((r: any) => r(pendingJobs))
      .mockImplementationOnce((r: any) => r(runningJobs))
      .mockImplementationOnce((r: any) => r(failedJobs))
      .mockImplementationOnce((r: any) => r(outbox));

    const result = await queries.getIngestDetails();

    expect(result.pendingJobs).toEqual(pendingJobs);
    expect(result.runningJobs).toEqual(runningJobs);
    expect(result.failedJobs).toEqual(failedJobs);
    expect(result.outboxEvents).toEqual(outbox);
  });

  // --- retryCrawlJob ---
  it("retryCrawlJob resets job to pending and clears error fields", async () => {
    const retried = { id: "j1", status: "pending" };
    mock.chain.returning.mockResolvedValueOnce([retried]);

    const result = await queries.retryCrawlJob("j1");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith({
      status: "pending",
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
    });
    expect(result).toEqual(retried);
  });

  it("retryCrawlJob returns null when job not found", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.retryCrawlJob("j-none");

    expect(result).toBeNull();
  });

  // --- replayOutboxEvent ---
  it("replayOutboxEvent resets event to pending with availableAt now", async () => {
    const replayed = { id: "evt1", status: "pending" };
    mock.chain.returning.mockResolvedValueOnce([replayed]);

    const result = await queries.replayOutboxEvent("evt1");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
    expect(result).toEqual(replayed);
  });

  it("replayOutboxEvent returns null when event not found", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.replayOutboxEvent("evt-none");

    expect(result).toBeNull();
  });

  // --- cancelCrawlJob ---
  it("cancelCrawlJob sets failed status with reason and admin id", async () => {
    const cancelled = { id: "j1", status: "failed" };
    mock.chain.returning.mockResolvedValueOnce([cancelled]);

    const result = await queries.cancelCrawlJob(
      "j1",
      "Duplicate crawl",
      "admin1",
    );

    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: "Duplicate crawl",
        cancelledBy: "admin1",
        cancelReason: "Duplicate crawl",
        completedAt: expect.any(Date),
        cancelledAt: expect.any(Date),
      }),
    );
    expect(result).toEqual(cancelled);
  });

  it("cancelCrawlJob returns null when job not found", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.cancelCrawlJob("j-none", "reason", "admin1");

    expect(result).toBeNull();
  });

  // --- recordAdminAction ---
  it("recordAdminAction inserts an audit log entry", async () => {
    await queries.recordAdminAction({
      actorId: "admin1",
      action: "cancel_crawl",
      targetType: "crawl_job",
      targetId: "j1",
      reason: "Stuck in crawling state",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith({
      actorId: "admin1",
      action: "cancel_crawl",
      targetType: "crawl_job",
      targetId: "j1",
      reason: "Stuck in crawling state",
    });
  });

  it("recordAdminAction works without optional reason", async () => {
    await queries.recordAdminAction({
      actorId: "admin1",
      action: "retry_crawl",
      targetType: "crawl_job",
      targetId: "j2",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith({
      actorId: "admin1",
      action: "retry_crawl",
      targetType: "crawl_job",
      targetId: "j2",
      reason: undefined,
    });
  });
});
