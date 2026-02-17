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
  queue?: Queue<any>;
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
