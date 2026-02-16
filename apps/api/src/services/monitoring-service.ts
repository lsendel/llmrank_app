import { type Database, crawlJobs } from "@llm-boost/db";
import { and, count, eq, inArray, lt, sql } from "drizzle-orm";
import { createLogger } from "../lib/logger";
import { NotificationService } from "./notification-service";

interface KVLike {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

export interface MonitoringService {
  checkSystemHealth(): Promise<void>;
  checkCrawlerHealth(crawlerUrl: string, kv: KVLike): Promise<void>;
  getSystemMetrics(): Promise<Record<string, unknown>>;
}

export function createMonitoringService(
  db: Database,
  _notifier: NotificationService,
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
            inArray(crawlJobs.status, ["crawling", "scoring"]),
            lt(crawlJobs.createdAt, oneHourAgo),
          ),
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
            })
            .where(eq(crawlJobs.id, job.id));

          // In a real app, notify admin via Slack/PagerDuty here
          log.error("CRITICAL: Crawl Stalled", { jobId: job.id });
        }
      }
    },

    async checkCrawlerHealth(crawlerUrl: string, kv: KVLike) {
      const start = Date.now();
      let status: "up" | "down";
      let error: string | undefined;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5_000);

        const response = await fetch(`${crawlerUrl}/api/v1/health`, {
          signal: controller.signal,
        });

        clearTimeout(timer);
        status = response.ok ? "up" : "down";
        if (!response.ok) {
          error = `HTTP ${response.status}`;
        }
      } catch (err) {
        status = "down";
        error = err instanceof Error ? err.message : "Unknown error";
      }

      const latencyMs = Date.now() - start;
      const entry = {
        status,
        latencyMs,
        error,
        checkedAt: new Date().toISOString(),
      };

      // Store latest
      await kv.put("crawler:health:latest", JSON.stringify(entry), {
        expirationTtl: 3600,
      });

      // Append to rolling history (last 50 checks)
      const historyRaw = await kv.get("crawler:health:history");
      const history: (typeof entry)[] = historyRaw
        ? JSON.parse(historyRaw)
        : [];
      history.push(entry);
      if (history.length > 50) history.splice(0, history.length - 50);
      await kv.put("crawler:health:history", JSON.stringify(history), {
        expirationTtl: 86400,
      });

      // Log warnings
      if (status === "down") {
        const recentDownCount = history
          .slice(-3)
          .filter((h) => h.status === "down").length;
        if (recentDownCount >= 3) {
          log.error("CRITICAL: Crawler down for 3+ consecutive checks", {
            crawlerUrl,
            error,
          });
        } else {
          log.warn("Crawler health check failed", {
            crawlerUrl,
            error,
            latencyMs,
          });
        }
      } else {
        log.info("Crawler health check passed", { crawlerUrl, latencyMs });
      }
    },

    async getSystemMetrics() {
      const activeCount = await db
        .select({ count: count() })
        .from(crawlJobs)
        .where(inArray(crawlJobs.status, ["crawling", "scoring"]));

      const error24h = await db
        .select({ count: count() })
        .from(crawlJobs)
        .where(
          and(
            eq(crawlJobs.status, "failed"),
            sql`${crawlJobs.createdAt} >= now() - interval '24 hours'`,
          ),
        );

      return {
        activeCrawls: Number(activeCount[0]?.count ?? 0),
        errorsLast24h: Number(error24h[0]?.count ?? 0),
        systemTime: new Date().toISOString(),
      };
    },
  };
}
