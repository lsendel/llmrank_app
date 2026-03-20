import { eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
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
      return db.query.llmBatchJobs.findMany({
        where: inArray(llmBatchJobs.status, ["submitted", "processing"]),
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
