import { eq, and } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { pageEnrichments } from "../schema";
import type { IntegrationProvider } from "../schema/enums";

export function enrichmentQueries(db: Database) {
  return {
    async createBatch(
      rows: {
        pageId: string;
        jobId: string;
        provider: IntegrationProvider;
        data: unknown;
      }[],
    ) {
      if (rows.length === 0) return [];
      return db
        .insert(pageEnrichments)
        .values(
          rows.map((r) => ({
            ...r,
            id: crypto.randomUUID(),
            data: typeof r.data === "string" ? r.data : JSON.stringify(r.data),
          })),
        )
        .returning();
    },

    async listByPage(pageId: string) {
      return db.query.pageEnrichments.findMany({
        where: eq(pageEnrichments.pageId, pageId),
      });
    },

    async listByJob(jobId: string) {
      return db.query.pageEnrichments.findMany({
        where: eq(pageEnrichments.jobId, jobId),
      });
    },

    async listByJobAndProvider(jobId: string, provider: IntegrationProvider) {
      return db.query.pageEnrichments.findMany({
        where: and(
          eq(pageEnrichments.jobId, jobId),
          eq(pageEnrichments.provider, provider),
        ),
      });
    },
  };
}
