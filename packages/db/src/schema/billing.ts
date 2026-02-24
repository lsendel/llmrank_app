import { pgTable, pgEnum, text, integer, real, boolean, timestamp, jsonb, index, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { subscriptionStatusEnum, paymentStatusEnum, discountTypeEnum, promoDurationEnum } from "./enums";
import { users } from "./identity";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planCode: text("plan_code").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripeCustomerId: text("stripe_customer_id"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_subscriptions_user").on(t.userId),
    index("idx_subscriptions_stripe").on(t.stripeSubscriptionId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
    stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: paymentStatusEnum("status").notNull().default("succeeded"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_payments_user").on(t.userId),
    index("idx_payments_subscription").on(t.subscriptionId),
  ],
);

export const promos = pgTable(
  "promos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    stripeCouponId: text("stripe_coupon_id").notNull(),
    stripePromotionCodeId: text("stripe_promotion_code_id"),
    discountType: discountTypeEnum("discount_type").notNull(),
    discountValue: integer("discount_value").notNull(),
    duration: promoDurationEnum("duration").notNull(),
    durationMonths: integer("duration_months"),
    maxRedemptions: integer("max_redemptions"),
    timesRedeemed: integer("times_redeemed").notNull().default(0),
    expiresAt: timestamp("expires_at"),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_promos_code").on(t.code),
    index("idx_promos_active").on(t.active),
  ],
);

export const planPriceHistory = pgTable(
  "plan_price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planCode: text("plan_code").notNull(),
    oldPriceCents: integer("old_price_cents").notNull(),
    newPriceCents: integer("new_price_cents").notNull(),
    changedBy: text("changed_by").references(() => users.id),
    reason: text("reason"),
    changedAt: timestamp("changed_at").notNull().defaultNow(),
  },
  (t) => [index("idx_price_history_plan").on(t.planCode)],
);

