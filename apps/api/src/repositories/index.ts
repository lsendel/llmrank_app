import {
  type Database,
  projectQueries,
  userQueries,
  crawlQueries,
  scoreQueries,
  visibilityQueries,
  visibilityChecks,
  competitorQueries,
  pageQueries,
  billingQueries,
  logQueries,
  enrichmentQueries,
  adminQueries,
  outboxQueries,
  reportQueries,
  crawlInsightQueries,
  pageInsightQueries,
  type CrawlInsightInsert,
  type PageInsightInsert,
  and,
  sql,
} from "@llm-boost/db";

// ---------------------------------------------------------------------------
// Project Repository
// ---------------------------------------------------------------------------

export interface ProjectRepository {
  listByUser(
    userId: string,
  ): ReturnType<ReturnType<typeof projectQueries>["listByUser"]>;
  getById(id: string): ReturnType<ReturnType<typeof projectQueries>["getById"]>;
  create(data: {
    userId: string;
    name: string;
    domain: string;
    settings?: unknown;
  }): ReturnType<ReturnType<typeof projectQueries>["create"]>;
  update(
    id: string,
    data: {
      name?: string;
      settings?: unknown;
      branding?: unknown;
      scoringProfileId?: string | null;
    },
  ): ReturnType<ReturnType<typeof projectQueries>["update"]>;
  delete(id: string): ReturnType<ReturnType<typeof projectQueries>["delete"]>;
  getDueForCrawl(
    limit?: number,
  ): ReturnType<ReturnType<typeof projectQueries>["getDueForCrawl"]>;
  updateNextCrawl(
    id: string,
    nextAt: Date,
  ): ReturnType<ReturnType<typeof projectQueries>["updateNextCrawl"]>;
}

export function createProjectRepository(db: Database): ProjectRepository {
  const queries = projectQueries(db);
  return {
    listByUser: (userId) => queries.listByUser(userId),
    getById: (id) => queries.getById(id),
    create: (data) => queries.create(data),
    update: (id, data) => queries.update(id, data),
    delete: (id) => queries.delete(id),
    getDueForCrawl: (limit) => queries.getDueForCrawl(limit),
    updateNextCrawl: (id, nextAt) => queries.updateNextCrawl(id, nextAt),
  };
}

// ---------------------------------------------------------------------------
// User Repository
// ---------------------------------------------------------------------------

export interface UserRepository {
  getById(id: string): ReturnType<ReturnType<typeof userQueries>["getById"]>;
  decrementCrawlCredits(
    id: string,
  ): ReturnType<ReturnType<typeof userQueries>["decrementCrawlCredits"]>;
  updatePlan(
    id: string,
    plan: string,
    stripeSubId?: string,
  ): ReturnType<ReturnType<typeof userQueries>["updatePlan"]>;
}

export function createUserRepository(db: Database): UserRepository {
  const queries = userQueries(db);
  return {
    getById: (id) => queries.getById(id),
    decrementCrawlCredits: (id) => queries.decrementCrawlCredits(id),
    updatePlan: (id, plan, stripeSubId) =>
      queries.updatePlan(
        id,
        plan as "free" | "starter" | "pro" | "agency",
        stripeSubId,
      ),
  };
}

// ---------------------------------------------------------------------------
// Crawl Repository
// ---------------------------------------------------------------------------

export interface CrawlRepository {
  create(data: {
    projectId: string;
    config: unknown;
  }): ReturnType<ReturnType<typeof crawlQueries>["create"]>;
  getById(id: string): ReturnType<ReturnType<typeof crawlQueries>["getById"]>;
  getLatestByProject(
    projectId: string,
  ): ReturnType<ReturnType<typeof crawlQueries>["getLatestByProject"]>;
  listByProject(
    projectId: string,
  ): ReturnType<ReturnType<typeof crawlQueries>["listByProject"]>;
  updateStatus(
    id: string,
    update: Parameters<ReturnType<typeof crawlQueries>["updateStatus"]>[1],
  ): ReturnType<ReturnType<typeof crawlQueries>["updateStatus"]>;
  generateShareToken(
    id: string,
    options?: {
      level?: "summary" | "issues" | "full";
      expiresAt?: Date | null;
    },
  ): ReturnType<ReturnType<typeof crawlQueries>["generateShareToken"]>;
  disableSharing(
    id: string,
  ): ReturnType<ReturnType<typeof crawlQueries>["disableSharing"]>;
  updateShareSettings(
    id: string,
    settings: {
      level?: "summary" | "issues" | "full";
      expiresAt?: Date | null;
    },
  ): ReturnType<ReturnType<typeof crawlQueries>["updateShareSettings"]>;
  listActiveByUser(
    userId: string,
    limit?: number,
    offset?: number,
  ): ReturnType<ReturnType<typeof crawlQueries>["listActiveByUser"]>;
  listByUser(
    userId: string,
    limit?: number,
    offset?: number,
  ): ReturnType<ReturnType<typeof crawlQueries>["listByUser"]>;
}

export function createCrawlRepository(db: Database): CrawlRepository {
  const queries = crawlQueries(db);
  return {
    create: (data) => queries.create(data),
    getById: (id) => queries.getById(id),
    getLatestByProject: (projectId) => queries.getLatestByProject(projectId),
    listByProject: (projectId) => queries.listByProject(projectId),
    updateStatus: (id, update) => queries.updateStatus(id, update),
    generateShareToken: (id, options) =>
      queries.generateShareToken(id, options),
    disableSharing: (id) => queries.disableSharing(id),
    updateShareSettings: (id, settings) =>
      queries.updateShareSettings(id, settings),
    listActiveByUser: (userId, limit, offset) =>
      queries.listActiveByUser(userId, limit, offset),
    listByUser: (userId, limit, offset) =>
      queries.listByUser(userId, limit, offset),
  };
}

// ---------------------------------------------------------------------------
// Score Repository
// ---------------------------------------------------------------------------

export interface ScoreRepository {
  listByJob(
    jobId: string,
  ): ReturnType<ReturnType<typeof scoreQueries>["listByJob"]>;
  getIssuesByJob(
    jobId: string,
  ): ReturnType<ReturnType<typeof scoreQueries>["getIssuesByJob"]>;
  listByJobWithPages(
    jobId: string,
  ): ReturnType<ReturnType<typeof scoreQueries>["listByJobWithPages"]>;
  getByPageWithIssues(
    pageId: string,
  ): ReturnType<ReturnType<typeof scoreQueries>["getByPageWithIssues"]>;
  createBatch(
    rows: Parameters<ReturnType<typeof scoreQueries>["createBatch"]>[0],
  ): ReturnType<ReturnType<typeof scoreQueries>["createBatch"]>;
  createIssues(
    rows: Parameters<ReturnType<typeof scoreQueries>["createIssues"]>[0],
  ): ReturnType<ReturnType<typeof scoreQueries>["createIssues"]>;
}

export function createScoreRepository(db: Database): ScoreRepository {
  const queries = scoreQueries(db);
  return {
    listByJob: (jobId) => queries.listByJob(jobId),
    getIssuesByJob: (jobId) => queries.getIssuesByJob(jobId),
    listByJobWithPages: (jobId) => queries.listByJobWithPages(jobId),
    getByPageWithIssues: (pageId) => queries.getByPageWithIssues(pageId),
    createBatch: (rows) => queries.createBatch(rows),
    createIssues: (rows) => queries.createIssues(rows),
  };
}

// ---------------------------------------------------------------------------
// Insight Repositories
// ---------------------------------------------------------------------------

export interface CrawlInsightRepository {
  replaceForCrawl(
    crawlId: string,
    rows: CrawlInsightInsert[],
  ): ReturnType<ReturnType<typeof crawlInsightQueries>["replaceForCrawl"]>;
  listByCrawl(
    crawlId: string,
  ): ReturnType<ReturnType<typeof crawlInsightQueries>["listByCrawl"]>;
}

export function createCrawlInsightRepository(
  db: Database,
): CrawlInsightRepository {
  const queries = crawlInsightQueries(db);
  return {
    replaceForCrawl: (crawlId, rows) => queries.replaceForCrawl(crawlId, rows),
    listByCrawl: (crawlId) => queries.listByCrawl(crawlId),
  };
}

export interface PageInsightRepository {
  replaceForCrawl(
    crawlId: string,
    rows: PageInsightInsert[],
  ): ReturnType<ReturnType<typeof pageInsightQueries>["replaceForCrawl"]>;
  listByCrawl(
    crawlId: string,
  ): ReturnType<ReturnType<typeof pageInsightQueries>["listByCrawl"]>;
}

export function createPageInsightRepository(
  db: Database,
): PageInsightRepository {
  const queries = pageInsightQueries(db);
  return {
    replaceForCrawl: (crawlId, rows) => queries.replaceForCrawl(crawlId, rows),
    listByCrawl: (crawlId) => queries.listByCrawl(crawlId),
  };
}

// ---------------------------------------------------------------------------
// Visibility Repository
// ---------------------------------------------------------------------------

export interface VisibilityRepository {
  listByProject(
    projectId: string,
  ): ReturnType<ReturnType<typeof visibilityQueries>["listByProject"]>;
  getTrends(
    projectId: string,
  ): ReturnType<ReturnType<typeof visibilityQueries>["getTrends"]>;
  create(
    data: Parameters<ReturnType<typeof visibilityQueries>["create"]>[0],
  ): ReturnType<ReturnType<typeof visibilityQueries>["create"]>;
  countSince(projectId: string, since: Date): Promise<number>;
}

export function createVisibilityRepository(db: Database): VisibilityRepository {
  const queries = visibilityQueries(db);
  return {
    listByProject: (projectId) => queries.listByProject(projectId),
    getTrends: (projectId) => queries.getTrends(projectId),
    create: (data) => queries.create(data),
    async countSince(projectId, since) {
      const rows = await db
        .select({ count: sql<number>`count(*)` })
        .from(visibilityChecks)
        .where(
          and(
            sql`${visibilityChecks.projectId} = ${projectId}`,
            sql`${visibilityChecks.checkedAt} >= ${since.toISOString()}`,
          ),
        );
      return Number(rows[0]?.count ?? 0);
    },
  };
}

// ---------------------------------------------------------------------------
// Competitor Repository
// ---------------------------------------------------------------------------

export interface CompetitorRepository {
  getById(
    id: string,
  ): ReturnType<ReturnType<typeof competitorQueries>["getById"]>;
  listByProject(
    projectId: string,
  ): ReturnType<ReturnType<typeof competitorQueries>["listByProject"]>;
  add?(
    projectId: string,
    domain: string,
  ): ReturnType<ReturnType<typeof competitorQueries>["add"]>;
  remove?(
    id: string,
  ): ReturnType<ReturnType<typeof competitorQueries>["remove"]>;
}

export function createCompetitorRepository(db: Database): CompetitorRepository {
  const queries = competitorQueries(db);
  return {
    getById: (id) => queries.getById(id),
    listByProject: (projectId) => queries.listByProject(projectId),
    add: (projectId, domain) => queries.add(projectId, domain),
    remove: (id) => queries.remove(id),
  };
}

// ---------------------------------------------------------------------------
// Page Repository
// ---------------------------------------------------------------------------

export interface PageRepository {
  listByJob(
    jobId: string,
  ): ReturnType<ReturnType<typeof pageQueries>["listByJob"]>;
  getById(id: string): ReturnType<ReturnType<typeof pageQueries>["getById"]>;
  createBatch(
    rows: Parameters<ReturnType<typeof pageQueries>["createBatch"]>[0],
  ): ReturnType<ReturnType<typeof pageQueries>["createBatch"]>;
}

export function createPageRepository(db: Database): PageRepository {
  const queries = pageQueries(db);
  return {
    listByJob: (jobId) => queries.listByJob(jobId),
    getById: (id) => queries.getById(id),
    createBatch: (rows) => queries.createBatch(rows),
  };
}

// ---------------------------------------------------------------------------
// Billing Repository
// ---------------------------------------------------------------------------

export interface BillingRepository {
  getActiveSubscription(
    userId: string,
  ): ReturnType<ReturnType<typeof billingQueries>["getActiveSubscription"]>;
  listPayments(
    userId: string,
  ): ReturnType<ReturnType<typeof billingQueries>["listPayments"]>;
  markCancelAtPeriodEnd(
    stripeSubId: string,
  ): ReturnType<ReturnType<typeof billingQueries>["markCancelAtPeriodEnd"]>;
  updateSubscriptionStatus(
    stripeSubId: string,
    status: Parameters<
      ReturnType<typeof billingQueries>["updateSubscriptionStatus"]
    >[1],
  ): ReturnType<ReturnType<typeof billingQueries>["updateSubscriptionStatus"]>;
  createSubscription: ReturnType<typeof billingQueries>["createSubscription"];
}

export function createBillingRepository(db: Database): BillingRepository {
  const queries = billingQueries(db);
  return {
    getActiveSubscription: (userId) => queries.getActiveSubscription(userId),
    listPayments: (userId) => queries.listPayments(userId),
    markCancelAtPeriodEnd: (stripeSubId) =>
      queries.markCancelAtPeriodEnd(stripeSubId),
    updateSubscriptionStatus: (stripeSubId, status) =>
      queries.updateSubscriptionStatus(stripeSubId, status),
    createSubscription: queries.createSubscription,
  };
}

// ---------------------------------------------------------------------------
// Enrichment Repository
// ---------------------------------------------------------------------------

export interface EnrichmentRepository {
  listByPage(
    pageId: string,
  ): ReturnType<ReturnType<typeof enrichmentQueries>["listByPage"]>;
  listByJob(
    jobId: string,
  ): ReturnType<ReturnType<typeof enrichmentQueries>["listByJob"]>;
}

export function createEnrichmentRepository(db: Database): EnrichmentRepository {
  const queries = enrichmentQueries(db);
  return {
    listByPage: (pageId) => queries.listByPage(pageId),
    listByJob: (jobId) => queries.listByJob(jobId),
  };
}

// ---------------------------------------------------------------------------
// Log Repository
// ---------------------------------------------------------------------------

export interface LogRepository {
  create(
    data: Parameters<ReturnType<typeof logQueries>["create"]>[0],
  ): ReturnType<ReturnType<typeof logQueries>["create"]>;
  listByProject(
    projectId: string,
  ): ReturnType<ReturnType<typeof logQueries>["listByProject"]>;
  getById(id: string): ReturnType<ReturnType<typeof logQueries>["getById"]>;
}

export function createLogRepository(db: Database): LogRepository {
  const queries = logQueries(db);
  return {
    create: (data) => queries.create(data),
    listByProject: (projectId) => queries.listByProject(projectId),
    getById: (id) => queries.getById(id),
  };
}

// ---------------------------------------------------------------------------
// Outbox Repository
// ---------------------------------------------------------------------------

export interface OutboxRepository {
  enqueue(event: {
    type: string;
    payload: Record<string, unknown>;
    availableAt?: Date;
  }): ReturnType<ReturnType<typeof outboxQueries>["enqueue"]>;
}

export function createOutboxRepository(db: Database): OutboxRepository {
  const queries = outboxQueries(db);
  return {
    enqueue: (event) => queries.enqueue(event),
  };
}

// ---------------------------------------------------------------------------
// Admin Repository
// ---------------------------------------------------------------------------

export interface AdminRepository {
  getStats(): ReturnType<ReturnType<typeof adminQueries>["getStats"]>;
  getCustomers(
    args: Parameters<ReturnType<typeof adminQueries>["getCustomers"]>[0],
  ): ReturnType<ReturnType<typeof adminQueries>["getCustomers"]>;
  getCustomerDetail(
    userId: string,
  ): ReturnType<ReturnType<typeof adminQueries>["getCustomerDetail"]>;
  getIngestDetails(): ReturnType<
    ReturnType<typeof adminQueries>["getIngestDetails"]
  >;
  retryCrawlJob(
    jobId: string,
  ): ReturnType<ReturnType<typeof adminQueries>["retryCrawlJob"]>;
  replayOutboxEvent(
    eventId: string,
  ): ReturnType<ReturnType<typeof adminQueries>["replayOutboxEvent"]>;
  cancelCrawlJob(
    jobId: string,
    reason: string,
    adminId: string,
  ): ReturnType<ReturnType<typeof adminQueries>["cancelCrawlJob"]>;
  recordAction(args: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    reason?: string;
  }): ReturnType<ReturnType<typeof adminQueries>["recordAdminAction"]>;
}

export function createAdminRepository(db: Database): AdminRepository {
  const queries = adminQueries(db);
  return {
    getStats: () => queries.getStats(),
    getCustomers: (args) => queries.getCustomers(args),
    getCustomerDetail: (userId) => queries.getCustomerDetail(userId),
    getIngestDetails: () => queries.getIngestDetails(),
    retryCrawlJob: (jobId) => queries.retryCrawlJob(jobId),
    replayOutboxEvent: (eventId) => queries.replayOutboxEvent(eventId),
    cancelCrawlJob: (jobId, reason, adminId) =>
      queries.cancelCrawlJob(jobId, reason, adminId),
    recordAction: (args) => queries.recordAdminAction(args),
  };
}

// ---------------------------------------------------------------------------
// Report Repository
// ---------------------------------------------------------------------------

export interface ReportRepository {
  create(
    data: Parameters<ReturnType<typeof reportQueries>["create"]>[0],
  ): ReturnType<ReturnType<typeof reportQueries>["create"]>;
  getById(id: string): ReturnType<ReturnType<typeof reportQueries>["getById"]>;
  listByProject(
    projectId: string,
    limit?: number,
  ): ReturnType<ReturnType<typeof reportQueries>["listByProject"]>;
  countThisMonth(
    userId: string,
  ): ReturnType<ReturnType<typeof reportQueries>["countThisMonth"]>;
  updateStatus(
    id: string,
    status: "queued" | "generating" | "complete" | "failed",
    extra?: Record<string, unknown>,
  ): ReturnType<ReturnType<typeof reportQueries>["updateStatus"]>;
  delete(id: string): ReturnType<ReturnType<typeof reportQueries>["delete"]>;
}

export function createReportRepository(db: Database): ReportRepository {
  const queries = reportQueries(db);
  return {
    create: (data) => queries.create(data),
    getById: (id) => queries.getById(id),
    listByProject: (projectId, limit) =>
      queries.listByProject(projectId, limit),
    countThisMonth: (userId) => queries.countThisMonth(userId),
    updateStatus: (id, status, extra) =>
      queries.updateStatus(id, status, extra),
    delete: (id) => queries.delete(id),
  };
}
