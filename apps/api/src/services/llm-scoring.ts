import { createDb, scoreQueries, pageQueries } from "@llm-boost/db";
import { LLMScorer } from "@llm-boost/llm";
import type { CrawlPageResult } from "@llm-boost/shared";
import { pMap } from "../lib/concurrent";
import { createLogger } from "../lib/logger";

const log = createLogger({ service: "llm-scoring" });

export interface LLMScoringInput {
  databaseUrl: string;
  anthropicApiKey: string;
  kvNamespace?: KVNamespace;
  r2Bucket: R2Bucket;
  batchPages: CrawlPageResult[];
  insertedPages: { id: string; url: string }[];
  insertedScores: { id: string; pageId: string }[];
  jobId: string;
}

/**
 * Runs async LLM content scoring for each page in a batch.
 * Designed to run inside waitUntil() after the HTTP response is sent.
 */
export async function runLLMScoring(input: LLMScoringInput): Promise<void> {
  const db = createDb(input.databaseUrl);
  const scorer = new LLMScorer({
    anthropicApiKey: input.anthropicApiKey,
    kvNamespace: input.kvNamespace,
  });

  await pMap(
    input.insertedPages,
    async (_insertedPage, i) => {
      const crawlPage = input.batchPages[i];
      const scoreRow = input.insertedScores[i];

      if (!scoreRow) return;
      if (crawlPage.word_count < 200 || !crawlPage.content_hash) return;

      try {
        const r2Obj = await input.r2Bucket.get(crawlPage.html_r2_key);
        if (!r2Obj) return;

        let html: string;
        if (r2Obj.httpMetadata?.contentEncoding === "gzip") {
          const ds = r2Obj.body.pipeThrough(new DecompressionStream("gzip"));
          html = await new Response(ds).text();
        } else {
          html = await r2Obj.text();
        }

        const text = html
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        const llmScores = await scorer.scoreContent(
          text,
          crawlPage.content_hash,
        );
        if (!llmScores) return;

        // Re-score the page with LLM scores populated
        const { scorePage, generateRecommendations } =
          await import("@llm-boost/scoring");
        const pageData = {
          url: crawlPage.url,
          statusCode: crawlPage.status_code,
          title: crawlPage.title,
          metaDescription: crawlPage.meta_description,
          canonicalUrl: crawlPage.canonical_url,
          wordCount: crawlPage.word_count,
          contentHash: crawlPage.content_hash,
          extracted: crawlPage.extracted,
          lighthouse: crawlPage.lighthouse ?? null,
          llmScores,
          siteContext: crawlPage.site_context
            ? {
                hasLlmsTxt: crawlPage.site_context.has_llms_txt,
                aiCrawlersBlocked: crawlPage.site_context.ai_crawlers_blocked,
                hasSitemap: crawlPage.site_context.has_sitemap,
                sitemapAnalysis: crawlPage.site_context.sitemap_analysis
                  ? {
                      isValid: crawlPage.site_context.sitemap_analysis.is_valid,
                      urlCount:
                        crawlPage.site_context.sitemap_analysis.url_count,
                      staleUrlCount:
                        crawlPage.site_context.sitemap_analysis.stale_url_count,
                      discoveredPageCount:
                        crawlPage.site_context.sitemap_analysis
                          .discovered_page_count,
                    }
                  : undefined,
                contentHashes: new Map(
                  Object.entries(crawlPage.site_context.content_hashes),
                ),
                responseTimeMs: crawlPage.site_context.response_time_ms,
                pageSizeBytes: crawlPage.site_context.page_size_bytes,
              }
            : undefined,
        };

        const result = scorePage(pageData);

        // Update main score fields
        await scoreQueries(db).update(scoreRow.id, {
          overallScore: result.overallScore,
          technicalScore: result.technicalScore,
          contentScore: result.contentScore,
          aiReadinessScore: result.aiReadinessScore,
          detail: {
            performanceScore: result.performanceScore,
            letterGrade: result.letterGrade,
            extracted: crawlPage.extracted,
            lighthouse: crawlPage.lighthouse ?? null,
            llmContentScores: llmScores,
          },
          platformScores: result.platformScores,
          recommendations: generateRecommendations(
            result.issues,
            result.overallScore,
          ),
        });

        // Replace issues
        await scoreQueries(db).clearIssues(scoreRow.pageId);
        await scoreQueries(db).createIssues(
          result.issues.map((issue) => ({
            pageId: scoreRow.pageId,
            jobId: input.jobId,
            category: issue.category,
            severity: issue.severity,
            code: issue.code,
            message: issue.message,
            recommendation: issue.recommendation,
            data: issue.data ?? null,
          })),
        );
      } catch (err) {
        log.error("LLM scoring failed for page", {
          pageId: scoreRow.pageId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    { concurrency: 5, settle: true },
  );
}

interface RescoreInput {
  databaseUrl: string;
  anthropicApiKey: string;
  kvNamespace?: KVNamespace;
  r2Bucket: R2Bucket;
  jobId: string;
}

/**
 * Re-runs LLM content scoring on all pages in a completed crawl job.
 */
export async function rescoreLLM(input: RescoreInput) {
  const db = createDb(input.databaseUrl);
  const scorer = new LLMScorer({
    anthropicApiKey: input.anthropicApiKey,
    kvNamespace: input.kvNamespace,
  });

  const scores = await scoreQueries(db).listByJob(input.jobId);
  const pages = await pageQueries(db).listByJob(input.jobId);
  const pageMap = new Map(pages.map((p) => [p.id, p]));

  const results: {
    pageId: string;
    url: string;
    status: string;
    encoding?: string;
  }[] = [];

  for (const score of scores) {
    const page = pageMap.get(score.pageId);
    if (!page) {
      results.push({ pageId: score.pageId, url: "unknown", status: "no_page" });
      continue;
    }
    if ((page.wordCount ?? 0) < 200 || !page.contentHash) {
      results.push({
        pageId: score.pageId,
        url: page.url,
        status: "skipped_thin",
      });
      continue;
    }
    if (!page.r2RawKey) {
      results.push({
        pageId: score.pageId,
        url: page.url,
        status: "no_r2_key",
      });
      continue;
    }

    try {
      const r2Obj = await input.r2Bucket.get(page.r2RawKey);
      if (!r2Obj) {
        results.push({
          pageId: score.pageId,
          url: page.url,
          status: "r2_not_found",
        });
        continue;
      }

      const encoding = r2Obj.httpMetadata?.contentEncoding ?? "none";
      let html: string;
      if (encoding === "gzip") {
        const ds = r2Obj.body.pipeThrough(new DecompressionStream("gzip"));
        html = await new Response(ds).text();
      } else {
        html = await r2Obj.text();
      }

      const text = html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      if (wordCount < 50) {
        results.push({
          pageId: score.pageId,
          url: page.url,
          status: `too_short_${wordCount}`,
          encoding,
        });
        continue;
      }

      const llmScores = await scorer.scoreContent(text, page.contentHash);
      if (!llmScores) {
        results.push({
          pageId: score.pageId,
          url: page.url,
          status: "scorer_returned_null",
          encoding,
        });
        continue;
      }

      await scoreQueries(db).updateDetail(score.id, {
        llmContentScores: llmScores,
      });
      results.push({
        pageId: score.pageId,
        url: page.url,
        status: "scored",
        encoding,
      });
    } catch (err) {
      results.push({
        pageId: score.pageId,
        url: page.url,
        status: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { jobId: input.jobId, total: scores.length, results };
}
