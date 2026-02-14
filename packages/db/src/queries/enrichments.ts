import { eq, and } from "drizzle-orm";
import type { Database } from "../client";
import { pageEnrichments } from "../schema";

export function enrichmentQueries(db: Database) {
  return {
    async createBatch(
      rows: {
        pageId: string;
        jobId: string;
        provider: "gsc" | "psi" | "ga4" | "clarity";
        data: unknown;
      }[],
    ) {
      if (rows.length === 0) return [];
      return db.insert(pageEnrichments).values(rows).returning();
    },

    async listByPage(pageId: string) {
      return db.query.pageEnrichments.findMany({
        where: eq(pageEnrichments.pageId, pageId),
      });
    },

    async listByJobAndProvider(
      jobId: string,
      provider: "gsc" | "psi" | "ga4" | "clarity",
    ) {
      return db.query.pageEnrichments.findMany({
        where: and(
          eq(pageEnrichments.jobId, jobId),
          eq(pageEnrichments.provider, provider),
        ),
      });
    },
  };
}
