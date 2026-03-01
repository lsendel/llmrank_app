import {
  eq,
  and,
  isNull,
  desc,
  asc,
  sql,
  ilike,
  or,
  inArray,
} from "drizzle-orm";
import type { Database } from "../client";
import { projects } from "../schema";

export interface ProjectListQuery {
  q?: string;
  sort?:
    | "activity_desc"
    | "score_desc"
    | "score_asc"
    | "name_asc"
    | "name_desc"
    | "created_desc"
    | "created_asc";
  limit?: number;
  offset?: number;
}

export type ProjectHealthFilter =
  | "all"
  | "good"
  | "needs_work"
  | "poor"
  | "no_crawl"
  | "in_progress"
  | "failed";

export interface ProjectPortfolioSummaryQuery extends ProjectListQuery {
  health?: ProjectHealthFilter;
}

export function projectQueries(db: Database) {
  function listWhere(userId: string, query?: ProjectListQuery) {
    const base = [eq(projects.userId, userId), isNull(projects.deletedAt)];
    const q = query?.q?.trim();
    if (!q) return and(...base);
    const pattern = `%${q}%`;
    return and(
      ...base,
      or(ilike(projects.name, pattern), ilike(projects.domain, pattern)),
    );
  }

  function listOrderBy(sort: ProjectListQuery["sort"]) {
    switch (sort) {
      case "name_asc":
        return [asc(projects.name), desc(projects.createdAt)];
      case "name_desc":
        return [desc(projects.name), desc(projects.createdAt)];
      case "created_asc":
        return [asc(projects.createdAt)];
      case "created_desc":
      case "activity_desc":
      case "score_desc":
      case "score_asc":
      default:
        return [desc(projects.createdAt)];
    }
  }

  function portfolioOrderBy(sort: ProjectListQuery["sort"]) {
    switch (sort) {
      case "name_asc":
        return sql`p.name ASC, p.created_at DESC`;
      case "name_desc":
        return sql`p.name DESC, p.created_at DESC`;
      case "created_asc":
        return sql`p.created_at ASC`;
      case "created_desc":
        return sql`p.created_at DESC`;
      case "score_desc":
        return sql`score_summary.overall_score DESC NULLS LAST, latest_activity_at DESC, p.created_at DESC`;
      case "score_asc":
        return sql`score_summary.overall_score ASC NULLS LAST, latest_activity_at DESC, p.created_at DESC`;
      case "activity_desc":
      default:
        return sql`latest_activity_at DESC, p.created_at DESC`;
    }
  }

  function portfolioHealthWhere(health: ProjectHealthFilter | undefined) {
    switch (health ?? "all") {
      case "good":
        return sql`AND score_summary.overall_score IS NOT NULL AND score_summary.overall_score >= 80`;
      case "needs_work":
        return sql`AND score_summary.overall_score IS NOT NULL AND score_summary.overall_score >= 60 AND score_summary.overall_score < 80`;
      case "poor":
        return sql`AND score_summary.overall_score IS NOT NULL AND score_summary.overall_score < 60`;
      case "no_crawl":
        return sql`AND lc.id IS NULL`;
      case "in_progress":
        return sql`AND lc.status IN ('pending', 'crawling', 'scoring')`;
      case "failed":
        return sql`AND lc.status = 'failed'`;
      case "all":
      default:
        return sql``;
    }
  }

  function toNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function toLetterGrade(score: number | null): string | null {
    if (score === null) return null;
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  return {
    async listByUser(userId: string, query?: ProjectListQuery) {
      return db.query.projects.findMany({
        where: listWhere(userId, query),
        orderBy: listOrderBy(query?.sort),
        ...(query?.limit !== undefined ? { limit: query.limit } : {}),
        ...(query?.offset !== undefined ? { offset: query.offset } : {}),
      });
    },

    async countByUser(userId: string, query?: Pick<ProjectListQuery, "q">) {
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(listWhere(userId, query));
      return Number(row?.count ?? 0);
    },

    async listPortfolioByUser(
      userId: string,
      query?: ProjectPortfolioSummaryQuery,
    ) {
      const q = query?.q?.trim();
      const pattern = q ? `%${q}%` : null;
      const qFilter = pattern
        ? sql`AND (p.name ILIKE ${pattern} OR p.domain ILIKE ${pattern})`
        : sql``;
      const healthFilter = portfolioHealthWhere(query?.health);
      const orderBy = portfolioOrderBy(query?.sort);
      const limitSql =
        query?.limit !== undefined ? sql`LIMIT ${query.limit}` : sql``;
      const offsetSql =
        query?.offset !== undefined ? sql`OFFSET ${query.offset}` : sql``;

      const summaryResult = await db.execute(
        sql`
          SELECT
            p.id AS project_id,
            lc.id AS latest_crawl_id,
            lc.status AS latest_crawl_status,
            lc.pages_found AS latest_crawl_pages_found,
            lc.pages_crawled AS latest_crawl_pages_crawled,
            lc.pages_scored AS latest_crawl_pages_scored,
            lc.started_at AS latest_crawl_started_at,
            lc.completed_at AS latest_crawl_completed_at,
            lc.created_at AS latest_crawl_created_at,
            score_summary.overall_score AS latest_crawl_overall_score,
            score_summary.technical_score AS latest_crawl_technical_score,
            score_summary.content_score AS latest_crawl_content_score,
            score_summary.ai_readiness_score AS latest_crawl_ai_readiness_score,
            score_summary.performance_score AS latest_crawl_performance_score,
            COALESCE(lc.completed_at, lc.started_at, p.created_at) AS latest_activity_at
          FROM projects p
          LEFT JOIN LATERAL (
            SELECT cj.*
            FROM crawl_jobs cj
            WHERE cj.project_id = p.id
            ORDER BY CASE WHEN cj.status = 'complete' THEN 0 ELSE 1 END, cj.created_at DESC
            LIMIT 1
          ) lc ON TRUE
          LEFT JOIN LATERAL (
            SELECT
              ROUND(AVG(ps.overall_score))::int AS overall_score,
              COALESCE(ROUND(AVG(ps.technical_score))::int, 0) AS technical_score,
              COALESCE(ROUND(AVG(ps.content_score))::int, 0) AS content_score,
              COALESCE(ROUND(AVG(ps.ai_readiness_score))::int, 0) AS ai_readiness_score,
              COALESCE(
                ROUND(AVG(NULLIF(ps.detail->>'performanceScore', '')::double precision))::int,
                0
              ) AS performance_score
            FROM page_scores ps
            WHERE ps.job_id = lc.id
          ) score_summary ON lc.status = 'complete'
          WHERE p.user_id = ${userId}
            AND p.deleted_at IS NULL
            ${qFilter}
            ${healthFilter}
          ORDER BY ${orderBy}
          ${limitSql}
          ${offsetSql}
        `,
      );

      const summaryRows = (summaryResult.rows ?? []) as Array<
        Record<string, unknown>
      >;
      if (summaryRows.length === 0) return [];

      const projectIds = summaryRows
        .map((row) => String(row.project_id ?? ""))
        .filter(Boolean);

      const page = await db.query.projects.findMany({
        where: and(
          inArray(projects.id, projectIds),
          isNull(projects.deletedAt),
        ),
      });
      const projectById = new Map(page.map((project) => [project.id, project]));

      return summaryRows
        .map((row) => {
          const projectId = String(row.project_id ?? "");
          const project = projectById.get(projectId);
          if (!project) return null;

          const latestCrawlId = row.latest_crawl_id
            ? String(row.latest_crawl_id)
            : null;
          const overallScore = toNumber(row.latest_crawl_overall_score);
          const hasScores = overallScore !== null;

          return {
            ...project,
            latestCrawl: latestCrawlId
              ? {
                  id: latestCrawlId,
                  status: String(row.latest_crawl_status ?? "pending"),
                  pagesFound: toNumber(row.latest_crawl_pages_found),
                  pagesCrawled: toNumber(row.latest_crawl_pages_crawled),
                  pagesScored: toNumber(row.latest_crawl_pages_scored),
                  overallScore,
                  letterGrade: toLetterGrade(overallScore),
                  scores: hasScores
                    ? {
                        technical:
                          toNumber(row.latest_crawl_technical_score) ?? 0,
                        content: toNumber(row.latest_crawl_content_score) ?? 0,
                        aiReadiness:
                          toNumber(row.latest_crawl_ai_readiness_score) ?? 0,
                        performance:
                          toNumber(row.latest_crawl_performance_score) ?? 0,
                      }
                    : null,
                  startedAt: row.latest_crawl_started_at ?? null,
                  completedAt: row.latest_crawl_completed_at ?? null,
                  createdAt: row.latest_crawl_created_at ?? null,
                }
              : null,
          };
        })
        .filter((project): project is NonNullable<typeof project> =>
          Boolean(project),
        );
    },

    async countPortfolioByUser(
      userId: string,
      query?: Pick<ProjectPortfolioSummaryQuery, "q" | "health">,
    ) {
      const q = query?.q?.trim();
      const pattern = q ? `%${q}%` : null;
      const qFilter = pattern
        ? sql`AND (p.name ILIKE ${pattern} OR p.domain ILIKE ${pattern})`
        : sql``;
      const healthFilter = portfolioHealthWhere(query?.health);

      const result = await db.execute(
        sql`
          SELECT COUNT(*)::int AS total
          FROM projects p
          LEFT JOIN LATERAL (
            SELECT cj.*
            FROM crawl_jobs cj
            WHERE cj.project_id = p.id
            ORDER BY CASE WHEN cj.status = 'complete' THEN 0 ELSE 1 END, cj.created_at DESC
            LIMIT 1
          ) lc ON TRUE
          LEFT JOIN LATERAL (
            SELECT ROUND(AVG(ps.overall_score))::int AS overall_score
            FROM page_scores ps
            WHERE ps.job_id = lc.id
          ) score_summary ON lc.status = 'complete'
          WHERE p.user_id = ${userId}
            AND p.deleted_at IS NULL
            ${qFilter}
            ${healthFilter}
        `,
      );

      const [row] = (result.rows ?? []) as Array<Record<string, unknown>>;
      return Number(row?.total ?? 0);
    },

    async getById(id: string) {
      return db.query.projects.findFirst({
        where: and(eq(projects.id, id), isNull(projects.deletedAt)),
      });
    },

    async create(data: {
      userId: string;
      name: string;
      domain: string;
      settings?: unknown;
    }) {
      const [project] = await db
        .insert(projects)
        .values({
          userId: data.userId,
          name: data.name,
          domain: data.domain,
          settings: data.settings ?? {},
        })
        .returning();
      return project;
    },

    async update(
      id: string,
      data: {
        name?: string;
        settings?: unknown;
        branding?: unknown;
        scoringProfileId?: string | null;
        siteDescription?: string | null;
        industry?: string | null;
        pipelineSettings?: unknown;
        siteDescriptionSource?: string;
        industrySource?: string;
      },
    ) {
      const [updated] = await db
        .update(projects)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
        .returning();
      return updated;
    },

    /** Soft delete — sets deletedAt rather than removing the row. */
    async delete(id: string) {
      await db
        .update(projects)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(projects.id, id));
    },

    async getDueForCrawl(limit = 10) {
      return db.query.projects.findMany({
        where: and(
          isNull(projects.deletedAt),
          sql`${projects.nextCrawlAt} <= now()`,
          sql`${projects.crawlSchedule} != 'manual'`,
        ),
        limit,
        with: {
          user: true,
        },
      });
    },

    async updateNextCrawl(id: string, nextAt: Date) {
      await db
        .update(projects)
        .set({ nextCrawlAt: nextAt })
        .where(eq(projects.id, id));
    },
  };
}
