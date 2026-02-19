import type { CrawlResultBatch } from "@llm-boost/shared";
import type {
  CrawlRepository,
  PageRepository,
  ProjectRepository,
  ScoreRepository,
  OutboxRepository,
  UserRepository,
} from "../repositories";
import { runLLMScoring, type LLMScoringInput } from "./llm-scoring";
import { runIntegrationEnrichments, type EnrichmentInput } from "./enrichments";
import {
  generateCrawlSummary,
  persistCrawlSummaryData,
  type SummaryInput,
} from "./summary";
import { createNotificationService } from "./notification-service";
import { createRegressionService } from "./regression-service";
import { createFrontierService } from "./frontier-service";
import { createDb, outboxEvents } from "@llm-boost/db";
import { runAutoVisibilityChecks } from "./auto-visibility-service";
import { runAutoNarrativeRegeneration } from "./auto-narrative-service";
import { runAutoPersonaGeneration } from "./auto-persona-service";
import { runAutoReportGeneration } from "./auto-report-service";
import { runAutoCompetitorDiscovery } from "./auto-competitor-service";

export interface PostProcessingDeps {
  crawls: CrawlRepository;
  projects?: ProjectRepository;
  users?: UserRepository;
  outbox?: OutboxRepository;
}

export interface PostProcessingEnv {
  databaseUrl: string;
  anthropicApiKey?: string;
  kvNamespace?: KVNamespace;
  r2: R2Bucket;
  integrationKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  resendApiKey?: string;
  appBaseUrl?: string;
  seenUrls?: KVNamespace;
  queue?: Queue<unknown>;
  // Auto-visibility API keys
  openaiApiKey?: string;
  perplexityApiKey?: string;
  googleApiKey?: string;
  bingApiKey?: string;
  xaiApiKey?: string;
  // Auto-report
  reportServiceUrl?: string;
  sharedSecret?: string;
}

export function createPostProcessingService(deps: PostProcessingDeps) {
  return {
    async schedule(args: {
      batch: CrawlResultBatch;
      crawlJobId: string;
      projectId: string;
      insertedPages: Awaited<ReturnType<PageRepository["createBatch"]>>;
      insertedScores: Awaited<ReturnType<ScoreRepository["createBatch"]>>;
      env: PostProcessingEnv;
      executionCtx: ExecutionContext;
    }) {
      const { batch, insertedPages, insertedScores, projectId, crawlJobId } =
        args;
      const env = args.env;

      if (env.anthropicApiKey) {
        await dispatchOrRun(deps.outbox, args.executionCtx, {
          type: "llm_scoring",
          payload: {
            databaseUrl: env.databaseUrl,
            anthropicApiKey: env.anthropicApiKey,
            kvNamespace: env.kvNamespace,
            r2Bucket: env.r2,
            batchPages: batch.pages,
            insertedPages,
            insertedScores,
            jobId: crawlJobId,
          },
        });
      }

      if (
        batch.is_final &&
        env.integrationKey &&
        env.googleClientId &&
        env.googleClientSecret
      ) {
        await dispatchOrRun(deps.outbox, args.executionCtx, {
          type: "integration_enrichment",
          payload: {
            databaseUrl: env.databaseUrl,
            encryptionKey: env.integrationKey,
            googleClientId: env.googleClientId,
            googleClientSecret: env.googleClientSecret,
            projectId,
            jobId: batch.job_id,
            insertedPages,
          },
        });
      }

      if (batch.is_final) {
        args.executionCtx.waitUntil(
          persistCrawlSummaryData({
            databaseUrl: env.databaseUrl,
            projectId,
            jobId: crawlJobId,
            resendApiKey: env.resendApiKey,
            appBaseUrl: env.appBaseUrl,
          }),
        );
      }

      if (batch.is_final && env.anthropicApiKey) {
        await dispatchOrRun(deps.outbox, args.executionCtx, {
          type: "crawl_summary",
          payload: {
            databaseUrl: env.databaseUrl,
            anthropicApiKey: env.anthropicApiKey,
            projectId,
            jobId: batch.job_id,
          },
        });
      }

      // Invalidate dashboard KV cache on crawl completion
      if (batch.is_final && env.kvNamespace && deps.projects) {
        const project = await deps.projects.getById(projectId);
        if (project) {
          args.executionCtx.waitUntil(
            env.kvNamespace.delete(`dashboard:stats:${project.userId}`),
          );
        }
      }

      // Send crawl-complete email notification (fire-and-forget)
      if (batch.is_final && env.resendApiKey && deps.users && deps.projects) {
        const project = await deps.projects.getById(projectId);
        if (project) {
          const db = createDb(env.databaseUrl);
          const notifier = createNotificationService(db, env.resendApiKey, {
            appBaseUrl: env.appBaseUrl,
          });
          args.executionCtx.waitUntil(
            notifier.sendCrawlComplete({
              userId: project.userId,
              projectId,
              projectName: project.name,
              jobId: crawlJobId,
            }),
          );

          // Regression detection — fire-and-forget after crawl completion
          const regressionSvc = createRegressionService({
            crawls: {
              listByProject: (pid) => deps.crawls.listByProject(pid),
            },
            notifications: {
              create: (data) =>
                db.insert(outboxEvents).values({
                  type: "notification",
                  eventType: data.type,
                  userId: data.userId,
                  projectId,
                  payload: data.data,
                  status: "pending",
                }),
            },
          });
          args.executionCtx.waitUntil(
            regressionSvc.checkAndNotify({
              projectId,
              userId: project.userId,
            }),
          );
        }
      }

      // Auto-run visibility checks (fire-and-forget)
      if (batch.is_final) {
        args.executionCtx.waitUntil(
          runAutoVisibilityChecks({
            databaseUrl: env.databaseUrl,
            projectId,
            apiKeys: {
              chatgpt: env.openaiApiKey ?? "",
              claude: env.anthropicApiKey ?? "",
              perplexity: env.perplexityApiKey ?? "",
              gemini: env.googleApiKey ?? "",
              copilot: env.bingApiKey ?? "",
              gemini_ai_mode: env.googleApiKey ?? "",
              grok: env.xaiApiKey ?? "",
            },
          }).catch(() => {}),
        );
      }

      // Auto-regenerate narrative (fire-and-forget)
      if (batch.is_final && env.anthropicApiKey) {
        args.executionCtx.waitUntil(
          runAutoNarrativeRegeneration({
            databaseUrl: env.databaseUrl,
            projectId,
            crawlJobId,
            anthropicApiKey: env.anthropicApiKey,
          }).catch(() => {}),
        );
      }

      // Auto-generate personas on first crawl (fire-and-forget)
      if (batch.is_final && env.anthropicApiKey) {
        args.executionCtx.waitUntil(
          runAutoPersonaGeneration({
            databaseUrl: env.databaseUrl,
            projectId,
            anthropicApiKey: env.anthropicApiKey,
          }).catch(() => {}),
        );
      }

      // Auto-generate summary report (fire-and-forget)
      if (batch.is_final && env.reportServiceUrl && env.sharedSecret) {
        args.executionCtx.waitUntil(
          runAutoReportGeneration({
            databaseUrl: env.databaseUrl,
            projectId,
            crawlJobId,
            reportServiceUrl: env.reportServiceUrl,
            sharedSecret: env.sharedSecret,
          }).catch(() => {}),
        );
      }

      // Auto-discover competitors on first crawl (fire-and-forget)
      if (batch.is_final && env.anthropicApiKey) {
        args.executionCtx.waitUntil(
          runAutoCompetitorDiscovery({
            databaseUrl: env.databaseUrl,
            projectId,
            anthropicApiKey: env.anthropicApiKey,
          }).catch(() => {}),
        );
      }

      // New: Recursive Link Discovery (Infinite Scaling)
      if (batch.pages.length > 0 && env.queue && env.seenUrls) {
        const frontier = createFrontierService(env.seenUrls);
        const newLinks = batch.pages.flatMap((p) => p.extracted.internal_links);

        for (const link of newLinks) {
          const isNew = !(await frontier.isSeen(projectId, link));
          if (isNew) {
            await frontier.markSeen(projectId, link);
            await env.queue.send({
              job_id: crawlJobId,
              projectId,
              url: link,
              depth: 1, // Simple heuristic for now
            });
          }
        }
      }
    },
  };

  async function dispatchOrRun(
    outbox: OutboxRepository | undefined,
    executionCtx: ExecutionContext,
    event: { type: string; payload: Record<string, unknown> },
  ) {
    if (outbox) {
      await outbox.enqueue(event);
      return;
    }

    executionCtx.waitUntil(runEventNow(event));
  }

  async function runEventNow(event: {
    type: string;
    payload: Record<string, unknown>;
  }) {
    switch (event.type) {
      case "llm_scoring":
        await runLLMScoring(event.payload as unknown as LLMScoringInput);
        break;
      case "integration_enrichment":
        await runIntegrationEnrichments(
          event.payload as unknown as EnrichmentInput,
        );
        break;
      case "crawl_summary":
        await generateCrawlSummary(event.payload as unknown as SummaryInput);
        break;
    }
  }
}
