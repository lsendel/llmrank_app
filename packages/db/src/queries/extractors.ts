import { eq, and } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { customExtractors } from "../schema";

export function extractorQueries(db: Database) {
  return {
    async listByProject(projectId: string) {
      return db.query.customExtractors.findMany({
        where: eq(customExtractors.projectId, projectId),
      });
    },

    async create(data: {
      projectId: string;
      name: string;
      type: string;
      selector: string;
      attribute?: string;
    }) {
      const [extractor] = await db
        .insert(customExtractors)
        .values({ ...data, id: crypto.randomUUID() })
        .returning();
      return extractor;
    },

    async update(
      id: string,
      projectId: string,
      data: { name?: string; selector?: string; attribute?: string },
    ) {
      const [updated] = await db
        .update(customExtractors)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(customExtractors.id, id),
            eq(customExtractors.projectId, projectId),
          ),
        )
        .returning();
      return updated;
    },

    async remove(id: string, projectId: string) {
      await db
        .delete(customExtractors)
        .where(
          and(
            eq(customExtractors.id, id),
            eq(customExtractors.projectId, projectId),
          ),
        );
    },
  };
}
