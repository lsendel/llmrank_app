import { eq, desc } from "drizzle-orm";
import type { Database } from "../client";
import { scoringProfiles } from "../schema";

export function scoringProfileQueries(db: Database) {
  return {
    async create(data: typeof scoringProfiles.$inferInsert) {
      const [row] = await db.insert(scoringProfiles).values(data).returning();
      return row;
    },

    async listByUser(userId: string) {
      return db
        .select()
        .from(scoringProfiles)
        .where(eq(scoringProfiles.userId, userId))
        .orderBy(desc(scoringProfiles.createdAt));
    },

    async getById(id: string) {
      const [row] = await db
        .select()
        .from(scoringProfiles)
        .where(eq(scoringProfiles.id, id))
        .limit(1);
      return row ?? null;
    },

    async update(
      id: string,
      data: Partial<typeof scoringProfiles.$inferInsert>,
    ) {
      const [row] = await db
        .update(scoringProfiles)
        .set(data)
        .where(eq(scoringProfiles.id, id))
        .returning();
      return row;
    },

    async delete(id: string) {
      await db.delete(scoringProfiles).where(eq(scoringProfiles.id, id));
    },
  };
}
