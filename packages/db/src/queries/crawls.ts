import { eq, desc } from "drizzle-orm";
import type { Database } from "../client";
import { crawlJobs, crawlStatusEnum } from "../schema";

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
  };
}
