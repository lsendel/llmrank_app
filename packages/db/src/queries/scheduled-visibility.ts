import { and, eq, lte, sql } from "drizzle-orm";
import type { Database } from "../client";
import { scheduledVisibilityQueries } from "../schema";

export function scheduledVisibilityQueryQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      query: string;
      providers: string[];
      frequency: "hourly" | "daily" | "weekly";
    }) {
      const nextRunAt = computeNextRun(data.frequency);
      const [row] = await db
        .insert(scheduledVisibilityQueries)
        .values({ ...data, nextRunAt })
        .returning();
      return row;
    },

    async listByProject(projectId: string) {
      return db
        .select()
        .from(scheduledVisibilityQueries)
        .where(eq(scheduledVisibilityQueries.projectId, projectId))
        .orderBy(scheduledVisibilityQueries.createdAt);
    },

    async getById(id: string) {
      const [row] = await db
        .select()
        .from(scheduledVisibilityQueries)
        .where(eq(scheduledVisibilityQueries.id, id));
      return row ?? null;
    },

    async update(
      id: string,
      data: Partial<{
        query: string;
        providers: string[];
        frequency: "hourly" | "daily" | "weekly";
        enabled: boolean;
      }>,
    ) {
      const updates: Record<string, unknown> = { ...data };
      if (data.frequency) {
        updates.nextRunAt = computeNextRun(data.frequency);
      }
      const [updated] = await db
        .update(scheduledVisibilityQueries)
        .set(updates)
        .where(eq(scheduledVisibilityQueries.id, id))
        .returning();
      return updated ?? null;
    },

    async delete(id: string) {
      await db
        .delete(scheduledVisibilityQueries)
        .where(eq(scheduledVisibilityQueries.id, id));
    },

    async getDueQueries(now: Date) {
      return db
        .select()
        .from(scheduledVisibilityQueries)
        .where(
          and(
            lte(scheduledVisibilityQueries.nextRunAt, now),
            eq(scheduledVisibilityQueries.enabled, true),
          ),
        )
        .limit(50);
    },

    async markRun(id: string, frequency: "hourly" | "daily" | "weekly") {
      const now = new Date();
      const [updated] = await db
        .update(scheduledVisibilityQueries)
        .set({
          lastRunAt: now,
          nextRunAt: computeNextRun(frequency, now),
        })
        .where(eq(scheduledVisibilityQueries.id, id))
        .returning();
      return updated ?? null;
    },

    async countByProject(projectId: string) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scheduledVisibilityQueries)
        .where(eq(scheduledVisibilityQueries.projectId, projectId));
      return result?.count ?? 0;
    },
  };
}

function computeNextRun(
  frequency: "hourly" | "daily" | "weekly",
  from: Date = new Date(),
): Date {
  const next = new Date(from);
  switch (frequency) {
    case "hourly":
      next.setHours(next.getHours() + 1);
      break;
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
  }
  return next;
}
