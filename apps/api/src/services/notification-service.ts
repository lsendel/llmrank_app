import { Resend } from "resend";
import {
  type Database,
  outboxQueries,
  outboxEvents,
  eq,
  and,
  lte,
} from "@llm-boost/db";
import { createLogger } from "../lib/logger";

export interface NotificationService {
  queueEmail(args: {
    userId: string;
    to: string;
    template:
      | "crawl_completed"
      | "credit_alert"
      | "competitor_alert"
      | "score_drop";
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

  processQueue(): Promise<void>;
}

export function createNotificationService(
  db: Database,
  resendApiKey: string,
): NotificationService {
  const log = createLogger({ context: "notification-service" });
  const resend = new Resend(resendApiKey);
  const outbox = outboxQueries(db);

  return {
    async queueEmail(args) {
      log.info("Queueing email notification", {
        userId: args.userId,
        template: args.template,
      });

      await outbox.enqueue({
        type: `email:${args.template}`,
        payload: {
          userId: args.userId,
          to: args.to,
          data: args.data,
        },
      });
    },

    async sendCrawlComplete(args) {
      // In real app, fetch user email from DB or pass it
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, args.userId),
      });
      if (!user?.email) return;

      await this.queueEmail({
        userId: args.userId,
        to: user.email,
        template: "crawl_completed",
        data: {
          projectName: args.projectName,
          projectId: args.projectId,
          jobId: args.jobId,
        },
      });
    },

    async sendScoreDrop(args) {
      if (args.currentScore >= args.previousScore) return;
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, args.userId),
      });
      if (!user?.email) return;

      await this.queueEmail({
        userId: args.userId,
        to: user.email,
        template: "score_drop",
        data: args,
      });
    },

    async processQueue() {
      // Pick up pending outbox events and send them via Resend
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
        try {
          if (event.type.startsWith("email:")) {
            const { to, data } = event.payload as any;

            await resend.emails.send({
              from: "LLM Boost <notifications@llmboost.io>",
              to: [to],
              subject: getSubject(event.type),
              html: renderTemplate(event.type, data),
            });
          }

          await db
            .update(outboxEvents)
            .set({ status: "completed", processedAt: new Date() } as any)
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

function getSubject(type: string): string {
  if (type.includes("crawl_completed")) return "🚀 Your AI SEO Audit is Ready";
  if (type.includes("credit_alert"))
    return "⚠️ Action Required: Crawl Credits Low";
  if (type.includes("score_drop"))
    return "📉 Alert: LLM Citability Score Dropped";
  return "🔍 Competitor Alert: New Semantic Gaps Detected";
}

function renderTemplate(type: string, data: any): string {
  const appUrl = "https://app.llmboost.io";
  if (type.includes("crawl_completed")) {
    return `<h1>Crawl Completed for ${data.projectName}</h1>
            <p>Score: ${data.score} (${data.grade})</p>
            <p>Found ${data.issueCount} issues to fix.</p>
            <a href="${appUrl}/projects/${data.projectId}">View Full Report</a>`;
  }
  return `<p>New updates in your LLM Boost dashboard.</p>`;
}
