import { Hono } from "hono";
import type { AppEnv } from "../index";
import { hmacMiddleware } from "../middleware/hmac";
import {
  createDb,
  crawlQueries,
  pageQueries,
  scoreQueries,
} from "@llm-boost/db";
import {
  CrawlResultBatchSchema,
  type CrawlPageResult,
} from "@llm-boost/shared";
import { scorePage, type PageData } from "@llm-boost/scoring";
import { LLMScorer } from "@llm-boost/llm";

export const ingestRoutes = new Hono<AppEnv>();

// All ingest routes require HMAC verification
ingestRoutes.use("*", hmacMiddleware);

// ---------------------------------------------------------------------------
// POST /batch — Receive crawl results from the Hetzner crawler
// ---------------------------------------------------------------------------

ingestRoutes.post("/batch", async (c) => {
  const db = c.get("db");

  // The HMAC middleware may have stored the body; otherwise re-read it
  let rawBody: string;
  const stored = c.get("parsedBody" as never) as string | undefined;
  if (stored) {
    rawBody = stored;
  } else {
    rawBody = await c.req.text();
  }

  const parsed = CrawlResultBatchSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid batch payload",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const batch = parsed.data;

  // Look up the crawl job
  const crawlJob = await crawlQueries(db).getById(batch.job_id);
  if (!crawlJob) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Crawl job not found" } },
      404,
    );
  }

  // Update status to crawling if still pending/queued
  if (crawlJob.status === "pending" || crawlJob.status === "queued") {
    await crawlQueries(db).updateStatus(crawlJob.id, {
      status: "crawling",
      startedAt: crawlJob.startedAt ?? new Date(),
    });
  }

  // Insert pages into DB
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

  const insertedPages = await pageQueries(db).createBatch(pageRows);

  // Score each page in memory, then batch-insert scores + issues
  await crawlQueries(db).updateStatus(crawlJob.id, { status: "scoring" });

  const scoreRows: Parameters<
    ReturnType<typeof scoreQueries>["createBatch"]
  >[0] = [];
  const issueRows: Parameters<
    ReturnType<typeof scoreQueries>["createIssues"]
  >[0] = [];

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

  // 2 batch inserts instead of N*2 sequential inserts
  const insertedScores = await scoreQueries(db).createBatch(scoreRows);
  await scoreQueries(db).createIssues(issueRows);

  // Update crawl job progress
  const updateData: Parameters<
    ReturnType<typeof crawlQueries>["updateStatus"]
  >[1] = {
    status: batch.is_final ? "complete" : "crawling",
    pagesFound: batch.stats.pages_found,
    pagesCrawled: batch.stats.pages_crawled,
    pagesScored: (crawlJob.pagesScored ?? 0) + insertedPages.length,
  };

  if (batch.is_final) {
    updateData.completedAt = new Date();
  }

  await crawlQueries(db).updateStatus(crawlJob.id, updateData);

  // Trigger async LLM content scoring via waitUntil
  // This runs after the response is sent, so it doesn't block the crawler callback
  if (c.env.ANTHROPIC_API_KEY) {
    const scoringPromise = (async () => {
      const llmDb = createDb(c.env.DATABASE_URL);
      const scorer = new LLMScorer({
        anthropicApiKey: c.env.ANTHROPIC_API_KEY,
        kvNamespace: c.env.KV,
      });

      for (let i = 0; i < insertedPages.length; i++) {
        const crawlPage = batch.pages[i];
        const scoreRow = insertedScores[i];

        if (!scoreRow) continue;
        if (crawlPage.word_count < 200 || !crawlPage.content_hash) continue;

        try {
          const r2Obj = await c.env.R2.get(crawlPage.html_r2_key);
          if (!r2Obj) continue;

          const html = await r2Obj.text();
          const text = html
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          const llmScores = await scorer.scoreContent(
            text,
            crawlPage.content_hash,
          );
          if (!llmScores) continue;

          // Update directly using the score ID we already have
          await scoreQueries(llmDb).updateDetail(scoreRow.id, {
            llmContentScores: llmScores,
          });
        } catch (err) {
          console.error(`LLM scoring failed for page ${scoreRow.pageId}:`, err);
        }
      }
    })();

    c.executionCtx.waitUntil(scoringPromise);
  }

  return c.json({
    data: {
      job_id: batch.job_id,
      batch_index: batch.batch_index,
      pages_processed: insertedPages.length,
      is_final: batch.is_final,
    },
  });
});
