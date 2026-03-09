import { describe, expect, it } from "vitest";
import {
  buildBillingUpgradeUrls,
  getBillingSubscriptionBadgeVariant,
  getBillingSubscriptionLabel,
  getNextBillingPlanTier,
  getPaymentStatusVariant,
  getPromoBadgeText,
} from "./billing-page-helpers";

describe("billing page helpers", () => {
  it("maps plan progression and subscription badge display", () => {
    expect(getNextBillingPlanTier("free")).toBe("starter");
    expect(getNextBillingPlanTier("agency")).toBeNull();

    expect(
      getBillingSubscriptionBadgeVariant({
        id: "sub_active",
        planCode: "starter",
        status: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      }),
    ).toBe("default");
    expect(
      getBillingSubscriptionLabel({
        id: "sub_canceling",
        planCode: "starter",
        status: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: true,
        canceledAt: null,
      }),
    ).toBe("Canceling");
  });

  it("formats promo, payment, and upgrade URL helpers", () => {
    expect(
      getPromoBadgeText({
        code: "SAVE20",
        discountType: "percent_off",
        discountValue: 20,
        duration: "once",
        durationMonths: null,
      }),
    ).toBe("20% off");
    expect(
      getPromoBadgeText({
        code: "FLAT50",
        discountType: "amount_off",
        discountValue: 5000,
        duration: "once",
        durationMonths: null,
      }),
    ).toBe("$50.00 off");
    expect(getPaymentStatusVariant("failed")).toBe("destructive");
    expect(buildBillingUpgradeUrls("https://llmrank.app")).toEqual({
      successUrl: "https://llmrank.app/dashboard/billing?upgraded=true",
      cancelUrl: "https://llmrank.app/dashboard/billing",
    });
  });
});
