const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

// ─── Error handling ─────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Types ──────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ExtractedFact {
  type: string;
  content: string;
  sourceSentence: string;
  citabilityScore: number;
}

export interface SemanticGapResponse {
  userFacts: ExtractedFact[];
  competitorFacts: ExtractedFact[];
  densityGap: number;
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
  updatedAt: string;
  settings: {
    maxPages: number;
    maxDepth: number;
    schedule: "manual" | "daily" | "weekly" | "monthly";
  };
  branding?: {
    logoUrl?: string;
    companyName?: string;
    primaryColor?: string;
  };
  latestCrawl?: CrawlJob | null;
}

export interface CreateProjectInput {
  name: string;
  domain: string;
}

export interface UpdateProjectInput {
  name?: string;
  settings?: {
    maxPages?: number;
    maxDepth?: number;
    schedule?: "manual" | "daily" | "weekly" | "monthly";
  };
  branding?: {
    logoUrl?: string;
    companyName?: string;
    primaryColor?: string;
  };
}

export interface StrategyPersona {
  name: string;
  role: string;
  demographics: string;
  goals: string[];
  pains: string[];
  keywords: string[];
  typicalQueries: string[];
}

export interface StrategyCompetitor {
  id: string;
  projectId: string;
  domain: string;
  createdAt: string;
}

export interface GapAnalysisResult {
  missingElements: string[];
  recommendation: string;
}

export interface CrawlJob {
  id: string;
  projectId: string;
  status: "pending" | "crawling" | "scoring" | "complete" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  pagesFound: number;
  pagesCrawled: number;
  pagesScored: number;
  pagesErrored: number;
  overallScore: number | null;
  letterGrade: string | null;
  scores: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  } | null;
  errorMessage: string | null;
  summary: string | null;
  summaryData?: CrawlSummaryData | null;
  createdAt: string;
  projectName?: string;
  projectId2?: string;
}

export interface CrawlSummaryData {
  project: {
    id: string;
    name: string;
    domain: string;
  };
  overallScore: number;
  letterGrade: string;
  categoryScores: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  };
  quickWins: QuickWin[];
  pagesScored: number;
  generatedAt: string;
  issueCount: number;
}

export interface CrawledPage {
  id: string;
  crawlId: string;
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  wordCount: number;
  overallScore: number | null;
  technicalScore: number | null;
  contentScore: number | null;
  aiReadinessScore: number | null;
  performanceScore: number | null;
  letterGrade: string | null;
  issueCount: number;
}

export interface PageDetail extends CrawledPage {
  canonicalUrl: string | null;
  extracted: {
    h1: string[];
    h2: string[];
    schemaTypes: string[];
    internalLinks: string[];
    externalLinks: string[];
    imagesWithoutAlt: number;
    hasRobotsMeta: boolean;
  };
  lighthouse: {
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
  } | null;
  issues: PageIssue[];
}

export interface PageIssue {
  code: string;
  category: "technical" | "content" | "ai_readiness" | "performance";
  severity: "critical" | "warning" | "info";
  message: string;
  recommendation: string;
  data?: Record<string, unknown>;
}

export interface VisibilityCheck {
  id: string;
  projectId: string;
  pageId?: string;
  llmProvider: "chatgpt" | "claude" | "perplexity" | "gemini" | "copilot";
  query: string;
  responseText: string | null;
  brandMentioned: boolean;
  urlCited: boolean;
  citationPosition: number | null;
  competitorMentions:
    | {
        domain: string;
        mentioned: boolean;
        position: number | null;
      }[]
    | null;
  checkedAt: string;
}

export interface PageScoreEntry {
  id: string;
  pageId: string;
  url: string;
  title: string | null;
  statusCode: number | null;
  wordCount: number | null;
  overallScore: number;
  technicalScore: number | null;
  contentScore: number | null;
  aiReadinessScore: number | null;
  lighthousePerf: number | null;
  lighthouseSeo: number | null;
  letterGrade: string;
  detail: Record<string, unknown> | null;
}

export interface PageScoreDetail {
  id: string;
  jobId: string;
  url: string;
  canonicalUrl: string | null;
  statusCode: number | null;
  title: string | null;
  metaDesc: string | null;
  wordCount: number | null;
  contentType?: string | null;
  textLength?: number | null;
  htmlLength?: number | null;
  contentHash: string | null;
  crawledAt: string | null;
  score: {
    overallScore: number;
    technicalScore: number | null;
    contentScore: number | null;
    aiReadinessScore: number | null;
    lighthousePerf: number | null;
    lighthouseSeo: number | null;
    letterGrade: string;
    detail: Record<string, unknown>;
    platformScores: Record<
      string,
      {
        score: number;
        grade: string;
        tips: string[];
      }
    > | null;
    recommendations: Array<{
      issueCode: string;
      title: string;
      description: string;
      priority: string;
      effort: string;
      impact: string;
      estimatedImprovement: number;
      affectedPlatforms: string[];
      steps?: string[];
      example?: { before: string; after: string };
    }> | null;
  } | null;
  issues: PageIssue[];
}

export interface NotificationPreferences {
  notifyOnCrawlComplete: boolean;
  notifyOnScoreDrop: boolean;
  webhookUrl: string | null;
}

export interface DigestPreferences {
  digestFrequency: string;
  digestDay: number;
  lastDigestSentAt: string | null;
}

export interface ShareInfo {
  shareToken: string;
  shareUrl: string;
  badgeUrl: string;
  level: "summary" | "issues" | "full";
  expiresAt: string | null;
}

export interface PublicReport {
  shareLevel: string;
  crawlId: string;
  projectId: string;
  completedAt: string;
  pagesScored: number;
  summary: string | null;
  summaryData: {
    overallScore: number;
    letterGrade: string;
    categoryScores: {
      technical: number;
      content: number;
      aiReadiness: number;
      performance: number;
    };
    quickWins: unknown[];
  } | null;
  project: { name: string; domain: string; branding: unknown };
  scores: {
    overall: number;
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
    letterGrade: string;
  };
  pages: Array<{
    url: string;
    title: string;
    overallScore: number;
    technicalScore: number;
    contentScore: number;
    aiReadinessScore: number;
    issueCount: number;
  }>;
  issueCount: number;
  readinessCoverage: Record<string, number>;
  scoreDeltas: Record<string, number> | null;
  quickWins: Array<{
    code: string;
    category: string;
    severity: string;
    scoreImpact: number;
    effortLevel: string;
    message: string;
    recommendation: string;
    affectedPages: number;
  }>;
}

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

export interface CrawlJobSummary {
  id: string;
  projectId: string;
  projectName: string | null;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
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

export interface QuickWin {
  code: string;
  category: string;
  severity: string;
  scoreImpact: number;
  effortLevel: "low" | "medium" | "high";
  message: string;
  recommendation: string;
  implementationSnippet?: string;
  priority: number;
  affectedPages: number;
  owner?: string;
  pillar?: string;
  docsUrl?: string;
  effort?: "low" | "medium" | "high";
}

export interface PublicScanResult {
  url: string;
  domain: string;
  scores: {
    overall: number;
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
    letterGrade: string;
  };
  issues: PageIssue[];
  quickWins: QuickWin[];
  meta: {
    title: string | null;
    description: string | null;
    wordCount: number;
    hasLlmsTxt: boolean;
    hasSitemap: boolean;
    sitemapUrls: number;
    aiCrawlersBlocked: string[];
    schemaTypes: string[];
    ogTags: Record<string, string>;
  };
  visibility?: {
    provider: string;
    brandMentioned: boolean;
    urlCited: boolean;
  } | null;
}

export interface SharedReport {
  crawlId: string;
  projectId: string;
  completedAt: string | null;
  pagesScored: number;
  summary: string | null;
  summaryData?: unknown;
  project: {
    name: string;
    domain: string;
    branding?: {
      logoUrl?: string;
      companyName?: string;
      primaryColor?: string;
    };
  };
  scores: {
    overall: number;
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
    letterGrade: string;
  };
  pages: {
    url: string;
    title: string | null;
    overallScore: number;
    technicalScore: number | null;
    contentScore: number | null;
    aiReadinessScore: number | null;
    issueCount: number;
  }[];
  issueCount: number;
  quickWins: QuickWin[];
  readinessCoverage: DashboardCoverageMetric[];
  scoreDeltas: DashboardScoreDeltas;
}

export interface PlatformReadinessResult {
  platform: string;
  score: number;
  grade: string;
  tips: string[];
  checks: {
    factor: string;
    label: string;
    importance: "critical" | "important" | "recommended";
    pass: boolean;
  }[];
}

export interface VisibilityTrend {
  weekStart: string;
  provider: string;
  mentionRate: number;
  citationRate: number;
  totalChecks: number;
}

export interface VisibilityGap {
  query: string;
  providers: string[];
  userMentioned: boolean;
  userCited: boolean;
  competitorsCited: Array<{
    domain: string;
    position: number | null;
  }>;
}

export interface ScheduledQuery {
  id: string;
  projectId: string;
  query: string;
  providers: string[];
  frequency: "hourly" | "daily" | "weekly";
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
}

export interface CreateScheduleInput {
  projectId: string;
  query: string;
  providers: string[];
  frequency: "hourly" | "daily" | "weekly";
}

export interface ScheduleUpdate {
  query: string;
  providers: string[];
  frequency: "hourly" | "daily" | "weekly";
  enabled: boolean;
}

export interface LogUpload {
  id: string;
  projectId: string;
  filename: string;
  totalRequests: number;
  crawlerRequests: number;
  uniqueIPs: number;
  summary: LogAnalysisSummary;
  createdAt: string;
}

export interface LogAnalysisSummary {
  totalRequests: number;
  crawlerRequests: number;
  uniqueIPs: number;
  botBreakdown: Array<{ bot: string; count: number }>;
  statusBreakdown: Array<{ status: number; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

export interface CrawlInsights {
  issueDistribution: {
    bySeverity: { severity: string; count: number }[];
    byCategory: { category: string; count: number }[];
    total: number;
  };
  scoreRadar: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  };
  gradeDistribution: {
    grade: string;
    count: number;
    percentage: number;
  }[];
  contentRatio: {
    avgWordCount: number;
    avgHtmlToTextRatio: number;
    pagesAboveThreshold: number;
    totalPages: number;
    totalTextLength: number;
    totalHtmlLength: number;
  };
  crawlProgress: {
    found: number;
    crawled: number;
    scored: number;
    errored: number;
    status: string;
  };
}

export interface IssueHeatmapData {
  categories: string[];
  pages: {
    url: string;
    pageId: string;
    issues: Record<string, string>;
  }[];
}

export interface CrawlerTimelinePoint {
  timestamp: string;
  gptbot: number;
  claudebot: number;
  perplexitybot: number;
  googlebot: number;
  bingbot: number;
  other: number;
}

export interface Report {
  id: string;
  projectId: string;
  crawlJobId: string;
  type: "summary" | "detailed";
  format: "pdf" | "docx";
  status: "queued" | "generating" | "complete" | "failed";
  r2Key: string | null;
  fileSize: number | null;
  config: Record<string, unknown>;
  error: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ReportSchedule {
  id: string;
  projectId: string;
  format: "pdf" | "docx";
  type: "summary" | "detailed";
  recipientEmail: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectIntegration {
  id: string;
  projectId: string;
  provider: "gsc" | "psi" | "ga4" | "clarity";
  enabled: boolean;
  hasCredentials: boolean;
  config: Record<string, unknown>;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationInsights {
  crawlId: string | null;
  integrations: {
    gsc: {
      topQueries: {
        query: string;
        impressions: number;
        clicks: number;
        position: number;
      }[];
    } | null;
    ga4: {
      bounceRate: number;
      avgEngagement: number;
      topPages: { url: string; sessions: number }[];
    } | null;
    clarity: {
      avgUxScore: number;
      rageClickPages: string[];
    } | null;
  } | null;
}

export interface PageEnrichment {
  id: string;
  pageId: string;
  jobId: string;
  provider: "gsc" | "psi" | "ga4" | "clarity";
  data: Record<string, unknown>;
  fetchedAt: string;
}

export interface DashboardStats {
  totalProjects: number;
  totalCrawls: number;
  avgScore: number;
  creditsRemaining: number;
  creditsTotal: number;
  latestInsights: DashboardInsightSummary | null;
}

export interface DashboardInsightSummary {
  quickWins: DashboardQuickWin[];
  coverage: DashboardCoverageMetric[];
  scoreDeltas: DashboardScoreDeltas;
}

export interface DashboardScoreDeltas {
  overall: number;
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
}

export interface DashboardQuickWin {
  code: string;
  message: string;
  recommendation: string;
  pillar: string;
  owner: string;
  effort: string;
  scoreImpact: number;
  affectedPages: number;
}

export interface DashboardCoverageMetric {
  code: string;
  label: string;
  description: string;
  pillar: string;
  coveragePercent: number;
  affectedPages: number;
  totalPages: number;
}

export interface DashboardActivity extends CrawlJob {
  projectName: string;
  projectId: string;
}

// Progress tracking
export interface CategoryDelta {
  current: number;
  previous: number;
  delta: number;
}

export interface ProjectProgress {
  currentCrawlId: string;
  previousCrawlId: string;
  scoreDelta: number;
  currentScore: number;
  previousScore: number;
  categoryDeltas: {
    technical: CategoryDelta;
    content: CategoryDelta;
    aiReadiness: CategoryDelta;
    performance: CategoryDelta;
  };
  issuesFixed: number;
  issuesNew: number;
  issuesPersisting: number;
  gradeChanges: { improved: number; regressed: number; unchanged: number };
  velocity: number;
  topImprovedPages: { url: string; delta: number; current: number }[];
  topRegressedPages: { url: string; delta: number; current: number }[];
}

// Regressions
export interface Regression {
  category: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  severity: "critical" | "warning" | "info";
}

// Intelligence fusion
export interface PlatformOpportunity {
  platform: string;
  currentScore: number;
  opportunityScore: number;
  topTips: string[];
  visibilityRate: number | null;
}

export interface FusedInsights {
  aiVisibilityReadiness: number;
  platformOpportunities: PlatformOpportunity[];
  contentHealthMatrix: {
    scoring: number;
    llmQuality: number | null;
    engagement: number | null;
    uxQuality: number | null;
  };
  roiQuickWins: {
    issueCode: string;
    scoreImpact: number;
    estimatedTrafficImpact: number | null;
    effort: "low" | "medium" | "high";
    affectedPages: number;
  }[];
}

// ─── Notification Channels ──────────────────────────────────────────

export type NotificationChannelType = "email" | "webhook" | "slack_incoming";

export type NotificationEventType =
  | "crawl_completed"
  | "score_drop"
  | "mention_gained"
  | "mention_lost"
  | "position_changed";

export interface NotificationChannel {
  id: string;
  userId: string;
  type: NotificationChannelType;
  config: Record<string, string>;
  eventTypes: NotificationEventType[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelInput {
  type: NotificationChannelType;
  config: Record<string, string>;
  eventTypes: NotificationEventType[];
}

export interface ChannelUpdate {
  enabled: boolean;
  config: Record<string, string>;
  eventTypes: NotificationEventType[];
}

// ─── API Tokens ────────────────────────────────────────────────────

export interface ApiTokenInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  projectId: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface ApiTokenWithPlaintext extends ApiTokenInfo {
  plaintext: string;
}

export interface CreateTokenInput {
  name: string;
  projectId?: string;
  scopes: string[];
}

// ─── Request helpers ────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers: extraHeaders, ...init } = options;

  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? "UNKNOWN_ERROR",
      errorBody?.error?.message ?? response.statusText,
      errorBody?.error?.details,
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ─── Envelope unwrapper ─────────────────────────────────────────────

interface ApiEnvelope<T> {
  data: T;
}

// ─── Base client ────────────────────────────────────────────────────

const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "POST", body });
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "PUT", body });
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "DELETE" });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "PATCH", body });
  },
};

// ─── Query string helper ────────────────────────────────────────────

function buildQueryString(
  params?: Record<string, string | number | undefined>,
): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

// ─── Domain-specific API methods ────────────────────────────────────

export const api = {
  // ── Dashboard ───────────────────────────────────────────────────
  dashboard: {
    async getStats(): Promise<DashboardStats> {
      const res = await apiClient.get<ApiEnvelope<DashboardStats>>(
        "/api/dashboard/stats",
      );
      return res.data;
    },
    async getRecentActivity(): Promise<DashboardActivity[]> {
      const res = await apiClient.get<ApiEnvelope<DashboardActivity[]>>(
        "/api/dashboard/activity",
      );
      return res.data;
    },
  },

  // ── Projects ────────────────────────────────────────────────────
  projects: {
    async list(params?: {
      page?: number;
      limit?: number;
    }): Promise<PaginatedResponse<Project>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<Project>>(`/api/projects${qs}`);
    },

    async get(projectId: string): Promise<Project> {
      const res = await apiClient.get<ApiEnvelope<Project>>(
        `/api/projects/${projectId}`,
      );
      return res.data;
    },

    async create(data: CreateProjectInput): Promise<Project> {
      const res = await apiClient.post<ApiEnvelope<Project>>(
        "/api/projects",
        data,
      );
      return res.data;
    },

    async update(
      projectId: string,
      data: UpdateProjectInput,
    ): Promise<Project> {
      const res = await apiClient.put<ApiEnvelope<Project>>(
        `/api/projects/${projectId}`,
        data,
      );
      return res.data;
    },

    async delete(projectId: string): Promise<void> {
      await apiClient.delete<ApiEnvelope<{ id: string; deleted: boolean }>>(
        `/api/projects/${projectId}`,
      );
    },

    async progress(projectId: string): Promise<ProjectProgress | null> {
      const res = await apiClient.get<ApiEnvelope<ProjectProgress | null>>(
        `/api/projects/${projectId}/progress`,
      );
      return res.data;
    },
  },

  // ── Crawls ──────────────────────────────────────────────────────
  crawls: {
    async start(projectId: string): Promise<CrawlJob> {
      const res = await apiClient.post<ApiEnvelope<CrawlJob>>("/api/crawls", {
        projectId,
      });
      return res.data;
    },

    async list(
      projectId: string,
      params?: { page?: number; limit?: number },
    ): Promise<PaginatedResponse<CrawlJob>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<CrawlJob>>(
        `/api/crawls/project/${projectId}${qs}`,
      );
    },

    async get(crawlId: string): Promise<CrawlJob> {
      const res = await apiClient.get<ApiEnvelope<CrawlJob>>(
        `/api/crawls/${crawlId}`,
      );
      return res.data;
    },

    async getInsights(crawlId: string): Promise<CrawlInsights> {
      const res = await apiClient.get<ApiEnvelope<CrawlInsights>>(
        `/api/crawls/${crawlId}/insights`,
      );
      return res.data;
    },

    async exportData(crawlId: string, format: "csv" | "json"): Promise<any> {
      if (format === "csv") {
        // For CSV, we need the raw response
        const res = await fetch(
          `${API_BASE_URL}/api/crawls/${crawlId}/export?format=csv`,
          {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        );
        if (!res.ok)
          throw new ApiError(res.status, "EXPORT_FAILED", "Export failed");
        return res.text();
      }
      const res = await apiClient.get<ApiEnvelope<any[]>>(
        `/api/crawls/${crawlId}/export?format=json`,
      );
      return res.data;
    },

    async getIssueHeatmap(crawlId: string): Promise<IssueHeatmapData> {
      const res = await apiClient.get<ApiEnvelope<IssueHeatmapData>>(
        `/api/crawls/${crawlId}/issue-heatmap`,
      );
      return res.data;
    },

    async fusedInsights(crawlId: string): Promise<FusedInsights> {
      const res = await apiClient.get<ApiEnvelope<FusedInsights>>(
        `/api/crawls/${crawlId}/fused-insights`,
      );
      return res.data;
    },
  },

  // ── Pages ───────────────────────────────────────────────────────
  pages: {
    async list(
      crawlId: string,
      params?: {
        page?: number;
        limit?: number;
        sort?: string;
        order?: string;
      },
    ): Promise<PaginatedResponse<CrawledPage>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<CrawledPage>>(
        `/api/pages/job/${crawlId}${qs}`,
      );
    },

    async get(pageId: string): Promise<PageDetail> {
      const res = await apiClient.get<ApiEnvelope<PageDetail>>(
        `/api/pages/${pageId}`,
      );
      return res.data;
    },

    async getEnrichments(pageId: string): Promise<PageEnrichment[]> {
      const res = await apiClient.get<ApiEnvelope<PageEnrichment[]>>(
        `/api/pages/${pageId}/enrichments`,
      );
      return res.data;
    },
  },

  // ── Issues ──────────────────────────────────────────────────────
  issues: {
    async listForCrawl(
      crawlId: string,
      params?: {
        page?: number;
        limit?: number;
        severity?: string;
        category?: string;
      },
    ): Promise<PaginatedResponse<PageIssue>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<PageIssue>>(
        `/api/pages/issues/job/${crawlId}${qs}`,
      );
    },
  },

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
      const res = await apiClient.get<ApiEnvelope<any>>("/api/admin/metrics");
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
  },

  // ── Scores ──────────────────────────────────────────────────────
  scores: {
    async listByJob(jobId: string): Promise<PageScoreEntry[]> {
      const res = await apiClient.get<ApiEnvelope<PageScoreEntry[]>>(
        `/api/scores/job/${jobId}/pages`,
      );
      return res.data;
    },

    async getPage(pageId: string): Promise<PageScoreDetail> {
      const res = await apiClient.get<ApiEnvelope<PageScoreDetail>>(
        `/api/scores/page/${pageId}`,
      );
      return res.data;
    },
  },

  // ── Visibility ─────────────────────────────────────────────────
  visibility: {
    async run(data: {
      projectId: string;
      query: string;
      providers: string[];
      competitors?: string[];
    }): Promise<VisibilityCheck[]> {
      const res = await apiClient.post<ApiEnvelope<VisibilityCheck[]>>(
        "/api/visibility/check",
        data,
      );
      return res.data;
    },

    async list(projectId: string): Promise<VisibilityCheck[]> {
      const res = await apiClient.get<ApiEnvelope<VisibilityCheck[]>>(
        `/api/visibility/${projectId}`,
      );
      return res.data;
    },

    async getTrends(projectId: string): Promise<VisibilityTrend[]> {
      const res = await apiClient.get<ApiEnvelope<VisibilityTrend[]>>(
        `/api/visibility/${projectId}/trends`,
      );
      return res.data;
    },

    async getGaps(projectId: string): Promise<VisibilityGap[]> {
      const res = await apiClient.get<ApiEnvelope<VisibilityGap[]>>(
        `/api/visibility/${projectId}/gaps`,
      );
      return res.data;
    },

    schedules: {
      async list(projectId: string): Promise<ScheduledQuery[]> {
        const res = await apiClient.get<ApiEnvelope<ScheduledQuery[]>>(
          `/api/visibility/schedules?projectId=${projectId}`,
        );
        return res.data;
      },

      async create(data: CreateScheduleInput): Promise<ScheduledQuery> {
        const res = await apiClient.post<ApiEnvelope<ScheduledQuery>>(
          "/api/visibility/schedules",
          data,
        );
        return res.data;
      },

      async update(
        id: string,
        data: Partial<ScheduleUpdate>,
      ): Promise<ScheduledQuery> {
        const res = await apiClient.patch<ApiEnvelope<ScheduledQuery>>(
          `/api/visibility/schedules/${id}`,
          data,
        );
        return res.data;
      },

      async delete(id: string): Promise<void> {
        await apiClient.delete(`/api/visibility/schedules/${id}`);
      },
    },
  },

  // ── Strategy ────────────────────────────────────────────────────
  strategy: {
    async generatePersonas(
      projectId: string,
      data: { description?: string; niche?: string },
    ): Promise<StrategyPersona[]> {
      const res = await apiClient.post<ApiEnvelope<StrategyPersona[]>>(
        `/api/strategy/${projectId}/personas`,
        data,
      );
      return res.data;
    },

    async getCompetitors(projectId: string): Promise<StrategyCompetitor[]> {
      const res = await apiClient.get<ApiEnvelope<StrategyCompetitor[]>>(
        `/api/strategy/${projectId}/competitors`,
      );
      return res.data;
    },

    async addCompetitor(
      projectId: string,
      domain: string,
    ): Promise<StrategyCompetitor> {
      const res = await apiClient.post<ApiEnvelope<StrategyCompetitor>>(
        `/api/strategy/${projectId}/competitors`,
        { domain },
      );
      return res.data;
    },

    async removeCompetitor(id: string): Promise<void> {
      await apiClient.delete(`/api/strategy/competitors/${id}`);
    },

    async gapAnalysis(data: {
      projectId: string;
      competitorDomain: string;
      query: string;
      pageId?: string;
    }): Promise<GapAnalysisResult> {
      const res = await apiClient.post<ApiEnvelope<GapAnalysisResult>>(
        "/api/strategy/gap-analysis",
        data,
      );
      return res.data;
    },

    async semanticGap(data: {
      projectId: string;
      pageId: string;
      competitorDomain: string;
    }): Promise<SemanticGapResponse> {
      const res = await apiClient.post<ApiEnvelope<SemanticGapResponse>>(
        "/api/strategy/semantic-gap",
        data,
      );
      return res.data;
    },

    async applyFix(data: {
      pageId: string;
      missingFact: string;
      factType: string;
    }): Promise<{
      suggestedSnippet: string;
      placementAdvice: string;
      citabilityBoost: number;
    }> {
      const res = await apiClient.post<
        ApiEnvelope<{
          suggestedSnippet: string;
          placementAdvice: string;
          citabilityBoost: number;
        }>
      >("/api/strategy/apply-fix", data);
      return res.data;
    },

    async getTopicMap(projectId: string): Promise<{
      nodes: any[];
      edges: any[];
      clusters: any[];
    }> {
      const res = await apiClient.get<ApiEnvelope<any>>(
        `/api/strategy/${projectId}/topic-map`,
      );
      return res.data;
    },

    async optimizeDimension(data: {
      pageId: string;
      content: string;
      dimension: string;
      tone?: string;
    }): Promise<{ optimized: string; explanation: string }> {
      const res = await apiClient.post<
        ApiEnvelope<{ optimized: string; explanation: string }>
      >("/api/strategy/optimize-dimension", data);
      return res.data;
    },
  },

  // ── Account ─────────────────────────────────────────────────────
  account: {
    async getMe(): Promise<{
      isAdmin: boolean;
      plan: string;
      email: string;
      onboardingComplete: boolean;
      persona: string | null;
    }> {
      const res = await apiClient.get<
        ApiEnvelope<{
          isAdmin: boolean;
          plan: string;
          email: string;
          onboardingComplete: boolean;
          persona: string | null;
        }>
      >("/api/account");
      return res.data;
    },

    async updateProfile(data: {
      name?: string;
      phone?: string;
      onboardingComplete?: boolean;
      persona?: string;
    }): Promise<void> {
      await apiClient.put("/api/account", data);
    },

    async classifyPersona(data: {
      teamSize: string;
      primaryGoal: string;
      domain?: string;
    }): Promise<{
      persona: string;
      confidence: "high" | "medium";
      reasoning: string;
    }> {
      const res = await apiClient.post<
        ApiEnvelope<{
          persona: string;
          confidence: "high" | "medium";
          reasoning: string;
        }>
      >("/api/account/classify-persona", data);
      return res.data;
    },

    async deleteAccount(): Promise<void> {
      await apiClient.delete<void>("/api/account");
    },

    async getNotifications(): Promise<NotificationPreferences> {
      const res = await apiClient.get<ApiEnvelope<NotificationPreferences>>(
        "/api/account/notifications",
      );
      return res.data;
    },

    async updateNotifications(
      data: Partial<NotificationPreferences>,
    ): Promise<NotificationPreferences> {
      const res = await apiClient.put<ApiEnvelope<NotificationPreferences>>(
        "/api/account/notifications",
        data,
      );
      return res.data;
    },

    async getDigestPreferences(): Promise<DigestPreferences> {
      const res = await apiClient.get<ApiEnvelope<DigestPreferences>>(
        "/api/account/digest",
      );
      return res.data;
    },

    async updateDigestPreferences(
      data: Partial<DigestPreferences>,
    ): Promise<DigestPreferences> {
      const res = await apiClient.put<ApiEnvelope<DigestPreferences>>(
        "/api/account/digest",
        data,
      );
      return res.data;
    },
  },

  // ── Public (no auth) ──────────────────────────────────────────
  public: {
    async scan(
      url: string,
    ): Promise<PublicScanResult & { scanResultId?: string }> {
      const res = await apiClient.post<
        ApiEnvelope<PublicScanResult & { scanResultId?: string }>
      >("/api/public/scan", { url });
      return res.data;
    },

    async getReport(token: string): Promise<SharedReport> {
      const res = await apiClient.get<ApiEnvelope<SharedReport>>(
        `/api/public/reports/${token}`,
      );
      return res.data;
    },

    async getScanResult(id: string, token?: string) {
      const params = token ? `?token=${token}` : "";
      const res = await apiClient.get<ApiEnvelope<any>>(
        `/api/public/scan-results/${id}${params}`,
      );
      return res.data;
    },

    async captureLead(data: {
      email: string;
      reportToken?: string;
      scanResultId?: string;
    }): Promise<{ id: string }> {
      const res = await apiClient.post<ApiEnvelope<{ id: string }>>(
        "/api/public/leads",
        data,
      );
      return res.data;
    },
  },

  // ── Reports ─────────────────────────────────────────────────────
  reports: {
    async generate(input: {
      projectId: string;
      crawlJobId: string;
      type: "summary" | "detailed";
      format: "pdf" | "docx";
      config?: {
        compareCrawlIds?: string[];
        brandingColor?: string;
        preparedFor?: string;
      };
    }): Promise<Report> {
      const res = await apiClient.post<ApiEnvelope<Report>>(
        "/api/reports/generate",
        input,
      );
      return res.data;
    },

    async list(projectId: string): Promise<Report[]> {
      const res = await apiClient.get<ApiEnvelope<Report[]>>(
        `/api/reports?projectId=${projectId}`,
      );
      return res.data;
    },

    async getStatus(reportId: string): Promise<Report> {
      const res = await apiClient.get<ApiEnvelope<Report>>(
        `/api/reports/${reportId}`,
      );
      return res.data;
    },

    async download(reportId: string): Promise<Blob> {
      const res = await fetch(
        `${API_BASE_URL}/api/reports/${reportId}/download`,
        {
          credentials: "include",
        },
      );
      if (!res.ok) {
        const text = await res.text();
        console.error("Report download failed:", res.status, text);
        let err;
        try {
          err = JSON.parse(text);
        } catch {
          err = {
            error: { code: "DOWNLOAD_ERROR", message: "Download failed" },
          };
        }
        throw new ApiError(
          res.status,
          err.error?.code ?? "DOWNLOAD_ERROR",
          err.error?.message ?? "Download failed",
        );
      }
      return res.blob();
    },

    async delete(reportId: string): Promise<void> {
      await apiClient.delete(`/api/reports/${reportId}`);
    },

    schedules: {
      async list(projectId: string): Promise<ReportSchedule[]> {
        const res = await apiClient.get<ApiEnvelope<ReportSchedule[]>>(
          `/api/reports/schedules?projectId=${projectId}`,
        );
        return res.data;
      },

      async create(data: {
        projectId: string;
        format: "pdf" | "docx";
        type: "summary" | "detailed";
        recipientEmail: string;
      }): Promise<ReportSchedule> {
        const res = await apiClient.post<ApiEnvelope<ReportSchedule>>(
          "/api/reports/schedules",
          data,
        );
        return res.data;
      },

      async update(
        id: string,
        data: Partial<{
          format: "pdf" | "docx";
          type: "summary" | "detailed";
          recipientEmail: string;
          enabled: boolean;
        }>,
      ): Promise<ReportSchedule> {
        const res = await apiClient.patch<ApiEnvelope<ReportSchedule>>(
          `/api/reports/schedules/${id}`,
          data,
        );
        return res.data;
      },

      async delete(id: string): Promise<void> {
        await apiClient.delete(`/api/reports/schedules/${id}`);
      },
    },
  },

  // ── Quick Wins ─────────────────────────────────────────────────
  quickWins: {
    async get(crawlId: string): Promise<QuickWin[]> {
      const res = await apiClient.get<ApiEnvelope<QuickWin[]>>(
        `/api/crawls/${crawlId}/quick-wins`,
      );
      return res.data;
    },
  },

  // ── Platform Readiness ─────────────────────────────────────────
  platformReadiness: {
    async get(crawlId: string): Promise<PlatformReadinessResult[]> {
      const res = await apiClient.get<ApiEnvelope<PlatformReadinessResult[]>>(
        `/api/crawls/${crawlId}/platform-readiness`,
      );
      return res.data;
    },
  },

  // ── Logs ───────────────────────────────────────────────────────
  logs: {
    async upload(
      projectId: string,
      data: { filename: string; content: string },
    ): Promise<{ id: string; summary: LogAnalysisSummary }> {
      const res = await apiClient.post<
        ApiEnvelope<{ id: string; summary: LogAnalysisSummary }>
      >(`/api/logs/${projectId}/upload`, data);
      return res.data;
    },

    async list(projectId: string): Promise<LogUpload[]> {
      const res = await apiClient.get<ApiEnvelope<LogUpload[]>>(
        `/api/logs/${projectId}`,
      );
      return res.data;
    },

    async getCrawlerTimeline(
      projectId: string,
    ): Promise<CrawlerTimelinePoint[]> {
      const res = await apiClient.get<ApiEnvelope<CrawlerTimelinePoint[]>>(
        `/api/logs/${projectId}/crawler-timeline`,
      );
      return res.data;
    },
  },

  // ── Integrations ────────────────────────────────────────────────
  integrations: {
    async list(projectId: string): Promise<ProjectIntegration[]> {
      const res = await apiClient.get<ApiEnvelope<ProjectIntegration[]>>(
        `/api/integrations/${projectId}`,
      );
      return res.data;
    },

    async connect(
      projectId: string,
      data: {
        provider: string;
        apiKey?: string;
        clarityProjectId?: string;
      },
    ): Promise<ProjectIntegration> {
      const res = await apiClient.post<ApiEnvelope<ProjectIntegration>>(
        `/api/integrations/${projectId}/connect`,
        data,
      );
      return res.data;
    },

    async update(
      projectId: string,
      integrationId: string,
      data: { enabled?: boolean; config?: Record<string, unknown> },
    ): Promise<ProjectIntegration> {
      const res = await apiClient.put<ApiEnvelope<ProjectIntegration>>(
        `/api/integrations/${projectId}/${integrationId}`,
        data,
      );
      return res.data;
    },

    async disconnect(projectId: string, integrationId: string): Promise<void> {
      await apiClient.delete(`/api/integrations/${projectId}/${integrationId}`);
    },

    async insights(
      projectId: string,
      crawlId?: string,
    ): Promise<IntegrationInsights> {
      const query = crawlId ? `?crawlId=${encodeURIComponent(crawlId)}` : "";
      const res = await apiClient.get<ApiEnvelope<IntegrationInsights>>(
        `/api/integrations/${projectId}/insights${query}`,
      );
      return res.data;
    },

    async startGoogleOAuth(
      projectId: string,
      provider: "gsc" | "ga4",
    ): Promise<{ url: string }> {
      const res = await apiClient.post<ApiEnvelope<{ url: string }>>(
        `/api/integrations/${projectId}/oauth/google/start`,
        { provider },
      );
      return res.data;
    },

    async oauthCallback(data: {
      code: string;
      state: string;
      redirectUri: string;
    }): Promise<ProjectIntegration> {
      const res = await apiClient.post<ApiEnvelope<ProjectIntegration>>(
        `/api/integrations/oauth/google/callback`,
        data,
      );
      return res.data;
    },

    async test(
      projectId: string,
      integrationId: string,
    ): Promise<{ ok: boolean; message: string }> {
      const res = await apiClient.post<
        ApiEnvelope<{ ok: boolean; message: string }>
      >(`/api/integrations/${projectId}/${integrationId}/test`);
      return res.data;
    },
  },

  // ── Share ──────────────────────────────────────────────────────
  share: {
    async enable(
      crawlId: string,
      options?: {
        level?: "summary" | "issues" | "full";
        expiresAt?: string | null;
      },
    ): Promise<ShareInfo> {
      const res = await apiClient.post<ApiEnvelope<ShareInfo>>(
        `/api/crawls/${crawlId}/share`,
        options,
      );
      return res.data;
    },

    async update(
      crawlId: string,
      settings: {
        level?: "summary" | "issues" | "full";
        expiresAt?: string | null;
      },
    ): Promise<ShareInfo> {
      const res = await apiClient.patch<ApiEnvelope<ShareInfo>>(
        `/api/crawls/${crawlId}/share`,
        settings,
      );
      return res.data;
    },

    async disable(crawlId: string): Promise<void> {
      await apiClient.delete(`/api/crawls/${crawlId}/share`);
    },

    async getPublicReport(token: string): Promise<PublicReport> {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/public/reports/${token}`,
      );
      if (!res.ok) throw new Error("Report not found");
      const json = await res.json();
      return json.data;
    },
  },

  // ── Notification Channels ────────────────────────────────────
  channels: {
    async list(): Promise<NotificationChannel[]> {
      const res = await apiClient.get<ApiEnvelope<NotificationChannel[]>>(
        "/api/notification-channels",
      );
      return res.data;
    },

    async create(data: CreateChannelInput): Promise<NotificationChannel> {
      const res = await apiClient.post<ApiEnvelope<NotificationChannel>>(
        "/api/notification-channels",
        data,
      );
      return res.data;
    },

    async update(
      id: string,
      data: Partial<ChannelUpdate>,
    ): Promise<NotificationChannel> {
      const res = await apiClient.patch<ApiEnvelope<NotificationChannel>>(
        `/api/notification-channels/${id}`,
        data,
      );
      return res.data;
    },

    async delete(id: string): Promise<void> {
      await apiClient.delete(`/api/notification-channels/${id}`);
    },
  },

  // ── AI Fixes ───────────────────────────────────────────────
  fixes: {
    async generate(data: {
      projectId: string;
      pageId?: string;
      issueCode: string;
    }) {
      const res = await apiClient.post<ApiEnvelope<any>>(
        "/api/fixes/generate",
        data,
      );
      return res.data;
    },

    async list(projectId: string) {
      const res = await apiClient.get<ApiEnvelope<any[]>>(
        `/api/fixes?projectId=${projectId}`,
      );
      return res.data;
    },

    async supported() {
      const res = await apiClient.get<ApiEnvelope<string[]>>(
        "/api/fixes/supported",
      );
      return res.data;
    },

    async generateBatch(data: { projectId: string; crawlId: string }) {
      const res = await apiClient.post<
        ApiEnvelope<
          Array<{
            code: string;
            fix: { generatedFix: string; fixType: string } | null;
            error: string | null;
          }>
        >
      >("/api/fixes/generate-batch", data);
      return res.data;
    },
  },

  // ── Benchmarks ───────────────────────────────────────────────
  benchmarks: {
    async trigger(data: { projectId: string; competitorDomain: string }) {
      const res = await apiClient.post<ApiEnvelope<any>>(
        "/api/competitors/benchmark",
        data,
      );
      return res.data;
    },
    async list(projectId: string) {
      const res = await apiClient.get<
        ApiEnvelope<{
          projectScores: {
            overall: number;
            technical: number;
            content: number;
            aiReadiness: number;
            performance: number;
            letterGrade: string;
          };
          competitors: Array<{
            competitorDomain: string;
            scores: {
              overall: number | null;
              technical: number | null;
              content: number | null;
              aiReadiness: number | null;
              performance: number | null;
              letterGrade: string | null;
            };
            comparison: {
              overall: number;
              technical: number;
              content: number;
              aiReadiness: number;
              performance: number;
            };
            crawledAt: string;
          }>;
        }>
      >(`/api/competitors?projectId=${projectId}`);
      return res.data;
    },
  },

  // ── Trends ─────────────────────────────────────────────────────
  trends: {
    async get(projectId: string, period = "90d") {
      const res = await apiClient.get<ApiEnvelope<any>>(
        `/api/trends/${projectId}?period=${period}`,
      );
      const points = res.data?.points ?? [];
      return points.map((p: any) => ({
        date: p.date,
        overall: p.overall ?? 0,
        technical: p.technical ?? 0,
        content: p.content ?? 0,
        aiReadiness: p.aiReadiness ?? 0,
        performance: p.performance ?? 0,
        delta: p.deltas?.overall ?? undefined,
      }));
    },

    async getRegressions(projectId: string): Promise<Regression[]> {
      const res = await apiClient.get<ApiEnvelope<Regression[]>>(
        `/api/trends/${projectId}/regressions`,
      );
      return res.data;
    },
  },

  // ── API Tokens ───────────────────────────────────────────────
  tokens: {
    async list(): Promise<ApiTokenInfo[]> {
      const res =
        await apiClient.get<ApiEnvelope<ApiTokenInfo[]>>("/api/tokens");
      return res.data;
    },

    async create(data: CreateTokenInput): Promise<ApiTokenWithPlaintext> {
      const res = await apiClient.post<ApiEnvelope<ApiTokenWithPlaintext>>(
        "/api/tokens",
        data,
      );
      return res.data;
    },

    async revoke(id: string): Promise<void> {
      await apiClient.delete(`/api/tokens/${id}`);
    },
  },
};
