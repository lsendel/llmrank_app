import { eq, desc, lte, and } from "drizzle-orm";
import type { Database } from "../client";
import { competitors } from "../schema";

export function competitorQueries(db: Database) {
  return {
    async getById(id: string) {
      return db.query.competitors.findFirst({
        where: eq(competitors.id, id),
      });
    },

    async listByProject(projectId: string, limit = 50, offset = 0) {
      return db.query.competitors.findMany({
        where: eq(competitors.projectId, projectId),
        orderBy: [desc(competitors.createdAt)],
        limit,
        offset,
      });
    },

    async add(projectId: string, domain: string) {
      const [competitor] = await db
        .insert(competitors)
        .values({
          projectId,
          domain,
        })
        .returning();
      return competitor;
    },

    async remove(id: string) {
      const [deleted] = await db
        .delete(competitors)
        .where(eq(competitors.id, id))
        .returning();
      return deleted;
    },

    async updateMonitoring(
      id: string,
      data: {
        monitoringEnabled?: boolean;
        monitoringFrequency?: string;
        nextBenchmarkAt?: Date | null;
        lastBenchmarkAt?: Date | null;
      },
    ) {
      const [updated] = await db
        .update(competitors)
        .set(data as any)
        .where(eq(competitors.id, id))
        .returning();
      return updated;
    },

    async listDueForBenchmark(now: Date, limit = 20) {
      return db.query.competitors.findMany({
        where: and(
          lte(competitors.nextBenchmarkAt, now),
          eq(competitors.monitoringEnabled, true),
        ),
        limit,
      });
    },
  };
}
