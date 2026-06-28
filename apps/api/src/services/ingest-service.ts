import {
  CrawlResultBatchSchema,
  CrawlStatus,
  type CrawlPageResult,
  type CrawlJobPayload,
} from "@llm-boost/shared";
import { detectContentType, type ScoringWeights } from "@llm-boost/scoring";
import { scoringProfileQueries } from "@llm-boost/db";
import type {
  CrawlRepository,
  PageRepository,
  ProjectRepository,
  ScoreRepository,
  OutboxRepository,
  UserRepository,
} from "@llm-boost/repositories";
import { ServiceError } from "@llm-boost/shared";
import type { WorkersAi } from "@llm-boost/llm";
import { rescoreLLM } from "./llm-scoring";
import { createPageScoringService } from "./page-scoring-service";
import { createPostProcessingService } from "./post-processing-service";
import {
  createInsightCaptureService,
  type CaptureArgs,
} from "./insight-capture-service";
import {
  createCrawlInsightRepository,
  createPageInsightRepository,
} from "@llm-boost/repositories";

export interface IngestServiceDeps {
  crawls: CrawlRepository;
  pages: PageRepository;
  scores: ScoreRepository;
  outbox?: OutboxRepository;
  users?: UserRepository;
  projects?: ProjectRepository;
  db?: import("@llm-boost/db").Database;
}

export interface BatchEnvironment {
  d1: D1Database;
  supabaseConnectionString?: string;
  anthropicApiKey?: string;
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
  queue?: Queue<CrawlJobPayload>;
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

export function createIngestService(deps: IngestServiceDeps) {
  const pageScoringService = createPageScoringService();
  const postProcessingService = createPostProcessingService({
    crawls: deps.crawls,
    projects: deps.projects,
    users: deps.users,
    outbox: deps.outbox,
  });
  const insightCaptureService =
    deps.db &&
    createInsightCaptureService({
      crawlInsights: createCrawlInsightRepository(deps.db),
      pageInsights: createPageInsightRepository(deps.db),
    });

  return {
    async processBatch(args: {
      rawBody: string;
      env: BatchEnvironment;
      executionCtx: ExecutionContext;
    }) {
      // 1. Parse & validate
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(args.rawBody);
      } catch (_error) {
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

      // Drop late callbacks for a cancelled job. Stall recovery marks a
      // superseded job `cancelled` and dispatches a fresh replacement; if the
      // original crawler is slow-but-alive and posts a batch after that, ingesting
      // it would resurrect the cancelled job (the later updateStatus writes
      // crawling/complete unconditionally) and run two crawlers on one project.
      // Ack with a no-op so the crawler stops retrying. `failed` is intentionally
      // NOT dropped — the ingest-error self-heal retry path depends on it.
      if (crawlJob.status === "cancelled") {
        return {
          job_id: batch.job_id,
          batch_index: batch.batch_index,
          pages_processed: 0,
          is_final: batch.is_final,
        };
      }

      // Idempotency: the crawler delivers callbacks at-least-once, so a
      // re-delivered batch must not duplicate pages/scores/issues. Skip a batch
      // we've already fully processed (keyed by job + batch index).
      const idempotencyKey = `ingest:done:${batch.job_id}:${batch.batch_index}`;
      if (args.env.kvNamespace) {
        const alreadyProcessed = await args.env.kvNamespace.get(idempotencyKey);
        if (alreadyProcessed) {
          return {
            job_id: batch.job_id,
            batch_index: batch.batch_index,
            pages_processed: 0,
            is_final: batch.is_final,
          };
        }
      }

      const crawlStatus = CrawlStatus.from(crawlJob.status);
      if (crawlStatus.canTransitionTo("crawling")) {
        await deps.crawls.updateStatus(crawlJob.id, {
          status: "crawling",
          startedAt: (crawlJob.startedAt ?? new Date().toISOString()) as any,
        });
      }

      // 2. Insert pages
      const pageRows = batch.pages.map((p: CrawlPageResult) => {
        const contentTypeResult = detectContentType(
          p.url,
          p.extracted?.schema_types ?? [],
        );
        return {
          jobId: batch.job_id,
          projectId: crawlJob.projectId,
          url: p.url,
          canonicalUrl: p.canonical_url,
          statusCode: p.status_code,
          title: p.title,
          metaDesc: p.meta_description,
          contentHash: p.content_hash,
          wordCount: p.word_count,
          contentType: contentTypeResult.type,
          textLength: p.extracted?.text_length ?? null,
          htmlLength: p.extracted?.html_length ?? null,
          r2RawKey: p.html_r2_key,
          r2LhKey: p.lighthouse?.lh_r2_key ?? null,
          crawledAt: new Date(),
        };
      });

      const insertedPages = await deps.pages.createBatch(pageRows);
      await deps.crawls.updateStatus(crawlJob.id, { status: "scoring" });

      // 3. Load custom scoring weights (if project has a scoring profile)
      let customWeights: ScoringWeights | undefined;
      if (deps.db && deps.projects) {
        const project = await deps.projects.getById(crawlJob.projectId);
        if (project?.scoringProfileId) {
          const profile = await scoringProfileQueries(deps.db).getById(
            project.scoringProfileId,
          );
          if (profile?.weights) {
            customWeights = (
              typeof profile.weights === "string"
                ? JSON.parse(profile.weights)
                : profile.weights
            ) as ScoringWeights;
          }
        }
      }

      // 4. Score pages
      const { scoreRows, issueRows } = pageScoringService.scorePages(
        batch.pages,
        insertedPages,
        batch.job_id,
        customWeights,
      );

      const insertedScores = await deps.scores.createBatch(scoreRows);
      await deps.scores.createIssues(issueRows);

      // 4. Update crawl status
      const updateData: Parameters<CrawlRepository["updateStatus"]>[1] = {
        status: batch.is_final ? "complete" : "crawling",
        pagesFound: batch.stats.pages_found,
        pagesCrawled: batch.stats.pages_crawled,
        pagesScored: (crawlJob.pagesScored ?? 0) + insertedPages.length,
      };

      // Extract siteContext from the first page if present (it's domain-level data)
      const pageWithContext = batch.pages.find((p) => p.site_context);
      if (pageWithContext?.site_context) {
        updateData.siteContext = pageWithContext.site_context;
      }

      if (batch.is_final) {
        updateData.completedAt = new Date();
      }
      await deps.crawls.updateStatus(crawlJob.id, updateData);

      if (batch.is_final && insightCaptureService) {
        const [allScores, allIssues, allPages] = await Promise.all([
          deps.scores.listByJob(crawlJob.id),
          deps.scores.getIssuesByJob(crawlJob.id),
          deps.pages.listByJob(crawlJob.id),
        ]);
        await insightCaptureService.capture({
          crawlId: crawlJob.id,
          projectId: crawlJob.projectId,
          scores: allScores as CaptureArgs["scores"],
          issues: allIssues as CaptureArgs["issues"],
          pages: allPages as CaptureArgs["pages"],
        });
      }

      // 5. Schedule post-processing
      await postProcessingService.schedule({
        batch,
        crawlJobId: crawlJob.id,
        projectId: crawlJob.projectId,
        insertedPages,
        insertedScores,
        env: args.env,
        executionCtx: args.executionCtx,
      });

      // Mark this batch processed so an at-least-once redelivery is a no-op.
      if (args.env.kvNamespace) {
        await args.env.kvNamespace.put(idempotencyKey, "1", {
          expirationTtl: 86400,
        });
      }

      // 6. Return result
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
        databaseUrl: args.env.supabaseConnectionString!,
        anthropicApiKey: args.env.anthropicApiKey,
        kvNamespace: args.env.kvNamespace,
        r2Bucket: args.env.r2,
        jobId: args.jobId,
      });
    },
  };
}
