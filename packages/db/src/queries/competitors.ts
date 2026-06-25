import { eq, desc, lte, and, inArray } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { competitors } from "../schema";
import { chunkForD1Insert } from "./d1-batch";

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

    async listByProjects(projectIds: string[]) {
      if (projectIds.length === 0) return [];
      return db.query.competitors.findMany({
        where: inArray(competitors.projectId, projectIds),
        orderBy: [desc(competitors.createdAt)],
      });
    },

    async add(projectId: string, domain: string, source?: string) {
      const [competitor] = await db
        .insert(competitors)
        .values({
          id: crypto.randomUUID(),
          projectId,
          domain,
          ...(source ? { source } : {}),
        })
        .returning();
      return competitor;
    },

    async addMultiple(
      projectId: string,
      domains: string[],
      source = "user_added",
    ) {
      if (domains.length === 0) return [];
      const rows = domains.map((domain) => ({
        id: crypto.randomUUID(),
        projectId,
        domain,
        source,
      }));
      const results = await Promise.all(
        chunkForD1Insert(rows, competitors, 2).map((chunk) =>
          db
            .insert(competitors)
            .values(chunk)
            .onConflictDoNothing()
            .returning(),
        ),
      );
      return results.flat();
    },

    async remove(id: string) {
      const [deleted] = await db
        .delete(competitors)
        .where(eq(competitors.id, id))
        .returning();
      return deleted;
    },

    async removeMany(ids: string[]) {
      if (ids.length === 0) return [];
      return db
        .delete(competitors)
        .where(inArray(competitors.id, ids))
        .returning();
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
      const setData: Record<string, unknown> = {};
      if (data.monitoringEnabled !== undefined)
        setData.monitoringEnabled = data.monitoringEnabled;
      if (data.monitoringFrequency !== undefined)
        setData.monitoringFrequency = data.monitoringFrequency;
      if (data.nextBenchmarkAt !== undefined)
        setData.nextBenchmarkAt = data.nextBenchmarkAt?.toISOString() ?? null;
      if (data.lastBenchmarkAt !== undefined)
        setData.lastBenchmarkAt = data.lastBenchmarkAt?.toISOString() ?? null;
      const [updated] = await db
        .update(competitors)
        .set(setData)
        .where(eq(competitors.id, id))
        .returning();
      return updated;
    },

    async listDueForBenchmark(now: Date, limit = 20) {
      return db.query.competitors.findMany({
        where: and(
          lte(competitors.nextBenchmarkAt, now.toISOString()),
          eq(competitors.monitoringEnabled, true),
        ),
        limit,
      });
    },
  };
}
