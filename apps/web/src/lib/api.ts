import { apiClient } from "./api/core/client";
import { ApiError } from "./api/core/errors";
import { buildQueryString } from "./api/core/query";
import type { ApiEnvelope } from "./api/core/types";
import type { CrawlJobSummary } from "./api/types/crawls";
import type { PaginatedResponse } from "./api/types/pagination";
import { createAccountApi } from "./api/domains/account";
import { createActionItemsApi } from "./api/domains/action-items";
import { createAlertsApi } from "./api/domains/alerts";
import { createBacklinksApi } from "./api/domains/backlinks";
import { createBrandApi } from "./api/domains/brand";
import { createChannelsApi } from "./api/domains/channels";
import { createCompetitorMonitoringApi } from "./api/domains/competitor-monitoring";
import { createCrawlsApi } from "./api/domains/crawls";
import { createDashboardApi } from "./api/domains/dashboard";
import { createDiscoveryApi } from "./api/domains/discovery";
import { createExportsApi } from "./api/domains/exports";
import { createFixesApi } from "./api/domains/fixes";
import { createGeneratorsApi } from "./api/domains/generators";
import { createIntegrationsApi } from "./api/domains/integrations";
import { createIssuesApi } from "./api/domains/issues";
import { createKeywordsApi } from "./api/domains/keywords";
import { createLogsApi } from "./api/domains/logs";
import { createNarrativesApi } from "./api/domains/narratives";
import { createOrganizationsApi } from "./api/domains/organizations";
import { createPagesApi } from "./api/domains/pages";
import { createPipelineApi } from "./api/domains/pipeline";
import { createPersonasApi } from "./api/domains/personas";
import { createPlatformReadinessApi } from "./api/domains/platform-readiness";
import { createPromptResearchApi } from "./api/domains/prompt-research";
import { createProjectsApi } from "./api/domains/projects";
import { createPublicApi } from "./api/domains/public";
import { createQuickWinsApi } from "./api/domains/quick-wins";
import { createQueueApi } from "./api/domains/queue";
import { createReportsApi } from "./api/domains/reports";
import { createScoringProfilesApi } from "./api/domains/scoring-profiles";
import { createScoresApi } from "./api/domains/scores";
import { createShareApi } from "./api/domains/share";
import { createStrategyApi } from "./api/domains/strategy";
import { createTeamsApi } from "./api/domains/teams";
import { createTokensApi } from "./api/domains/tokens";
import { createTrendsApi } from "./api/domains/trends";
import { createTrialApi } from "./api/domains/trial";
import { createVisibilityApi } from "./api/domains/visibility";
import { createBenchmarksApi } from "./api/domains/benchmarks";

// ─── Error handling ─────────────────────────────────────────────────

export type { ComparisonItem } from "./api/types/crawls";

export { ApiError };

// ─── Types ──────────────────────────────────────────────────────────

export type { PaginatedResponse } from "./api/types/pagination";
export type {
  ProjectsDefaultPreset,
  AccountLastProjectContext,
  ProjectsHealthFilterPreference,
  ProjectsSortPreference,
  ProjectsAnomalyFilterPreference,
  AccountProjectsViewState,
  AccountPreferences,
  NotificationPreferences,
  DigestPreferences,
} from "./api/types/account";

export type {
  ExtractedFact,
  SemanticGapResponse,
  StrategyPersona,
  StrategyCompetitor,
  GapAnalysisResult,
} from "./api/types/strategy";

export type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  CategoryDelta,
  ChecklistData,
  ProjectProgress,
} from "./api/types/projects";

export type { Persona } from "./api/types/personas";
export type { SavedKeyword } from "./api/types/keywords";
export type {
  DiscoveryResult,
  CompetitorSuggestion,
  SuggestCompetitorsResponse,
} from "./api/types/discovery";

export type {
  CrawlJob,
  SiteContext,
  CrawlSummaryData,
  AIAuditCheck,
  AIAuditResult,
} from "./api/types/crawls";
export type {
  CrawledPage,
  PageDetail,
  PageIssue,
  PageEnrichment,
} from "./api/types/pages";

export type {
  VisibilityCheck,
  VisibilityTrend,
  VisibilityGap,
  CitedPage,
  SourceOpportunity,
  AIScoreTrend,
  VisibilityRecommendation,
  ScheduledQuery,
  CreateScheduleInput,
  ScheduleUpdate,
} from "./api/types/visibility";

export type { PageScoreEntry, PageScoreDetail } from "./api/types/scores";

export type { RecommendationConfidence } from "./api/types/recommendations";
export type { ShareInfo, PublicReport } from "./api/types/share";

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

export type { CrawlJobSummary } from "./api/types/crawls";

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

export type { QuickWin } from "./api/types/quick-wins";
export type {
  PublicScanResult,
  IntegrationCatalogItem,
  SharedReport,
} from "./api/types/public";

export type { PlatformReadinessResult } from "./api/types/platform-readiness";
export type {
  BrandSentiment,
  BrandSentimentSnapshot,
  BrandPerceptionProvider,
  BrandPerformance,
} from "./api/types/brand";

export type { AIPrompt, PromptCheckResult } from "./api/types/prompt-research";

export type {
  LogUpload,
  LogAnalysisSummary,
  CrawlerTimelinePoint,
} from "./api/types/logs";

export type {
  CrawlInsights,
  IssueHeatmapData,
  PlatformOpportunity,
  FusedInsights,
} from "./api/types/crawls";

export type { Report, ReportSchedule } from "./api/types/reports";

export type {
  ProjectIntegration,
  IntegrationInsights,
} from "./api/types/integrations";

export type {
  DashboardStats,
  DashboardInsightSummary,
  DashboardScoreDeltas,
  DashboardQuickWin,
  DashboardCoverageMetric,
  DashboardActivity,
  PortfolioPriorityItem,
} from "./api/types/dashboard";

// Regressions
export type { Regression } from "./api/types/trends";

// Intelligence fusion
// ─── Notification Channels ──────────────────────────────────────────

export type {
  NotificationChannelType,
  NotificationEventType,
  NotificationChannel,
  CreateChannelInput,
  ChannelUpdate,
} from "./api/types/channels";

// ─── API Tokens ────────────────────────────────────────────────────
export type {
  ApiTokenInfo,
  ApiTokenWithPlaintext,
  CreateTokenInput,
} from "./api/types/tokens";
export type { ScoringProfile } from "./api/types/scoring-profiles";
export type {
  Team,
  TeamMember,
  TeamDetail,
  Organization,
  OrganizationMember,
  OrganizationInvite,
} from "./api/types/organizations";

export type { Benchmarks } from "./api/types/benchmarks";

// ─── Action Items ───────────────────────────────────────────────────
export type {
  ActionItemStatus,
  ActionItem,
  ActionItemStats,
  ActionItemBulkResult,
} from "./api/types/action-items";
export type {
  PipelineRecommendation,
  PipelineRunStatus,
  PipelineRun,
  PipelineHealthCheck,
  PipelineHealthCheckResult,
} from "./api/types/pipeline";

// ─── Query string helper ────────────────────────────────────────────

// ─── Domain-specific API methods ────────────────────────────────────

const organizationsApi = createOrganizationsApi();

export const api = {
  // ── Dashboard ───────────────────────────────────────────────────
  dashboard: createDashboardApi(),

  // ── Projects ────────────────────────────────────────────────────
  projects: createProjectsApi(),

  // ── Crawls ──────────────────────────────────────────────────────
  crawls: createCrawlsApi(),

  // ── Pages ───────────────────────────────────────────────────────
  pages: createPagesApi(),

  // ── Issues ──────────────────────────────────────────────────────
  issues: createIssuesApi(),

  // ── Billing ─────────────────────────────────────────────────────
  billing: {
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
  },

  // ── Admin ───────────────────────────────────────────────────────
  admin: {
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

    async cancelCrawlJob(jobId: string, reason?: string) {
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
  },

  // ── Scores ──────────────────────────────────────────────────────
  scores: createScoresApi(),

  // ── Visibility ─────────────────────────────────────────────────
  visibility: createVisibilityApi(),

  // ── Brand ────────────────────────────────────────────────────
  brand: createBrandApi(),

  // ── Prompt Research ─────────────────────────────────────────────
  promptResearch: createPromptResearchApi(),

  // ── Backlinks ─────────────────────────────────────────────────
  backlinks: createBacklinksApi(),

  // ── Strategy ────────────────────────────────────────────────────
  strategy: createStrategyApi(),

  // ── Personas ─────────────────────────────────────────────────────
  personas: createPersonasApi(),

  // ── Keywords ─────────────────────────────────────────────────────
  keywords: createKeywordsApi(),

  // ── Discovery ────────────────────────────────────────────────────
  discovery: createDiscoveryApi(),

  // ── Account ─────────────────────────────────────────────────────
  account: createAccountApi(),

  // ── Public (no auth) ──────────────────────────────────────────
  public: createPublicApi(),

  // ── Reports ─────────────────────────────────────────────────────
  reports: createReportsApi(),

  // ── Pipeline Recommendations ──────────────────────────────────
  pipeline: createPipelineApi(),

  // ── Quick Wins ─────────────────────────────────────────────────
  quickWins: createQuickWinsApi(),

  // ── Platform Readiness ─────────────────────────────────────────
  platformReadiness: createPlatformReadinessApi(),

  // ── Logs ───────────────────────────────────────────────────────
  logs: createLogsApi(),

  // ── Integrations ────────────────────────────────────────────────
  integrations: createIntegrationsApi(),

  // ── Share ──────────────────────────────────────────────────────
  share: createShareApi(),

  // ── Notification Channels ────────────────────────────────────
  channels: createChannelsApi(),

  // ── AI Fixes ───────────────────────────────────────────────
  fixes: createFixesApi(),

  // ── Trends ─────────────────────────────────────────────────────
  trends: createTrendsApi(),

  // ── API Tokens ───────────────────────────────────────────────
  tokens: createTokensApi(),

  // ── Scoring Profiles ────────────────────────────────────────
  scoringProfiles: createScoringProfilesApi(),

  // ── Organizations ────────────────────────────────────────────────
  organizations: organizationsApi,

  // ── Teams (Legacy compatibility adapter) ─────────────────────
  teams: createTeamsApi(organizationsApi),

  // ── Generators ──────────────────────────────────────────────
  generators: createGeneratorsApi(),

  // ── Exports ───────────────────────────────────────────────
  exports: createExportsApi(),

  // ── Benchmarks ──────────────────────────────────────────────
  benchmarks: createBenchmarksApi(),

  // ── Competitor Monitoring ────────────────────────────────────
  competitorMonitoring: createCompetitorMonitoringApi(),

  queue: createQueueApi(),

  // ── Action Items ───────────────────────────────────────────────
  actionItems: createActionItemsApi(),

  // ── Alerts ─────────────────────────────────────────────────────
  alerts: createAlertsApi(),

  // ── Trial ──────────────────────────────────────────────────────
  trial: createTrialApi(),

  // ── Narratives ─────────────────────────────────────────────────
  narratives: createNarrativesApi(),
};
