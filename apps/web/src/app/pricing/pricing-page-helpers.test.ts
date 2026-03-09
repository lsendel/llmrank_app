import { PLAN_LIMITS } from "@llm-boost/shared";
import { describe, expect, it } from "vitest";
import {
  PRICING_FAQ,
  PRICING_FEATURES,
  PRICING_PAGE_METADATA,
  PRICING_PLANS,
  PRICING_PRODUCT_OFFERS,
  formatPricingHistory,
  getPricingDisplayPrice,
} from "./pricing-page-helpers";

describe("pricing page helpers", () => {
  it("keeps plan ordering, highlight state, and feature mappings stable", () => {
    expect(PRICING_PLANS.map((plan) => plan.tier)).toEqual([
      "free",
      "starter",
      "pro",
      "agency",
    ]);
    expect(
      PRICING_PLANS.filter((plan) => plan.highlight).map((plan) => plan.tier),
    ).toEqual(["pro"]);

    expect(
      PRICING_FEATURES.find(
        (feature) => feature.label === "Pages per crawl",
      )?.getValue(PLAN_LIMITS.starter),
    ).toBe("100");
    expect(
      PRICING_FEATURES.find(
        (feature) => feature.label === "Crawls per month",
      )?.getValue(PLAN_LIMITS.agency),
    ).toBe("Unlimited");
    expect(
      PRICING_FEATURES.find(
        (feature) => feature.label === "API access",
      )?.getValue(PLAN_LIMITS.free),
    ).toBe(false);
  });

  it("preserves metadata, FAQ coverage, and pricing display helpers", () => {
    expect(PRICING_PAGE_METADATA.alternates?.canonical).toBe("/pricing");
    expect(PRICING_PAGE_METADATA.openGraph?.url).toBe(
      "https://llmrank.app/pricing",
    );
    expect(PRICING_FAQ).toHaveLength(6);
    expect(PRICING_PRODUCT_OFFERS).toHaveLength(4);

    expect(formatPricingHistory(365)).toBe("1 year score history");
    expect(formatPricingHistory(730)).toBe("2 years score history");
    expect(getPricingDisplayPrice(79, false)).toEqual({
      displayPrice: 79,
      period: "/month",
    });
    expect(getPricingDisplayPrice(79, true)).toEqual({
      displayPrice: 758,
      period: "/year",
    });
  });
});
