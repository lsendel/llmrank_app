import { eq, lt } from "drizzle-orm";
import type { Database } from "../client";
import { scanResults } from "../schema";

export function scanResultQueries(db: Database) {
  return {
    async create(data: {
      domain: string;
      url: string;
      scores: Record<string, unknown>;
      issues: unknown[];
      quickWins: unknown[];
      ipHash?: string;
    }) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const [row] = await db
        .insert(scanResults)
        .values({ ...data, expiresAt })
        .returning();
      return row;
    },

    async getById(id: string) {
      const [row] = await db
        .select()
        .from(scanResults)
        .where(eq(scanResults.id, id));
      return row ?? null;
    },

    async deleteExpired() {
      const result = await db
        .delete(scanResults)
        .where(lt(scanResults.expiresAt, new Date()))
        .returning({ id: scanResults.id });
      return result.length;
    },
  };
}
