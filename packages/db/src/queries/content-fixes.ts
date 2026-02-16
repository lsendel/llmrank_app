import { eq, and, desc, sql, gte } from "drizzle-orm";
import type { Database } from "../client";
import { contentFixes } from "../schema";

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
        .select({ count: sql<number>`count(*)::int` })
        .from(contentFixes)
        .where(
          and(
            eq(contentFixes.userId, userId),
            gte(contentFixes.createdAt, startOfMonth),
          ),
        );
      return row?.count ?? 0;
    },
    async updateStatus(id: string, status: string) {
      const [updated] = await db
        .update(contentFixes)
        .set({ status: status as any })
        .where(eq(contentFixes.id, id))
        .returning();
      return updated;
    },
  };
}
