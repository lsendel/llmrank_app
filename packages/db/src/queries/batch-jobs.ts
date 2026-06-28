import { eq, inArray } from "drizzle-orm";
import type { AgencyDatabase as Database } from "../supabase-client";
import { llmBatchJobs } from "../schema";

export function batchJobQueries(db: Database) {
  return {
    async create(data: {
      batchId: string;
      jobId: string;
      projectId: string;
      totalRequests?: number;
    }) {
      const [row] = await db.insert(llmBatchJobs).values(data).returning();
      return row;
    },

    async listPending() {
      // Every non-terminal status. The poller writes Anthropic's
      // processing_status ("in_progress" / "canceling"); without these a batch
      // would drop out of polling after the first tick and never be collected.
      return db.query.llmBatchJobs.findMany({
        where: inArray(llmBatchJobs.status, [
          "submitted",
          "processing",
          "in_progress",
          "canceling",
        ]),
      });
    },

    async updateStatus(
      id: string,
      update: {
        status?: string;
        completedRequests?: number;
        failedRequests?: number;
        completedAt?: Date;
        error?: string;
      },
    ) {
      const [updated] = await db
        .update(llmBatchJobs)
        .set(update)
        .where(eq(llmBatchJobs.id, id))
        .returning();
      return updated;
    },
  };
}
