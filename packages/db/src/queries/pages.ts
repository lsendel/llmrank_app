import { and, eq, gt, gte, isNotNull } from "drizzle-orm";
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

    /**
     * The `limit` highest-word-count pages of a job that are eligible for LLM
     * content scoring (>= 200 words, and have both a content hash and stored R2
     * HTML). Used by the per-crawl paid-scoring path to pick the true top-N most
     * citation-worthy pages of the WHOLE crawl (not per ingest batch). The
     * eligibility filter is in the WHERE clause so the DB returns exactly the
     * scoreable set, ordered — no over-fetch/in-memory trimming needed.
     */
    async topScoreableByWordCount(jobId: string, limit: number) {
      return db.query.pages.findMany({
        where: and(
          eq(pages.jobId, jobId),
          gte(pages.wordCount, 200),
          isNotNull(pages.contentHash),
          isNotNull(pages.r2RawKey),
        ),
        limit,
        orderBy: (pages, { desc }) => [desc(pages.wordCount)],
      });
    },
  };
}
