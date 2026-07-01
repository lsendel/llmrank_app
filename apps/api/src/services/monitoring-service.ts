import { type Database, crawlJobs } from "@llm-boost/db";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { createLogger } from "@llm-boost/shared";
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
  checkLlmScorePopulation(kv: KVLike): Promise<void>;
  getSystemMetrics(): Promise<Record<string, unknown>>;
}

// --- LLM content-score population watchdog tunables ------------------------
// Detects the #108-class silent breakage where `llmContentScores` stopped being
// written (dropped ~100%→1% for a day, quietly inflating content_score). We
// self-baseline off a KV rolling history rather than a hard threshold, because
// the *steady-state* population rate depends on the plan mix (only paid top-N
// pages get LLM-scored). A sudden collapse relative to that baseline is the tell.
const LLM_POP_WINDOW_HOURS = 24; // completed-crawl window we sample each run
const LLM_POP_MIN_SCORED = 20; // ignore low-volume windows (too noisy to judge)
const LLM_POP_MIN_HISTORY = 3; // need this many prior samples to have a baseline
const LLM_POP_BASELINE_MIN = 0.2; // only alert if LLM scoring was historically real
const LLM_POP_DROP_FACTOR = 0.25; // alert when current < 25% of the trailing median
const LLM_POP_HISTORY_MAX = 30; // rolling samples retained in KV

interface LlmPopSample {
  checkedAt: string;
  totalScored: number;
  populated: number;
  rate: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function createMonitoringService(
  db: Database,
  _notifier: NotificationService,
): MonitoringService {
  const log = createLogger({ context: "monitoring-service" });

  return {
    async checkSystemHealth() {
      log.info("Running system health check...");

      // 1. Detect Stalled Crawls (6h backstop)
      // Primary recovery is crawl-service.recoverStalledCrawls, which re-dispatches
      // jobs gone silent for ~30m. This is the absolute backstop for jobs that
      // recovery can't handle (e.g. no crawler URL configured, or re-dispatch
      // itself failing). Detection is activity-based off updatedAt (bumped on
      // every ingest batch), so a job is only failed after 6h of true silence —
      // a large but healthy crawl (Agency tier: 2,000 pages + Lighthouse) keeps
      // bumping updatedAt and is never failed while still progressing.
      const stallThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000);

      const stalledJobs = await db
        .select()
        .from(crawlJobs)
        .where(
          and(
            inArray(crawlJobs.status, [
              "pending",
              "queued",
              "crawling",
              "scoring",
            ]),
            // COALESCE so deploy-window rows with a NULL updated_at (written by
            // old code before the new Worker shipped) are still reaped by age.
            // datetime() on both sides normalizes the mixed storage formats
            // (created_at `YYYY-MM-DD HH:MM:SS` vs updated_at/cutoff ISO) so the
            // comparison isn't a buggy lexical sort (' ' < 'T').
            sql`datetime(coalesce(${crawlJobs.updatedAt}, ${crawlJobs.createdAt})) < datetime(${stallThreshold.toISOString()})`,
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
              errorMessage:
                "Crawl stalled: no terminal state after 6 hours (likely crawler died without calling back)",
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

    async checkLlmScorePopulation(kv: KVLike) {
      // Fraction of freshly-scored pages that carry `llmContentScores`, over the
      // recent completed-crawl window. `json_extract(... '$.llmContentScores')`
      // is NULL when the LLM metric never wrote (the #108 breakage).
      const cutoff = new Date(
        Date.now() - LLM_POP_WINDOW_HOURS * 60 * 60 * 1000,
      ).toISOString();

      const rows = (await db.all(
        sql`
          SELECT
            COUNT(*) AS total,
            SUM(
              CASE WHEN json_extract(ps.detail, '$.llmContentScores') IS NOT NULL
                   THEN 1 ELSE 0 END
            ) AS populated
          FROM page_scores ps
          JOIN crawl_jobs cj ON cj.id = ps.job_id
          WHERE cj.status = 'complete'
            AND datetime(COALESCE(cj.completed_at, cj.updated_at, cj.created_at))
                >= datetime(${cutoff})
        `,
      )) as unknown as Array<{ total: number; populated: number | null }>;

      const totalScored = Number(rows[0]?.total ?? 0);
      const populated = Number(rows[0]?.populated ?? 0);

      // Too few scored pages in the window to draw any conclusion — skip without
      // polluting the baseline history.
      if (totalScored < LLM_POP_MIN_SCORED) {
        log.info("LLM score population: window too small to evaluate", {
          totalScored,
          populated,
        });
        return;
      }

      const rate = populated / totalScored;

      // Load rolling history and compute the trailing baseline from PRIOR samples.
      const historyRaw = await kv.get("llm:score:population:history");
      const history: LlmPopSample[] = historyRaw ? JSON.parse(historyRaw) : [];
      const priorRates = history.map((h) => h.rate);
      const baseline = median(priorRates);

      const anomaly =
        priorRates.length >= LLM_POP_MIN_HISTORY &&
        baseline >= LLM_POP_BASELINE_MIN &&
        rate < baseline * LLM_POP_DROP_FACTOR;

      if (anomaly) {
        // The signal collapsed relative to its own history — almost certainly a
        // silent LLM-scoring pipeline breakage, not an organic mix shift.
        log.error("CRITICAL: llmContentScores population dropped sharply", {
          currentRate: Number(rate.toFixed(4)),
          baselineRate: Number(baseline.toFixed(4)),
          totalScored,
          populated,
          windowHours: LLM_POP_WINDOW_HOURS,
        });
      } else {
        log.info("LLM score population healthy", {
          currentRate: Number(rate.toFixed(4)),
          baselineRate: Number(baseline.toFixed(4)),
          totalScored,
          populated,
        });
      }

      // Append this (meaningful-volume) sample and retain the last N.
      history.push({
        checkedAt: new Date().toISOString(),
        totalScored,
        populated,
        rate,
      });
      if (history.length > LLM_POP_HISTORY_MAX) {
        history.splice(0, history.length - LLM_POP_HISTORY_MAX);
      }
      await kv.put("llm:score:population:history", JSON.stringify(history), {
        expirationTtl: 30 * 24 * 3600,
      });
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
            // D1/SQLite: now()/interval are Postgres-only and throw here.
            sql`${crawlJobs.createdAt} >= datetime('now', '-24 hours')`,
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
