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

    async create(data: { email: string; name?: string; avatarUrl?: string }) {
      const [user] = await db.insert(users).values(data).returning();
      return user;
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
