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
import {
  runLLMScoring,
  PAID_CONTENT_SCORING_MODEL,
  type LLMScoringInput,
} from "./llm-scoring";
import { resolveEffectivePlan, type PlanTier } from "@llm-boost/shared";
import type { WorkersAi } from "@llm-boost/llm";
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
  llmUsageQueries,
  outboxEvents,
  projectQueries,
  userQueries,
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
  /** Kill-switch: "false" disables ALL LLM content scoring (+ its spend). */
  LLM_SCORING_ENABLED?: string;
  /** Per-account monthly LLM budget cap in USD; 0/unset = no cap. */
  LLM_MONTHLY_BUDGET_USD?: string;
  kvNamespace?: KVNamespace;
  r2: R2Bucket;
  ai?: WorkersAi;
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

      // LLM content scoring is a PAID feature: only Pro/Agency projects are
      // scored (Free/Starter keep deterministic structural scoring). Paid tiers
      // are scored with Sonnet when an Anthropic key is available, falling back
      // to Workers AI otherwise. resolveEffectivePlan keeps trial users (→ pro)
      // included. The provider check short-circuits the plan lookup on
      // no-provider deployments.
      let isPaidPlus = false;
      let scoringOwnerId: string | null = null;
      let scoringPlan: string | null = null;
      // Global kill-switch: set LLM_SCORING_ENABLED="false" to stop ALL LLM
      // content scoring (and its spend) without touching provider keys.
      const llmScoringEnabled = env.LLM_SCORING_ENABLED !== "false";
      if (llmScoringEnabled && (env.ai || env.anthropicApiKey)) {
        try {
          const scoringDb = createAppDb(env.d1);
          const scoringProject =
            await projectQueries(scoringDb).getById(projectId);
          const scoringOwner = scoringProject
            ? await userQueries(scoringDb).getById(scoringProject.userId)
            : null;
          if (scoringOwner) {
            const effectivePlan = resolveEffectivePlan({
              plan: scoringOwner.plan as PlanTier,
              trialEndsAt: scoringOwner.trialEndsAt,
            });
            isPaidPlus = effectivePlan === "pro" || effectivePlan === "agency";
            scoringOwnerId = scoringOwner.id;
            scoringPlan = effectivePlan;
            // Per-account monthly budget cap: skip scoring once an account's
            // LLM spend this month reaches LLM_MONTHLY_BUDGET_USD (0/unset = off).
            const cap = Number(env.LLM_MONTHLY_BUDGET_USD ?? 0);
            if (isPaidPlus && cap > 0) {
              const spent = await llmUsageQueries(
                scoringDb,
              ).accountSpendThisMonth(scoringOwner.id);
              if (spent >= cap) {
                isPaidPlus = false;
                console.warn(
                  `[post-processing] account ${scoringOwner.id} hit LLM budget cap $${cap} (spent $${spent.toFixed(2)}); skipping LLM scoring`,
                );
              }
            }
          }
        } catch (err) {
          // A plan-read fault must NEVER abort the rest of schedule() — the
          // idempotency write happens after this in processBatch, so a throw
          // here would re-run the batch (duplicate pages) and skip enrichment/
          // summary/narrative. Default to no LLM scoring on error.
          console.error(
            `[post-processing] plan lookup failed for ${projectId}; skipping LLM scoring:`,
            err,
          );
        }
      }
      // Pro+ → high-quality Sonnet content scoring on the top pages; without an
      // Anthropic key, falls back to Workers AI.
      const useSonnet = !!env.anthropicApiKey;
      // The Sonnet path scores the true top-N highest-word-count pages of the
      // WHOLE crawl, so it dispatches ONCE on the final batch — dispatching per
      // batch would re-score ~every page (batches are ~10 pages → hundreds of
      // Sonnet calls per crawl). The Workers AI fallback (no Anthropic key, ~8x
      // cheaper) stays per-batch on the fresh in-memory CrawlPageResult.
      const shouldDispatchScoring = useSonnet ? batch.is_final : true;
      if (isPaidPlus && shouldDispatchScoring) {
        await dispatchOrRun(deps.outbox, args.executionCtx, {
          type: "llm_scoring",
          payload: {
            // Worker context: score in-worker straight to D1. d1 + ai are
            // bindings — they don't survive the durable-outbox JSON round-trip,
            // so the outbox processor re-injects them from env; they are passed
            // live here for the run-immediately path.
            d1: env.d1,
            ai: env.ai,
            anthropicApiKey: env.anthropicApiKey,
            kvNamespace: env.kvNamespace,
            r2Bucket: env.r2,
            // The Sonnet (per-crawl) path re-reads all pages from D1; batchPages
            // is used only by the per-batch Workers AI fallback.
            batchPages: batch.pages,
            insertedPages,
            insertedScores,
            jobId: crawlJobId,
            // Attribution for LLM cost tracking (llm_usage rows).
            projectId,
            ownerId: scoringOwnerId,
            plan: scoringPlan,
            contentScoringModel: useSonnet
              ? PAID_CONTENT_SCORING_MODEL
              : undefined,
          },
        });
      }

      if (batch.is_final) {
        const hasIntegrationKeys = !!env.integrationKey;
        if (!hasIntegrationKeys) {
          console.warn(
            `[post-processing] Skipping enrichment dispatch for job ${batch.job_id}: ` +
              `missing env vars (integrationKey=${!!env.integrationKey})`,
          );
        }
      }

      if (batch.is_final && env.integrationKey) {
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
            openaiApiKey: env.openaiApiKey,
            perplexityApiKey: env.perplexityApiKey,
            googleApiKey: env.googleApiKey,
            bingApiKey: env.bingApiKey,
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
