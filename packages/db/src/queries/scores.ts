import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  pageScores,
  pages,
  issues,
  issueCategoryEnum,
  issueSeverityEnum,
} from "../schema";

type IssueCategory = (typeof issueCategoryEnum.enumValues)[number];
type IssueSeverity = (typeof issueSeverityEnum.enumValues)[number];

interface ScoreCreateData {
  pageId: string;
  jobId: string;
  overallScore: number;
  technicalScore?: number | null;
  contentScore?: number | null;
  aiReadinessScore?: number | null;
  llmsTxtScore?: number | null;
  robotsTxtScore?: number | null;
  sitemapScore?: number | null;
  schemaMarkupScore?: number | null;
  metaTagsScore?: number | null;
  botAccessScore?: number | null;
  contentCiteabilityScore?: number | null;
  lighthousePerf?: number | null;
  lighthouseSeo?: number | null;
  detail?: unknown;
  platformScores?: unknown;
  recommendations?: unknown;
}

interface IssueCreateData {
  pageId: string;
  jobId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  code: string;
  message: string;
  recommendation?: string | null;
  data?: unknown;
}

export function scoreQueries(db: Database) {
  return {
    async create(data: ScoreCreateData) {
      const [score] = await db.insert(pageScores).values(data).returning();
      return score;
    },

    /** Batch insert scores — single INSERT for N pages instead of N round-trips. */
    async createBatch(rows: ScoreCreateData[]) {
      if (rows.length === 0) return [];
      return db.insert(pageScores).values(rows).returning();
    },

    async getByPage(pageId: string) {
      return db.query.pageScores.findFirst({
        where: eq(pageScores.pageId, pageId),
      });
    },

    async listByJob(
      jobId: string,
      options?: { cursor?: string; limit?: number },
    ) {
      const limit = options?.limit ?? 50;
      const cursor = options?.cursor;

      // Fetch one extra to determine if there are more results
      const conditions = cursor
        ? and(eq(pageScores.jobId, jobId), gt(pageScores.id, cursor))
        : eq(pageScores.jobId, jobId);

      return db.query.pageScores.findMany({
        where: conditions,
        limit: limit + 1,
        orderBy: (pageScores, { asc }) => [asc(pageScores.id)],
      });
    },

    /** Fetch ALL scores for a job without pagination (for aggregation). */
    async listAllByJob(jobId: string) {
      return db.query.pageScores.findMany({
        where: eq(pageScores.jobId, jobId),
      });
    },

    async listByJobs(
      jobIds: string[],
      options?: { cursor?: string; limit?: number },
    ) {
      if (jobIds.length === 0) return [];

      const limit = options?.limit ?? 50;
      const cursor = options?.cursor;

      const conditions = cursor
        ? and(inArray(pageScores.jobId, jobIds), gt(pageScores.id, cursor))
        : inArray(pageScores.jobId, jobIds);

      return db.query.pageScores.findMany({
        where: conditions,
        limit: limit + 1,
        orderBy: (pageScores, { asc }) => [asc(pageScores.id)],
      });
    },

    async createIssues(rows: IssueCreateData[]) {
      if (rows.length === 0) return [];
      return db.insert(issues).values(rows).returning();
    },

    async getIssuesByPage(pageId: string) {
      return db.query.issues.findMany({ where: eq(issues.pageId, pageId) });
    },

    async getIssuesByJob(jobId: string) {
      const [jobIssues, pageRows] = await Promise.all([
        db.query.issues.findMany({ where: eq(issues.jobId, jobId) }),
        db.query.pages.findMany({ where: eq(pages.jobId, jobId) }),
      ]);
      const pageMap = new Map(pageRows.map((p) => [p.id, p]));
      return jobIssues.map((issue) => ({
        ...issue,
        pageUrl: pageMap.get(issue.pageId)?.url ?? null,
      }));
    },

    async getByPageWithIssues(pageId: string) {
      const [score, pageIssues] = await Promise.all([
        db.query.pageScores.findFirst({
          where: eq(pageScores.pageId, pageId),
        }),
        db.query.issues.findMany({ where: eq(issues.pageId, pageId) }),
      ]);
      return { score: score ?? null, issues: pageIssues };
    },

    /**
     * Fetch all page scores for a job with page info and issue counts.
     * Uses 3 parallel queries instead of 2N queries (eliminates N+1).
     * Supports cursor-based pagination.
     */
    async listByJobWithPages(
      jobId: string,
      options?: { cursor?: string; limit?: number },
    ) {
      const limit = options?.limit ?? 50;
      const cursor = options?.cursor;

      // Build condition for paginated score fetch
      const scoreConditions = cursor
        ? and(eq(pageScores.jobId, jobId), gt(pageScores.id, cursor))
        : eq(pageScores.jobId, jobId);

      // Fetch scores with pagination (limit + 1 for hasMore detection)
      const scores = await db.query.pageScores.findMany({
        where: scoreConditions,
        limit: limit + 1,
        orderBy: (pageScores, { asc }) => [asc(pageScores.id)],
      });

      if (scores.length === 0) return [];

      // Extract page IDs from the fetched scores
      const pageIds = scores.map((s) => s.pageId);

      // Fetch related pages and issues for only the paginated scores
      const [pageRows, relatedIssues] = await Promise.all([
        db.query.pages.findMany({
          where: inArray(pages.id, pageIds),
        }),
        db.query.issues.findMany({
          where: inArray(issues.pageId, pageIds),
        }),
      ]);

      const pageMap = new Map(pageRows.map((p) => [p.id, p]));

      // Count issues per page in memory
      const issueCountMap = new Map<string, number>();
      for (const issue of relatedIssues) {
        issueCountMap.set(
          issue.pageId,
          (issueCountMap.get(issue.pageId) ?? 0) + 1,
        );
      }

      return scores.map((s) => ({
        ...s,
        page: pageMap.get(s.pageId) ?? null,
        issueCount: issueCountMap.get(s.pageId) ?? 0,
      }));
    },

    async update(id: string, data: Partial<ScoreCreateData>) {
      const [updated] = await db
        .update(pageScores)
        .set(data)
        .where(eq(pageScores.id, id))
        .returning();
      return updated;
    },

    async updateDetail(
      pageScoreId: string,
      detailPatch: Record<string, unknown>,
    ) {
      const [updated] = await db
        .update(pageScores)
        .set({
          detail: sql`COALESCE(${pageScores.detail}, '{}'::jsonb) || ${JSON.stringify(detailPatch)}::jsonb`,
        })
        .where(eq(pageScores.id, pageScoreId))
        .returning();
      return updated;
    },

    async clearIssues(pageId: string) {
      return db.delete(issues).where(eq(issues.pageId, pageId));
    },
  };
}
