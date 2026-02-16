import { eq, and, desc } from "drizzle-orm";
import type { Database } from "../client";
import { competitorBenchmarks } from "../schema";

export function competitorBenchmarkQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      competitorDomain: string;
      overallScore: number | null;
      technicalScore: number | null;
      contentScore: number | null;
      aiReadinessScore: number | null;
      performanceScore: number | null;
      letterGrade: string | null;
      issueCount: number;
      topIssues: string[];
    }) {
      const [benchmark] = await db
        .insert(competitorBenchmarks)
        .values(data)
        .returning();
      return benchmark;
    },

    async listByProject(projectId: string, limit = 50, offset = 0) {
      return db.query.competitorBenchmarks.findMany({
        where: eq(competitorBenchmarks.projectId, projectId),
        orderBy: [desc(competitorBenchmarks.crawledAt)],
        limit,
        offset,
      });
    },

    async getLatest(projectId: string, domain: string) {
      return db.query.competitorBenchmarks.findFirst({
        where: and(
          eq(competitorBenchmarks.projectId, projectId),
          eq(competitorBenchmarks.competitorDomain, domain),
        ),
        orderBy: [desc(competitorBenchmarks.crawledAt)],
      });
    },
  };
}
