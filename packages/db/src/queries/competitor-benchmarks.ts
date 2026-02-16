import { eq, and, desc } from "drizzle-orm";
import type { Database } from "../client";
import { competitorBenchmarks } from "../schema";

export function competitorBenchmarkQueries(db: Database) {
  return {
    async create(data: typeof competitorBenchmarks.$inferInsert) {
      const [row] = await db
        .insert(competitorBenchmarks)
        .values(data)
        .returning();
      return row;
    },

    async listByProject(projectId: string) {
      return db.query.competitorBenchmarks.findMany({
        where: eq(competitorBenchmarks.projectId, projectId),
        orderBy: desc(competitorBenchmarks.crawledAt),
      });
    },

    async getLatest(projectId: string, competitorDomain: string) {
      return db.query.competitorBenchmarks.findFirst({
        where: and(
          eq(competitorBenchmarks.projectId, projectId),
          eq(competitorBenchmarks.competitorDomain, competitorDomain),
        ),
        orderBy: desc(competitorBenchmarks.crawledAt),
      });
    },
  };
}
