import { eq, and, desc, sql, gte } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { contentFixes } from "../schema";
import type { FixStatus } from "../schema/enums";

export function contentFixQueries(db: Database) {
  return {
    async create(data: typeof contentFixes.$inferInsert) {
      const [row] = await db.insert(contentFixes).values(data).returning();
      return row;
    },
    async listByProject(projectId: string, limit = 20) {
      return db.query.contentFixes.findMany({
        where: eq(contentFixes.projectId, projectId),
        orderBy: desc(contentFixes.createdAt),
        limit,
      });
    },
    async countByUserThisMonth(userId: string) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(contentFixes)
        .where(
          and(
            eq(contentFixes.userId, userId),
            gte(contentFixes.createdAt, startOfMonth),
          ),
        );
      return row?.count ?? 0;
    },
    async updateStatus(id: string, status: FixStatus) {
      const [updated] = await db
        .update(contentFixes)
        .set({ status })
        .where(eq(contentFixes.id, id))
        .returning();
      return updated;
    },
  };
}
