import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBillingService } from "../../services/billing-service";
import {
  createMockBillingRepo,
  createMockUserRepo,
} from "../helpers/mock-repositories";
import { buildUser } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mock the billing gateway
// ---------------------------------------------------------------------------

const mockGateway = {
  ensureCustomer: vi.fn().mockResolvedValue("cus_test123"),
  createCheckoutSession: vi
    .fn()
    .mockResolvedValue({ url: "https://checkout.stripe.com/session" }),
  cancelAtPeriodEnd: vi.fn().mockResolvedValue(undefined),
  createPortalSession: vi
    .fn()
    .mockResolvedValue("https://billing.stripe.com/portal"),
};

vi.mock("@llm-boost/billing", () => ({
  StripeGateway: vi.fn().mockImplementation(() => mockGateway),
  priceIdFromPlanCode: vi.fn().mockImplementation((plan: string) => {
    const map: Record<string, string> = {
      starter: "price_starter",
      pro: "price_pro",
      agency: "price_agency",
    };
    return map[plan] ?? undefined;
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BillingService", () => {
  let billing: ReturnType<typeof createMockBillingRepo>;
  let users: ReturnType<typeof createMockUserRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    billing = createMockBillingRepo();
    users = createMockUserRepo({
      getById: vi.fn().mockResolvedValue(buildUser()),
    });
  });

  // ---- checkout ----

  it("creates checkout session for valid plan", async () => {
    const service = createBillingService({ billing, users });
    const result = await service.checkout({
      userId: "user-1",
      plan: "pro",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
      stripeSecretKey: "sk_test_key",
    });

    expect(result).toEqual({ url: "https://checkout.stripe.com/session" });
    expect(mockGateway.ensureCustomer).toHaveBeenCalledWith(
      "test@example.com",
      "user-1",
      undefined,
    );
  });

  it("throws NOT_FOUND when user does not exist for checkout", async () => {
    users.getById.mockResolvedValue(undefined);
    const service = createBillingService({ billing, users });

    await expect(
      service.checkout({
        userId: "user-1",
        plan: "pro",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
        stripeSecretKey: "sk_test_key",
      }),
    ).rejects.toThrow("User not found");
  });

  it("throws VALIDATION_ERROR for invalid plan code", async () => {
    const service = createBillingService({ billing, users });

    await expect(
      service.checkout({
        userId: "user-1",
        plan: "nonexistent_plan",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
        stripeSecretKey: "sk_test_key",
      }),
    ).rejects.toThrow("Invalid plan: nonexistent_plan");
  });

  // ---- getUsage ----

  it("returns usage info for a valid user", async () => {
    const service = createBillingService({ billing, users });
    const usage = await service.getUsage("user-1");

    expect(usage).toMatchObject({
      plan: "pro",
      crawlCreditsRemaining: 5,
      crawlCreditsTotal: 30,
      maxPagesPerCrawl: 500,
      maxDepth: 5,
      maxProjects: 20,
    });
  });

  it("throws NOT_FOUND when user does not exist for getUsage", async () => {
    users.getById.mockResolvedValue(undefined);
    const service = createBillingService({ billing, users });

    await expect(service.getUsage("user-1")).rejects.toThrow("User not found");
  });

  // ---- cancelAtPeriodEnd ----

  it("cancels subscription at period end", async () => {
    billing.getActiveSubscription.mockResolvedValue({
      id: "sub-1",
      stripeSubscriptionId: "sub_stripe_1",
    } as any);
    const service = createBillingService({ billing, users });

    const result = await service.cancelAtPeriodEnd("user-1", "sk_test_key");
    expect(result).toEqual({ canceled: true });
    expect(mockGateway.cancelAtPeriodEnd).toHaveBeenCalledWith("sub_stripe_1");
    expect(billing.markCancelAtPeriodEnd).toHaveBeenCalledWith("sub_stripe_1");
  });

  it("throws when no active subscription exists for cancellation", async () => {
    billing.getActiveSubscription.mockResolvedValue(undefined);
    const service = createBillingService({ billing, users });

    await expect(
      service.cancelAtPeriodEnd("user-1", "sk_test_key"),
    ).rejects.toThrow("No active subscription");
  });

  // ---- downgrade (paid-to-paid) ----

  it("updates local plan immediately on paid-to-paid downgrade", async () => {
    billing.getActiveSubscription.mockResolvedValue({
      id: "sub-1",
      stripeSubscriptionId: "sub_stripe_1",
    } as any);

    const mockGetSubscription = vi.fn().mockResolvedValue({
      id: "sub_stripe_1",
      items: { data: [{ id: "si_item1" }] },
    });
    const mockUpdatePrice = vi.fn().mockResolvedValue(undefined);

    // Re-mock gateway with getSubscription + updateSubscriptionPrice
    const { StripeGateway } = await import("@llm-boost/billing");
    (StripeGateway as any).mockImplementation(() => ({
      ...mockGateway,
      getSubscription: mockGetSubscription,
      updateSubscriptionPrice: mockUpdatePrice,
    }));

    const service = createBillingService({ billing, users });
    const result = await service.downgrade({
      userId: "user-1",
      targetPlan: "starter",
      stripeSecretKey: "sk_test_key",
    });

    expect(result).toEqual({ downgraded: true, targetPlan: "starter" });
    expect(mockUpdatePrice).toHaveBeenCalledWith(
      "sub_stripe_1",
      "si_item1",
      "price_starter",
    );
    expect(users.updatePlan).toHaveBeenCalledWith(
      "user-1",
      "starter",
      "sub_stripe_1",
    );
  });

  // ---- portal ----

  it("creates portal session for user with Stripe customer ID", async () => {
    users.getById.mockResolvedValue(
      buildUser({ stripeCustomerId: "cus_existing" }),
    );
    const service = createBillingService({ billing, users });

    const result = await service.portal(
      "user-1",
      "https://app.test/settings",
      "sk_test_key",
    );
    expect(result).toEqual({ url: "https://billing.stripe.com/portal" });
  });

  it("throws when user has no Stripe customer ID for portal", async () => {
    users.getById.mockResolvedValue(buildUser({ stripeCustomerId: null }));
    const service = createBillingService({ billing, users });

    await expect(
      service.portal("user-1", "https://app.test/settings", "sk_test_key"),
    ).rejects.toThrow("No active subscription found");
  });
});
