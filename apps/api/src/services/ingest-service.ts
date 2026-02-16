import {
  CrawlResultBatchSchema,
  CrawlStatus,
  type CrawlPageResult,
} from "@llm-boost/shared";
import { detectContentType } from "@llm-boost/scoring";
import type {
  CrawlRepository,
  PageRepository,
  ProjectRepository,
  ScoreRepository,
  OutboxRepository,
  UserRepository,
} from "../repositories";
import { ServiceError } from "./errors";
import { rescoreLLM } from "./llm-scoring";
import { createPageScoringService } from "./page-scoring-service";
import { createPostProcessingService } from "./post-processing-service";

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
  const pageScoringService = createPageScoringService();
  const postProcessingService = createPostProcessingService({
    crawls: deps.crawls,
    projects: deps.projects,
    users: deps.users,
    outbox: deps.outbox,
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

      const crawlStatus = CrawlStatus.from(crawlJob.status);
      if (crawlStatus.canTransitionTo("crawling")) {
        await deps.crawls.updateStatus(crawlJob.id, {
          status: "crawling",
          startedAt: crawlJob.startedAt ?? new Date(),
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

      // 3. Score pages
      const { scoreRows, issueRows } = pageScoringService.scorePages(
        batch.pages,
        insertedPages,
        batch.job_id,
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
      if (batch.is_final) {
        updateData.completedAt = new Date();
      }
      await deps.crawls.updateStatus(crawlJob.id, updateData);

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
        databaseUrl: args.env.databaseUrl,
        anthropicApiKey: args.env.anthropicApiKey,
        kvNamespace: args.env.kvNamespace,
        r2Bucket: args.env.r2,
        jobId: args.jobId,
      });
    },
  };
}
