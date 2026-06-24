import { eq, and, desc } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { subscriptions, payments } from "../schema";

export function billingQueries(db: Database) {
  return {
    async getActiveSubscription(userId: string) {
      return db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "active"),
        ),
        orderBy: desc(subscriptions.createdAt),
      });
    },

    async getSubscriptionByStripeId(stripeSubscriptionId: string) {
      return db.query.subscriptions.findFirst({
        where: eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId),
      });
    },

    async createSubscription(data: {
      userId: string;
      planCode: string;
      status: "active" | "trialing" | "past_due" | "canceled";
      stripeSubscriptionId: string;
      stripeCustomerId: string;
    }) {
      const [sub] = await db
        .insert(subscriptions)
        .values({ ...data, id: crypto.randomUUID() })
        .returning();
      return sub;
    },

    async updateSubscriptionPeriod(
      stripeSubscriptionId: string,
      periodStart: Date,
      periodEnd: Date,
    ) {
      const [sub] = await db
        .update(subscriptions)
        .set({
          currentPeriodStart: periodStart.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
          status: "active",
        })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .returning();
      return sub;
    },

    async updateSubscriptionStatus(
      stripeSubscriptionId: string,
      status: "active" | "trialing" | "past_due" | "canceled",
    ) {
      const [sub] = await db
        .update(subscriptions)
        .set({ status })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .returning();
      return sub;
    },

    async cancelSubscription(stripeSubscriptionId: string, canceledAt: Date) {
      const [sub] = await db
        .update(subscriptions)
        .set({
          status: "canceled",
          canceledAt: canceledAt.toISOString(),
          cancelAtPeriodEnd: false,
        })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .returning();
      return sub;
    },

    async markCancelAtPeriodEnd(stripeSubscriptionId: string) {
      const [sub] = await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true, canceledAt: new Date().toISOString() })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .returning();
      return sub;
    },

    async getPaymentByInvoiceId(stripeInvoiceId: string) {
      return db.query.payments.findFirst({
        where: eq(payments.stripeInvoiceId, stripeInvoiceId),
      });
    },

    async createPayment(data: {
      userId: string;
      subscriptionId?: string;
      stripeInvoiceId: string;
      amountCents: number;
      currency: string;
      status: "succeeded" | "pending" | "failed";
    }) {
      const [payment] = await db
        .insert(payments)
        .values({ ...data, id: crypto.randomUUID() })
        .returning();
      return payment;
    },

    async listPayments(userId: string, limit = 50) {
      return db.query.payments.findMany({
        where: eq(payments.userId, userId),
        orderBy: desc(payments.createdAt),
        limit,
      });
    },
  };
}
