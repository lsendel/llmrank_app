import { vi } from "vitest";
import type {
  ProjectRepository,
  UserRepository,
  CrawlRepository,
  ScoreRepository,
  VisibilityRepository,
  CompetitorRepository,
  PageRepository,
  BillingRepository,
  EnrichmentRepository,
  LogRepository,
  OutboxRepository,
  AdminRepository,
  NarrativeRepository,
} from "../../repositories";
import {
  buildNotificationChannel,
  buildApiToken,
  buildScheduledQuery,
  buildScanResult,
} from "./factories";

// ---------------------------------------------------------------------------
// Generic override helper
// ---------------------------------------------------------------------------

type MockOf<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? ReturnType<typeof vi.fn<(...args: A) => R>>
    : T[K];
};

function applyOverrides<T extends Record<string, unknown>>(
  base: T,
  overrides?: Partial<T>,
): T {
  if (!overrides) return base;
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export function createMockProjectRepo(
  overrides?: Partial<MockOf<ProjectRepository>>,
): MockOf<ProjectRepository> {
  return applyOverrides(
    {
      listByUser: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "project-1" }),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      getDueForCrawl: vi.fn().mockResolvedValue([]),
      updateNextCrawl: vi.fn().mockResolvedValue(undefined),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export function createMockUserRepo(
  overrides?: Partial<MockOf<UserRepository>>,
): MockOf<UserRepository> {
  return applyOverrides(
    {
      getById: vi.fn().mockResolvedValue(null),
      decrementCrawlCredits: vi.fn().mockResolvedValue(undefined),
      updatePlan: vi.fn().mockResolvedValue(undefined),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Crawl
// ---------------------------------------------------------------------------

export function createMockCrawlRepo(
  overrides?: Partial<MockOf<CrawlRepository>>,
): MockOf<CrawlRepository> {
  return applyOverrides(
    {
      create: vi.fn().mockResolvedValue({ id: "crawl-1" }),
      getById: vi.fn().mockResolvedValue(null),
      getLatestByProject: vi.fn().mockResolvedValue(null),
      listByProject: vi.fn().mockResolvedValue([]),
      listByUser: vi.fn().mockResolvedValue([]),
      listActiveByUser: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      generateShareToken: vi.fn().mockResolvedValue("share-token-abc"),
      disableSharing: vi.fn().mockResolvedValue(undefined),
      updateShareSettings: vi.fn().mockResolvedValue(undefined),
      deleteByProject: vi.fn().mockResolvedValue(undefined),
      deleteAllByUser: vi.fn().mockResolvedValue(undefined),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

export function createMockScoreRepo(
  overrides?: Partial<MockOf<ScoreRepository>>,
): MockOf<ScoreRepository> {
  return applyOverrides(
    {
      listByJob: vi.fn().mockResolvedValue([]),
      getIssuesByJob: vi.fn().mockResolvedValue([]),
      listByJobWithPages: vi.fn().mockResolvedValue([]),
      getByPageWithIssues: vi.fn().mockResolvedValue(null),
      createBatch: vi.fn().mockResolvedValue(undefined),
      createIssues: vi.fn().mockResolvedValue(undefined),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

export function createMockVisibilityRepo(
  overrides?: Partial<MockOf<VisibilityRepository>>,
): MockOf<VisibilityRepository> {
  return applyOverrides(
    {
      listByProject: vi.fn().mockResolvedValue([]),
      getTrends: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "vis-1" }),
      countSince: vi.fn().mockResolvedValue(0),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Competitor
// ---------------------------------------------------------------------------

export function createMockCompetitorRepo(
  overrides?: Partial<MockOf<CompetitorRepository>>,
): MockOf<CompetitorRepository> {
  return applyOverrides(
    {
      getById: vi.fn().mockResolvedValue(null),
      listByProject: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue({ id: "comp-1" }),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function createMockPageRepo(
  overrides?: Partial<MockOf<PageRepository>>,
): MockOf<PageRepository> {
  return applyOverrides(
    {
      listByJob: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      createBatch: vi.fn().mockResolvedValue(undefined),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export function createMockBillingRepo(
  overrides?: Partial<MockOf<BillingRepository>>,
): MockOf<BillingRepository> {
  return applyOverrides(
    {
      getActiveSubscription: vi.fn().mockResolvedValue(null),
      listPayments: vi.fn().mockResolvedValue([]),
      markCancelAtPeriodEnd: vi.fn().mockResolvedValue(undefined),
      updateSubscriptionStatus: vi.fn().mockResolvedValue(undefined),
      createSubscription: vi.fn().mockResolvedValue({ id: "sub-1" }),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

export function createMockEnrichmentRepo(
  overrides?: Partial<MockOf<EnrichmentRepository>>,
): MockOf<EnrichmentRepository> {
  return applyOverrides(
    {
      listByPage: vi.fn().mockResolvedValue([]),
      listByJob: vi.fn().mockResolvedValue([]),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

export function createMockLogRepo(
  overrides?: Partial<MockOf<LogRepository>>,
): MockOf<LogRepository> {
  return applyOverrides(
    {
      create: vi.fn().mockResolvedValue({ id: "log-1" }),
      listByProject: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

export function createMockOutboxRepo(
  overrides?: Partial<MockOf<OutboxRepository>>,
): MockOf<OutboxRepository> {
  return applyOverrides(
    {
      enqueue: vi.fn().mockResolvedValue(undefined),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function createMockAdminRepo(
  overrides?: Partial<MockOf<AdminRepository>>,
): MockOf<AdminRepository> {
  return applyOverrides(
    {
      getStats: vi.fn().mockResolvedValue({}),
      getCustomers: vi.fn().mockResolvedValue([]),
      getCustomerDetail: vi.fn().mockResolvedValue(null),
      getIngestDetails: vi.fn().mockResolvedValue([]),
      retryCrawlJob: vi.fn().mockResolvedValue(undefined),
      replayOutboxEvent: vi.fn().mockResolvedValue(undefined),
      cancelCrawlJob: vi.fn().mockResolvedValue(undefined),
      recordAction: vi.fn().mockResolvedValue(undefined),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Platform Growth Entities (untyped — no formal repository interfaces yet)
// ---------------------------------------------------------------------------

// Notification Channel
export function createMockChannelRepo(overrides?: any) {
  return applyOverrides(
    {
      create: vi.fn().mockResolvedValue(buildNotificationChannel()),
      listByUser: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      delete: vi.fn(),
      countByUser: vi.fn().mockResolvedValue(0),
      findByEventType: vi.fn().mockResolvedValue([]),
    },
    overrides,
  );
}

// API Token
export function createMockTokenRepo(overrides?: any) {
  return applyOverrides(
    {
      create: vi.fn().mockResolvedValue(buildApiToken()),
      findByHash: vi.fn().mockResolvedValue(null),
      listByUser: vi.fn().mockResolvedValue([]),
      revoke: vi.fn(),
      updateLastUsed: vi.fn(),
      countByUser: vi.fn().mockResolvedValue(0),
    },
    overrides,
  );
}

// Scheduled Query
export function createMockScheduleRepo(overrides?: any) {
  return applyOverrides(
    {
      create: vi.fn().mockResolvedValue(buildScheduledQuery()),
      listByProject: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      delete: vi.fn(),
      getDueQueries: vi.fn().mockResolvedValue([]),
      markRun: vi.fn(),
      countByProject: vi.fn().mockResolvedValue(0),
    },
    overrides,
  );
}

// Scan Result
export function createMockScanResultRepo(overrides?: any) {
  return applyOverrides(
    {
      create: vi.fn().mockResolvedValue(buildScanResult()),
      getById: vi.fn().mockResolvedValue(null),
      deleteExpired: vi.fn().mockResolvedValue(0),
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Narrative
// ---------------------------------------------------------------------------

export function createMockNarrativeRepo(
  overrides?: Partial<MockOf<NarrativeRepository>>,
): MockOf<NarrativeRepository> {
  return applyOverrides(
    {
      create: vi.fn().mockResolvedValue({ id: "narrative-1" }),
      getById: vi.fn().mockResolvedValue(null),
      getByCrawlAndTone: vi.fn().mockResolvedValue(null),
      listByProject: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      updateSections: vi.fn().mockResolvedValue(undefined),
      getLatestVersion: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    overrides,
  );
}
