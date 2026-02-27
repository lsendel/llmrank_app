import { eq, and, desc, lte, sql } from "drizzle-orm";
import type { Database } from "../client";
import { competitorMonitoringSchedules } from "../schema";

export function competitorMonitoringScheduleQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      query: string;
      providers: string[];
      frequency?: string;
      nextRunAt?: Date;
    }) {
      const [schedule] = await db
        .insert(competitorMonitoringSchedules)
        .values({
          ...data,
          nextRunAt: data.nextRunAt ?? new Date(),
        } as any)
        .returning();
      return schedule;
    },

    async listByProject(projectId: string) {
      return db.query.competitorMonitoringSchedules.findMany({
        where: eq(competitorMonitoringSchedules.projectId, projectId),
        orderBy: [desc(competitorMonitoringSchedules.createdAt)],
      });
    },

    async getById(id: string) {
      return db.query.competitorMonitoringSchedules.findFirst({
        where: eq(competitorMonitoringSchedules.id, id),
      });
    },

    async update(
      id: string,
      data: Partial<{
        query: string;
        providers: string[];
        frequency: string;
        enabled: boolean;
        nextRunAt: Date;
        lastRunAt: Date;
      }>,
    ) {
      const [updated] = await db
        .update(competitorMonitoringSchedules)
        .set(data as any)
        .where(eq(competitorMonitoringSchedules.id, id))
        .returning();
      return updated;
    },

    async delete(id: string) {
      const [deleted] = await db
        .delete(competitorMonitoringSchedules)
        .where(eq(competitorMonitoringSchedules.id, id))
        .returning();
      return deleted;
    },

    async getDueSchedules(now: Date, limit = 10) {
      return db.query.competitorMonitoringSchedules.findMany({
        where: and(
          lte(competitorMonitoringSchedules.nextRunAt, now),
          eq(competitorMonitoringSchedules.enabled, true),
        ),
        limit,
      });
    },

    async countByProject(projectId: string) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(competitorMonitoringSchedules)
        .where(eq(competitorMonitoringSchedules.projectId, projectId));
      return result?.count ?? 0;
    },

    async markRun(id: string, frequency: string) {
      const now = new Date();
      const nextRun = new Date(now);
      if (frequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else if (frequency === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      else nextRun.setHours(nextRun.getHours() + 1);

      const [updated] = await db
        .update(competitorMonitoringSchedules)
        .set({ lastRunAt: now, nextRunAt: nextRun })
        .where(eq(competitorMonitoringSchedules.id, id))
        .returning();
      return updated;
    },
  };
}
