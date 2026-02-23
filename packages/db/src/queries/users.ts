import { eq, and, sql } from "drizzle-orm";
import { PLAN_LIMITS } from "@llm-boost/shared";
import type { Database } from "../client";
import { users, planEnum, personaEnum } from "../schema";

type Plan = (typeof planEnum.enumValues)[number];
type Persona = (typeof personaEnum.enumValues)[number];

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
        .values({
          id: crypto.randomUUID(),
          clerkId,
          email,
          name: name ?? null,
        })
        .returning();
      return user;
    },

    async create(data: { email: string; name?: string; avatarUrl?: string }) {
      const [user] = await db
        .insert(users)
        .values({ ...data, id: crypto.randomUUID() })
        .returning();
      return user;
    },

    async updateProfile(
      id: string,
      data: {
        name?: string;
        phone?: string;
        onboardingComplete?: boolean;
        persona?: Persona;
        stripeCustomerId?: string;
      },
    ) {
      const [updated] = await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return updated;
    },

    async updatePlan(id: string, plan: Plan, stripeSubId?: string) {
      const limits = PLAN_LIMITS[plan];
      const crawlCreditsRemaining = Number.isFinite(limits.crawlsPerMonth)
        ? limits.crawlsPerMonth
        : 999999;
      await db
        .update(users)
        .set({ plan, stripeSubId, crawlCreditsRemaining, updatedAt: new Date() })
        .where(eq(users.id, id));
    },

    async decrementCrawlCredits(id: string) {
      const [updated] = await db
        .update(users)
        .set({
          crawlCreditsRemaining: sql`${users.crawlCreditsRemaining} - 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, id), sql`${users.crawlCreditsRemaining} > 0`))
        .returning({ remaining: users.crawlCreditsRemaining });
      return !!updated;
    },

    async updateNotifications(
      id: string,
      data: {
        notifyOnCrawlComplete?: boolean;
        notifyOnScoreDrop?: boolean;
        webhookUrl?: string | null;
      },
    ) {
      const [updated] = await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({
          notifyOnCrawlComplete: users.notifyOnCrawlComplete,
          notifyOnScoreDrop: users.notifyOnScoreDrop,
          webhookUrl: users.webhookUrl,
        });
      return updated;
    },

    async resetCrawlCreditsForPlan(plan: Plan, credits: number) {
      await db
        .update(users)
        .set({ crawlCreditsRemaining: credits, updatedAt: new Date() })
        .where(eq(users.plan, plan));
    },

    async startTrial(id: string, trialStartedAt: Date, trialEndsAt: Date) {
      const [updated] = await db
        .update(users)
        .set({ trialStartedAt, trialEndsAt, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return updated;
    },

    async updateStatus(
      id: string,
      status: "active" | "suspended" | "banned",
      reason?: string,
    ) {
      const [updated] = await db
        .update(users)
        .set({
          status,
          suspendedAt: status !== "active" ? new Date() : null,
          suspendedReason: reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      return updated;
    },
  };
}
