import type {
  CrawlRepository,
  ProjectRepository,
  ScoreRepository,
  UserRepository,
  VisibilityRepository,
  PageRepository,
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
    createdAt: STATIC_DATE,
    updatedAt: STATIC_DATE,
    ...overrides,
  };
}

export function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    plan: "pro",
    clerkId: null,
    phone: null,
    avatarUrl: null,
    stripeCustomerId: null,
    stripeSubId: null,
    crawlCreditsRemaining: 5,
    notifyOnCrawlComplete: true,
    notifyOnScoreDrop: true,
    isAdmin: false,
    createdAt: STATIC_DATE,
    updatedAt: STATIC_DATE,
    ...overrides,
  };
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
    shareToken: null,
    shareEnabled: false,
    sharedAt: null,
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
  return {
    id: "score-1",
    pageId: "page-1",
    jobId: "crawl-1",
    overallScore: 85,
    technicalScore: 80,
    contentScore: 80,
    aiReadinessScore: 80,
    lighthousePerf: null,
    lighthouseSeo: null,
    detail: {},
    createdAt: STATIC_DATE,
    ...overrides,
  };
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
    crawledAt: STATIC_DATE,
    createdAt: STATIC_DATE,
    updatedAt: STATIC_DATE,
    ...overrides,
  } as PageEntity;
}
