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
  projectName?: string;
  projectId2?: string;
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
  } | null;
  issues: PageIssue[];
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
}

export interface SharedReport {
  crawlId: string;
  completedAt: string | null;
  pagesScored: number;
  scores: {
    overall: number;
    technical: number;
    content: number;
    aiReadiness: number;
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
}

export interface PlatformReadinessResult {
  platform: string;
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
}

export interface DashboardActivity extends CrawlJob {
  projectName: string;
  projectId: string;
}

// ─── Request helpers ────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, token, headers: extraHeaders, ...init } = options;

  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
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

interface PaginatedEnvelope<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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
    async getStats(token: string): Promise<DashboardStats> {
      const res = await apiClient.get<ApiEnvelope<DashboardStats>>(
        "/api/dashboard/stats",
        { token },
      );
      return res.data;
    },
    async getRecentActivity(token: string): Promise<DashboardActivity[]> {
      const res = await apiClient.get<ApiEnvelope<DashboardActivity[]>>(
        "/api/dashboard/activity",
        { token },
      );
      return res.data;
    },
  },

  // ── Projects ────────────────────────────────────────────────────
  projects: {
    async list(
      token: string,
      params?: { page?: number; limit?: number },
    ): Promise<PaginatedResponse<Project>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<Project>>(`/api/projects${qs}`, {
        token,
      });
    },

    async get(token: string, projectId: string): Promise<Project> {
      const res = await apiClient.get<ApiEnvelope<Project>>(
        `/api/projects/${projectId}`,
        { token },
      );
      return res.data;
    },

    async create(token: string, data: CreateProjectInput): Promise<Project> {
      const res = await apiClient.post<ApiEnvelope<Project>>(
        "/api/projects",
        data,
        { token },
      );
      return res.data;
    },

    async update(
      token: string,
      projectId: string,
      data: UpdateProjectInput,
    ): Promise<Project> {
      const res = await apiClient.put<ApiEnvelope<Project>>(
        `/api/projects/${projectId}`,
        data,
        { token },
      );
      return res.data;
    },

    async delete(token: string, projectId: string): Promise<void> {
      await apiClient.delete<ApiEnvelope<{ id: string; deleted: boolean }>>(
        `/api/projects/${projectId}`,
        { token },
      );
    },
  },

  // ── Crawls ──────────────────────────────────────────────────────
  crawls: {
    async start(token: string, projectId: string): Promise<CrawlJob> {
      const res = await apiClient.post<ApiEnvelope<CrawlJob>>(
        "/api/crawls",
        { projectId },
        { token },
      );
      return res.data;
    },

    async list(
      token: string,
      projectId: string,
      params?: { page?: number; limit?: number },
    ): Promise<PaginatedResponse<CrawlJob>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<CrawlJob>>(
        `/api/crawls/project/${projectId}${qs}`,
        { token },
      );
    },

    async get(token: string, crawlId: string): Promise<CrawlJob> {
      const res = await apiClient.get<ApiEnvelope<CrawlJob>>(
        `/api/crawls/${crawlId}`,
        { token },
      );
      return res.data;
    },
  },

  // ── Pages ───────────────────────────────────────────────────────
  pages: {
    async list(
      token: string,
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
        { token },
      );
    },

    async get(token: string, pageId: string): Promise<PageDetail> {
      const res = await apiClient.get<ApiEnvelope<PageDetail>>(
        `/api/pages/${pageId}`,
        { token },
      );
      return res.data;
    },

    async getEnrichments(
      token: string,
      pageId: string,
    ): Promise<PageEnrichment[]> {
      const res = await apiClient.get<ApiEnvelope<PageEnrichment[]>>(
        `/api/pages/${pageId}/enrichments`,
        { token },
      );
      return res.data;
    },
  },

  // ── Issues ──────────────────────────────────────────────────────
  issues: {
    async listForCrawl(
      token: string,
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
        { token },
      );
    },
  },

  // ── Billing ─────────────────────────────────────────────────────
  billing: {
    async getInfo(token: string): Promise<BillingInfo> {
      const res = await apiClient.get<ApiEnvelope<BillingInfo>>(
        "/api/billing/usage",
        { token },
      );
      return res.data;
    },

    async createCheckoutSession(
      token: string,
      plan: string,
      successUrl: string,
      cancelUrl: string,
    ): Promise<{ sessionId: string; url: string }> {
      const res = await apiClient.post<
        ApiEnvelope<{ sessionId: string; url: string }>
      >("/api/billing/checkout", { plan, successUrl, cancelUrl }, { token });
      return res.data;
    },

    async createPortalSession(
      token: string,
      returnUrl: string,
    ): Promise<{ url: string }> {
      const res = await apiClient.post<ApiEnvelope<{ url: string }>>(
        "/api/billing/portal",
        { returnUrl },
        { token },
      );
      return res.data;
    },

    async getSubscription(token: string): Promise<SubscriptionInfo | null> {
      const res = await apiClient.get<ApiEnvelope<SubscriptionInfo | null>>(
        "/api/billing/subscription",
        { token },
      );
      return res.data;
    },

    async getPayments(token: string): Promise<PaymentRecord[]> {
      const res = await apiClient.get<ApiEnvelope<PaymentRecord[]>>(
        "/api/billing/payments",
        { token },
      );
      return res.data;
    },

    async cancelSubscription(token: string): Promise<void> {
      await apiClient.post("/api/billing/cancel", undefined, { token });
    },
  },

  // ── Admin ───────────────────────────────────────────────────────
  admin: {
    async getStats(token: string): Promise<AdminStats> {
      const res = await apiClient.get<ApiEnvelope<AdminStats>>(
        "/api/admin/stats",
        { token },
      );
      return res.data;
    },

    async getCustomers(
      token: string,
      params?: { page?: number; limit?: number; search?: string },
    ): Promise<PaginatedResponse<AdminCustomer>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<AdminCustomer>>(
        `/api/admin/customers${qs}`,
        { token },
      );
    },

    async getCustomerDetail(
      token: string,
      userId: string,
    ): Promise<AdminCustomerDetail> {
      const res = await apiClient.get<ApiEnvelope<AdminCustomerDetail>>(
        `/api/admin/customers/${userId}`,
        { token },
      );
      return res.data;
    },
  },

  // ── Scores ──────────────────────────────────────────────────────
  scores: {
    async listByJob(token: string, jobId: string): Promise<PageScoreEntry[]> {
      const res = await apiClient.get<ApiEnvelope<PageScoreEntry[]>>(
        `/api/scores/job/${jobId}/pages`,
        { token },
      );
      return res.data;
    },

    async getPage(token: string, pageId: string): Promise<PageScoreDetail> {
      const res = await apiClient.get<ApiEnvelope<PageScoreDetail>>(
        `/api/scores/page/${pageId}`,
        { token },
      );
      return res.data;
    },
  },

  // ── Visibility ─────────────────────────────────────────────────
  visibility: {
    async run(
      token: string,
      data: {
        projectId: string;
        query: string;
        providers: string[];
        competitors?: string[];
      },
    ): Promise<VisibilityCheck[]> {
      const res = await apiClient.post<ApiEnvelope<VisibilityCheck[]>>(
        "/api/visibility/check",
        data,
        { token },
      );
      return res.data;
    },

    async list(token: string, projectId: string): Promise<VisibilityCheck[]> {
      const res = await apiClient.get<ApiEnvelope<VisibilityCheck[]>>(
        `/api/visibility/${projectId}`,
        { token },
      );
      return res.data;
    },

    async getTrends(
      token: string,
      projectId: string,
    ): Promise<VisibilityTrend[]> {
      const res = await apiClient.get<ApiEnvelope<VisibilityTrend[]>>(
        `/api/visibility/${projectId}/trends`,
        { token },
      );
      return res.data;
    },
  },

  // ── Account ─────────────────────────────────────────────────────
  account: {
    async deleteAccount(token: string): Promise<void> {
      await apiClient.delete<void>("/api/account", { token });
    },
  },

  // ── Public (no auth) ──────────────────────────────────────────
  public: {
    async scan(url: string): Promise<PublicScanResult> {
      const res = await apiClient.post<ApiEnvelope<PublicScanResult>>(
        "/api/public/scan",
        { url },
      );
      return res.data;
    },

    async getReport(token: string): Promise<SharedReport> {
      const res = await apiClient.get<ApiEnvelope<SharedReport>>(
        `/api/public/reports/${token}`,
      );
      return res.data;
    },
  },

  // ── Quick Wins ─────────────────────────────────────────────────
  quickWins: {
    async get(token: string, crawlId: string): Promise<QuickWin[]> {
      const res = await apiClient.get<ApiEnvelope<QuickWin[]>>(
        `/api/crawls/${crawlId}/quick-wins`,
        { token },
      );
      return res.data;
    },
  },

  // ── Platform Readiness ─────────────────────────────────────────
  platformReadiness: {
    async get(
      token: string,
      crawlId: string,
    ): Promise<PlatformReadinessResult[]> {
      const res = await apiClient.get<ApiEnvelope<PlatformReadinessResult[]>>(
        `/api/crawls/${crawlId}/platform-readiness`,
        { token },
      );
      return res.data;
    },
  },

  // ── Logs ───────────────────────────────────────────────────────
  logs: {
    async upload(
      token: string,
      projectId: string,
      data: { filename: string; content: string },
    ): Promise<{ id: string; summary: LogAnalysisSummary }> {
      const res = await apiClient.post<
        ApiEnvelope<{ id: string; summary: LogAnalysisSummary }>
      >(`/api/logs/${projectId}/upload`, data, { token });
      return res.data;
    },

    async list(token: string, projectId: string): Promise<LogUpload[]> {
      const res = await apiClient.get<ApiEnvelope<LogUpload[]>>(
        `/api/logs/${projectId}`,
        { token },
      );
      return res.data;
    },
  },

  // ── Integrations ────────────────────────────────────────────────
  integrations: {
    async list(
      token: string,
      projectId: string,
    ): Promise<ProjectIntegration[]> {
      const res = await apiClient.get<ApiEnvelope<ProjectIntegration[]>>(
        `/api/integrations/${projectId}`,
        { token },
      );
      return res.data;
    },

    async connect(
      token: string,
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
        { token },
      );
      return res.data;
    },

    async update(
      token: string,
      projectId: string,
      integrationId: string,
      data: { enabled?: boolean; config?: Record<string, unknown> },
    ): Promise<ProjectIntegration> {
      const res = await apiClient.put<ApiEnvelope<ProjectIntegration>>(
        `/api/integrations/${projectId}/${integrationId}`,
        data,
        { token },
      );
      return res.data;
    },

    async disconnect(
      token: string,
      projectId: string,
      integrationId: string,
    ): Promise<void> {
      await apiClient.delete(
        `/api/integrations/${projectId}/${integrationId}`,
        { token },
      );
    },

    async startGoogleOAuth(
      token: string,
      projectId: string,
      provider: "gsc" | "ga4",
    ): Promise<{ url: string }> {
      const res = await apiClient.post<ApiEnvelope<{ url: string }>>(
        `/api/integrations/${projectId}/oauth/google/start`,
        { provider },
        { token },
      );
      return res.data;
    },

    async oauthCallback(
      token: string,
      data: { code: string; state: string; redirectUri: string },
    ): Promise<ProjectIntegration> {
      const res = await apiClient.post<ApiEnvelope<ProjectIntegration>>(
        `/api/integrations/oauth/google/callback`,
        data,
        { token },
      );
      return res.data;
    },

    async test(
      token: string,
      projectId: string,
      integrationId: string,
    ): Promise<{ ok: boolean; message: string }> {
      const res = await apiClient.post<
        ApiEnvelope<{ ok: boolean; message: string }>
      >(`/api/integrations/${projectId}/${integrationId}/test`, undefined, {
        token,
      });
      return res.data;
    },
  },

  // ── Share ──────────────────────────────────────────────────────
  share: {
    async enable(
      token: string,
      crawlId: string,
    ): Promise<{ shareToken: string; shareUrl: string }> {
      const res = await apiClient.post<
        ApiEnvelope<{ shareToken: string; shareUrl: string }>
      >(`/api/crawls/${crawlId}/share`, undefined, { token });
      return res.data;
    },

    async disable(token: string, crawlId: string): Promise<void> {
      await apiClient.delete(`/api/crawls/${crawlId}/share`, { token });
    },
  },
};
