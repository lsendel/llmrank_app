import { apiClient } from "../core/client";
import { buildQueryString } from "../core/query";
import type { ApiEnvelope } from "../core/types";
import type { PaginatedResponse } from "../types/pagination";
import type { CrawlJobSummary } from "../types/crawls";

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

export interface Promo {
  id: string;
  code: string;
  stripeCouponId: string;
  discountType: "percent_off" | "amount_off" | "free_months";
  discountValue: number;
  duration: "once" | "repeating" | "forever";
  durationMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

export interface BlockedDomain {
  id: string;
  domain: string;
  reason: string | null;
  blockedBy: string;
  createdAt: string;
}

export interface AdminStats {
  mrr: number;
  mrrByPlan: Record<string, number>;
  totalRevenue: number;
  failedPayments: number;
  activeSubscribers: number;
  totalCustomers: number;
  churnRate: number;
  ingestHealth: {
    pendingJobs: number;
    runningJobs: number;
    failedLast24h: number;
    avgCompletionMinutes: number;
    outboxPending: number;
  };
}

export interface OutboxEventSummary {
  id: string;
  type: string;
  attempts: number;
  availableAt: string;
  createdAt: string;
}

export interface AdminIngestDetails {
  pendingJobs: CrawlJobSummary[];
  runningJobs: CrawlJobSummary[];
  failedJobs: CrawlJobSummary[];
  outboxEvents: OutboxEventSummary[];
}

export interface AdminCustomer {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  stripeCustomerId: string | null;
  createdAt: string;
}

export interface AdminCustomerDetail {
  user: AdminCustomer;
  subscriptions: SubscriptionInfo[];
  payments: PaymentRecord[];
}

export function createAdminApi() {
  return {
    async getStats(): Promise<AdminStats> {
      const res =
        await apiClient.get<ApiEnvelope<AdminStats>>("/api/admin/stats");
      return res.data;
    },

    async getMetrics(): Promise<{
      activeCrawls: number;
      errorsLast24h: number;
      systemTime: string;
    }> {
      const res = await apiClient.get<
        ApiEnvelope<{
          activeCrawls: number;
          errorsLast24h: number;
          systemTime: string;
        }>
      >("/api/admin/metrics");
      return res.data;
    },

    async getCustomers(params?: {
      page?: number;
      limit?: number;
      search?: string;
    }): Promise<PaginatedResponse<AdminCustomer>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<AdminCustomer>>(
        `/api/admin/customers${qs}`,
      );
    },

    async getCustomerDetail(userId: string): Promise<AdminCustomerDetail> {
      const res = await apiClient.get<ApiEnvelope<AdminCustomerDetail>>(
        `/api/admin/customers/${userId}`,
      );
      return res.data;
    },

    async getIngestDetails(): Promise<AdminIngestDetails> {
      const res =
        await apiClient.get<ApiEnvelope<AdminIngestDetails>>(
          "/api/admin/ingest",
        );
      return res.data;
    },

    async retryCrawlJob(jobId: string): Promise<void> {
      await apiClient.post(`/api/admin/ingest/jobs/${jobId}/retry`);
    },

    async replayOutboxEvent(eventId: string): Promise<void> {
      await apiClient.post(`/api/admin/ingest/outbox/${eventId}/replay`);
    },

    async cancelCrawlJob(jobId: string, reason?: string): Promise<void> {
      await apiClient.post(
        `/api/admin/ingest/jobs/${jobId}/cancel`,
        reason ? { reason } : undefined,
      );
    },

    async blockUser(id: string, reason?: string) {
      return apiClient.post(`/api/admin/customers/${id}/block`, { reason });
    },

    async suspendUser(id: string, reason?: string) {
      return apiClient.post(`/api/admin/customers/${id}/suspend`, { reason });
    },

    async unblockUser(id: string) {
      return apiClient.post(`/api/admin/customers/${id}/unblock`, {});
    },

    async changeUserPlan(id: string, plan: string) {
      return apiClient.post(`/api/admin/customers/${id}/change-plan`, {
        plan,
      });
    },

    async cancelUserSubscription(id: string) {
      return apiClient.post(
        `/api/admin/customers/${id}/cancel-subscription`,
        {},
      );
    },

    async listPromos(): Promise<Promo[]> {
      const res =
        await apiClient.get<ApiEnvelope<Promo[]>>("/api/admin/promos");
      return res.data;
    },

    async createPromo(data: {
      code: string;
      discountType: string;
      discountValue: number;
      duration: string;
      durationMonths?: number;
      maxRedemptions?: number;
      expiresAt?: string;
    }): Promise<Promo> {
      const res = await apiClient.post<ApiEnvelope<Promo>>(
        "/api/admin/promos",
        data,
      );
      return res.data;
    },

    async deactivatePromo(id: string) {
      return apiClient.delete(`/api/admin/promos/${id}`);
    },

    async applyPromo(userId: string, promoId: string) {
      return apiClient.post(`/api/admin/customers/${userId}/apply-promo`, {
        promoId,
      });
    },

    async getBlockedDomains(): Promise<BlockedDomain[]> {
      const res = await apiClient.get<ApiEnvelope<BlockedDomain[]>>(
        "/api/admin/blocked-domains",
      );
      return res.data;
    },

    async addBlockedDomain(
      domain: string,
      reason?: string,
    ): Promise<BlockedDomain> {
      const res = await apiClient.post<ApiEnvelope<BlockedDomain>>(
        "/api/admin/blocked-domains",
        { domain, reason },
      );
      return res.data;
    },

    async removeBlockedDomain(id: string): Promise<BlockedDomain> {
      const res = await apiClient.delete<ApiEnvelope<BlockedDomain>>(
        `/api/admin/blocked-domains/${id}`,
      );
      return res.data;
    },

    async getSettings(): Promise<{ http_fallback_enabled: boolean }> {
      const res = await apiClient.get<
        ApiEnvelope<{ http_fallback_enabled: boolean }>
      >("/api/admin/settings");
      return res.data;
    },

    async updateSetting(key: string, value: unknown) {
      const res = await apiClient.put<ApiEnvelope<unknown>>(
        `/api/admin/settings/${key}`,
        { value },
      );
      return res.data;
    },
  };
}
