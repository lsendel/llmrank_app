import { type Database, crawlJobs } from "@llm-boost/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { createLogger } from "../lib/logger";
import { NotificationService } from "./notification-service";

export interface MonitoringService {
  checkSystemHealth(): Promise<void>;
  getSystemMetrics(): Promise<Record<string, unknown>>;
}

export function createMonitoringService(
  db: Database,
  notifier: NotificationService,
): MonitoringService {
  const log = createLogger({ context: "monitoring-service" });

  return {
    async checkSystemHealth() {
      log.info("Running system health check...");

      // 1. Detect Stalled Crawls
      // Jobs in 'crawling' or 'scoring' for > 1 hour are likely stuck
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const stalledJobs = await db
        .select()
        .from(crawlJobs)
        .where(
          and(
            sql`${crawlJobs.status} IN ('crawling', 'scoring')`,
            sql`${crawlJobs.createdAt} < ${oneHourAgo.toISOString()}`,
          ) as any,
        );

      if (stalledJobs.length > 0) {
        log.warn(`Found ${stalledJobs.length} stalled crawl jobs.`);

        // Mark as failed and notify
        for (const job of stalledJobs) {
          await db
            .update(crawlJobs)
            .set({
              status: "failed",
              errorMessage: "Crawl stalled: No activity for > 1 hour",
            } as any)
            .where(sql`${crawlJobs.id} = ${job.id}` as any);

          // In a real app, notify admin via Slack/PagerDuty here
          log.error("CRITICAL: Crawl Stalled", { jobId: job.id });
        }
      }
    },

    async getSystemMetrics() {
      const activeCount = await db
        .select({ count: sql<number>`count(*)` as any })
        .from(crawlJobs)
        .where(
          and(
            sql`${crawlJobs.status} = 'crawling'`,
            sql`${crawlJobs.status} = 'scoring'`,
          ) as any,
        );

      const error24h = await db
        .select({ count: sql<number>`count(*)` as any })
        .from(crawlJobs)
        .where(
          and(
            sql`${crawlJobs.status} = 'failed'`,
            sql`${crawlJobs.createdAt} >= now() - interval '24 hours'`,
          ) as any,
        );

      return {
        activeCrawls: Number(activeCount[0]?.count ?? 0),
        errorsLast24h: Number(error24h[0]?.count ?? 0),
        systemTime: new Date().toISOString(),
      };
    },
  };
}
