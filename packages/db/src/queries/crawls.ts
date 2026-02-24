import {
  eq,
  desc,
  and,
  sql,
  inArray,
  type InferSelectModel,
} from "drizzle-orm";
import type { Database } from "../client";
import {
  crawlJobs,
  crawlStatusEnum,
  projects,
  pageScores,
  pages,
} from "../schema";

type CrawlStatus = (typeof crawlStatusEnum.enumValues)[number];
type PageScore = InferSelectModel<typeof pageScores>;

export function crawlQueries(db: Database) {
  return {
    async create(data: { projectId: string; config: unknown }) {
      const [job] = await db
        .insert(crawlJobs)
        .values({
          projectId: data.projectId,
          config: data.config,
          status: "pending",
        })
        .returning();
      return job;
    },

    async updateStatus(
      id: string,
      update: {
        status: CrawlStatus;
        pagesFound?: number;
        pagesCrawled?: number;
        pagesScored?: number;
        errorMessage?: string;
        r2Prefix?: string;
        startedAt?: Date;
        completedAt?: Date;
        siteContext?: unknown;
      },
    ) {
      const [updated] = await db
        .update(crawlJobs)
        .set(update)
        .where(eq(crawlJobs.id, id))
        .returning();
      return updated;
    },

    async getById(id: string) {
      return db.query.crawlJobs.findFirst({ where: eq(crawlJobs.id, id) });
    },

    async getLatestByProject(projectId: string) {
      // Prefer completed crawls; fall back to most recent of any status
      const completed = await db.query.crawlJobs.findFirst({
        where: and(
          eq(crawlJobs.projectId, projectId),
          eq(crawlJobs.status, "complete"),
        ),
        orderBy: [desc(crawlJobs.createdAt)],
      });
      if (completed) return completed;

      return db.query.crawlJobs.findFirst({
        where: eq(crawlJobs.projectId, projectId),
        orderBy: [desc(crawlJobs.createdAt)],
      });
    },

    async getLatestByProjects(projectIds: string[]) {
      if (projectIds.length === 0) return [];

      const rows = await db.query.crawlJobs.findMany({
        where: inArray(crawlJobs.projectId, projectIds),
        orderBy: [desc(crawlJobs.createdAt)],
      });

      const latestByProject = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        const existing = latestByProject.get(row.projectId);
        if (!existing) {
          latestByProject.set(row.projectId, row);
          continue;
        }

        // Prefer most recent completed crawl over newer non-completed crawl.
        if (existing.status !== "complete" && row.status === "complete") {
          latestByProject.set(row.projectId, row);
        }
      }

      return Array.from(latestByProject.values());
    },

    async listByProject(projectId: string, limit = 50, offset = 0) {
      return db.query.crawlJobs.findMany({
        where: eq(crawlJobs.projectId, projectId),
        orderBy: [desc(crawlJobs.createdAt)],
        limit,
        offset,
      });
    },

    async listCompletedByProject(projectId: string, limit = 50) {
      return db.query.crawlJobs.findMany({
        where: and(
          eq(crawlJobs.projectId, projectId),
          eq(crawlJobs.status, "complete"),
        ),
        limit,
        orderBy: [desc(crawlJobs.createdAt)],
      });
    },

    async getComparisonData(jobId1: string, jobId2: string) {
      // Fetch scores and pages for both jobs
      const [scores1, pages1, scores2, pages2] = await Promise.all([
        db.query.pageScores.findMany({ where: eq(pageScores.jobId, jobId1) }),
        db.query.pages.findMany({ where: eq(pages.jobId, jobId1) }),
        db.query.pageScores.findMany({ where: eq(pageScores.jobId, jobId2) }),
        db.query.pages.findMany({ where: eq(pages.jobId, jobId2) }),
      ]);

      const pageMap1 = new Map(pages1.map((p) => [p.id, p.url]));
      const pageMap2 = new Map(pages2.map((p) => [p.id, p.url]));

      const scoresByUrl1 = new Map<string, PageScore>();
      for (const s of scores1) {
        const url = pageMap1.get(s.pageId);
        if (url) scoresByUrl1.set(url, s);
      }

      const scoresByUrl2 = new Map<string, PageScore>();
      for (const s of scores2) {
        const url = pageMap2.get(s.pageId);
        if (url) scoresByUrl2.set(url, s);
      }

      // Find all unique URLs across both jobs
      const allUrls = new Set([...scoresByUrl1.keys(), ...scoresByUrl2.keys()]);

      return Array.from(allUrls).map((url) => {
        const s1 = scoresByUrl1.get(url);
        const s2 = scoresByUrl2.get(url);

        return {
          url,
          oldScore: s1?.overallScore ?? null,
          newScore: s2?.overallScore ?? null,
          delta:
            s1 && s2
              ? s2.overallScore - s1.overallScore
              : s2
                ? s2.overallScore
                : s1
                  ? -s1.overallScore
                  : 0,
        };
      });
    },

    async generateShareToken(
      id: string,
      options?: {
        level?: "summary" | "issues" | "full";
        expiresAt?: Date | null;
      },
    ) {
      const token = crypto.randomUUID();
      const [updated] = await db
        .update(crawlJobs)
        .set({
          shareToken: token,
          shareEnabled: true,
          sharedAt: new Date(),
          shareLevel: options?.level ?? "summary",
          shareExpiresAt: options?.expiresAt ?? null,
        })
        .where(eq(crawlJobs.id, id))
        .returning();
      return updated;
    },

    async getByShareToken(token: string) {
      const job = await db.query.crawlJobs.findFirst({
        where: (fields, { and, eq: eq_ }) =>
          and(eq_(fields.shareToken, token), eq_(fields.shareEnabled, true)),
      });
      if (!job) return null;
      if (job.shareExpiresAt && new Date(job.shareExpiresAt) < new Date()) {
        return null;
      }
      return job;
    },

    async disableSharing(id: string) {
      const [updated] = await db
        .update(crawlJobs)
        .set({ shareEnabled: false })
        .where(eq(crawlJobs.id, id))
        .returning();
      return updated;
    },

    async updateShareSettings(
      id: string,
      settings: {
        level?: "summary" | "issues" | "full";
        expiresAt?: Date | null;
      },
    ) {
      const update: Record<string, unknown> = {};
      if (settings.level !== undefined) update.shareLevel = settings.level;
      if (settings.expiresAt !== undefined)
        update.shareExpiresAt = settings.expiresAt;
      const [updated] = await db
        .update(crawlJobs)
        .set(update)
        .where(eq(crawlJobs.id, id))
        .returning();
      return updated;
    },

    async updateSummary(id: string, summary: string) {
      const [updated] = await db
        .update(crawlJobs)
        .set({ summary })
        .where(eq(crawlJobs.id, id))
        .returning();
      return updated;
    },

    async updateSummaryData(id: string, summaryData: unknown) {
      const [updated] = await db
        .update(crawlJobs)
        .set({ summaryData })
        .where(eq(crawlJobs.id, id))
        .returning();
      return updated;
    },

    /** Count total crawls + average score for a user (2 queries, not N+1). */
    async getStatsForUser(userId: string) {
      const [countRow] = await db
        .select({ total: sql<number>`count(*)` })
        .from(crawlJobs)
        .innerJoin(projects, eq(crawlJobs.projectId, projects.id))
        .where(eq(projects.userId, userId));

      const [avgRow] = await db
        .select({
          avg: sql<number>`coalesce(avg(${pageScores.overallScore}), 0)`,
        })
        .from(pageScores)
        .innerJoin(crawlJobs, eq(pageScores.jobId, crawlJobs.id))
        .innerJoin(projects, eq(crawlJobs.projectId, projects.id))
        .where(
          and(eq(projects.userId, userId), eq(crawlJobs.status, "complete")),
        );

      return {
        totalCrawls: Number(countRow?.total ?? 0),
        avgScore: Math.round(Number(avgRow?.avg ?? 0)),
      };
    },

    /** Recent crawls with project name, ordered by creation (single JOIN). */
    async getRecentForUser(userId: string, limit = 10) {
      const rows = await db
        .select({
          id: crawlJobs.id,
          projectId: crawlJobs.projectId,
          status: crawlJobs.status,
          pagesFound: crawlJobs.pagesFound,
          pagesCrawled: crawlJobs.pagesCrawled,
          pagesScored: crawlJobs.pagesScored,
          errorMessage: crawlJobs.errorMessage,
          summary: crawlJobs.summary,
          summaryData: crawlJobs.summaryData,
          startedAt: crawlJobs.startedAt,
          completedAt: crawlJobs.completedAt,
          createdAt: crawlJobs.createdAt,
          projectName: projects.name,
        })
        .from(crawlJobs)
        .innerJoin(projects, eq(crawlJobs.projectId, projects.id))
        .where(eq(projects.userId, userId))
        .orderBy(desc(crawlJobs.createdAt))
        .limit(limit);

      if (rows.length === 0) return [];

      // Batch-fetch average scores for completed crawls
      const completedIds = rows
        .filter((r) => r.status === "complete")
        .map((r) => r.id);

      const scoreMap = new Map<string, number>();
      if (completedIds.length > 0) {
        const scoreRows = await db
          .select({
            jobId: pageScores.jobId,
            avg: sql<number>`avg(${pageScores.overallScore})`,
          })
          .from(pageScores)
          .where(inArray(pageScores.jobId, completedIds))
          .groupBy(pageScores.jobId);

        for (const sr of scoreRows) {
          scoreMap.set(sr.jobId, Math.round(Number(sr.avg)));
        }
      }

      return rows.map((r) => {
        const overallScore = scoreMap.get(r.id) ?? null;
        let letterGrade: string | null = null;
        if (overallScore !== null) {
          if (overallScore >= 90) letterGrade = "A";
          else if (overallScore >= 80) letterGrade = "B";
          else if (overallScore >= 70) letterGrade = "C";
          else if (overallScore >= 60) letterGrade = "D";
          else letterGrade = "F";
        }
        return { ...r, overallScore, letterGrade };
      });
    },
    /** List active crawls (likely to be in queue/processing) for a user. */
    async listActiveByUser(userId: string, limit = 50, offset = 0) {
      return db
        .select({
          id: crawlJobs.id,
          projectId: crawlJobs.projectId,
          status: crawlJobs.status,
          pagesFound: crawlJobs.pagesFound,
          pagesCrawled: crawlJobs.pagesCrawled,
          pagesScored: crawlJobs.pagesScored,
          errorMessage: crawlJobs.errorMessage,
          createdAt: crawlJobs.createdAt,
          projectName: projects.name,
        })
        .from(crawlJobs)
        .innerJoin(projects, eq(crawlJobs.projectId, projects.id))
        .where(
          and(
            eq(projects.userId, userId),
            inArray(crawlJobs.status, [
              "pending",
              "queued",
              "crawling",
              "scoring",
            ]),
          ),
        )
        .orderBy(desc(crawlJobs.createdAt))
        .limit(limit)
        .offset(offset);
    },

    /** Count active crawls for a user. */
    async countActiveByUser(userId: string) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(crawlJobs)
        .innerJoin(projects, eq(crawlJobs.projectId, projects.id))
        .where(
          and(
            eq(projects.userId, userId),
            inArray(crawlJobs.status, [
              "pending",
              "queued",
              "crawling",
              "scoring",
            ]),
          ),
        );
      return Number(count);
    },

    /** List ALL crawls for a user (history), ordered by creation. */
    async listByUser(userId: string, limit = 50, offset = 0) {
      const rows = await db
        .select({
          id: crawlJobs.id,
          projectId: crawlJobs.projectId,
          status: crawlJobs.status,
          pagesFound: crawlJobs.pagesFound,
          pagesCrawled: crawlJobs.pagesCrawled,
          pagesScored: crawlJobs.pagesScored,
          errorMessage: crawlJobs.errorMessage,
          summary: crawlJobs.summary,
          summaryData: crawlJobs.summaryData,
          startedAt: crawlJobs.startedAt,
          completedAt: crawlJobs.completedAt,
          createdAt: crawlJobs.createdAt,
          projectName: projects.name,
        })
        .from(crawlJobs)
        .innerJoin(projects, eq(crawlJobs.projectId, projects.id))
        .where(eq(projects.userId, userId))
        .orderBy(desc(crawlJobs.createdAt))
        .limit(limit)
        .offset(offset);

      if (rows.length === 0) return [];

      // Batch-fetch average scores for completed crawls
      const completedIds = rows
        .filter((r) => r.status === "complete")
        .map((r) => r.id);

      const scoreMap = new Map<string, number>();
      if (completedIds.length > 0) {
        const scoreRows = await db
          .select({
            jobId: pageScores.jobId,
            avg: sql<number>`avg(${pageScores.overallScore})`,
          })
          .from(pageScores)
          .where(inArray(pageScores.jobId, completedIds))
          .groupBy(pageScores.jobId);

        for (const sr of scoreRows) {
          scoreMap.set(sr.jobId, Math.round(Number(sr.avg)));
        }
      }

      return rows.map((r) => {
        const overallScore = scoreMap.get(r.id) ?? null;
        let letterGrade: string | null = null;
        if (overallScore !== null) {
          if (overallScore >= 90) letterGrade = "A";
          else if (overallScore >= 80) letterGrade = "B";
          else if (overallScore >= 70) letterGrade = "C";
          else if (overallScore >= 60) letterGrade = "D";
          else letterGrade = "F";
        }
        return { ...r, overallScore, letterGrade };
      });
    },

    /** Count ALL crawls for a user. */
    async countByUser(userId: string) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(crawlJobs)
        .innerJoin(projects, eq(crawlJobs.projectId, projects.id))
        .where(eq(projects.userId, userId));
      return Number(count);
    },

    /** Delete all crawl jobs for a specific project (cascades to pages, scores, issues). */
    async deleteByProject(projectId: string) {
      const deleted = await db
        .delete(crawlJobs)
        .where(eq(crawlJobs.projectId, projectId))
        .returning({ id: crawlJobs.id });
      return deleted.length;
    },

    /** Delete all crawl jobs for all projects owned by a user. */
    async deleteAllByUser(userId: string) {
      const userProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.userId, userId));

      if (userProjects.length === 0) return 0;

      const projectIds = userProjects.map((p) => p.id);
      const deleted = await db
        .delete(crawlJobs)
        .where(inArray(crawlJobs.projectId, projectIds))
        .returning({ id: crawlJobs.id });
      return deleted.length;
    },
  };
}
