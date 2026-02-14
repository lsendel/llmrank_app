import { createDb, scoreQueries, pageQueries } from "@llm-boost/db";
import { LLMScorer } from "@llm-boost/llm";
import type { CrawlPageResult } from "@llm-boost/shared";
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

  for (let i = 0; i < input.insertedPages.length; i++) {
    const crawlPage = input.batchPages[i];
    const scoreRow = input.insertedScores[i];

    if (!scoreRow) continue;
    if (crawlPage.word_count < 200 || !crawlPage.content_hash) continue;

    try {
      const r2Obj = await input.r2Bucket.get(crawlPage.html_r2_key);
      if (!r2Obj) continue;

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

      const llmScores = await scorer.scoreContent(text, crawlPage.content_hash);
      if (!llmScores) continue;

      await scoreQueries(db).updateDetail(scoreRow.id, {
        llmContentScores: llmScores,
      });
    } catch (err) {
      log.error("LLM scoring failed for page", {
        pageId: scoreRow.pageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
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
