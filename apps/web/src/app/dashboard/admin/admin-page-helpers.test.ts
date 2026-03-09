import { describe, expect, it } from "vitest";
import type { AdminCustomer, AdminStats, Promo } from "@/lib/api";
import {
  buildAdminIngestCards,
  buildAdminStatCards,
  getAdminCustomerStatus,
  getCustomerActionDialogTitle,
  getCustomerPlanBadgeVariant,
  getPromoSummary,
  isRestrictedCustomerStatus,
} from "./admin-page-helpers";

const stats: AdminStats = {
  mrr: 1250,
  mrrByPlan: { pro: 1250 },
  totalRevenue: 9800,
  failedPayments: 1,
  activeSubscribers: 14,
  totalCustomers: 20,
  churnRate: 3.5,
  ingestHealth: {
    pendingJobs: 72,
    runningJobs: 4,
    failedLast24h: 2,
    avgCompletionMinutes: 42.4,
    outboxPending: 27,
  },
};

describe("admin page helpers", () => {
  it("builds formatted stat cards and ingest cards with the expected tones", () => {
    expect(buildAdminStatCards(undefined).map((card) => card.value)).toEqual([
      "—",
      "—",
      "—",
      "—",
    ]);

    expect(buildAdminStatCards(stats).map((card) => card.value)).toEqual([
      "$1,250.00",
      "$9,800.00",
      "14",
      "3.5%",
    ]);

    expect(
      buildAdminIngestCards(stats, [
        { timestamp: 1, value: 12 },
        { timestamp: 2, value: 18 },
      ]).map((card) => ({
        title: card.title,
        tone: card.tone,
        detailKey: card.detailKey,
      })),
    ).toEqual([
      { title: "Pending Crawl Jobs", tone: "warning", detailKey: "pending" },
      { title: "Running Jobs", tone: "default", detailKey: "running" },
      { title: "Avg Completion (24h)", tone: "warning", detailKey: undefined },
      { title: "Failed (24h)", tone: "destructive", detailKey: "failed" },
      { title: "Outbox Queue", tone: "warning", detailKey: "outbox" },
    ]);
  });

  it("formats promo summaries for Stripe-backed admin listings", () => {
    const promo: Promo = {
      id: "promo_1",
      code: "SAVE10",
      stripeCouponId: "coupon_1",
      discountType: "amount_off",
      discountValue: 1000,
      duration: "repeating",
      durationMonths: 3,
      maxRedemptions: 10,
      timesRedeemed: 2,
      expiresAt: null,
      active: true,
      createdAt: "2024-03-10T00:00:00.000Z",
    };

    expect(getPromoSummary(promo)).toBe(
      "$10.00 off · repeating (3mo) · 2/10 used",
    );
  });

  it("maps admin customer metadata and dialog labels", () => {
    const customer = {
      id: "user_1",
      email: "alice@example.com",
      name: "Alice",
      plan: "starter",
      stripeCustomerId: "cus_1",
      createdAt: "2024-03-10T00:00:00.000Z",
      status: "suspended",
    } as AdminCustomer & { status: string };

    expect(getAdminCustomerStatus(customer)).toBe("suspended");
    expect(isRestrictedCustomerStatus("banned")).toBe(true);
    expect(isRestrictedCustomerStatus("active")).toBe(false);
    expect(getCustomerActionDialogTitle("change-plan")).toBe("Change Plan");
    expect(getCustomerActionDialogTitle("cancel-sub")).toBe(
      "Cancel Subscription",
    );
    expect(getCustomerPlanBadgeVariant("free")).toBe("secondary");
    expect(getCustomerPlanBadgeVariant("enterprise")).toBe("default");
  });
});
