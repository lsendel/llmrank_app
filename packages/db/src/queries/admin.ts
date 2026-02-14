import {
  eq,
  sql,
  and,
  or,
  ilike,
  desc,
  count,
  countDistinct,
  inArray,
  gt,
} from "drizzle-orm";
import type { Database } from "../client";
import {
  users,
  subscriptions,
  payments,
  crawlJobs,
  outboxEvents,
  projects,
  adminAuditLogs,
} from "../schema";

const PLAN_PRICE_CENTS: Record<string, number> = {
  free: 0,
  starter: 7900,
  pro: 14900,
  agency: 29900,
};

export function adminQueries(db: Database) {
  return {
    async getStats() {
      // MRR: count active subscriptions by plan, multiply by price
      const mrrResult = await db
        .select({
          planCode: subscriptions.planCode,
          count: count(),
        })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"))
        .groupBy(subscriptions.planCode);

      let totalMrrCents = 0;
      const mrrByPlan: Record<string, number> = {};
      for (const row of mrrResult) {
        const priceCents = PLAN_PRICE_CENTS[row.planCode] ?? 0;
        const planMrr = priceCents * row.count;
        totalMrrCents += planMrr;
        mrrByPlan[row.planCode] = planMrr / 100;
      }

      const [activeResult] = await db
        .select({ value: countDistinct(subscriptions.userId) })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"));

      const [totalResult] = await db.select({ value: count() }).from(users);

      const [churningResult] = await db
        .select({ value: count() })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.cancelAtPeriodEnd, true),
            eq(subscriptions.status, "active"),
          ),
        );

      const activeSubs = activeResult?.value ?? 0;
      const churning = churningResult?.value ?? 0;
      const churnRate = activeSubs > 0 ? (churning / activeSubs) * 100 : 0;

      const [revenueResult] = await db
        .select({
          value: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
        })
        .from(payments)
        .where(eq(payments.status, "succeeded"));

      const [failedResult] = await db
        .select({ value: count() })
        .from(payments)
        .where(eq(payments.status, "failed"));

      const recentWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [pendingJobsResult] = await db
        .select({ value: count() })
        .from(crawlJobs)
        .where(inArray(crawlJobs.status, ["pending", "queued"]));

      const [runningJobsResult] = await db
        .select({ value: count() })
        .from(crawlJobs)
        .where(inArray(crawlJobs.status, ["crawling", "scoring"]));

      const [failedJobsResult] = await db
        .select({ value: count() })
        .from(crawlJobs)
        .where(
          and(
            eq(crawlJobs.status, "failed"),
            gt(crawlJobs.createdAt, recentWindow),
          ),
        );

      const [avgDurationResult] = await db
        .select({
          value: sql<number>`coalesce(avg(extract(epoch from ${crawlJobs.completedAt} - ${crawlJobs.startedAt})), 0)`,
        })
        .from(crawlJobs)
        .where(
          and(
            eq(crawlJobs.status, "complete"),
            gt(crawlJobs.completedAt, recentWindow),
            sql`${crawlJobs.startedAt} IS NOT NULL`,
            sql`${crawlJobs.completedAt} IS NOT NULL`,
          ),
        );

      const [outboxPendingResult] = await db
        .select({ value: count() })
        .from(outboxEvents)
        .where(eq(outboxEvents.status, "pending"));

      return {
        mrr: totalMrrCents / 100,
        mrrByPlan,
        totalRevenue: (revenueResult?.value ?? 0) / 100,
        failedPayments: failedResult?.value ?? 0,
        activeSubscribers: activeSubs,
        totalCustomers: totalResult?.value ?? 0,
        churnRate: Math.round(churnRate * 100) / 100,
        ingestHealth: {
          pendingJobs: pendingJobsResult?.value ?? 0,
          runningJobs: runningJobsResult?.value ?? 0,
          failedLast24h: failedJobsResult?.value ?? 0,
          avgCompletionMinutes:
            Math.round(((avgDurationResult?.value ?? 0) / 60) * 100) / 100,
          outboxPending: outboxPendingResult?.value ?? 0,
        },
      };
    },

    async getCustomers(opts: {
      page?: number;
      limit?: number;
      search?: string;
    }) {
      const page = opts.page ?? 1;
      const limit = opts.limit ?? 25;
      const offset = (page - 1) * limit;

      const where = opts.search
        ? or(
            ilike(users.email, `%${opts.search}%`),
            ilike(users.name, `%${opts.search}%`),
          )
        : undefined;

      const customerRows = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          plan: users.plan,
          stripeCustomerId: users.stripeCustomerId,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      const [totalResult] = await db
        .select({ value: count() })
        .from(users)
        .where(where);

      return {
        data: customerRows,
        pagination: {
          page,
          limit,
          total: totalResult?.value ?? 0,
          totalPages: Math.ceil((totalResult?.value ?? 0) / limit),
        },
      };
    },

    async getCustomerDetail(userId: string) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!user) return null;

      const [subs, userPayments] = await Promise.all([
        db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
          .orderBy(desc(subscriptions.createdAt)),
        db
          .select()
          .from(payments)
          .where(eq(payments.userId, userId))
          .orderBy(desc(payments.createdAt))
          .limit(50),
      ]);

      return { user, subscriptions: subs, payments: userPayments };
    },

    async getIngestDetails() {
      const pendingJobs = await db
        .select({
          id: crawlJobs.id,
          projectId: crawlJobs.projectId,
          projectName: projects.name,
          status: crawlJobs.status,
          createdAt: crawlJobs.createdAt,
          startedAt: crawlJobs.startedAt,
          completedAt: crawlJobs.completedAt,
          errorMessage: crawlJobs.errorMessage,
          cancelledAt: crawlJobs.cancelledAt,
          cancelledBy: crawlJobs.cancelledBy,
          cancelReason: crawlJobs.cancelReason,
        })
        .from(crawlJobs)
        .leftJoin(projects, eq(crawlJobs.projectId, projects.id))
        .where(inArray(crawlJobs.status, ["pending", "queued"]))
        .orderBy(crawlJobs.createdAt)
        .limit(20);

      const runningJobs = await db
        .select({
          id: crawlJobs.id,
          projectId: crawlJobs.projectId,
          projectName: projects.name,
          status: crawlJobs.status,
          createdAt: crawlJobs.createdAt,
          startedAt: crawlJobs.startedAt,
          completedAt: crawlJobs.completedAt,
          errorMessage: crawlJobs.errorMessage,
          cancelledAt: crawlJobs.cancelledAt,
          cancelledBy: crawlJobs.cancelledBy,
          cancelReason: crawlJobs.cancelReason,
        })
        .from(crawlJobs)
        .leftJoin(projects, eq(crawlJobs.projectId, projects.id))
        .where(inArray(crawlJobs.status, ["crawling", "scoring"]))
        .orderBy(desc(crawlJobs.startedAt))
        .limit(20);

      const failedJobs = await db
        .select({
          id: crawlJobs.id,
          projectId: crawlJobs.projectId,
          projectName: projects.name,
          status: crawlJobs.status,
          createdAt: crawlJobs.createdAt,
          startedAt: crawlJobs.startedAt,
          completedAt: crawlJobs.completedAt,
          errorMessage: crawlJobs.errorMessage,
          cancelledAt: crawlJobs.cancelledAt,
          cancelledBy: crawlJobs.cancelledBy,
          cancelReason: crawlJobs.cancelReason,
        })
        .from(crawlJobs)
        .leftJoin(projects, eq(crawlJobs.projectId, projects.id))
        .where(eq(crawlJobs.status, "failed"))
        .orderBy(desc(crawlJobs.createdAt))
        .limit(20);

      const outboxPending = await db
        .select({
          id: outboxEvents.id,
          type: outboxEvents.type,
          attempts: outboxEvents.attempts,
          availableAt: outboxEvents.availableAt,
          createdAt: outboxEvents.createdAt,
        })
        .from(outboxEvents)
        .where(eq(outboxEvents.status, "pending"))
        .orderBy(outboxEvents.availableAt)
        .limit(20);

      return {
        pendingJobs,
        runningJobs,
        failedJobs,
        outboxEvents: outboxPending,
      };
    },

    async retryCrawlJob(jobId: string) {
      const [row] = await db
        .update(crawlJobs)
        .set({
          status: "pending",
          startedAt: null,
          completedAt: null,
          errorMessage: null,
          cancelledAt: null,
          cancelledBy: null,
          cancelReason: null,
        })
        .where(eq(crawlJobs.id, jobId))
        .returning({ id: crawlJobs.id, status: crawlJobs.status });
      return row ?? null;
    },

    async replayOutboxEvent(eventId: string) {
      const [row] = await db
        .update(outboxEvents)
        .set({ status: "pending", availableAt: sql`NOW()` })
        .where(eq(outboxEvents.id, eventId))
        .returning({ id: outboxEvents.id, status: outboxEvents.status });
      return row ?? null;
    },

    async cancelCrawlJob(jobId: string, reason: string, adminId: string) {
      const [row] = await db
        .update(crawlJobs)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: reason,
          cancelledAt: new Date(),
          cancelledBy: adminId,
          cancelReason: reason,
        })
        .where(eq(crawlJobs.id, jobId))
        .returning({ id: crawlJobs.id, status: crawlJobs.status });
      return row ?? null;
    },

    async recordAdminAction(args: {
      actorId: string;
      action: string;
      targetType: string;
      targetId: string;
      reason?: string;
    }) {
      await db.insert(adminAuditLogs).values({
        actorId: args.actorId,
        action: args.action,
        targetType: args.targetType,
        targetId: args.targetId,
        reason: args.reason,
      });
    },
  };
}
