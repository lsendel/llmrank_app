import { PLAN_LIMITS, ERROR_CODES } from "@llm-boost/shared";
import type { BillingRepository, UserRepository } from "../repositories";
import { StripeGateway, priceIdFromPlanCode } from "@llm-boost/billing";
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
      });
    },

    async getUsage(userId: string) {
      const user = await deps.users.getById(userId);
      if (!user) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "User not found");
      }
      const limits = PLAN_LIMITS[user.plan];
      return {
        plan: user.plan,
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
