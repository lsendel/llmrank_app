import {
  createDb,
  type Database,
  users,
  userQueries,
  competitorBenchmarkQueries,
  competitorQueries,
  competitorEventQueries,
  outboxQueries,
  scheduledVisibilityQueryQueries,
  visibilityQueries,
  projectQueries,
  outboxEvents,
  scanResultQueries,
  leadQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";
import type { Bindings } from "../index";
import { createLogger } from "../lib/logger";
import { captureError } from "../lib/sentry";
import { trackServer } from "../lib/telemetry";
import {
  createCompetitorRepository,
  createCrawlRepository,
  createProjectRepository,
  createScoreRepository,
  createUserRepository,
  createVisibilityRepository,
} from "../repositories";
import { createCompetitorMonitorService } from "../services/competitor-monitor-service";
import { createCrawlService } from "../services/crawl-service";
import { createDigestService } from "../services/digest-service";
import { createMonitoringService } from "../services/monitoring-service";
import { createNotificationService } from "../services/notification-service";
import { processOutboxEvents } from "../services/outbox-processor";
import { createVisibilityService } from "../services/visibility-service";
import { aggregateBenchmarks } from "../services/benchmark-aggregation-service";

interface VisibilityCheckResult {
  provider: string;
  brandMentioned: boolean;
  urlCited: boolean;
  citationPosition: number | null;
}

async function resetMonthlyCredits(env: Bindings) {
  const db = createDb(env.DATABASE_URL);
  const queries = userQueries(db);
  for (const [plan, limits] of Object.entries(PLAN_LIMITS)) {
    const credits = Number.isFinite(limits.crawlsPerMonth)
      ? limits.crawlsPerMonth
      : 999999;
    await queries.resetCrawlCreditsForPlan(
      plan as (typeof users.plan.enumValues)[number],
      credits,
    );
  }
}

async function runScheduledTasks(env: Bindings) {
  const db = createDb(env.DATABASE_URL);
  const notifications = createNotificationService(db, env.RESEND_API_KEY, {
    appBaseUrl: env.APP_BASE_URL,
  });
  await notifications.processQueue();

  const monitor = createMonitoringService(db, notifications);
  await monitor.checkSystemHealth();
  await monitor.checkCrawlerHealth(env.CRAWLER_URL, env.KV, {
    adminEmail: env.ADMIN_ALERT_EMAIL,
    slackWebhookUrl: env.SLACK_ALERT_WEBHOOK_URL,
    resendApiKey: env.RESEND_API_KEY,
  });

  const crawlService = createCrawlService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
  });

  await crawlService.dispatchScheduledJobs({
    crawlerUrl: env.CRAWLER_URL,
    sharedSecret: env.SHARED_SECRET,
    queue: env.CRAWL_QUEUE,
  });

  await processOutboxEvents(env.DATABASE_URL);
}

async function cleanupExpiredData(env: Bindings): Promise<void> {
  const db = createDb(env.DATABASE_URL);
  const logger = createLogger({ requestId: "cron-cleanup" });
  const deletedScans = await scanResultQueries(db).deleteExpired();
  logger.info("Cleaned up expired scan results", { deletedScans });
  const deletedLeads = await leadQueries(db).deleteOldUnconverted(90);
  logger.info("Cleaned up stale leads", { deletedLeads });
}

async function detectAndEmitChanges(
  db: Database,
  schedule: { id: string; projectId: string; query: string },
  project: { id: string; userId: string; domain: string },
  results: VisibilityCheckResult[],
  previousByProvider: Map<
    string,
    { brandMentioned: boolean; citationPosition: number | null }
  >,
): Promise<void> {
  for (const result of results) {
    const previous = previousByProvider.get(result.provider);
    if (!previous) continue;

    if (previous.brandMentioned === true && result.brandMentioned === false) {
      await db.insert(outboxEvents).values({
        type: "notification",
        eventType: "mention_lost",
        userId: project.userId,
        projectId: project.id,
        payload: {
          query: schedule.query,
          provider: result.provider,
          domain: project.domain,
        },
      });
    }

    if (previous.brandMentioned === false && result.brandMentioned === true) {
      await db.insert(outboxEvents).values({
        type: "notification",
        eventType: "mention_gained",
        userId: project.userId,
        projectId: project.id,
        payload: {
          query: schedule.query,
          provider: result.provider,
          domain: project.domain,
        },
      });
    }

    if (
      previous.citationPosition !== result.citationPosition &&
      result.citationPosition != null
    ) {
      await db.insert(outboxEvents).values({
        type: "notification",
        eventType: "position_changed",
        userId: project.userId,
        projectId: project.id,
        payload: {
          query: schedule.query,
          provider: result.provider,
          oldPosition: previous.citationPosition,
          newPosition: result.citationPosition,
        },
      });
    }
  }
}

async function processScheduledVisibilityChecks(env: Bindings): Promise<void> {
  const db = createDb(env.DATABASE_URL);
  const scheduleRepo = scheduledVisibilityQueryQueries(db);
  const visQueries = visibilityQueries(db);
  const dueQueries = await scheduleRepo.getDueQueries(new Date());
  const batch = dueQueries.slice(0, 10);

  for (const schedule of batch) {
    try {
      const pq = projectQueries(db);
      const project = await pq.getById(schedule.projectId);
      if (!project) {
        await scheduleRepo.markRun(schedule.id, schedule.frequency);
        continue;
      }

      const previousByProvider = new Map<
        string,
        { brandMentioned: boolean; citationPosition: number | null }
      >();
      for (const provider of schedule.providers) {
        const prev = await visQueries.getLatestForQuery(
          schedule.projectId,
          schedule.query,
          provider,
        );
        if (prev) {
          previousByProvider.set(provider, {
            brandMentioned: prev.brandMentioned ?? false,
            citationPosition: prev.citationPosition ?? null,
          });
        }
      }

      const visibilityService = createVisibilityService({
        projects: createProjectRepository(db),
        users: createUserRepository(db),
        visibility: createVisibilityRepository(db),
        competitors: createCompetitorRepository(db),
      });

      const stored = await visibilityService.runCheck({
        userId: project.userId,
        projectId: schedule.projectId,
        query: schedule.query,
        providers: schedule.providers,
        apiKeys: {
          chatgpt: env.OPENAI_API_KEY,
          claude: env.ANTHROPIC_API_KEY,
          perplexity: env.PERPLEXITY_API_KEY,
          gemini: env.GOOGLE_API_KEY,
          copilot: env.BING_API_KEY,
          gemini_ai_mode: env.GOOGLE_API_KEY,
          grok: env.XAI_API_KEY,
        },
      });

      if (!stored || stored.length === 0) {
        await scheduleRepo.markRun(schedule.id, schedule.frequency);
        continue;
      }

      const results: VisibilityCheckResult[] = stored.map((s) => ({
        provider: s.llmProvider,
        brandMentioned: s.brandMentioned ?? false,
        urlCited: s.urlCited ?? false,
        citationPosition: s.citationPosition ?? null,
      }));

      await detectAndEmitChanges(
        db,
        schedule,
        project,
        results,
        previousByProvider,
      );
      await scheduleRepo.markRun(schedule.id, schedule.frequency);

      trackServer(
        env.POSTHOG_API_KEY,
        project.userId,
        "scheduled_visibility_check_completed",
        {
          scheduleId: schedule.id,
          projectId: schedule.projectId,
          query: schedule.query,
          providers: schedule.providers,
        },
      );
    } catch (err) {
      captureError(err instanceof Error ? err : new Error(String(err)), {
        scheduleId: schedule.id,
        context: "cron-visibility",
      });
      const log = createLogger({ requestId: "cron-visibility" });
      log.error("Scheduled visibility check failed", {
        scheduleId: schedule.id,
        error: err instanceof Error ? err.message : String(err),
      });
      await scheduleRepo.markRun(schedule.id, schedule.frequency);
    }
  }
}

async function processScheduledCompetitorChecks(env: Bindings) {
  const db = createDb(env.DATABASE_URL);
  const logger = createLogger({ requestId: "cron-competitor-checks" });
  const { createCompetitorBenchmarkService } =
    await import("../services/competitor-benchmark-service");
  const benchmarkService = createCompetitorBenchmarkService({
    competitorBenchmarks: competitorBenchmarkQueries(db),
    competitors: competitorQueries(db),
  });
  const monitorService = createCompetitorMonitorService({
    competitors: competitorQueries(db),
    competitorBenchmarks: competitorBenchmarkQueries(db),
    competitorEvents: competitorEventQueries(db),
    outbox: outboxQueries(db),
    benchmarkService,
  }, logger);

  const results = await monitorService.processScheduledBenchmarks();
  logger.info("Competitor monitoring completed", {
    processed: results.processed,
    events: results.events,
    errors: results.errors,
  });
}

export async function handleScheduled(
  controller: ScheduledController,
  env: Bindings,
) {
  if (controller.cron === "0 0 1 * *") {
    await resetMonthlyCredits(env);
  } else if (controller.cron === "*/15 * * * *") {
    await processScheduledVisibilityChecks(env);
  } else if (controller.cron === "0 3 * * *") {
    await cleanupExpiredData(env);
  } else if (controller.cron === "0 9 * * 1") {
    const db = createDb(env.DATABASE_URL);
    const digest = createDigestService(db, env.RESEND_API_KEY, {
      appBaseUrl: env.APP_BASE_URL,
    });
    await digest.processWeeklyDigests();
  } else if (controller.cron === "0 9 1 * *") {
    const db = createDb(env.DATABASE_URL);
    const digest = createDigestService(db, env.RESEND_API_KEY, {
      appBaseUrl: env.APP_BASE_URL,
    });
    await digest.processMonthlyDigests();
  } else if (controller.cron === "0 4 * * *") {
    const db = createDb(env.DATABASE_URL);
    await aggregateBenchmarks(db, env.KV);
  } else if (controller.cron === "0 2 * * 7") {
    await processScheduledCompetitorChecks(env);
  } else {
    await runScheduledTasks(env);
  }
}
