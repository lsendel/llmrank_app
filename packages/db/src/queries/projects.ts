import { eq, and, isNull, desc, asc, sql, ilike, or } from "drizzle-orm";
import type { Database } from "../client";
import { projects } from "../schema";

export interface ProjectListQuery {
  q?: string;
  sort?:
    | "activity_desc"
    | "score_desc"
    | "score_asc"
    | "name_asc"
    | "name_desc"
    | "created_desc"
    | "created_asc";
  limit?: number;
  offset?: number;
}

export function projectQueries(db: Database) {
  function listWhere(userId: string, query?: ProjectListQuery) {
    const base = [eq(projects.userId, userId), isNull(projects.deletedAt)];
    const q = query?.q?.trim();
    if (!q) return and(...base);
    const pattern = `%${q}%`;
    return and(
      ...base,
      or(ilike(projects.name, pattern), ilike(projects.domain, pattern)),
    );
  }

  function listOrderBy(sort: ProjectListQuery["sort"]) {
    switch (sort) {
      case "name_asc":
        return [asc(projects.name), desc(projects.createdAt)];
      case "name_desc":
        return [desc(projects.name), desc(projects.createdAt)];
      case "created_asc":
        return [asc(projects.createdAt)];
      case "created_desc":
      case "activity_desc":
      case "score_desc":
      case "score_asc":
      default:
        return [desc(projects.createdAt)];
    }
  }

  return {
    async listByUser(userId: string, query?: ProjectListQuery) {
      return db.query.projects.findMany({
        where: listWhere(userId, query),
        orderBy: listOrderBy(query?.sort),
        ...(query?.limit !== undefined ? { limit: query.limit } : {}),
        ...(query?.offset !== undefined ? { offset: query.offset } : {}),
      });
    },

    async countByUser(userId: string, query?: Pick<ProjectListQuery, "q">) {
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(listWhere(userId, query));
      return Number(row?.count ?? 0);
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

    async update(
      id: string,
      data: {
        name?: string;
        settings?: unknown;
        branding?: unknown;
        scoringProfileId?: string | null;
        siteDescription?: string | null;
        industry?: string | null;
        pipelineSettings?: unknown;
        siteDescriptionSource?: string;
        industrySource?: string;
      },
    ) {
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

    async getDueForCrawl(limit = 10) {
      return db.query.projects.findMany({
        where: and(
          isNull(projects.deletedAt),
          sql`${projects.nextCrawlAt} <= now()`,
          sql`${projects.crawlSchedule} != 'manual'`,
        ),
        limit,
        with: {
          user: true,
        },
      });
    },

    async updateNextCrawl(id: string, nextAt: Date) {
      await db
        .update(projects)
        .set({ nextCrawlAt: nextAt })
        .where(eq(projects.id, id));
    },
  };
}
