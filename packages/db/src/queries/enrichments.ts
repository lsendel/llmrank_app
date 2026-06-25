import { eq, and } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { pageEnrichments } from "../schema";
import type { IntegrationProvider } from "../schema/enums";
import { chunkForD1Insert } from "./d1-batch";

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
      const serialized = rows.map((r) => ({
        ...r,
        id: crypto.randomUUID(),
        data: typeof r.data === "string" ? r.data : JSON.stringify(r.data),
      }));
      const results = await Promise.all(
        chunkForD1Insert(serialized, pageEnrichments).map((chunk) =>
          db.insert(pageEnrichments).values(chunk).returning(),
        ),
      );
      return results.flat();
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
