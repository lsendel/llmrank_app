import { eq, and, desc, gte, sql } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { reports } from "../schema";
import type { ReportStatus } from "../schema/enums";

export function reportQueries(db: Database) {
  return {
    async create(data: typeof reports.$inferInsert) {
      const [row] = await db
        .insert(reports)
        .values({ ...data, id: data.id ?? crypto.randomUUID() })
        .returning();
      return row;
    },

    async getById(id: string) {
      return db.query.reports.findFirst({
        where: eq(reports.id, id),
      });
    },

    async listByProject(projectId: string, limit = 20) {
      return db
        .select()
        .from(reports)
        .where(eq(reports.projectId, projectId))
        .orderBy(desc(reports.createdAt))
        .limit(limit);
    },

    async countThisMonth(userId: string) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const rows = await db
        .select({ count: sql<number>`count(*)` })
        .from(reports)
        .where(
          and(
            eq(reports.userId, userId),
            gte(reports.createdAt, startOfMonth.toISOString()),
          ),
        );
      return Number(rows[0]?.count ?? 0);
    },

    async updateStatus(
      id: string,
      status: ReportStatus,
      extra?: Partial<typeof reports.$inferInsert>,
    ) {
      await db
        .update(reports)
        .set({ status, ...extra })
        .where(eq(reports.id, id));
    },

    async delete(id: string) {
      await db.delete(reports).where(eq(reports.id, id));
    },
  };
}
