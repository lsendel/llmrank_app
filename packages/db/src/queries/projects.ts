import { eq, and, isNull, desc } from "drizzle-orm";
import type { Database } from "../client";
import { projects } from "../schema";

export function projectQueries(db: Database) {
  return {
    async listByUser(userId: string) {
      return db.query.projects.findMany({
        where: and(eq(projects.userId, userId), isNull(projects.deletedAt)),
        orderBy: [desc(projects.createdAt)],
      });
    },

    async getById(id: string) {
      return db.query.projects.findFirst({
        where: and(eq(projects.id, id), isNull(projects.deletedAt)),
      });
    },

    async create(data: {
      userId: string;
      name: string;
      domain: string;
      settings?: unknown;
    }) {
      const [project] = await db
        .insert(projects)
        .values({
          userId: data.userId,
          name: data.name,
          domain: data.domain,
          settings: data.settings ?? {},
        })
        .returning();
      return project;
    },

    async update(id: string, data: { name?: string; settings?: unknown }) {
      const [updated] = await db
        .update(projects)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
        .returning();
      return updated;
    },

    /** Soft delete — sets deletedAt rather than removing the row. */
    async delete(id: string) {
      await db
        .update(projects)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(projects.id, id));
    },
  };
}
