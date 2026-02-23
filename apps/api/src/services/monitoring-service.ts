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

export interface AlertConfig {
  adminEmail?: string;
  slackWebhookUrl?: string;
  resendApiKey?: string;
}

export interface MonitoringService {
  checkSystemHealth(): Promise<void>;
  checkCrawlerHealth(
    crawlerUrl: string,
    kv: KVLike,
    alertConfig?: AlertConfig,
  ): Promise<void>;
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

    async checkCrawlerHealth(
      crawlerUrl: string,
      kv: KVLike,
      alertConfig?: AlertConfig,
    ) {
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

      // Log warnings and send alerts
      if (status === "down") {
        const recentDownCount = history
          .slice(-3)
          .filter((h) => h.status === "down").length;
        if (recentDownCount >= 3) {
          log.error("CRITICAL: Crawler down for 3+ consecutive checks", {
            crawlerUrl,
            error,
          });

          // Send alert only once per outage (dedup via KV)
          const alreadySent = await kv.get("crawler:alert:sent");
          if (!alreadySent && alertConfig) {
            await sendCrawlerDownAlerts(alertConfig, crawlerUrl, error, log);
            await kv.put("crawler:alert:sent", "true", {
              expirationTtl: 3600,
            });
          }
        } else {
          log.warn("Crawler health check failed", {
            crawlerUrl,
            error,
            latencyMs,
          });
        }
      } else {
        log.info("Crawler health check passed", { crawlerUrl, latencyMs });

        // Clear alert dedup flag when crawler recovers
        const alertWasSent = await kv.get("crawler:alert:sent");
        if (alertWasSent) {
          await kv.put("crawler:alert:sent", "", { expirationTtl: 1 });
          // Send recovery notification
          if (alertConfig) {
            await sendCrawlerRecoveryAlerts(alertConfig, crawlerUrl, log);
          }
        }
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

// ---------------------------------------------------------------------------
// Alert Helpers
// ---------------------------------------------------------------------------

async function sendCrawlerDownAlerts(
  config: AlertConfig,
  crawlerUrl: string,
  error: string | undefined,
  log: ReturnType<typeof createLogger>,
) {
  const timestamp = new Date().toISOString();

  // Email via Resend
  if (config.adminEmail && config.resendApiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(config.resendApiKey);
      await resend.emails.send({
        from: "LLM Rank Alerts <alerts@llmboost.io>",
        to: [config.adminEmail],
        subject: "🚨 Crawler Service DOWN",
        html: `<h2>Crawler Service Alert</h2>
          <p><strong>Status:</strong> DOWN (3+ consecutive health check failures)</p>
          <p><strong>URL:</strong> ${crawlerUrl}</p>
          <p><strong>Error:</strong> ${error ?? "Unknown"}</p>
          <p><strong>Time:</strong> ${timestamp}</p>
          <p>Check Fly.io dashboard: <a href="https://fly.io/apps/llmrank-crawler/monitoring">Monitoring</a></p>`,
      });
    } catch (err) {
      log.error("Failed to send crawler down email alert", {
        error: String(err),
      });
    }
  }

  // Slack webhook
  if (config.slackWebhookUrl) {
    try {
      await fetch(config.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🚨 Crawler Service DOWN",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Status:* DOWN (3+ consecutive failures)\n*URL:* ${crawlerUrl}\n*Error:* ${error ?? "Unknown"}\n*Time:* ${timestamp}\n\n<https://fly.io/apps/llmrank-crawler/monitoring|View Fly.io Dashboard>`,
              },
            },
          ],
        }),
      });
    } catch (err) {
      log.error("Failed to send crawler down Slack alert", {
        error: String(err),
      });
    }
  }
}

async function sendCrawlerRecoveryAlerts(
  config: AlertConfig,
  crawlerUrl: string,
  log: ReturnType<typeof createLogger>,
) {
  const timestamp = new Date().toISOString();

  if (config.adminEmail && config.resendApiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(config.resendApiKey);
      await resend.emails.send({
        from: "LLM Rank Alerts <alerts@llmboost.io>",
        to: [config.adminEmail],
        subject: "✅ Crawler Service RECOVERED",
        html: `<h2>Crawler Service Recovered</h2>
          <p><strong>Status:</strong> UP</p>
          <p><strong>URL:</strong> ${crawlerUrl}</p>
          <p><strong>Time:</strong> ${timestamp}</p>`,
      });
    } catch (err) {
      log.error("Failed to send crawler recovery email", {
        error: String(err),
      });
    }
  }

  if (config.slackWebhookUrl) {
    try {
      await fetch(config.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "✅ Crawler Service RECOVERED",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Status:* UP\n*URL:* ${crawlerUrl}\n*Time:* ${timestamp}`,
              },
            },
          ],
        }),
      });
    } catch (err) {
      log.error("Failed to send crawler recovery Slack alert", {
        error: String(err),
      });
    }
  }
}
