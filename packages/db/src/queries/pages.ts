import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { pages } from "../schema";

export function pageQueries(db: Database) {
  return {
    async createBatch(
      rows: Array<{
        jobId: string;
        projectId: string;
        url: string;
        canonicalUrl?: string | null;
        statusCode?: number | null;
        title?: string | null;
        metaDesc?: string | null;
        contentHash?: string | null;
        wordCount?: number | null;
        r2RawKey?: string | null;
        r2LhKey?: string | null;
        crawledAt?: Date | null;
      }>,
    ) {
      if (rows.length === 0) return [];
      return db.insert(pages).values(rows).returning();
    },

    async getById(id: string) {
      return db.query.pages.findFirst({ where: eq(pages.id, id) });
    },

    async listByJob(jobId: string) {
      return db.query.pages.findMany({ where: eq(pages.jobId, jobId) });
    },
  };
}
