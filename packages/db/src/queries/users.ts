import { eq, sql } from "drizzle-orm";
import type { Database } from "../client";
import { users, planEnum } from "../schema";

type Plan = (typeof planEnum.enumValues)[number];

export function userQueries(db: Database) {
  return {
    async getById(id: string) {
      return db.query.users.findFirst({ where: eq(users.id, id) });
    },

    async getByEmail(email: string) {
      return db.query.users.findFirst({ where: eq(users.email, email) });
    },

    async getByClerkId(clerkId: string) {
      return db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
    },

    async upsertFromClerk(clerkId: string, email: string, name?: string) {
      const existing = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (existing) return existing;
      const [user] = await db
        .insert(users)
        .values({ clerkId, email, name: name ?? null })
        .returning();
      return user;
    },

    async create(data: { email: string; name?: string; avatarUrl?: string }) {
      const [user] = await db.insert(users).values(data).returning();
      return user;
    },

    async updateProfile(id: string, data: { name?: string; phone?: string }) {
      const [updated] = await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return updated;
    },

    async updatePlan(id: string, plan: Plan, stripeSubId?: string) {
      await db
        .update(users)
        .set({ plan, stripeSubId, updatedAt: new Date() })
        .where(eq(users.id, id));
    },

    async decrementCrawlCredits(id: string) {
      const user = await db.query.users.findFirst({ where: eq(users.id, id) });
      if (!user || user.crawlCreditsRemaining <= 0) return false;
      await db
        .update(users)
        .set({
          crawlCreditsRemaining: sql`${users.crawlCreditsRemaining} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));
      return true;
    },
  };
}
