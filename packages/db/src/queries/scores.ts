import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { pageScores, pages, issues } from "../schema";
import type { IssueCategory, IssueSeverity } from "../schema/enums";
import { chunkForD1Insert } from "./d1-batch";

/** Rows per chunk when loading a whole job's issues/pages (D1 response-size safe). */
const ISSUE_LOAD_CHUNK = 500;

/**
 * Load every row of an id-ordered query by paging with an id cursor, so a large
 * result set never lands in a single D1 response (which can exceed its size
 * limit and throw). The fetcher must order by `id asc` and use `gt(id, cursor)`.
 */
async function loadAllById<T extends { id: string }>(
  fetch: (cursor: string | undefined) => Promise<T[]>,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const rows = await fetch(cursor);
    all.push(...rows);
    if (rows.length < ISSUE_LOAD_CHUNK) break;
    cursor = rows[rows.length - 1].id;
  }
  return all;
}

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

function jsonStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  return typeof v === "string" ? v : JSON.stringify(v);
}

function serializeScore(data: ScoreCreateData) {
  return {
    ...data,
    id: crypto.randomUUID(),
    detail: jsonStr(data.detail),
    platformScores: jsonStr(data.platformScores),
    recommendations: jsonStr(data.recommendations),
  };
}

function serializeIssue(data: IssueCreateData) {
  return {
    ...data,
    id: crypto.randomUUID(),
    data: jsonStr(data.data),
  };
}

/** Parse a JSON text column. Idempotent: returns objects/null untouched. */
function parseJson(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Inverse of {@link serializeScore}: the `detail`, `platform_scores`, and
 * `recommendations` columns are TEXT-stored JSON, so every read must parse them
 * back to objects. Without this, consumers that do `Object.entries(platformScores)`
 * iterate the JSON *string's characters* (keys "0","1","2"…) — the source of the
 * "0/100 +100 potential" platform cards. Applied in all read paths below.
 */
function deserializeScore<
  T extends {
    detail?: unknown;
    platformScores?: unknown;
    recommendations?: unknown;
  },
>(row: T) {
  return {
    ...row,
    detail: parseJson(row.detail),
    platformScores: parseJson(row.platformScores),
    recommendations: parseJson(row.recommendations),
  };
}

export function scoreQueries(db: Database) {
  return {
    async create(data: ScoreCreateData) {
      const [score] = await db
        .insert(pageScores)
        .values(serializeScore(data))
        .returning();
      return score;
    },

    /** Batch insert scores — chunked to stay under D1's 100 bound-param limit. */
    async createBatch(rows: ScoreCreateData[]) {
      if (rows.length === 0) return [];
      const chunks = chunkForD1Insert(rows.map(serializeScore), pageScores);
      const results = await Promise.all(
        chunks.map((chunk) => db.insert(pageScores).values(chunk).returning()),
      );
      return results.flat();
    },

    async getByPage(pageId: string) {
      const row = await db.query.pageScores.findFirst({
        where: eq(pageScores.pageId, pageId),
      });
      return row ? deserializeScore(row) : row;
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

      const rows = await db.query.pageScores.findMany({
        where: conditions,
        limit: limit + 1,
        orderBy: (pageScores, { asc }) => [asc(pageScores.id)],
      });
      return rows.map(deserializeScore);
    },

    /** Fetch ALL scores for a job without pagination (for aggregation). */
    async listAllByJob(jobId: string) {
      const rows = await db.query.pageScores.findMany({
        where: eq(pageScores.jobId, jobId),
      });
      return rows.map(deserializeScore);
    },

    /** Total number of scored pages for a job (SQL-side, pagination-safe). */
    async countByJob(jobId: string) {
      const [row] = await db
        .select({ n: sql<number>`count(*)` })
        .from(pageScores)
        .where(eq(pageScores.jobId, jobId));
      return row?.n ?? 0;
    },

    /**
     * SQL-side aggregate over ALL scores for a job (count + category averages).
     * Use this for metrics endpoints instead of averaging a paginated
     * `listByJob` sample — one cheap query, no 2000-row transfer, and no risk
     * of the D1 response-size limit that full-row loads carry.
     */
    async aggregateByJob(jobId: string) {
      const [row] = await db
        .select({
          totalPages: sql<number>`count(*)`,
          avgOverall: sql<number | null>`avg(${pageScores.overallScore})`,
          avgTechnical: sql<number | null>`avg(${pageScores.technicalScore})`,
          avgContent: sql<number | null>`avg(${pageScores.contentScore})`,
          avgAiReadiness: sql<
            number | null
          >`avg(${pageScores.aiReadinessScore})`,
        })
        .from(pageScores)
        .where(eq(pageScores.jobId, jobId));
      return {
        totalPages: row?.totalPages ?? 0,
        avgOverall: row?.avgOverall ?? null,
        avgTechnical: row?.avgTechnical ?? null,
        avgContent: row?.avgContent ?? null,
        avgAiReadiness: row?.avgAiReadiness ?? null,
      };
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

      const rows = await db.query.pageScores.findMany({
        where: conditions,
        limit: limit + 1,
        orderBy: (pageScores, { asc }) => [asc(pageScores.id)],
      });
      return rows.map(deserializeScore);
    },

    async createIssues(rows: IssueCreateData[]) {
      if (rows.length === 0) return [];
      const chunks = chunkForD1Insert(rows.map(serializeIssue), issues);
      const results = await Promise.all(
        chunks.map((chunk) => db.insert(issues).values(chunk).returning()),
      );
      return results.flat();
    },

    async getIssuesByPage(pageId: string) {
      return db.query.issues.findMany({ where: eq(issues.pageId, pageId) });
    },

    /**
     * Aggregate a crawl's issues by code (SQL-side GROUP BY — one cheap query,
     * never loads the raw issue rows). Backs the issue-code breakdown and
     * crawl-over-crawl delta views: issue-code counts are the trustworthy way
     * to measure content/SEO change across crawls (score averages are
     * top-N-gated and sampling-sensitive).
     */
    async countIssuesByCode(jobId: string) {
      return db
        .select({
          code: issues.code,
          category: issues.category,
          severity: issues.severity,
          count: sql<number>`count(*)`,
        })
        .from(issues)
        .where(eq(issues.jobId, jobId))
        .groupBy(issues.code, issues.category, issues.severity)
        .orderBy(sql`count(*) desc`);
    },

    async getIssuesByJob(jobId: string) {
      // Load issues + pages in bounded id-cursor chunks. A single unbounded
      // findMany over a large crawl (thousands of issues/pages) can exceed D1's
      // response-size limit and THROW — which used to abort the is_final ingest
      // batch (500) before post-processing ran. Chunked reads stay safe.
      const [jobIssues, pageRows] = await Promise.all([
        loadAllById((cursor) =>
          db.query.issues.findMany({
            where: cursor
              ? and(eq(issues.jobId, jobId), gt(issues.id, cursor))
              : eq(issues.jobId, jobId),
            orderBy: (i, { asc }) => [asc(i.id)],
            limit: ISSUE_LOAD_CHUNK,
          }),
        ),
        loadAllById((cursor) =>
          db.query.pages.findMany({
            where: cursor
              ? and(eq(pages.jobId, jobId), gt(pages.id, cursor))
              : eq(pages.jobId, jobId),
            orderBy: (p, { asc }) => [asc(p.id)],
            limit: ISSUE_LOAD_CHUNK,
          }),
        ),
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
      return {
        score: score ? deserializeScore(score) : null,
        issues: pageIssues,
      };
    },

    /**
     * Fetch all page scores for a job with page info and issue counts.
     * Uses 3 parallel queries instead of 2N queries (eliminates N+1).
     * Supports cursor-based pagination.
     */
    async listByJobWithPages(
      jobId: string,
      options?: { cursor?: string; limit?: number; offset?: number },
    ) {
      const limit = options?.limit ?? 50;
      const cursor = options?.cursor;
      const offset = options?.offset ?? 0;

      // Build condition for paginated score fetch
      const scoreConditions = cursor
        ? and(eq(pageScores.jobId, jobId), gt(pageScores.id, cursor))
        : eq(pageScores.jobId, jobId);

      // Fetch scores with pagination (limit + 1 for hasMore detection)
      const scores = (
        await db.query.pageScores.findMany({
          where: scoreConditions,
          limit: limit + 1,
          offset,
          orderBy: (pageScores, { asc }) => [asc(pageScores.id)],
        })
      ).map(deserializeScore);

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
      const setData: Record<string, unknown> = { ...data };
      if (data.detail !== undefined) setData.detail = jsonStr(data.detail);
      if (data.platformScores !== undefined)
        setData.platformScores = jsonStr(data.platformScores);
      if (data.recommendations !== undefined)
        setData.recommendations = jsonStr(data.recommendations);
      const [updated] = await db
        .update(pageScores)
        .set(setData)
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
          detail: sql`json_patch(COALESCE(${pageScores.detail}, '{}'), ${JSON.stringify(detailPatch)})`,
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
