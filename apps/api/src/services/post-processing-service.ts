import type { CrawlResultBatch } from "@llm-boost/shared";
import type {
  CrawlRepository,
  PageRepository,
  ProjectRepository,
  ScoreRepository,
  OutboxRepository,
  UserRepository,
} from "@llm-boost/repositories";
import {
  createCrawlRepository,
  createProjectRepository,
  createReportRepository,
  createUserRepository,
} from "@llm-boost/repositories";
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
import {
  actionItemQueries,
  createAppDb,
  createAdminDb,
  createAgencyDb,
  outboxEvents,
  projectQueries,
  reportScheduleQueries,
} from "@llm-boost/db";
import { createPipelineService } from "./pipeline-service";
import { createAuditService } from "./audit-service";
import { createReportService } from "./report-service";
import { createNarrativeService } from "./narrative-service";
import { createNarrativeRepository } from "@llm-boost/repositories";

export interface PostProcessingDeps {
  crawls: CrawlRepository;
  projects?: ProjectRepository;
  users?: UserRepository;
  outbox?: OutboxRepository;
}

export interface PostProcessingEnv {
  d1: D1Database;
  d1Admin?: D1Database;
  supabaseConnectionString?: string;
  anthropicApiKey?: string;
  kvNamespace?: KVNamespace;
  r2: R2Bucket;
  integrationKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  metaAppId?: string;
  metaAppSecret?: string;
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
            d1: env.d1,
            anthropicApiKey: env.anthropicApiKey,
            kvNamespace: env.kvNamespace,
            r2Bucket: env.r2,
            batchPages: batch.pages,
            insertedPages,
            insertedScores,
            jobId: crawlJobId,
            // Required to persist the batch_jobs row (project_id is a non-null
            // UUID); without it llm-scoring routes to sync to avoid orphaning.
            projectId,
          },
        });
      }

      if (batch.is_final) {
        const hasIntegrationKeys = !!(
          env.integrationKey &&
          env.googleClientId &&
          env.googleClientSecret
        );
        if (!hasIntegrationKeys) {
          console.warn(
            `[post-processing] Skipping enrichment dispatch for job ${batch.job_id}: ` +
              `missing env vars (integrationKey=${!!env.integrationKey}, ` +
              `googleClientId=${!!env.googleClientId}, ` +
              `googleClientSecret=${!!env.googleClientSecret})`,
          );
        }
      }

      if (
        batch.is_final &&
        env.integrationKey &&
        env.googleClientId &&
        env.googleClientSecret
      ) {
        try {
          await dispatchOrRun(deps.outbox, args.executionCtx, {
            type: "integration_enrichment",
            payload: {
              d1: env.d1,
              encryptionKey: env.integrationKey,
              googleClientId: env.googleClientId,
              googleClientSecret: env.googleClientSecret,
              metaAppId: env.metaAppId ?? "",
              metaAppSecret: env.metaAppSecret ?? "",
              projectId,
              jobId: batch.job_id,
              insertedPages,
            },
          });
          console.info(
            `[post-processing] Enrichment event dispatched for job ${batch.job_id}, project ${projectId}`,
          );
        } catch (err) {
          console.error(
            `[post-processing] Failed to dispatch enrichment for job ${batch.job_id}:`,
            err,
          );
        }
      }

      if (batch.is_final) {
        args.executionCtx.waitUntil(
          persistCrawlSummaryData({
            d1: env.d1,
            projectId,
            jobId: crawlJobId,
            resendApiKey: env.resendApiKey,
            appBaseUrl: env.appBaseUrl,
          }).catch((err) => {
            console.error(
              `[post-processing] persistCrawlSummaryData failed for job ${crawlJobId}:`,
              err,
            );
          }),
        );
      }

      if (batch.is_final && env.anthropicApiKey) {
        await dispatchOrRun(deps.outbox, args.executionCtx, {
          type: "crawl_summary",
          payload: {
            d1: env.d1,
            anthropicApiKey: env.anthropicApiKey,
            projectId,
            jobId: batch.job_id,
          },
        });
      }

      // Auto-generate narrative report after crawl completion
      if (batch.is_final && env.anthropicApiKey) {
        args.executionCtx.waitUntil(
          (async () => {
            try {
              const db = createAppDb(env.d1);
              // narratives live in the Supabase agency DB, not D1.
              const agencyDb = createAgencyDb(
                env.supabaseConnectionString ?? "",
              );
              const project = await projectQueries(db).getById(projectId);
              if (!project) return;
              const narrativeSvc = createNarrativeService({
                db,
                adminDb: env.d1Admin ? createAdminDb(env.d1Admin) : (db as any),
                narratives: createNarrativeRepository(agencyDb),
                projects: createProjectRepository(db),
                users: createUserRepository(db),
                crawls: createCrawlRepository(db),
              });
              await narrativeSvc.generate(
                project.userId,
                crawlJobId,
                "technical",
                { anthropicApiKey: env.anthropicApiKey! },
              );
            } catch (err) {
              // Non-critical to ingest, but log so the cause is visible instead
              // of a silent "no narrative" (this catch swallowed it entirely).
              console.error(
                `[post-processing] narrative auto-generation failed for job ${crawlJobId}:`,
                err,
              );
            }
          })(),
        );
      }

      // Auto-dispatch the post-crawl insights pipeline — the "Automatic post-crawl
      // insights" the dashboard advertises. Nothing wired this before, so
      // pipeline_runs stayed empty and the Actions checklist sat at PENDING
      // forever. Runs in waitUntil (a cold Fly report service shouldn't block the
      // ingest response) via the shared dispatcher, which retries the cold-start
      // and records failures instead of swallowing them.
      if (batch.is_final && env.reportServiceUrl && env.sharedSecret) {
        const reportServiceUrl = env.reportServiceUrl;
        const sharedSecret = env.sharedSecret;
        args.executionCtx.waitUntil(
          (async () => {
            try {
              const db = createAppDb(env.d1);
              const project = await projectQueries(db).getById(projectId);
              if (!project) return;
              const settings = (project.pipelineSettings ?? {}) as {
                skipSteps?: string[];
              };
              const { dispatchInsightsPipeline } =
                await import("./pipeline-dispatch");
              const result = await dispatchInsightsPipeline(
                db,
                projectId,
                crawlJobId,
                {
                  reportServiceUrl,
                  sharedSecret,
                  anthropicApiKey: env.anthropicApiKey,
                  perplexityApiKey: env.perplexityApiKey,
                  xaiApiKey: env.xaiApiKey,
                  skipSteps: settings.skipSteps,
                },
              );
              if (result.status === "failed") {
                console.error(
                  `[post-processing] auto insights pipeline failed for job ${crawlJobId}: ${result.error}`,
                );
              }
            } catch (err) {
              console.error(
                `[post-processing] auto insights pipeline dispatch threw for job ${crawlJobId}:`,
                err,
              );
            }
          })(),
        );
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

      // Fetch and store favicon for the project (fire-and-forget)
      if (batch.is_final && deps.projects) {
        const project = await deps.projects.getById(projectId);
        if (project && !project.faviconUrl) {
          args.executionCtx.waitUntil(
            (async () => {
              try {
                const domain = project.domain;
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
                const res = await fetch(faviconUrl, { method: "HEAD" });
                if (res.ok) {
                  const db = createAppDb(env.d1);
                  await projectQueries(db).update(projectId, { faviconUrl });
                }
              } catch {
                // Non-critical — skip silently
              }
            })(),
          );
        }
      }

      // Send crawl-complete email notification (fire-and-forget)
      if (batch.is_final && env.resendApiKey && deps.users && deps.projects) {
        const project = await deps.projects.getById(projectId);
        if (project) {
          const db = createAppDb(env.d1);
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
                  id: crypto.randomUUID(),
                  type: "notification",
                  eventType: data.type,
                  userId: data.userId,
                  projectId,
                  payload:
                    typeof data.data === "string"
                      ? data.data
                      : JSON.stringify(data.data),
                  status: "pending",
                }),
            },
            actionItems: {
              create: (data: any) => actionItemQueries(db).create(data),
              getOpenByProjectIssueCode: (pid, issueCode) =>
                actionItemQueries(db).getOpenByProjectIssueCode(pid, issueCode),
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

      // Run AI intelligence pipeline (replaces individual auto-service calls)
      if (batch.is_final && env.anthropicApiKey) {
        const db = createAppDb(env.d1);
        const project = await projectQueries(db).getById(projectId);
        const settings = (project?.pipelineSettings ?? {}) as Record<
          string,
          unknown
        >;

        if (settings.autoRunOnCrawl !== false) {
          const audit = createAuditService(db);
          const pipeline = createPipelineService(db, audit, {
            databaseUrl: env.supabaseConnectionString ?? "",
            anthropicApiKey: env.anthropicApiKey,
            perplexityApiKey: env.perplexityApiKey,
            grokApiKey: env.xaiApiKey,
            reportServiceUrl: env.reportServiceUrl,
            sharedSecret: env.sharedSecret,
          });

          args.executionCtx.waitUntil(
            pipeline.start(projectId, crawlJobId).catch(() => {}),
          );
        }
      }

      // Auto-generate scheduled reports after each completed crawl.
      if (batch.is_final && env.reportServiceUrl && env.sharedSecret) {
        const db = createAppDb(env.d1);
        const project = await projectQueries(db).getById(projectId);

        if (project) {
          const activeSchedules =
            await reportScheduleQueries(db).getActiveByProject(projectId);

          if (activeSchedules.length > 0) {
            const reportService = createReportService({
              reports: createReportRepository(db),
              projects: createProjectRepository(db),
              users: createUserRepository(db),
              crawls: createCrawlRepository(db),
            });

            args.executionCtx.waitUntil(
              (async () => {
                for (const schedule of activeSchedules) {
                  try {
                    await reportService.generate(
                      project.userId,
                      {
                        projectId,
                        crawlJobId,
                        type: schedule.type as "summary" | "detailed",
                        format: schedule.format as "pdf" | "docx",
                        config: { preparedFor: schedule.recipientEmail },
                      },
                      {
                        reportServiceUrl: env.reportServiceUrl!,
                        sharedSecret: env.sharedSecret!,
                      },
                    );
                  } catch {
                    // Continue to next schedule to avoid blocking other outputs.
                  }
                }
              })(),
            );
          }
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
