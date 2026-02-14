import { eq, desc, and, sql, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { crawlJobs, crawlStatusEnum, projects, pageScores } from "../schema";

type CrawlStatus = (typeof crawlStatusEnum.enumValues)[number];

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

    async listByProject(projectId: string) {
      return db.query.crawlJobs.findMany({
        where: eq(crawlJobs.projectId, projectId),
        orderBy: [desc(crawlJobs.createdAt)],
      });
    },

    async generateShareToken(id: string) {
      const token = crypto.randomUUID();
      const [updated] = await db
        .update(crawlJobs)
        .set({ shareToken: token, shareEnabled: true, sharedAt: new Date() })
        .where(eq(crawlJobs.id, id))
        .returning();
      return updated;
    },

    async getByShareToken(token: string) {
      return db.query.crawlJobs.findFirst({
        where: (fields, { and, eq: eq_ }) =>
          and(eq_(fields.shareToken, token), eq_(fields.shareEnabled, true)),
      });
    },

    async disableSharing(id: string) {
      const [updated] = await db
        .update(crawlJobs)
        .set({ shareEnabled: false })
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
  };
}
