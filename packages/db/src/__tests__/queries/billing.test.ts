import { describe, it, expect, vi, beforeEach } from "vitest";
import { billingQueries } from "../../queries/billing";

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

describe("billingQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof billingQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = billingQueries(mock.db);
  });

  // --- getActiveSubscription ---
  it("getActiveSubscription returns the active sub for a user", async () => {
    const sub = { id: "sub1", userId: "u1", status: "active", planCode: "pro" };
    mock.db.query.subscriptions.findFirst.mockResolvedValueOnce(sub);

    const result = await queries.getActiveSubscription("u1");

    expect(mock.db.query.subscriptions.findFirst).toHaveBeenCalled();
    expect(result).toEqual(sub);
  });

  it("getActiveSubscription returns undefined when no active subscription", async () => {
    const result = await queries.getActiveSubscription("u-none");
    expect(result).toBeUndefined();
  });

  // --- getSubscriptionByStripeId ---
  it("getSubscriptionByStripeId finds sub by stripe subscription id", async () => {
    const sub = { id: "sub1", stripeSubscriptionId: "sub_stripe_123" };
    mock.db.query.subscriptions.findFirst.mockResolvedValueOnce(sub);

    const result = await queries.getSubscriptionByStripeId("sub_stripe_123");

    expect(mock.db.query.subscriptions.findFirst).toHaveBeenCalled();
    expect(result).toEqual(sub);
  });

  // --- createSubscription ---
  it("createSubscription inserts a new subscription and returns it", async () => {
    const newSub = {
      id: "sub2",
      userId: "u1",
      planCode: "starter",
      status: "active",
      stripeSubscriptionId: "sub_new",
      stripeCustomerId: "cus_new",
    };
    mock.chain.returning.mockResolvedValueOnce([newSub]);

    const result = await queries.createSubscription({
      userId: "u1",
      planCode: "starter",
      status: "active",
      stripeSubscriptionId: "sub_new",
      stripeCustomerId: "cus_new",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(result).toEqual(newSub);
  });

  // --- updateSubscriptionPeriod ---
  it("updateSubscriptionPeriod sets period dates and active status", async () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-02-01");
    const updated = {
      id: "sub1",
      currentPeriodStart: start,
      currentPeriodEnd: end,
      status: "active",
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updateSubscriptionPeriod(
      "sub_stripe_123",
      start,
      end,
    );

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith({
      currentPeriodStart: start,
      currentPeriodEnd: end,
      status: "active",
    });
    expect(result).toEqual(updated);
  });

  // --- updateSubscriptionStatus ---
  it("updateSubscriptionStatus changes the subscription status", async () => {
    const updated = { id: "sub1", status: "past_due" };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updateSubscriptionStatus(
      "sub_stripe_123",
      "past_due",
    );

    expect(mock.chain.set).toHaveBeenCalledWith({ status: "past_due" });
    expect(result).toEqual(updated);
  });

  // --- cancelSubscription ---
  it("cancelSubscription sets status to canceled with timestamp", async () => {
    const canceledAt = new Date("2026-02-14");
    const updated = {
      id: "sub1",
      status: "canceled",
      canceledAt,
      cancelAtPeriodEnd: false,
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.cancelSubscription(
      "sub_stripe_123",
      canceledAt,
    );

    expect(mock.chain.set).toHaveBeenCalledWith({
      status: "canceled",
      canceledAt,
      cancelAtPeriodEnd: false,
    });
    expect(result).toEqual(updated);
  });

  // --- markCancelAtPeriodEnd ---
  it("markCancelAtPeriodEnd flags subscription for end-of-period cancellation", async () => {
    const updated = { id: "sub1", cancelAtPeriodEnd: true };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.markCancelAtPeriodEnd("sub_stripe_123");

    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelAtPeriodEnd: true,
        canceledAt: expect.any(Date),
      }),
    );
    expect(result).toEqual(updated);
  });

  // --- getPaymentByInvoiceId ---
  it("getPaymentByInvoiceId finds payment by Stripe invoice id", async () => {
    const payment = { id: "pay1", stripeInvoiceId: "inv_abc" };
    mock.db.query.payments.findFirst.mockResolvedValueOnce(payment);

    const result = await queries.getPaymentByInvoiceId("inv_abc");

    expect(mock.db.query.payments.findFirst).toHaveBeenCalled();
    expect(result).toEqual(payment);
  });

  it("getPaymentByInvoiceId returns undefined when not found", async () => {
    const result = await queries.getPaymentByInvoiceId("inv_nonexistent");
    expect(result).toBeUndefined();
  });

  // --- createPayment ---
  it("createPayment inserts a payment record and returns it", async () => {
    const payment = {
      id: "pay2",
      userId: "u1",
      stripeInvoiceId: "inv_new",
      amountCents: 7900,
      currency: "usd",
      status: "succeeded",
    };
    mock.chain.returning.mockResolvedValueOnce([payment]);

    const result = await queries.createPayment({
      userId: "u1",
      stripeInvoiceId: "inv_new",
      amountCents: 7900,
      currency: "usd",
      status: "succeeded",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(result).toEqual(payment);
  });

  // --- listPayments ---
  it("listPayments returns payments ordered by creation date", async () => {
    const payments = [
      { id: "pay1", userId: "u1", amountCents: 7900 },
      { id: "pay2", userId: "u1", amountCents: 14900 },
    ];
    mock.db.query.payments.findMany.mockResolvedValueOnce(payments);

    const result = await queries.listPayments("u1");

    expect(mock.db.query.payments.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("listPayments accepts a custom limit", async () => {
    mock.db.query.payments.findMany.mockResolvedValueOnce([]);

    await queries.listPayments("u1", 10);

    expect(mock.db.query.payments.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
  });
});
