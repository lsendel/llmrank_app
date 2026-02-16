import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildUser } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mock auth middleware to bypass JWT verification
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

// ---------------------------------------------------------------------------
// Mock repositories
// ---------------------------------------------------------------------------

const mockBillingRepo = {
  getActiveSubscription: vi.fn().mockResolvedValue(null),
  listPayments: vi.fn().mockResolvedValue([]),
  markCancelAtPeriodEnd: vi.fn().mockResolvedValue(undefined),
  updateSubscriptionStatus: vi.fn().mockResolvedValue(undefined),
  createSubscription: vi.fn().mockResolvedValue({ id: "sub-1" }),
};

const mockUserRepo = {
  getById: vi.fn().mockResolvedValue(buildUser({ id: "test-user-id" })),
  decrementCrawlCredits: vi.fn().mockResolvedValue(true),
};

vi.mock("../../repositories", () => ({
  createBillingRepository: () => mockBillingRepo,
  createProjectRepository: () => ({}),
  createUserRepository: () => mockUserRepo,
  createCrawlRepository: () => ({}),
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
}));

// Mock the Stripe billing package to avoid real Stripe calls
vi.mock("@llm-boost/billing", () => ({
  StripeGateway: vi.fn().mockImplementation(() => ({
    ensureCustomer: vi.fn().mockResolvedValue("cus_test123"),
    createCheckoutSession: vi
      .fn()
      .mockResolvedValue({ url: "https://checkout.stripe.com/session123" }),
    verifyWebhookSignature: vi.fn().mockRejectedValue(new Error("Invalid")),
    cancelAtPeriodEnd: vi.fn().mockResolvedValue(undefined),
    createPortalSession: vi
      .fn()
      .mockResolvedValue("https://billing.stripe.com/portal"),
  })),
  handleWebhook: vi.fn().mockResolvedValue(undefined),
  priceIdFromPlanCode: vi.fn().mockReturnValue("price_test_starter"),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Billing Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRepo.getById.mockResolvedValue(buildUser({ id: "test-user-id" }));
  });

  // -----------------------------------------------------------------------
  // GET /api/billing/subscription
  // -----------------------------------------------------------------------

  describe("GET /api/billing/subscription", () => {
    it("returns 200 with null when no active subscription", async () => {
      mockBillingRepo.getActiveSubscription.mockResolvedValue(null);

      const res = await request("/api/billing/subscription");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeNull();
    });

    it("returns 200 with subscription details when active", async () => {
      mockBillingRepo.getActiveSubscription.mockResolvedValue({
        id: "sub-1",
        planCode: "starter",
        status: "active",
        stripeSubscriptionId: "sub_stripe_1",
        currentPeriodEnd: new Date("2025-01-01"),
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });

      const res = await request("/api/billing/subscription");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.id).toBe("sub-1");
      expect(body.data.planCode).toBe("starter");
      expect(body.data.status).toBe("active");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/billing/usage
  // -----------------------------------------------------------------------

  describe("GET /api/billing/usage", () => {
    it("returns 200 with usage and plan limits", async () => {
      const res = await request("/api/billing/usage");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("plan");
      expect(body.data).toHaveProperty("crawlCreditsRemaining");
      expect(body.data).toHaveProperty("crawlCreditsTotal");
      expect(body.data).toHaveProperty("maxPagesPerCrawl");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/billing/checkout
  // -----------------------------------------------------------------------

  describe("POST /api/billing/checkout", () => {
    it("returns 200 with checkout session URL", async () => {
      const res = await request("/api/billing/checkout", {
        method: "POST",
        json: {
          plan: "starter",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("url");
      expect(body.data.url).toContain("stripe.com");
    });

    it("returns 422 when plan is missing", async () => {
      const res = await request("/api/billing/checkout", {
        method: "POST",
        json: {
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when successUrl is missing", async () => {
      const res = await request("/api/billing/checkout", {
        method: "POST",
        json: { plan: "starter", cancelUrl: "https://example.com/cancel" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when cancelUrl is missing", async () => {
      const res = await request("/api/billing/checkout", {
        method: "POST",
        json: { plan: "starter", successUrl: "https://example.com/success" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/billing/payments
  // -----------------------------------------------------------------------

  describe("GET /api/billing/payments", () => {
    it("returns 200 with empty payment list", async () => {
      mockBillingRepo.listPayments.mockResolvedValue([]);

      const res = await request("/api/billing/payments");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual([]);
    });

    it("returns 200 with formatted payment entries", async () => {
      mockBillingRepo.listPayments.mockResolvedValue([
        {
          id: "pay-1",
          amountCents: 7900,
          currency: "usd",
          status: "paid",
          stripeInvoiceId: "inv_123",
          createdAt: new Date("2024-06-15T00:00:00.000Z"),
        },
      ]);

      const res = await request("/api/billing/payments");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(1);
      expect(body.data[0]).toHaveProperty("amountCents", 7900);
      expect(body.data[0]).toHaveProperty("createdAt");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/billing/cancel
  // -----------------------------------------------------------------------

  describe("POST /api/billing/cancel", () => {
    it("returns 200 when cancelling subscription at period end", async () => {
      mockBillingRepo.getActiveSubscription.mockResolvedValue({
        id: "sub-1",
        stripeSubscriptionId: "sub_stripe_1",
        planCode: "starter",
        status: "active",
        currentPeriodEnd: new Date("2025-01-01"),
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });

      const res = await request("/api/billing/cancel", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("canceled", true);
    });

    it("returns 422 when no active subscription", async () => {
      mockBillingRepo.getActiveSubscription.mockResolvedValue(null);

      const res = await request("/api/billing/cancel", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("No active subscription");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/billing/portal
  // -----------------------------------------------------------------------

  describe("POST /api/billing/portal", () => {
    it("returns 200 with portal URL", async () => {
      mockUserRepo.getById.mockResolvedValue(
        buildUser({
          id: "test-user-id",
          stripeCustomerId: "cus_test123",
        }),
      );

      const res = await request("/api/billing/portal", {
        method: "POST",
        json: { returnUrl: "https://example.com/settings" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("url");
    });

    it("returns 422 when returnUrl is missing", async () => {
      const res = await request("/api/billing/portal", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("returnUrl");
    });

    it("returns 422 when user has no Stripe customer ID", async () => {
      mockUserRepo.getById.mockResolvedValue(
        buildUser({ id: "test-user-id", stripeCustomerId: null }),
      );

      const res = await request("/api/billing/portal", {
        method: "POST",
        json: { returnUrl: "https://example.com/settings" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("subscription");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/billing/webhook
  // -----------------------------------------------------------------------

  describe("POST /api/billing/webhook", () => {
    it("returns 401 when stripe-signature header is missing", async () => {
      const res = await request("/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      });
      expect(res.status).toBe(401);

      const body: any = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toContain("Stripe signature");
    });

    it("returns 401 when signature verification fails", async () => {
      const res = await request("/api/billing/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "t=123,v1=invalid",
        },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      });
      expect(res.status).toBe(401);

      const body: any = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
