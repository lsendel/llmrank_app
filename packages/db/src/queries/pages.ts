import { and, eq, gt } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { pages } from "../schema";
import { chunkForD1Insert } from "./d1-batch";

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
        contentType?: string | null;
        textLength?: number | null;
        htmlLength?: number | null;
        r2RawKey?: string | null;
        r2LhKey?: string | null;
        crawledAt?: Date | null;
      }>,
    ) {
      if (rows.length === 0) return [];
      const serialized = rows.map((r) => ({
        ...r,
        id: crypto.randomUUID(),
        crawledAt:
          r.crawledAt instanceof Date
            ? r.crawledAt.toISOString()
            : (r.crawledAt ?? null),
      }));
      const results = await Promise.all(
        chunkForD1Insert(serialized, pages).map((chunk) =>
          db.insert(pages).values(chunk).returning(),
        ),
      );
      return results.flat();
    },

    async getById(id: string) {
      return db.query.pages.findFirst({ where: eq(pages.id, id) });
    },

    async listByJob(
      jobId: string,
      options?: { cursor?: string; limit?: number },
    ) {
      const limit = options?.limit ?? 50;
      const cursor = options?.cursor;

      // Fetch one extra to determine if there are more results
      const conditions = cursor
        ? and(eq(pages.jobId, jobId), gt(pages.id, cursor))
        : eq(pages.jobId, jobId);

      return db.query.pages.findMany({
        where: conditions,
        limit: limit + 1,
        orderBy: (pages, { asc }) => [asc(pages.id)],
      });
    },
  };
}
