import { Resend } from "resend";
import {
  type Database,
  outboxQueries,
  outboxEvents,
  notificationChannelQueries,
  eq,
  and,
  lte,
  issues,
  sql,
} from "@llm-boost/db";
import { aggregatePageScores } from "@llm-boost/shared";
import { createLogger } from "../lib/logger";
import type { CrawlSummaryData } from "./summary";

export interface NotificationService {
  queueEmail(args: {
    userId: string;
    to: string;
    template:
      | "crawl_completed"
      | "credit_alert"
      | "competitor_alert"
      | "score_drop"
      | "high_roi_wins";
    data: Record<string, unknown>;
  }): Promise<void>;

  sendCrawlComplete(args: {
    userId: string;
    projectId: string;
    projectName: string;
    jobId: string;
  }): Promise<void>;

  sendScoreDrop(args: {
    userId: string;
    projectId: string;
    projectName: string;
    previousScore: number;
    currentScore: number;
  }): Promise<void>;

  sendHighRoiAlert(args: {
    userId: string;
    projectId: string;
    projectName: string;
    wins: any[];
  }): Promise<void>;

  queueWebhook(args: {
    projectId: string;
    event: string;
    payload: Record<string, unknown>;
  }): Promise<void>;

  processQueue(): Promise<void>;
}

const DEFAULT_APP_URL = "https://app.llmboost.io";

export function createNotificationService(
  db: Database,
  resendApiKey: string,
  options: { appBaseUrl?: string } = {},
): NotificationService {
  const log = createLogger({ context: "notification-service" });
  const resend = new Resend(resendApiKey);
  const _outbox = outboxQueries(db);
  const appBaseUrl = normalizeBaseUrl(options.appBaseUrl);

  return {
    async queueEmail(args) {
      log.info("Queueing email notification", {
        userId: args.userId,
        template: args.template,
      });

      await db.insert(outboxEvents).values({
        type: `email:${args.template}`,
        eventType: args.template,
        userId: args.userId,
        payload: {
          userId: args.userId,
          to: args.to,
          data: args.data,
        },
        status: "pending",
      });
    },

    async queueWebhook(args: {
      projectId: string;
      event: string;
      payload: Record<string, unknown>;
    }) {
      const project = await db.query.projects.findFirst({
        where: (p, { eq }) => eq(p.id, args.projectId),
      });
      if (!project) return;

      const settings = (project.settings as any) || {};
      const webhookUrl = settings.webhookUrl;
      if (!webhookUrl) return;

      await db.insert(outboxEvents).values({
        type: `webhook:${args.event}`,
        eventType: args.event,
        projectId: args.projectId,
        userId: (project as any).userId ?? null,
        payload: {
          url: webhookUrl,
          data: args.payload,
        },
        status: "pending",
      });
    },

    async sendCrawlComplete(args) {
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, args.userId),
      });
      if (!user?.email) return;

      const payload = await buildCrawlCompletePayload(db, args, appBaseUrl);

      await this.queueEmail({
        userId: args.userId,
        to: user.email,
        template: "crawl_completed",
        data: payload,
      });

      await this.queueWebhook({
        projectId: args.projectId,
        event: "crawl.completed",
        payload,
      });
    },

    async sendScoreDrop(args) {
      if (args.currentScore >= args.previousScore) return;
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, args.userId),
      });
      if (!user?.email) return;
      if (!user.notifyOnScoreDrop) return;

      await this.queueEmail({
        userId: args.userId,
        to: user.email,
        template: "score_drop",
        data: args,
      });

      // User-level webhook
      if (user.webhookUrl) {
        await db.insert(outboxEvents).values({
          type: "webhook:alert",
          eventType: "score_drop",
          userId: args.userId,
          projectId: args.projectId,
          payload: {
            webhookUrl: user.webhookUrl,
            event: "score_drop",
            data: {
              projectId: args.projectId,
              projectName: args.projectName,
              previousScore: args.previousScore,
              currentScore: args.currentScore,
              delta: args.currentScore - args.previousScore,
            },
          },
          status: "pending",
        });
      }

      // Project-level webhook (existing)
      await this.queueWebhook({
        projectId: args.projectId,
        event: "score.dropped",
        payload: args,
      });
    },

    async sendHighRoiAlert(args) {
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, args.userId),
      });
      if (!user?.email) return;

      await this.queueEmail({
        userId: args.userId,
        to: user.email,
        template: "high_roi_wins",
        data: args,
      });

      await this.queueWebhook({
        projectId: args.projectId,
        event: "quick_wins.available",
        payload: args,
      });
    },

    async processQueue() {
      // Pick up pending outbox events and send them
      const events = await db
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.status, "pending"),
            lte(outboxEvents.availableAt, new Date()),
          ) as any,
        )
        .limit(20);

      for (const event of events) {
        // Skip non-notification events — they're handled by the outbox processor
        if (
          !event.type.startsWith("email:") &&
          !event.type.startsWith("webhook:") &&
          event.type !== "notification"
        ) {
          continue;
        }

        try {
          if (event.type.startsWith("email:")) {
            const { to, data } = event.payload as any;

            await resend.emails.send({
              from: "LLM Rank <notifications@llmboost.io>",
              to: [to],
              subject: getSubject(event.type),
              html: renderTemplate(event.type, data),
            });
          } else if (event.type === "webhook:alert") {
            // User-level webhook with Slack detection
            const {
              webhookUrl,
              event: eventName,
              data: alertData,
            } = event.payload as any;
            const isSlack = webhookUrl.includes("hooks.slack.com");
            const body = isSlack
              ? {
                  text: `*${eventName}*: ${alertData.projectName} \u2014 score ${alertData.previousScore} \u2192 ${alertData.currentScore}`,
                }
              : {
                  event: eventName,
                  timestamp: new Date().toISOString(),
                  ...alertData,
                };

            const res = await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Webhook failed: ${res.status}`);
          } else if (event.type.startsWith("webhook:")) {
            const { url, data } = event.payload as any;

            const webhookRes = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: event.type.split(":")[1],
                timestamp: new Date().toISOString(),
                data,
              }),
            });
            if (!webhookRes.ok) {
              throw new Error(`Webhook delivery failed: ${webhookRes.status}`);
            }
          }

          // Channel-aware delivery: route to configured notification channels
          let channelDeliveryCount = 0;
          let channelFailureCount = 0;

          if (event.userId && event.eventType) {
            const channels = await notificationChannelQueries(
              db,
            ).findByEventType(
              event.userId,
              event.eventType,
              event.projectId ?? undefined,
            );

            for (const channel of channels) {
              channelDeliveryCount++;
              try {
                switch (channel.channelType) {
                  case "webhook":
                    await sendWebhook(
                      channel.config as Record<string, unknown>,
                      event as OutboxEvent,
                    );
                    break;
                  case "slack_incoming":
                    await sendSlackIncoming(
                      channel.config as Record<string, unknown>,
                      event as OutboxEvent,
                    );
                    break;
                  // email handled by existing Resend path above
                }
              } catch (channelErr) {
                channelFailureCount++;
                log.error("Failed to deliver to notification channel", {
                  eventId: event.id,
                  channelId: channel.id,
                  channelType: channel.channelType,
                  error: String(channelErr),
                });
                // Continue processing other channels
              }
            }
          }

          // Mark as failed only when all channel deliveries failed
          const allChannelsFailed =
            channelDeliveryCount > 0 &&
            channelFailureCount === channelDeliveryCount;
          const finalStatus = allChannelsFailed ? "failed" : "completed";

          await db
            .update(outboxEvents)
            .set({
              status: finalStatus,
              processedAt: new Date(),
            } as any)
            .where(eq(outboxEvents.id, event.id) as any);
        } catch (err) {
          log.error("Failed to process notification event", {
            eventId: event.id,
            error: String(err),
          });
          await db
            .update(outboxEvents)
            .set({ attempts: event.attempts + 1 } as any)
            .where(eq(outboxEvents.id, event.id) as any);
        }
      }
    },
  };
}

type CrawlCompleteArgs = {
  projectId: string;
  projectName: string;
  jobId: string;
};

async function buildCrawlCompletePayload(
  db: Database,
  args: CrawlCompleteArgs,
  baseUrl: string,
) {
  const crawl = await db.query.crawlJobs.findFirst({
    where: (jobs, { eq }) => eq(jobs.id, args.jobId),
    columns: {
      summaryData: true,
    },
  });

  const cachedSummary = crawl?.summaryData as CrawlSummaryData | null;
  if (cachedSummary) {
    return {
      projectName: args.projectName,
      projectId: args.projectId,
      jobId: args.jobId,
      score: cachedSummary.overallScore,
      grade: cachedSummary.letterGrade,
      issueCount: cachedSummary.issueCount,
      reportUrl: `${baseUrl}/dashboard/projects/${args.projectId}`,
    };
  }

  const [pageScores, issueCount] = await Promise.all([
    db.query.pageScores.findMany({
      where: (scores, { eq }) => eq(scores.jobId, args.jobId),
      columns: {
        overallScore: true,
        technicalScore: true,
        contentScore: true,
        aiReadinessScore: true,
        detail: true,
      },
    }),
    countIssuesForJob(db, args.jobId),
  ]);

  const aggregate =
    pageScores.length > 0 ? aggregatePageScores(pageScores) : null;

  return {
    projectName: args.projectName,
    projectId: args.projectId,
    jobId: args.jobId,
    score: aggregate?.overallScore ?? null,
    grade: aggregate?.letterGrade ?? null,
    issueCount,
    reportUrl: `${baseUrl}/dashboard/projects/${args.projectId}`,
  };
}

async function countIssuesForJob(db: Database, jobId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)` as any })
    .from(issues)
    .where(eq(issues.jobId, jobId) as any);
  return Number(rows[0]?.count ?? 0);
}

function normalizeBaseUrl(candidate?: string) {
  if (!candidate) return DEFAULT_APP_URL;
  return candidate.endsWith("/") ? candidate.slice(0, -1) : candidate;
}

function getSubject(type: string): string {
  if (type.includes("crawl_completed")) return "🚀 Your AI SEO Audit is Ready";
  if (type.includes("credit_alert"))
    return "⚠️ Action Required: Crawl Credits Low";
  if (type.includes("score_drop"))
    return "📉 Alert: LLM Citability Score Dropped";
  if (type.includes("competitor_score_regression"))
    return "📉 Competitor Alert: Score Drop Detected";
  if (type.includes("competitor_score_improvement"))
    return "📈 Competitor Alert: Score Improvement Detected";
  if (type.includes("competitor_llms_txt"))
    return "🚨 Competitor Alert: AI Readiness Change";
  if (type.includes("competitor_ai_crawlers"))
    return "🚨 Competitor Alert: Crawler Access Changed";
  if (type.startsWith("competitor_")) return "🔍 Competitor Activity Update";
  return "🔍 Competitor Alert: New Semantic Gaps Detected";
}

function renderTemplate(type: string, data: any): string {
  if (type.includes("crawl_completed")) {
    const projectName = data.projectName ?? "your project";
    const gradeSuffix = data.grade ? ` (${data.grade})` : "";
    const scoreLine =
      typeof data.score === "number"
        ? `<p>Score: ${data.score}/100${gradeSuffix}</p>`
        : "<p>Your new AI SEO audit is ready.</p>";
    const issueLine =
      typeof data.issueCount === "number"
        ? `<p>Found ${data.issueCount} issues to fix.</p>`
        : "";
    const reportUrl = resolveReportUrl(data);

    return `<h1>Crawl Completed for ${projectName}</h1>
            ${scoreLine}
            ${issueLine}
            <a href="${reportUrl}">View Full Report</a>`;
  }

  if (type.includes("score_drop")) {
    const projectName = data.projectName ?? "your project";
    const prev = data.previousScore;
    const curr = data.currentScore;
    const reportUrl = `${DEFAULT_APP_URL}/dashboard/projects/${data.projectId}`;

    return `<h1>📉 Score Drop Alert: ${projectName}</h1>
            <p>Your LLM Citability Score has dropped from <strong>${prev}</strong> to <strong>${curr}</strong>.</p>
            <p>This drop may be due to technical changes, content updates, or new competitor activity detected by our engine.</p>
            <p>We recommend reviewing the latest crawl results to identify and fix the issues.</p>
            <a href="${reportUrl}">Analyze the Drop</a>`;
  }

  if (type.includes("high_roi_wins")) {
    const projectName = data.projectName ?? "your project";
    const wins = (data.wins as any[]) ?? [];
    const reportUrl = `${DEFAULT_APP_URL}/dashboard/projects/${data.projectId}`;

    const winsHtml = wins
      .map(
        (w) =>
          `<li><strong>${w.message}</strong>: ${w.recommendation} (Impact: +${w.scoreImpact} pts)</li>`,
      )
      .join("");

    return `<h1>⚡ Quick Wins Available for ${projectName}</h1>
            <p>We've identified high-ROI optimizations that can quickly boost your AI visibility score.</p>
            <ul>${winsHtml}</ul>
            <p>Implement these fixes to improve how AI assistants perceive and cite your content.</p>
            <a href="${reportUrl}">View All Quick Wins</a>`;
  }

  if (type.startsWith("competitor_")) {
    const severityColor =
      data.severity === "critical"
        ? "#ef4444"
        : data.severity === "warning"
          ? "#f59e0b"
          : "#3b82f6";
    const scoreTable =
      data.previousScore != null
        ? `<table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Previous Score</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${data.previousScore}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Current Score</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${data.newScore}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Change</td><td style="padding:8px;text-align:right;color:${data.delta > 0 ? "#22c55e" : "#ef4444"};font-weight:bold">${data.delta > 0 ? "+" : ""}${data.delta.toFixed(0)}</td></tr>
        </table>`
        : "";
    return `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a1a2e">Competitor Activity Detected</h2>
      <div style="background:#f8f9fa;border-left:4px solid ${severityColor};padding:16px;margin:16px 0;border-radius:4px">
        <strong>${data.domain}</strong>
        <p style="margin:8px 0 0">${data.summary}</p>
      </div>
      ${scoreTable}
      <a href="${DEFAULT_APP_URL}/dashboard/projects/${data.projectId}?tab=competitors" style="display:inline-block;background:#3b82f6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:16px">View Activity Feed &rarr;</a>
    </div>`;
  }

  return `<p>New updates in your LLM Rank dashboard.</p>`;
}

function resolveReportUrl(data: any) {
  const candidate =
    typeof data.reportUrl === "string" ? data.reportUrl.trim() : "";
  if (candidate) return candidate;
  if (typeof data.projectId === "string" && data.projectId.length > 0) {
    return `${DEFAULT_APP_URL}/dashboard/projects/${data.projectId}`;
  }
  return DEFAULT_APP_URL;
}

// ---------------------------------------------------------------------------
// Channel-Aware Delivery Helpers
// ---------------------------------------------------------------------------

interface OutboxEvent {
  id: string;
  type: string;
  eventType?: string | null;
  userId?: string | null;
  projectId?: string | null;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
}

async function sendWebhook(
  config: Record<string, unknown>,
  event: OutboxEvent,
) {
  const payload = {
    event: event.eventType,
    timestamp: new Date().toISOString(),
    data: event.payload,
  };
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.secret) {
    // HMAC signature using Web Crypto API (Cloudflare Workers compatible)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(config.secret as string),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body),
    );
    const hex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    headers["X-Signature"] = `hmac-sha256=${hex}`;
  }

  const res = await fetch(config.url as string, {
    method: "POST",
    headers,
    body,
  });
  if (!res.ok) {
    throw new Error(`Webhook delivery failed: ${res.status} ${res.statusText}`);
  }
}

async function sendSlackIncoming(
  config: Record<string, unknown>,
  event: OutboxEvent,
) {
  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `LLM Rank: ${event.eventType}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: formatSlackMessage(event),
        },
      },
    ],
  };
  const res = await fetch(config.url as string, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      `Slack webhook delivery failed: ${res.status} ${res.statusText}`,
    );
  }
}

function formatSlackMessage(event: OutboxEvent): string {
  const data = event.payload as Record<string, any>;
  switch (event.eventType) {
    case "crawl_completed":
      return `*Crawl completed* for ${data.domain ?? "unknown"}\nScore: ${data.score ?? "N/A"} | Grade: ${data.grade ?? "N/A"}`;
    case "score_drop":
      return `*Score dropped* for ${data.domain ?? "unknown"}\nFrom ${data.previousScore} \u2192 ${data.currentScore}`;
    case "mention_gained":
      return `*New mention detected* on ${data.provider}\nQuery: "${data.query}"`;
    case "mention_lost":
      return `*Mention lost* on ${data.provider}\nQuery: "${data.query}"`;
    case "position_changed":
      return `*Citation position changed* on ${data.provider}\n${data.oldPosition} \u2192 ${data.newPosition}`;
    case "competitor_score_regression":
      return `*Competitor Score Drop* \ud83d\udcc9\n*${data.domain}* dropped ${Math.abs(data.delta).toFixed(0)} points (${data.previousScore} \u2192 ${data.newScore})`;
    case "competitor_score_improvement":
      return `*Competitor Score Jump* \ud83d\udcc8\n*${data.domain}* improved ${data.delta.toFixed(0)} points (${data.previousScore} \u2192 ${data.newScore})`;
    case "competitor_llms_txt_added":
      return `*Competitor Alert* \ud83d\udea8\n*${data.domain}* added llms.txt \u2014 they're optimizing for AI visibility`;
    case "competitor_ai_crawlers_unblocked":
      return `*Competitor Alert* \ud83d\udea8\n*${data.domain}* unblocked AI crawlers \u2014 they're opening up to AI`;
    case "competitor_ai_crawlers_blocked":
      return `*Competitor Alert* \u26a0\ufe0f\n*${data.domain}* blocked AI crawlers`;
    case "competitor_schema_added":
      return `*Competitor Update* \u2139\ufe0f\n*${data.domain}* added structured data markup`;
    case "competitor_new_pages_detected":
      return `*Competitor Content* \ud83d\udcc4\n*${data.domain}* published ${data.count} new page(s)`;
    default:
      return `Event: ${event.eventType}\n${JSON.stringify(data, null, 2)}`;
  }
}
