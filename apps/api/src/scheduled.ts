import {
  createAppDb,
  createAdminDb,
  createAgencyDb,
  type AppDatabase,
  userQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";
import {
  createCrawlRepository,
  createProjectRepository,
  createScoreRepository,
  createUserRepository,
  createVisibilityRepository,
  createCompetitorRepository,
} from "@llm-boost/repositories";
import { createCrawlService } from "./services/crawl-service";
import { createNotificationService } from "./services/notification-service";
import { createMonitoringService } from "./services/monitoring-service";
import { createVisibilityService } from "@llm-boost/pipeline";
import {
  scheduledVisibilityQueryQueries,
  visibilityQueries,
  projectQueries,
  outboxEvents,
  scanResultQueries,
  leadQueries,
  analyticsQueries,
  competitorBenchmarkQueries,
  competitorQueries as competitorDbQueries,
  competitorEventQueries,
  outboxQueries,
} from "@llm-boost/db";
import { trackServer } from "./lib/telemetry";
import { createDigestService } from "./services/digest-service";
import { processOutboxEvents } from "./services/outbox-processor";
import { captureError } from "./lib/sentry";
import { createLogger } from "@llm-boost/shared";
import { aggregateBenchmarks } from "./services/benchmark-aggregation-service";
import { createCompetitorMonitorService } from "./services/competitor-monitor-service";
import type { Bindings } from "./index";

// ---------------------------------------------------------------------------
// Scheduled handler — monthly credit reset (1st of every month)
// ---------------------------------------------------------------------------

async function resetMonthlyCredits(env: Bindings) {
  const db = createAppDb(env.D1_APP);
  const queries = userQueries(db);
  for (const [plan, limits] of Object.entries(PLAN_LIMITS)) {
    const credits = Number.isFinite(limits.crawlsPerMonth)
      ? limits.crawlsPerMonth
      : 999999;
    await queries.resetCrawlCreditsForPlan(
      plan as "free" | "starter" | "pro" | "agency",
      credits,
    );
  }
}

async function runScheduledTasks(env: Bindings) {
  const db = createAppDb(env.D1_APP);
  const log = createLogger({ context: "scheduled-tasks" });

  // Each step is independent — errors in one should not block the others
  try {
    const notifications = createNotificationService(db, env.RESEND_API_KEY, {
      appBaseUrl: env.APP_BASE_URL,
    });
    await notifications.processQueue();
  } catch (err) {
    log.error("Notification processing failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const monitor = createMonitoringService(
      db,
      createNotificationService(db, env.RESEND_API_KEY, {
        appBaseUrl: env.APP_BASE_URL,
      }),
    );
    await monitor.checkSystemHealth();
    await monitor.checkCrawlerHealth(env.CRAWLER_URL, env.KV, {
      adminEmail: env.ADMIN_ALERT_EMAIL,
      slackWebhookUrl: env.SLACK_ALERT_WEBHOOK_URL,
      resendApiKey: env.RESEND_API_KEY,
    });
  } catch (err) {
    log.error("Health check failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const crawlService = createCrawlService({
      crawls: createCrawlRepository(db),
      projects: createProjectRepository(db),
      users: createUserRepository(db),
      scores: createScoreRepository(db),
    });
    await crawlService.dispatchScheduledJobs({
      crawlerUrl: env.CRAWLER_URL,
      sharedSecret: env.SHARED_SECRET,
      // Dispatch straight to the crawler. CRAWL_QUEUE has no consumer, so
      // routing through it would strand jobs in "queued". baseUrl is the API's
      // own origin so the crawler posts results back to /ingest/batch here.
      baseUrl: env.BETTER_AUTH_URL,
    });

    // Recover crawls orphaned by a crawler restart/crash: re-dispatch jobs that
    // have gone silent (~30m of no ingest activity) as fresh jobs, bounded by a
    // retry cap. Without this, a deploy that restarts the crawler mid-run leaves
    // the crawl stuck until the 6h backstop fails it.
    const recovery = await crawlService.recoverStalledCrawls({
      crawlerUrl: env.CRAWLER_URL,
      sharedSecret: env.SHARED_SECRET,
      baseUrl: env.BETTER_AUTH_URL,
    });
    if (recovery.recovered > 0 || recovery.failed > 0) {
      log.warn("Stalled crawl recovery", recovery);
    }
  } catch (err) {
    log.error("Scheduled crawl dispatch failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await processOutboxEvents(env.D1_APP, {
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      AI: env.AI,
      KV: env.KV,
      R2: env.R2,
      INTEGRATION_ENCRYPTION_KEY: env.INTEGRATION_ENCRYPTION_KEY,
      GOOGLE_OAUTH_CLIENT_ID: env.GOOGLE_OAUTH_CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET: env.GOOGLE_OAUTH_CLIENT_SECRET,
      META_APP_ID: env.META_APP_ID,
      META_APP_SECRET: env.META_APP_SECRET,
    });
  } catch (err) {
    log.error("Outbox processing failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 5. Poll pending LLM batch jobs (Supabase report-service path)
  try {
    const { pollPendingBatches } =
      await import("./services/batch-polling-service");
    await pollPendingBatches({
      AGENCY_DB_URL: env.SUPABASE.connectionString,
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      KV: env.KV,
      R2: env.R2,
    });
  } catch (err) {
    log.error("Batch polling failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 5b. Poll pending per-crawl content-scoring batches (D1 path). These are the
  // paid-tier Sonnet batches submitted on is_final; results are applied to D1.
  try {
    const { pollLLMScoreBatches } = await import("./services/llm-batch-poller");
    await pollLLMScoreBatches({
      d1: env.D1_APP,
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      KV: env.KV,
    });
  } catch (err) {
    log.error("Content-scoring batch polling failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Cleanup cron — daily at 3 AM UTC
// ---------------------------------------------------------------------------

async function cleanupExpiredData(env: Bindings): Promise<void> {
  const db = createAppDb(env.D1_APP);
  const adminDb = createAdminDb(env.D1_ADMIN);

  const deletedScans = await scanResultQueries(db).deleteExpired();
  console.log(`Cleaned up ${deletedScans} expired scan results`);

  const deletedLeads = await leadQueries(adminDb as any).deleteOldUnconverted(
    90,
  );
  console.log(`Cleaned up ${deletedLeads} stale leads`);
}

// ---------------------------------------------------------------------------
// Scheduled Visibility — 15-minute cron worker
// ---------------------------------------------------------------------------

interface VisibilityCheckResult {
  provider: string;
  brandMentioned: boolean;
  urlCited: boolean;
  citationPosition: number | null;
}

async function detectAndEmitChanges(
  db: AppDatabase,
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
        id: crypto.randomUUID(),
        type: "notification",
        eventType: "mention_lost",
        userId: project.userId,
        projectId: project.id,
        payload: JSON.stringify({
          query: schedule.query,
          provider: result.provider,
          domain: project.domain,
        }),
      });
    }

    if (previous.brandMentioned === false && result.brandMentioned === true) {
      await db.insert(outboxEvents).values({
        id: crypto.randomUUID(),
        type: "notification",
        eventType: "mention_gained",
        userId: project.userId,
        projectId: project.id,
        payload: JSON.stringify({
          query: schedule.query,
          provider: result.provider,
          domain: project.domain,
        }),
      });
    }

    if (
      previous.citationPosition !== result.citationPosition &&
      result.citationPosition != null
    ) {
      await db.insert(outboxEvents).values({
        id: crypto.randomUUID(),
        type: "notification",
        eventType: "position_changed",
        userId: project.userId,
        projectId: project.id,
        payload: JSON.stringify({
          query: schedule.query,
          provider: result.provider,
          oldPosition: previous.citationPosition,
          newPosition: result.citationPosition,
        }),
      });
    }
  }
}

async function processScheduledVisibilityChecks(env: Bindings): Promise<void> {
  const db = createAppDb(env.D1_APP);
  const agencyDb = createAgencyDb(env.SUPABASE.connectionString);
  const scheduleRepo = scheduledVisibilityQueryQueries(db);
  const visQueries = visibilityQueries(agencyDb);

  const dueQueries = await scheduleRepo.getDueQueries(new Date());
  const batch = dueQueries.slice(0, 10);

  for (const rawSchedule of batch) {
    const schedule = {
      ...rawSchedule,
      providers: (typeof rawSchedule.providers === "string"
        ? JSON.parse(rawSchedule.providers)
        : rawSchedule.providers) as string[],
    };
    try {
      const pq = projectQueries(db);
      const project = await pq.getById(schedule.projectId);
      if (!project) {
        await scheduleRepo.markRun(
          schedule.id,
          schedule.frequency as "daily" | "weekly" | "hourly",
        );
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
        visibility: createVisibilityRepository(agencyDb),
        competitors: createCompetitorRepository(db),
        archive: env.R2,
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
        await scheduleRepo.markRun(
          schedule.id,
          schedule.frequency as "daily" | "weekly" | "hourly",
        );
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
      await scheduleRepo.markRun(
        schedule.id,
        schedule.frequency as "daily" | "weekly" | "hourly",
      );

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
      await scheduleRepo.markRun(
        schedule.id,
        schedule.frequency as "daily" | "weekly" | "hourly",
      );
    }
  }
}

async function processScheduledCompetitorChecks(env: Bindings) {
  const db = createAppDb(env.D1_APP);
  const agencyDb = createAgencyDb(env.SUPABASE.connectionString);
  const { createCompetitorBenchmarkService } =
    await import("@llm-boost/pipeline");
  const benchmarkService = createCompetitorBenchmarkService({
    competitorBenchmarks: competitorBenchmarkQueries(agencyDb),
    competitors: competitorDbQueries(db),
  });
  const monitorService = createCompetitorMonitorService({
    competitors: competitorDbQueries(db),
    competitorBenchmarks: competitorBenchmarkQueries(agencyDb),
    competitorEvents: competitorEventQueries(agencyDb),
    outbox: outboxQueries(db),
    benchmarkService,
  });

  const results = await monitorService.processScheduledBenchmarks();
  console.log(
    `Competitor monitoring: processed=${results.processed}, events=${results.events}, errors=${results.errors}`,
  );
}

// ---------------------------------------------------------------------------
// Main scheduled handler
// ---------------------------------------------------------------------------

export async function handleScheduled(
  controller: ScheduledController,
  env: Bindings,
): Promise<void> {
  if (controller.cron === "0 0 1 * *") {
    await resetMonthlyCredits(env);
  } else if (controller.cron === "*/15 * * * *") {
    await processScheduledVisibilityChecks(env);
  } else if (controller.cron === "0 3 * * *") {
    await cleanupExpiredData(env);
  } else if (controller.cron === "0 9 * * 1") {
    const db = createAppDb(env.D1_APP);
    const digest = createDigestService(db, env.RESEND_API_KEY, {
      appBaseUrl: env.APP_BASE_URL,
    });
    await digest.processWeeklyDigests();
  } else if (controller.cron === "0 9 1 * *") {
    const db = createAppDb(env.D1_APP);
    const digest = createDigestService(db, env.RESEND_API_KEY, {
      appBaseUrl: env.APP_BASE_URL,
    });
    await digest.processMonthlyDigests();
  } else if (controller.cron === "0 4 * * *") {
    const db = createAppDb(env.D1_APP);
    await aggregateBenchmarks(db, env.KV);
  } else if (controller.cron === "0 2 * * 7") {
    await processScheduledCompetitorChecks(env);
  } else if (controller.cron === "0 2 * * *") {
    // Daily analytics rollup at 2 AM UTC
    const agencyDb = createAgencyDb(env.SUPABASE.connectionString);
    const queries = analyticsQueries(agencyDb);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];
    await queries.aggregateDay(dateStr);
    await queries.pruneOldEvents(90);
    console.log(`Analytics rollup complete for ${dateStr}`);
  } else {
    await runScheduledTasks(env);
  }
}
