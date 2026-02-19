import type {
  CrawlRepository,
  ProjectRepository,
  ScoreRepository,
  UserRepository,
  VisibilityRepository,
  PageRepository,
  ReportRepository,
} from "../../repositories";

export type ProjectEntity = NonNullable<
  Awaited<ReturnType<ProjectRepository["getById"]>>
>;
export type ProjectResult = Awaited<ReturnType<ProjectRepository["getById"]>>;
export type UserEntity = NonNullable<
  Awaited<ReturnType<UserRepository["getById"]>>
>;
export type UserResult = Awaited<ReturnType<UserRepository["getById"]>>;
export type CrawlJobEntity = NonNullable<
  Awaited<ReturnType<CrawlRepository["getById"]>>
>;
export type CrawlJobResult = Awaited<ReturnType<CrawlRepository["getById"]>>;
type ScoreRows = Awaited<ReturnType<ScoreRepository["listByJob"]>>;
export type ScoreEntity = ScoreRows extends Array<infer Item> ? Item : never;
type VisibilityRows = Awaited<
  ReturnType<VisibilityRepository["listByProject"]>
>;
export type VisibilityCheckEntity =
  VisibilityRows extends Array<infer Item> ? Item : never;
type VisibilityTrendRows = Awaited<
  ReturnType<VisibilityRepository["getTrends"]>
>;
export type VisibilityTrendEntity =
  VisibilityTrendRows extends Array<infer Item> ? Item : never;
export type PageEntity = NonNullable<
  Awaited<ReturnType<PageRepository["getById"]>>
>;
export type ReportEntity = NonNullable<
  Awaited<ReturnType<ReportRepository["getById"]>>
>;

const STATIC_DATE = new Date("2024-01-01T00:00:00.000Z");

export function buildProject(
  overrides: Partial<ProjectEntity> = {},
): ProjectEntity {
  return {
    id: "proj-1",
    userId: "user-1",
    name: "My Site",
    domain: "https://example.com",
    settings: {},
    branding: {},
    crawlSchedule: "manual",
    nextCrawlAt: null,
    deletedAt: null,
    scoringProfileId: null,
    leaderboardOptIn: false,
    teamId: null,
    createdAt: STATIC_DATE,
    updatedAt: STATIC_DATE,
    ...overrides,
  };
}

export function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const base: UserEntity = {
    id: "user-1",
    email: "test@example.com",
    emailVerified: false,
    name: "Test User",
    plan: "pro",
    clerkId: null,
    phone: null,
    avatarUrl: null,
    image: null,
    stripeCustomerId: null,
    stripeSubId: null,
    crawlCreditsRemaining: 5,
    notifyOnCrawlComplete: true,
    notifyOnScoreDrop: true,
    webhookUrl: null,
    persona: null,
    isAdmin: false,
    status: "active",
    suspendedAt: null,
    suspendedReason: null,
    onboardingComplete: false,
    lastSignedIn: null,
    digestFrequency: "off",
    digestDay: 1,
    lastDigestSentAt: null,
    createdAt: STATIC_DATE,
    updatedAt: STATIC_DATE,
  };

  return { ...base, ...overrides };
}

export function buildCrawlJob(
  overrides: Partial<CrawlJobEntity> = {},
): CrawlJobEntity {
  return {
    id: "crawl-1",
    projectId: "proj-1",
    status: "pending",
    config: { seed_urls: ["https://example.com"] },
    pagesFound: 0,
    pagesCrawled: 0,
    pagesScored: 0,
    errorMessage: null,
    r2Prefix: null,
    summary: null,
    summaryData: null,
    siteContext: null,
    shareToken: null,
    shareEnabled: false,
    sharedAt: null,
    shareLevel: "summary",
    shareExpiresAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: STATIC_DATE,
    ...overrides,
  };
}

export function buildScore(overrides: Partial<ScoreEntity> = {}): ScoreEntity {
  const base: ScoreEntity = {
    id: "score-1",
    pageId: "page-1",
    jobId: "crawl-1",
    overallScore: 85,
    technicalScore: 80,
    contentScore: 80,
    aiReadinessScore: 80,
    llmsTxtScore: null,
    robotsTxtScore: null,
    sitemapScore: null,
    schemaMarkupScore: null,
    metaTagsScore: null,
    botAccessScore: null,
    contentCiteabilityScore: null,
    lighthousePerf: null,
    lighthouseSeo: null,
    detail: {},
    platformScores: null,
    recommendations: null,
    createdAt: STATIC_DATE,
  } as ScoreEntity;

  return { ...base, ...overrides };
}

export function buildVisibilityCheck(
  overrides: Partial<VisibilityCheckEntity> = {},
): VisibilityCheckEntity {
  return {
    id: "vis-1",
    projectId: "proj-1",
    llmProvider: "chatgpt",
    query: "test query",
    responseText: null,
    brandMentioned: false,
    urlCited: false,
    citationPosition: null,
    competitorMentions: {},
    r2ResponseKey: null,
    keywordId: null,
    checkedAt: STATIC_DATE,
    ...overrides,
  };
}

export function buildVisibilityTrend(
  overrides: Partial<VisibilityTrendEntity> = {},
): VisibilityTrendEntity {
  return {
    weekStart: "2024-01-01",
    provider: "chatgpt",
    mentionRate: 0.5,
    citationRate: 0.5,
    totalChecks: 5,
    ...overrides,
  };
}

export function buildPage(overrides: Partial<PageEntity> = {}): PageEntity {
  return {
    id: "page-1",
    projectId: "proj-1",
    jobId: "crawl-1",
    url: "https://example.com/page1",
    canonicalUrl: null,
    statusCode: 200,
    title: "Test Page",
    metaDesc: null,
    h1: null,
    wordCount: 500,
    contentHash: "hash123",
    contentType: "blog_post",
    textLength: 5000,
    htmlLength: 12000,
    r2RawKey: null,
    r2LhKey: null,
    crawledAt: STATIC_DATE,
    createdAt: STATIC_DATE,
    updatedAt: STATIC_DATE,
    ...overrides,
  } as PageEntity;
}

export function buildReport(
  overrides: Partial<ReportEntity> = {},
): ReportEntity {
  return {
    id: "report-1",
    projectId: "proj-1",
    crawlJobId: "crawl-1",
    userId: "test-user-id",
    type: "summary",
    format: "pdf",
    status: "queued",
    r2Key: null,
    fileSize: null,
    config: {},
    error: null,
    generatedAt: null,
    expiresAt: null,
    createdAt: STATIC_DATE,
    ...overrides,
  } as ReportEntity;
}

// ---------------------------------------------------------------------------
// Platform Growth Entities (untyped — no formal repository interfaces yet)
// ---------------------------------------------------------------------------

export function buildNotificationChannel(overrides: Partial<any> = {}) {
  return {
    id: "ch-1",
    userId: "user-1",
    projectId: null,
    channelType: "webhook" as const,
    config: { url: "https://hooks.example.com" },
    eventTypes: ["crawl_completed"],
    enabled: true,
    createdAt: STATIC_DATE,
    updatedAt: STATIC_DATE,
    ...overrides,
  };
}

export function buildScheduledQuery(overrides: Partial<any> = {}) {
  return {
    id: "sq-1",
    projectId: "proj-1",
    query: "best CRM software",
    providers: ["chatgpt", "claude"],
    frequency: "daily" as const,
    lastRunAt: null,
    nextRunAt: new Date(Date.now() + 86400000),
    enabled: true,
    createdAt: STATIC_DATE,
    ...overrides,
  };
}

export function buildApiToken(overrides: Partial<any> = {}) {
  return {
    id: "tok-1",
    userId: "user-1",
    projectId: "proj-1",
    name: "CI token",
    tokenHash: "abc123hash",
    tokenPrefix: "llmb_abc1",
    scopes: ["metrics:read"] as string[],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: STATIC_DATE,
    ...overrides,
  };
}

export function buildScanResult(overrides: Partial<any> = {}) {
  return {
    id: "scan-1",
    domain: "example.com",
    url: "https://example.com",
    scores: { overall: 85 },
    issues: [],
    quickWins: [],
    ipHash: "sha256hash",
    createdAt: STATIC_DATE,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}
