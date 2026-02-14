import {
  CrawlResultBatchSchema,
  type CrawlPageResult,
  type CrawlResultBatch,
} from "@llm-boost/shared";
import { scorePage, type PageData } from "@llm-boost/scoring";
import type {
  CrawlRepository,
  PageRepository,
  ProjectRepository,
  ScoreRepository,
  OutboxRepository,
  UserRepository,
} from "../repositories";
import { ServiceError } from "./errors";
import { runLLMScoring, rescoreLLM, type LLMScoringInput } from "./llm-scoring";
import { runIntegrationEnrichments, type EnrichmentInput } from "./enrichments";
import { generateCrawlSummary, type SummaryInput } from "./summary";
import { createNotificationService } from "./notification-service";
import { createFrontierService } from "./frontier-service";
import { createDb } from "@llm-boost/db";

export interface IngestServiceDeps {
  crawls: CrawlRepository;
  pages: PageRepository;
  scores: ScoreRepository;
  outbox?: OutboxRepository;
  users?: UserRepository;
  projects?: ProjectRepository;
}

export interface BatchEnvironment {
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

export function createIngestService(deps: IngestServiceDeps) {
  return {
    async processBatch(args: {
      rawBody: string;
      env: BatchEnvironment;
      executionCtx: ExecutionContext;
    }) {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(args.rawBody);
      } catch (error) {
        throw new ServiceError("VALIDATION_ERROR", 422, "Invalid JSON payload");
      }

      const parsed = CrawlResultBatchSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          422,
          "Invalid batch payload",
          parsed.error.flatten(),
        );
      }

      const batch = parsed.data;
      const crawlJob = await deps.crawls.getById(batch.job_id);
      if (!crawlJob) {
        throw new ServiceError("NOT_FOUND", 404, "Crawl job not found");
      }

      if (crawlJob.status === "pending" || crawlJob.status === "queued") {
        await deps.crawls.updateStatus(crawlJob.id, {
          status: "crawling",
          startedAt: crawlJob.startedAt ?? new Date(),
        });
      }

      const pageRows = batch.pages.map((p: CrawlPageResult) => ({
        jobId: batch.job_id,
        projectId: crawlJob.projectId,
        url: p.url,
        canonicalUrl: p.canonical_url,
        statusCode: p.status_code,
        title: p.title,
        metaDesc: p.meta_description,
        contentHash: p.content_hash,
        wordCount: p.word_count,
        r2RawKey: p.html_r2_key,
        r2LhKey: p.lighthouse?.lh_r2_key ?? null,
        crawledAt: new Date(),
      }));

      const insertedPages = await deps.pages.createBatch(pageRows);
      await deps.crawls.updateStatus(crawlJob.id, { status: "scoring" });

      const scoreRows: Parameters<ScoreRepository["createBatch"]>[0] = [];
      const issueRows: Parameters<ScoreRepository["createIssues"]>[0] = [];

      for (let i = 0; i < insertedPages.length; i++) {
        const insertedPage = insertedPages[i];
        const crawlPageResult = batch.pages[i];

        const pageData: PageData = {
          url: crawlPageResult.url,
          statusCode: crawlPageResult.status_code,
          title: crawlPageResult.title,
          metaDescription: crawlPageResult.meta_description,
          canonicalUrl: crawlPageResult.canonical_url,
          wordCount: crawlPageResult.word_count,
          contentHash: crawlPageResult.content_hash,
          extracted: crawlPageResult.extracted,
          lighthouse: crawlPageResult.lighthouse ?? null,
          llmScores: null,
        };

        const result = scorePage(pageData);

        scoreRows.push({
          pageId: insertedPage.id,
          jobId: batch.job_id,
          overallScore: result.overallScore,
          technicalScore: result.technicalScore,
          contentScore: result.contentScore,
          aiReadinessScore: result.aiReadinessScore,
          lighthousePerf: crawlPageResult.lighthouse?.performance ?? null,
          lighthouseSeo: crawlPageResult.lighthouse?.seo ?? null,
          detail: {
            performanceScore: result.performanceScore,
            letterGrade: result.letterGrade,
            extracted: crawlPageResult.extracted,
            lighthouse: crawlPageResult.lighthouse ?? null,
          },
        });

        for (const issue of result.issues) {
          issueRows.push({
            pageId: insertedPage.id,
            jobId: batch.job_id,
            category: issue.category,
            severity: issue.severity,
            code: issue.code,
            message: issue.message,
            recommendation: issue.recommendation,
            data: issue.data ?? null,
          });
        }
      }

      const insertedScores = await deps.scores.createBatch(scoreRows);
      await deps.scores.createIssues(issueRows);

      const updateData: Parameters<CrawlRepository["updateStatus"]>[1] = {
        status: batch.is_final ? "complete" : "crawling",
        pagesFound: batch.stats.pages_found,
        pagesCrawled: batch.stats.pages_crawled,
        pagesScored: (crawlJob.pagesScored ?? 0) + insertedPages.length,
      };
      if (batch.is_final) {
        updateData.completedAt = new Date();
      }
      await deps.crawls.updateStatus(crawlJob.id, updateData);

      await schedulePostProcessing({
        batch,
        crawlJobId: crawlJob.id,
        projectId: crawlJob.projectId,
        insertedPages,
        insertedScores,
        env: args.env,
        executionCtx: args.executionCtx,
        outbox: deps.outbox,
      });

      return {
        job_id: batch.job_id,
        batch_index: batch.batch_index,
        pages_processed: insertedPages.length,
        is_final: batch.is_final,
      };
    },

    rescoreLLMJob(args: { jobId: string; env: BatchEnvironment }) {
      if (!args.env.anthropicApiKey) {
        throw new ServiceError(
          "CONFIG_ERROR",
          500,
          "ANTHROPIC_API_KEY not set",
        );
      }
      return rescoreLLM({
        databaseUrl: args.env.databaseUrl,
        anthropicApiKey: args.env.anthropicApiKey,
        kvNamespace: args.env.kvNamespace,
        r2Bucket: args.env.r2,
        jobId: args.jobId,
      });
    },
  };

  async function schedulePostProcessing(args: {
    batch: CrawlResultBatch;
    crawlJobId: string;
    projectId: string;
    insertedPages: Awaited<ReturnType<PageRepository["createBatch"]>>;
    insertedScores: Awaited<ReturnType<ScoreRepository["createBatch"]>>;
    env: BatchEnvironment;
    executionCtx: ExecutionContext;
    outbox?: OutboxRepository;
  }) {
    const { batch, insertedPages, insertedScores, projectId, crawlJobId } =
      args;
    const env = args.env;

    if (env.anthropicApiKey) {
      await dispatchOrRun(args.outbox, args.executionCtx, {
        type: "llm_scoring",
        payload: {
          databaseUrl: env.databaseUrl,
          anthropicApiKey: env.anthropicApiKey,
          kvNamespace: env.kvNamespace,
          r2Bucket: env.r2,
          batchPages: batch.pages,
          insertedPages,
          insertedScores,
        },
      });
    }

    if (
      batch.is_final &&
      env.integrationKey &&
      env.googleClientId &&
      env.googleClientSecret
    ) {
      await dispatchOrRun(args.outbox, args.executionCtx, {
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

    if (batch.is_final && env.anthropicApiKey) {
      await dispatchOrRun(args.outbox, args.executionCtx, {
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
        const notifier = createNotificationService(db, env.resendApiKey);
        args.executionCtx.waitUntil(
          notifier.sendCrawlComplete({
            userId: project.userId,
            projectId,
            projectName: project.name,
            jobId: crawlJobId,
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
  }

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
