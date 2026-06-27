import {
  eq,
  desc,
  asc,
  and,
  sql,
  inArray,
  type InferSelectModel,
} from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { crawlJobs, projects, pageScores, pages } from "../schema";
import type { CrawlStatus } from "../schema/enums";

type PageScore = InferSelectModel<typeof pageScores>;

/** Map an aggregate crawl score to a letter grade. Single source of truth for
 *  the crawl-list enrichment used by listByProject / listByUser /
 *  getRecentForUser (crawlJobs has no stored grade column). */
function scoreToLetterGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function crawlQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      config: unknown;
      redispatchCount?: number;
    }) {
      // updated_at has no DB default (added nullable via migration; SQLite
      // forbids a datetime() default on ADD COLUMN), so set it explicitly here
      // and on every updateStatus so the stall watchdog always has activity.
      const now = new Date().toISOString();
      const [job] = await db
        .insert(crawlJobs)
        .values({
          id: crypto.randomUUID(),
          projectId: data.projectId,
          config:
            typeof data.config === "string"
              ? data.config
              : JSON.stringify(data.config),
          status: "pending",
          redispatchCount: data.redispatchCount ?? 0,
          updatedAt: now,
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
        startedAt?: Date | string;
        completedAt?: Date | string;
        siteContext?: unknown;
      },
    ) {
      // Always stamp activity so the stall watchdog measures inactivity, not age.
      const setData: Record<string, unknown> = {
        status: update.status,
        updatedAt: new Date().toISOString(),
      };
      if (update.pagesFound !== undefined)
        setData.pagesFound = update.pagesFound;
      if (update.pagesCrawled !== undefined)
        setData.pagesCrawled = update.pagesCrawled;
      if (update.pagesScored !== undefined)
        setData.pagesScored = update.pagesScored;
      if (update.errorMessage !== undefined)
        setData.errorMessage = update.errorMessage;
      if (update.r2Prefix !== undefined) setData.r2Prefix = update.r2Prefix;
      if (update.startedAt !== undefined)
        setData.startedAt =
          update.startedAt instanceof Date
            ? update.startedAt.toISOString()
            : update.startedAt;
      if (update.completedAt !== undefined)
        setData.completedAt =
          update.completedAt instanceof Date
            ? update.completedAt.toISOString()
            : update.completedAt;
      if (update.siteContext !== undefined)
        setData.siteContext =
          typeof update.siteContext === "string"
            ? update.siteContext
            : JSON.stringify(update.siteContext);
      const [updated] = await db
        .update(crawlJobs)
        .set(setData)
        .where(eq(crawlJobs.id, id))
        .returning();
      return updated;
    },

    async getById(id: string) {
      return db.query.crawlJobs.findFirst({ where: eq(crawlJobs.id, id) });
    },

    /**
     * Find crawls that are still in a non-terminal state but have had no
     * activity (no status/progress write) since `olderThanISO`. These are jobs
     * whose crawler died mid-run (deploy restart, crash) without a terminal
     * callback. Ordered oldest-activity first; capped so one watchdog tick
     * can't fan out unbounded recovery work.
     */
    async findStalled(opts: { olderThanISO: string; limit?: number }) {
      return db.query.crawlJobs.findMany({
        where: and(
          inArray(crawlJobs.status, [
            "pending",
            "queued",
            "crawling",
            "scoring",
          ]),
          // COALESCE so a row written by old code during the migration→deploy
          // window (updated_at still NULL) is evaluated by createdAt age instead
          // of being invisible to `lt` forever. Both sides wrapped in datetime()
          // because created_at is stored as `YYYY-MM-DD HH:MM:SS` (datetime('now'))
          // while updated_at and the cutoff are ISO (`...T...Z`); a raw string
          // compare sorts ' ' before 'T' and would flag fresh rows as stale.
          sql`datetime(coalesce(${crawlJobs.updatedAt}, ${crawlJobs.createdAt})) < datetime(${opts.olderThanISO})`,
        ),
        orderBy: [asc(crawlJobs.updatedAt)],
        limit: opts.limit ?? 20,
      });
    },

    /**
     * Atomically claim a stalled job for recovery: transition it
     * active→cancelled only if it is STILL non-terminal and STILL stale
     * (datetime(COALESCE(updated_at, created_at)) < cutoff). Returns the claimed
     * row, or undefined if the conditional update matched nothing — meaning an
     * ingest callback bumped activity (the crawler was alive after all) or
     * another worker already claimed it. The caller must only re-dispatch when
     * it wins the claim, closing the find→act race that could double-dispatch.
     *
     * Claimed jobs are marked `cancelled` (a terminal state ingest drops late
     * callbacks for) rather than `failed`, so a slow-but-alive original crawler
     * posting a batch after the claim can't resurrect the job alongside its
     * replacement. The caller may relabel no-replacement outcomes as `failed`.
     */
    async claimStalled(opts: { id: string; olderThanISO: string }) {
      const now = new Date().toISOString();
      const [claimed] = await db
        .update(crawlJobs)
        .set({
          status: "cancelled",
          cancelledAt: now,
          cancelReason: "stall-recovery: claimed (no crawler activity)",
          updatedAt: now,
        })
        .where(
          and(
            eq(crawlJobs.id, opts.id),
            inArray(crawlJobs.status, [
              "pending",
              "queued",
              "crawling",
              "scoring",
            ]),
            sql`datetime(coalesce(${crawlJobs.updatedAt}, ${crawlJobs.createdAt})) < datetime(${opts.olderThanISO})`,
          ),
        )
        .returning();
      return claimed;
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
      const rows = await db.query.crawlJobs.findMany({
        where: eq(crawlJobs.projectId, projectId),
        orderBy: [desc(crawlJobs.createdAt)],
        limit,
        offset,
      });

      // Enrich with aggregate score + grade the same way listByUser /
      // getRecentForUser do. Without this the History tab and Score Trends read
      // null overallScore/letterGrade even though page_scores exist, and render
      // "--". Scores are derived from page_scores (crawlJobs has no score
      // column), so this is the single source of truth.
      if (rows.length === 0) return rows;
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
        return {
          ...r,
          overallScore,
          letterGrade:
            overallScore === null ? null : scoreToLetterGrade(overallScore),
        };
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
          sharedAt: new Date().toISOString(),
          shareLevel: options?.level ?? "summary",
          shareExpiresAt: options?.expiresAt?.toISOString() ?? null,
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
        update.shareExpiresAt = settings.expiresAt?.toISOString() ?? null;
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
        .set({
          summaryData:
            typeof summaryData === "string"
              ? summaryData
              : JSON.stringify(summaryData),
        })
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
          projectDomain: projects.domain,
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
        return {
          ...r,
          overallScore,
          letterGrade:
            overallScore === null ? null : scoreToLetterGrade(overallScore),
        };
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
        return {
          ...r,
          overallScore,
          letterGrade:
            overallScore === null ? null : scoreToLetterGrade(overallScore),
        };
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
