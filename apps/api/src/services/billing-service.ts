import {
  PLAN_LIMITS,
  ERROR_CODES,
  resolveEffectivePlan,
} from "@llm-boost/shared";
import type { BillingRepository, UserRepository } from "../repositories";
import { StripeGateway, priceIdFromPlanCode } from "@llm-boost/billing";
import { promoQueries } from "@llm-boost/db";
import type { Database } from "@llm-boost/db";
import { ServiceError } from "./errors";

export interface BillingServiceDeps {
  billing: BillingRepository;
  users: UserRepository;
}

export function createBillingService(deps: BillingServiceDeps) {
  return {
    async checkout(args: {
      userId: string;
      plan: string;
      successUrl: string;
      cancelUrl: string;
      stripeSecretKey: string;
      promoCode?: string;
      db?: Database;
    }) {
      const user = await deps.users.getById(args.userId);
      if (!user) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "User not found");
      }
      const priceId = priceIdFromPlanCode(args.plan);
      if (!priceId) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          422,
          `Invalid plan: ${args.plan}`,
        );
      }

      let promotionCodeId: string | undefined;
      if (args.promoCode && args.db) {
        const promo = await promoQueries(args.db).getByCode(args.promoCode);
        if (promo?.stripePromotionCodeId) {
          promotionCodeId = promo.stripePromotionCodeId;
        }
      }

      const gateway = new StripeGateway(args.stripeSecretKey);
      const customerId = await gateway.ensureCustomer(
        user.email,
        args.userId,
        user.stripeCustomerId ?? undefined,
      );
      return gateway.createCheckoutSession({
        customerId,
        priceId,
        userId: args.userId,
        planCode: args.plan,
        successUrl: args.successUrl,
        cancelUrl: args.cancelUrl,
        promotionCodeId,
      });
    },

    async getUsage(userId: string) {
      const user = await deps.users.getById(userId);
      if (!user) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "User not found");
      }
      const effectivePlan = resolveEffectivePlan(user);
      const limits = PLAN_LIMITS[effectivePlan];
      return {
        plan: user.plan,
        effectivePlan,
        crawlCreditsRemaining: user.crawlCreditsRemaining,
        crawlCreditsTotal: limits.crawlsPerMonth,
        maxPagesPerCrawl: limits.pagesPerCrawl,
        maxDepth: limits.maxCrawlDepth,
        maxProjects: limits.projects,
      };
    },

    getSubscription(userId: string) {
      return deps.billing.getActiveSubscription(userId);
    },

    listPayments(userId: string) {
      return deps.billing.listPayments(userId);
    },

    async cancelAtPeriodEnd(userId: string, stripeSecretKey: string) {
      const subscription = await deps.billing.getActiveSubscription(userId);
      if (!subscription?.stripeSubscriptionId) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          422,
          "No active subscription",
        );
      }
      const gateway = new StripeGateway(stripeSecretKey);
      await gateway.cancelAtPeriodEnd(subscription.stripeSubscriptionId);
      await deps.billing.markCancelAtPeriodEnd(
        subscription.stripeSubscriptionId,
      );
      return { canceled: true };
    },

    async downgrade(args: {
      userId: string;
      targetPlan: string;
      stripeSecretKey: string;
    }) {
      const user = await deps.users.getById(args.userId);
      if (!user) {
        throw new ServiceError("NOT_FOUND", 404, "User not found");
      }

      const subscription = await deps.billing.getActiveSubscription(
        args.userId,
      );

      // No Stripe subscription — just update the plan directly
      if (!subscription?.stripeSubscriptionId) {
        await deps.users.updatePlan(args.userId, args.targetPlan);
        return { downgraded: true, targetPlan: args.targetPlan };
      }

      // Downgrade to free = cancel subscription
      if (args.targetPlan === "free") {
        return this.cancelAtPeriodEnd(args.userId, args.stripeSecretKey);
      }

      const targetPriceId = priceIdFromPlanCode(args.targetPlan);
      if (!targetPriceId) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          422,
          `Invalid plan: ${args.targetPlan}`,
        );
      }

      const gateway = new StripeGateway(args.stripeSecretKey);
      const stripeSub = await gateway.getSubscription(
        subscription.stripeSubscriptionId,
      );
      const itemId = stripeSub.items.data[0]?.id;
      if (!itemId) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          422,
          "Subscription has no items",
        );
      }

      await gateway.updateSubscriptionPrice(
        subscription.stripeSubscriptionId,
        itemId,
        targetPriceId,
      );

      return { downgraded: true, targetPlan: args.targetPlan };
    },

    async validatePromo(code: string, db: Database) {
      const promo = await promoQueries(db).getByCode(code);
      if (!promo) {
        throw new ServiceError("NOT_FOUND", 404, "Promo code not found");
      }
      if (promo.expiresAt && promo.expiresAt < new Date()) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          422,
          "Promo code has expired",
        );
      }
      if (promo.maxRedemptions && promo.timesRedeemed >= promo.maxRedemptions) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          422,
          "Promo code has reached maximum redemptions",
        );
      }
      return {
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        duration: promo.duration,
        durationMonths: promo.durationMonths,
      };
    },

    async portal(userId: string, returnUrl: string, stripeSecretKey: string) {
      const user = await deps.users.getById(userId);
      if (!user?.stripeCustomerId) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          422,
          "No active subscription found",
        );
      }
      const gateway = new StripeGateway(stripeSecretKey);
      const url = await gateway.createPortalSession(
        user.stripeCustomerId,
        returnUrl,
      );
      return { url };
    },
  };
}
