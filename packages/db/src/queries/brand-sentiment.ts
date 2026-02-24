import { eq, desc } from "drizzle-orm";
import type { Database } from "../client";
import { brandSentimentSnapshots } from "../schema";

export function brandSentimentQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      period: string;
      overallSentiment?: string | null;
      sentimentScore?: number | null;
      keyAttributes?: unknown;
      brandNarrative?: string | null;
      strengthTopics?: unknown;
      weaknessTopics?: unknown;
      providerBreakdown?: unknown;
      sampleSize: number;
    }) {
      const [row] = await db
        .insert(brandSentimentSnapshots)
        .values(data)
        .returning();
      return row;
    },

    async getLatest(projectId: string) {
      return db.query.brandSentimentSnapshots.findFirst({
        where: eq(brandSentimentSnapshots.projectId, projectId),
        orderBy: [desc(brandSentimentSnapshots.createdAt)],
      });
    },

    async getHistory(projectId: string, limit = 12) {
      return db.query.brandSentimentSnapshots.findMany({
        where: eq(brandSentimentSnapshots.projectId, projectId),
        orderBy: [desc(brandSentimentSnapshots.createdAt)],
        limit,
      });
    },
  };
}
