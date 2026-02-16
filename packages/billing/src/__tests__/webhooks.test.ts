import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWebhook } from "../webhooks";
import type { StripeEvent } from "../gateway";

// ---------------------------------------------------------------------------
// Mock @llm-boost/db
// ---------------------------------------------------------------------------

const mockBilling = {
  createSubscription: vi.fn().mockResolvedValue({ id: "sub-local-1" }),
  cancelSubscription: vi.fn().mockResolvedValue(undefined),
  getPaymentByInvoiceId: vi.fn().mockResolvedValue(null),
  getSubscriptionByStripeId: vi.fn().mockResolvedValue(null),
  updateSubscriptionPeriod: vi.fn().mockResolvedValue(undefined),
  createPayment: vi.fn().mockResolvedValue({ id: "pay-1" }),
  updateSubscriptionStatus: vi.fn().mockResolvedValue(undefined),
  markCancelAtPeriodEnd: vi.fn().mockResolvedValue(undefined),
};

const mockUsers = {
  updatePlan: vi.fn().mockResolvedValue(undefined),
  getById: vi.fn().mockResolvedValue({ id: "user-1", stripeCustomerId: null }),
  updateProfile: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@llm-boost/db", () => ({
  billingQueries: () => mockBilling,
  userQueries: () => mockUsers,
}));

// Mock the StripeGateway that webhooks.ts instantiates
vi.mock("../gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../gateway")>();
  return {
    ...actual,
    StripeGateway: vi.fn().mockImplementation(() => ({
      getSubscription: vi.fn().mockResolvedValue({
        id: "sub_stripe_1",
        metadata: { plan_code: "pro" },
      }),
      cancelImmediately: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

// Mock plan-map to handle test data price IDs
vi.mock("../plan-map", () => ({
  planCodeFromPriceId: (priceId: string) => {
    if (priceId === "price_pro") return "pro";
    if (priceId === "price_starter") return "starter";
    if (priceId === "price_agency") return "agency";
    return undefined;
  },
  priceIdFromPlanCode: (planCode: string) => {
    if (planCode === "pro") return "price_pro";
    if (planCode === "starter") return "price_starter";
    if (planCode === "agency") return "price_agency";
    return undefined;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(type: string, data: Record<string, unknown>): StripeEvent {
  return { id: "evt_1", object: "event", type, data: { object: data } };
}

const fakeDb = {} as any;
const fakeKey = "sk_test_xxx";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBilling.getSubscriptionByStripeId.mockResolvedValue(null);
    mockBilling.getPaymentByInvoiceId.mockResolvedValue(null);
  });

  // -------------------------------------------------------------------------
  // checkout.session.completed
  // -------------------------------------------------------------------------

  describe("checkout.session.completed", () => {
    it("creates subscription and upgrades user plan", async () => {
      const event = makeEvent("checkout.session.completed", {
        client_reference_id: "user-1",
        subscription: "sub_stripe_1",
        customer: "cus_1",
      });

      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockBilling.createSubscription).toHaveBeenCalledWith({
        userId: "user-1",
        planCode: "pro",
        status: "active",
        stripeSubscriptionId: "sub_stripe_1",
        stripeCustomerId: "cus_1",
      });
      expect(mockUsers.updatePlan).toHaveBeenCalledWith(
        "user-1",
        "pro",
        "sub_stripe_1",
      );
    });

    it("throws when client_reference_id is missing", async () => {
      const event = makeEvent("checkout.session.completed", {
        subscription: "sub_stripe_1",
        customer: "cus_1",
      });

      await expect(handleWebhook(event, fakeDb, fakeKey)).rejects.toThrow(
        "missing client_reference_id",
      );
    });

    it("throws when subscription is missing", async () => {
      const event = makeEvent("checkout.session.completed", {
        client_reference_id: "user-1",
        customer: "cus_1",
      });

      await expect(handleWebhook(event, fakeDb, fakeKey)).rejects.toThrow(
        "missing subscription",
      );
    });

    it("handles upgrade from existing subscription", async () => {
      // Mock gateway.getSubscription to return upgrade metadata
      const { StripeGateway } = await import("../gateway");
      const mockCancel = vi.fn().mockResolvedValue(undefined);
      (StripeGateway as any).mockImplementation(() => ({
        getSubscription: vi.fn().mockResolvedValue({
          id: "sub_stripe_new",
          metadata: {
            plan_code: "agency",
            upgrade_from_subscription_id: "sub_stripe_old",
          },
        }),
        cancelImmediately: mockCancel,
      }));

      const event = makeEvent("checkout.session.completed", {
        client_reference_id: "user-1",
        subscription: "sub_stripe_new",
        customer: "cus_1",
      });

      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockCancel).toHaveBeenCalledWith("sub_stripe_old");
      expect(mockBilling.cancelSubscription).toHaveBeenCalledWith(
        "sub_stripe_old",
        expect.any(Date),
      );
    });
  });

  // -------------------------------------------------------------------------
  // invoice.payment_succeeded
  // -------------------------------------------------------------------------

  describe("invoice.payment_succeeded", () => {
    const invoiceData = {
      id: "in_123",
      amount_paid: 14900,
      currency: "usd",
      period_start: 1700000000,
      period_end: 1702592000,
      lines: {
        data: [
          {
            parent: {
              type: "subscription_item",
              subscription_item_details: { subscription: "sub_stripe_1" },
            },
          },
        ],
      },
    };

    it("records payment and syncs billing period", async () => {
      mockBilling.getSubscriptionByStripeId.mockResolvedValue({
        id: "local-sub-1",
        userId: "user-1",
      });

      const event = makeEvent("invoice.payment_succeeded", invoiceData);
      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockBilling.createPayment).toHaveBeenCalledWith({
        userId: "user-1",
        subscriptionId: "local-sub-1",
        stripeInvoiceId: "in_123",
        amountCents: 14900,
        currency: "usd",
        status: "succeeded",
      });
      expect(mockBilling.updateSubscriptionPeriod).toHaveBeenCalledWith(
        "sub_stripe_1",
        new Date(1700000000 * 1000),
        new Date(1702592000 * 1000),
      );
    });

    it("skips duplicate payment (idempotency)", async () => {
      mockBilling.getPaymentByInvoiceId.mockResolvedValue({ id: "existing" });

      const event = makeEvent("invoice.payment_succeeded", invoiceData);
      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockBilling.createPayment).not.toHaveBeenCalled();
    });

    it("skips when local subscription not found", async () => {
      mockBilling.getSubscriptionByStripeId.mockResolvedValue(null);

      const event = makeEvent("invoice.payment_succeeded", invoiceData);
      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockBilling.createPayment).not.toHaveBeenCalled();
    });

    it("handles missing period dates gracefully", async () => {
      mockBilling.getSubscriptionByStripeId.mockResolvedValue({
        id: "local-sub-1",
        userId: "user-1",
      });

      const event = makeEvent("invoice.payment_succeeded", {
        ...invoiceData,
        period_start: undefined,
        period_end: undefined,
      });
      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockBilling.updateSubscriptionPeriod).not.toHaveBeenCalled();
      expect(mockBilling.createPayment).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // invoice.payment_failed
  // -------------------------------------------------------------------------

  describe("invoice.payment_failed", () => {
    it("marks subscription as past_due", async () => {
      const event = makeEvent("invoice.payment_failed", {
        lines: {
          data: [
            {
              parent: {
                type: "subscription_item",
                subscription_item_details: { subscription: "sub_stripe_1" },
              },
            },
          ],
        },
      });

      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockBilling.updateSubscriptionStatus).toHaveBeenCalledWith(
        "sub_stripe_1",
        "past_due",
      );
    });

    it("does nothing when subscription ID not found in invoice lines", async () => {
      const event = makeEvent("invoice.payment_failed", {
        lines: { data: [{ parent: null }] },
      });

      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockBilling.updateSubscriptionStatus).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // customer.subscription.updated
  // -------------------------------------------------------------------------

  describe("customer.subscription.updated", () => {
    it("syncs cancel_at_period_end flag", async () => {
      const event = makeEvent("customer.subscription.updated", {
        id: "sub_stripe_1",
        cancel_at_period_end: true,
        status: "active",
        items: { data: [{ price: { id: "price_pro" } }] },
      });

      mockBilling.getSubscriptionByStripeId.mockResolvedValue({
        id: "local-1",
        userId: "user-1",
      });

      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockBilling.markCancelAtPeriodEnd).toHaveBeenCalledWith(
        "sub_stripe_1",
      );
    });

    it("updates plan on price change", async () => {
      const event = makeEvent("customer.subscription.updated", {
        id: "sub_stripe_1",
        cancel_at_period_end: false,
        status: "active",
        items: { data: [{ price: { id: "price_pro" } }] },
      });

      mockBilling.getSubscriptionByStripeId.mockResolvedValue({
        id: "local-1",
        userId: "user-1",
      });

      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockUsers.updatePlan).toHaveBeenCalledWith(
        "user-1",
        "pro",
        "sub_stripe_1",
      );
    });

    it("maps stripe status to local status", async () => {
      const event = makeEvent("customer.subscription.updated", {
        id: "sub_stripe_1",
        cancel_at_period_end: false,
        status: "past_due",
        items: { data: [{ price: { id: "price_starter" } }] },
      });

      mockBilling.getSubscriptionByStripeId.mockResolvedValue({
        id: "local-1",
        userId: "user-1",
      });

      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockBilling.updateSubscriptionStatus).toHaveBeenCalledWith(
        "sub_stripe_1",
        "past_due",
      );
    });

    it("ignores unknown price IDs", async () => {
      const event = makeEvent("customer.subscription.updated", {
        id: "sub_stripe_1",
        cancel_at_period_end: false,
        status: "active",
        items: { data: [{ price: { id: "price_unknown_xyz" } }] },
      });

      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockUsers.updatePlan).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // customer.subscription.deleted
  // -------------------------------------------------------------------------

  describe("customer.subscription.deleted", () => {
    it("cancels subscription and downgrades to free", async () => {
      mockBilling.getSubscriptionByStripeId.mockResolvedValue({
        id: "local-1",
        userId: "user-1",
      });

      const event = makeEvent("customer.subscription.deleted", {
        id: "sub_stripe_1",
      });

      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockBilling.cancelSubscription).toHaveBeenCalledWith(
        "sub_stripe_1",
        expect.any(Date),
      );
      expect(mockUsers.updatePlan).toHaveBeenCalledWith(
        "user-1",
        "free",
        undefined,
      );
    });

    it("cancels subscription even when local sub not found", async () => {
      mockBilling.getSubscriptionByStripeId.mockResolvedValue(null);

      const event = makeEvent("customer.subscription.deleted", {
        id: "sub_stripe_1",
      });

      await handleWebhook(event, fakeDb, fakeKey);

      expect(mockBilling.cancelSubscription).toHaveBeenCalled();
      expect(mockUsers.updatePlan).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Unknown events
  // -------------------------------------------------------------------------

  describe("unknown event types", () => {
    it("ignores unknown event types silently", async () => {
      const event = makeEvent("payment_intent.created", { id: "pi_1" });

      await expect(
        handleWebhook(event, fakeDb, fakeKey),
      ).resolves.toBeUndefined();
    });
  });
});
