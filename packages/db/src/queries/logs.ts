import { eq, desc } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { logUploads } from "../schema";

export function logQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      userId: string;
      filename: string;
      totalRequests: number;
      crawlerRequests: number;
      uniqueIPs: number;
      summary: unknown;
    }) {
      const [upload] = await db
        .insert(logUploads)
        .values({
          ...data,
          id: crypto.randomUUID(),
          summary:
            data.summary != null
              ? typeof data.summary === "string"
                ? data.summary
                : JSON.stringify(data.summary)
              : null,
        })
        .returning();
      return upload;
    },

    async listByProject(projectId: string, limit = 20) {
      return db.query.logUploads.findMany({
        where: eq(logUploads.projectId, projectId),
        orderBy: desc(logUploads.createdAt),
        limit,
      });
    },

    async getById(id: string) {
      return db.query.logUploads.findFirst({
        where: eq(logUploads.id, id),
      });
    },
  };
}
