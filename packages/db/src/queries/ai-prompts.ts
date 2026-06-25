import { eq, and, desc, sql } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { aiPrompts } from "../schema";
import { chunkForD1Insert } from "./d1-batch";

export function aiPromptQueries(db: Database) {
  return {
    async create(
      data: {
        projectId: string;
        prompt: string;
        category?: string | null;
        estimatedVolume?: number | null;
        difficulty?: number | null;
        intent?: string | null;
        yourMentioned?: boolean;
        competitorsMentioned?: unknown;
        source?: string;
      }[],
    ) {
      if (data.length === 0) return [];
      const rows = data.map((d) => ({
        ...d,
        id: crypto.randomUUID(),
        competitorsMentioned:
          d.competitorsMentioned != null
            ? typeof d.competitorsMentioned === "string"
              ? d.competitorsMentioned
              : JSON.stringify(d.competitorsMentioned)
            : undefined,
      }));
      const results = await Promise.all(
        chunkForD1Insert(rows, aiPrompts).map((chunk) =>
          db.insert(aiPrompts).values(chunk).returning(),
        ),
      );
      return results.flat();
    },

    async listByProject(
      projectId: string,
      opts?: { limit?: number; offset?: number },
    ) {
      return db.query.aiPrompts.findMany({
        where: eq(aiPrompts.projectId, projectId),
        orderBy: [desc(aiPrompts.estimatedVolume)],
        limit: opts?.limit ?? 100,
        offset: opts?.offset ?? 0,
      });
    },

    async getById(projectId: string, promptId: string) {
      return db.query.aiPrompts.findFirst({
        where: and(
          eq(aiPrompts.projectId, projectId),
          eq(aiPrompts.id, promptId),
        ),
      });
    },

    async countByProject(projectId: string) {
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(aiPrompts)
        .where(eq(aiPrompts.projectId, projectId));
      return row?.count ?? 0;
    },

    async deleteById(id: string, projectId: string) {
      return db
        .delete(aiPrompts)
        .where(and(eq(aiPrompts.id, id), eq(aiPrompts.projectId, projectId)));
    },

    async updateTracking(
      id: string,
      projectId: string,
      data: {
        yourMentioned?: boolean;
        competitorsMentioned?: unknown;
      },
    ) {
      const setData: Record<string, unknown> = {};
      if (data.yourMentioned !== undefined)
        setData.yourMentioned = data.yourMentioned;
      if (data.competitorsMentioned !== undefined)
        setData.competitorsMentioned =
          typeof data.competitorsMentioned === "string"
            ? data.competitorsMentioned
            : JSON.stringify(data.competitorsMentioned);
      const [row] = await db
        .update(aiPrompts)
        .set(setData)
        .where(and(eq(aiPrompts.id, id), eq(aiPrompts.projectId, projectId)))
        .returning();
      return row ?? null;
    },

    async deleteAllByProject(projectId: string) {
      return db.delete(aiPrompts).where(eq(aiPrompts.projectId, projectId));
    },
  };
}
