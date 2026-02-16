import { describe, it, expect } from "vitest";
import { PLAN_LIMITS, PlanTier } from "../../constants/plans";

describe("PLAN_LIMITS", () => {
  it("defines limits for all four tiers", () => {
    const tiers: PlanTier[] = ["free", "starter", "pro", "agency"];
    for (const tier of tiers) {
      expect(PLAN_LIMITS[tier]).toBeDefined();
    }
  });

  describe("new plan limits", () => {
    it("free tier has no scheduled queries or API tokens", () => {
      expect(PLAN_LIMITS.free.scheduledQueries).toBe(0);
      expect(PLAN_LIMITS.free.apiTokens).toBe(0);
      expect(PLAN_LIMITS.free.notificationChannels).toBe(1);
    });

    it("starter allows scheduled queries but no API tokens", () => {
      expect(PLAN_LIMITS.starter.scheduledQueries).toBe(5);
      expect(PLAN_LIMITS.starter.apiTokens).toBe(0);
    });

    it("pro allows API tokens", () => {
      expect(PLAN_LIMITS.pro.apiTokens).toBe(3);
      expect(PLAN_LIMITS.pro.apiRateLimit).toBe(500);
    });

    it("agency has highest limits", () => {
      expect(PLAN_LIMITS.agency.scheduledQueries).toBe(100);
      expect(PLAN_LIMITS.agency.apiTokens).toBe(10);
      expect(PLAN_LIMITS.agency.apiRateLimit).toBe(2000);
    });
  });

  describe("limit escalation across tiers", () => {
    it("scheduled queries increase with tier", () => {
      expect(PLAN_LIMITS.free.scheduledQueries).toBeLessThan(
        PLAN_LIMITS.starter.scheduledQueries,
      );
      expect(PLAN_LIMITS.starter.scheduledQueries).toBeLessThan(
        PLAN_LIMITS.pro.scheduledQueries,
      );
      expect(PLAN_LIMITS.pro.scheduledQueries).toBeLessThan(
        PLAN_LIMITS.agency.scheduledQueries,
      );
    });

    it("notification channels increase with tier", () => {
      expect(PLAN_LIMITS.free.notificationChannels).toBeLessThan(
        PLAN_LIMITS.starter.notificationChannels,
      );
      expect(PLAN_LIMITS.starter.notificationChannels).toBeLessThanOrEqual(
        PLAN_LIMITS.pro.notificationChannels,
      );
    });

    it("API rate limit increases with tier", () => {
      expect(PLAN_LIMITS.starter.apiRateLimit).toBeLessThan(
        PLAN_LIMITS.pro.apiRateLimit,
      );
      expect(PLAN_LIMITS.pro.apiRateLimit).toBeLessThan(
        PLAN_LIMITS.agency.apiRateLimit,
      );
    });
  });
});
