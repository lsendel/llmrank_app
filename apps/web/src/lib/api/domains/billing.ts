import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";

export interface BillingInfo {
  plan: "free" | "starter" | "pro" | "agency";
  crawlCreditsRemaining: number;
  crawlCreditsTotal: number;
  maxPagesPerCrawl: number;
  maxDepth: number;
  maxProjects: number;
}

export interface SubscriptionInfo {
  id: string;
  planCode: string;
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

export interface PaymentRecord {
  id: string;
  amountCents: number;
  currency: string;
  status: "succeeded" | "pending" | "failed";
  stripeInvoiceId: string;
  createdAt: string;
}

export interface PromoInfo {
  code: string;
  discountType: "percent_off" | "amount_off" | "free_months";
  discountValue: number;
  duration: "once" | "repeating" | "forever";
  durationMonths: number | null;
}

export function createBillingApi() {
  return {
    async getInfo(): Promise<BillingInfo> {
      const res =
        await apiClient.get<ApiEnvelope<BillingInfo>>("/api/billing/usage");
      return res.data;
    },

    async createCheckoutSession(
      plan: string,
      successUrl: string,
      cancelUrl: string,
    ): Promise<{ sessionId: string; url: string }> {
      const res = await apiClient.post<
        ApiEnvelope<{ sessionId: string; url: string }>
      >("/api/billing/checkout", { plan, successUrl, cancelUrl });
      return res.data;
    },

    async createPortalSession(returnUrl: string): Promise<{ url: string }> {
      const res = await apiClient.post<ApiEnvelope<{ url: string }>>(
        "/api/billing/portal",
        { returnUrl },
      );
      return res.data;
    },

    async getSubscription(): Promise<SubscriptionInfo | null> {
      const res = await apiClient.get<ApiEnvelope<SubscriptionInfo | null>>(
        "/api/billing/subscription",
      );
      return res.data;
    },

    async getPayments(): Promise<PaymentRecord[]> {
      const res = await apiClient.get<ApiEnvelope<PaymentRecord[]>>(
        "/api/billing/payments",
      );
      return res.data;
    },

    async cancelSubscription(): Promise<void> {
      await apiClient.post("/api/billing/cancel");
    },

    async upgrade(
      plan: string,
      successUrl: string,
      cancelUrl: string,
    ): Promise<{
      upgraded: boolean;
      targetPlan: string;
      method: string;
      sessionId?: string;
      url?: string;
    }> {
      const res = await apiClient.post<
        ApiEnvelope<{
          upgraded: boolean;
          targetPlan: string;
          method: string;
          sessionId?: string;
          url?: string;
        }>
      >("/api/billing/upgrade", { plan, successUrl, cancelUrl });
      return res.data;
    },

    async downgrade(plan: string): Promise<{ downgraded: boolean }> {
      const res = await apiClient.post<ApiEnvelope<{ downgraded: boolean }>>(
        "/api/billing/downgrade",
        { plan },
      );
      return res.data;
    },

    async validatePromo(code: string): Promise<PromoInfo> {
      const res = await apiClient.post<ApiEnvelope<PromoInfo>>(
        "/api/billing/validate-promo",
        { code },
      );
      return res.data;
    },
  };
}
