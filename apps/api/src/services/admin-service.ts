import type { AdminRepository } from "@llm-boost/repositories";
import { userQueries, billingQueries, type Database } from "@llm-boost/db";
import { StripeGateway } from "@llm-boost/billing";
import { ServiceError } from "@llm-boost/shared";

export interface AdminServiceDeps {
  admin: AdminRepository;
}

export function createAdminService(deps: AdminServiceDeps) {
  return {
    getStats() {
      return deps.admin.getStats();
    },

    getCustomers(args: { page?: number; limit?: number; search?: string }) {
      return deps.admin.getCustomers(args);
    },

    async getCustomerDetail(id: string) {
      const detail = await deps.admin.getCustomerDetail(id);
      if (!detail) {
        throw new ServiceError("NOT_FOUND", 404, "Customer not found");
      }
      return detail;
    },

    getIngestDetails() {
      return deps.admin.getIngestDetails();
    },

    async retryCrawlJob(jobId: string, adminId: string) {
      const updated = await deps.admin.retryCrawlJob(jobId);
      if (!updated) {
        throw new ServiceError("NOT_FOUND", 404, "Crawl job not found");
      }
      await deps.admin.recordAction({
        actorId: adminId,
        action: "retry_crawl_job",
        targetType: "crawl_job",
        targetId: jobId,
      });
      return updated;
    },

    async replayOutboxEvent(eventId: string, adminId: string) {
      const updated = await deps.admin.replayOutboxEvent(eventId);
      if (!updated) {
        throw new ServiceError("NOT_FOUND", 404, "Outbox event not found");
      }
      await deps.admin.recordAction({
        actorId: adminId,
        action: "replay_outbox_event",
        targetType: "outbox_event",
        targetId: eventId,
      });
      return updated;
    },

    async cancelCrawlJob(jobId: string, reason: string, adminId: string) {
      const updated = await deps.admin.cancelCrawlJob(jobId, reason, adminId);
      if (!updated) {
        throw new ServiceError("NOT_FOUND", 404, "Crawl job not found");
      }
      await deps.admin.recordAction({
        actorId: adminId,
        action: "cancel_crawl_job",
        targetType: "crawl_job",
        targetId: jobId,
        reason,
      });
      return updated;
    },

    recordAction(args: {
      actorId: string;
      action: string;
      targetType: string;
      targetId: string;
      reason?: string;
    }) {
      return deps.admin.recordAction(args);
    },

    async blockUser(args: {
      targetId: string;
      adminId: string;
      reason?: string;
      stripeSecretKey: string;
      db: Database;
    }) {
      const usersQ = userQueries(args.db);
      const user = await usersQ.getById(args.targetId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      // Cancel Stripe subscription if exists
      const billing = billingQueries(args.db);
      const sub = await billing.getActiveSubscription(args.targetId);
      if (sub?.stripeSubscriptionId) {
        const gateway = new StripeGateway(args.stripeSecretKey);
        await gateway.cancelImmediately(sub.stripeSubscriptionId);
        await billing.cancelSubscription(sub.stripeSubscriptionId, new Date());
        await usersQ.updatePlan(args.targetId, "free", undefined);
      }

      await usersQ.updateStatus(args.targetId, "banned", args.reason);
      await deps.admin.recordAction({
        actorId: args.adminId,
        action: "block_user",
        targetType: "user",
        targetId: args.targetId,
        reason: args.reason,
      });
      return { blocked: true };
    },

    async suspendUser(args: {
      targetId: string;
      adminId: string;
      reason?: string;
      stripeSecretKey: string;
      db: Database;
    }) {
      const usersQ = userQueries(args.db);
      const user = await usersQ.getById(args.targetId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      const billing = billingQueries(args.db);
      const sub = await billing.getActiveSubscription(args.targetId);
      if (sub?.stripeSubscriptionId) {
        const gateway = new StripeGateway(args.stripeSecretKey);
        await gateway.cancelImmediately(sub.stripeSubscriptionId);
        await billing.cancelSubscription(sub.stripeSubscriptionId, new Date());
        await usersQ.updatePlan(args.targetId, "free", undefined);
      }

      await usersQ.updateStatus(args.targetId, "suspended", args.reason);
      await deps.admin.recordAction({
        actorId: args.adminId,
        action: "suspend_user",
        targetType: "user",
        targetId: args.targetId,
        reason: args.reason,
      });
      return { suspended: true };
    },

    async unblockUser(args: {
      targetId: string;
      adminId: string;
      db: Database;
    }) {
      const usersQ = userQueries(args.db);
      const user = await usersQ.getById(args.targetId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      await usersQ.updateStatus(args.targetId, "active");
      await deps.admin.recordAction({
        actorId: args.adminId,
        action: "unblock_user",
        targetType: "user",
        targetId: args.targetId,
      });
      return { unblocked: true };
    },

    async changeUserPlan(args: {
      targetId: string;
      adminId: string;
      plan: string;
      stripeSecretKey: string;
      db: Database;
    }) {
      const usersQ = userQueries(args.db);
      const user = await usersQ.getById(args.targetId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      await usersQ.updatePlan(
        args.targetId,
        args.plan as "free" | "starter" | "pro" | "agency",
        user.stripeSubId ?? undefined,
      );
      await deps.admin.recordAction({
        actorId: args.adminId,
        action: "change_plan",
        targetType: "user",
        targetId: args.targetId,
        reason: `Changed plan to ${args.plan}`,
      });
      return { plan: args.plan };
    },

    async cancelUserSubscription(args: {
      targetId: string;
      adminId: string;
      stripeSecretKey: string;
      db: Database;
    }) {
      const usersQ = userQueries(args.db);
      const billing = billingQueries(args.db);
      const sub = await billing.getActiveSubscription(args.targetId);

      if (sub?.stripeSubscriptionId) {
        const gateway = new StripeGateway(args.stripeSecretKey);
        await gateway.cancelImmediately(sub.stripeSubscriptionId);
        await billing.cancelSubscription(sub.stripeSubscriptionId, new Date());
      }

      await usersQ.updatePlan(args.targetId, "free", undefined);
      await deps.admin.recordAction({
        actorId: args.adminId,
        action: "cancel_subscription",
        targetType: "user",
        targetId: args.targetId,
      });
      return { canceled: true };
    },
  };
}
