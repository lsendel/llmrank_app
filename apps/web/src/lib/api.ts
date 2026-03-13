import { apiClient } from "./api/core/client";
import { ApiError } from "./api/core/errors";
import { buildQueryString } from "./api/core/query";
import type { ApiEnvelope } from "./api/core/types";
import type { CrawlJobSummary } from "./api/types/crawls";
import type { PaginatedResponse } from "./api/types/pagination";
import { createAccountApi } from "./api/domains/account";
import { createAnalyticsApi } from "./api/domains/analytics";
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
import { createBillingApi } from "./api/domains/billing";
import { createAdminApi } from "./api/domains/admin";

// ─── Error handling ─────────────────────────────────────────────────

export type { ComparisonItem } from "./api/types/crawls";

export { ApiError };

// ─── Types ──────────────────────────────────────────────────────────

export type { PaginatedResponse } from "./api/types/pagination";
export type { CrawlJobSummary } from "./api/types/crawls";
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
export type {
  BillingInfo,
  PaymentRecord,
  PromoInfo,
  SubscriptionInfo,
} from "./api/domains/billing";
export type {
  AdminCustomer,
  AdminCustomerDetail,
  AdminIngestDetails,
  AdminStats,
  BlockedDomain,
  OutboxEventSummary,
  Promo,
} from "./api/domains/admin";

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
  billing: createBillingApi(),

  // ── Admin ───────────────────────────────────────────────────────
  admin: createAdminApi(),

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

  // ── Analytics ──────────────────────────────────────────────────
  analytics: createAnalyticsApi(),
};
