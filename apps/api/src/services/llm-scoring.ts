import {
  createAppDb,
  createAgencyDb,
  scoreQueries,
  pageQueries,
  batchJobQueries,
} from "@llm-boost/db";
import { LLMScorer } from "@llm-boost/llm";
import type { CrawlPageResult } from "@llm-boost/shared";
import { pMap } from "../lib/concurrent";
import { createLogger } from "@llm-boost/shared";

const log = createLogger({ service: "llm-scoring" });

type LLMUnavailableCause = "usage_limit" | "auth" | "rate_limit" | "other";

/** Classify an LLM provider error so a hard outage (cap/auth) reads clearly. */
function classifyLLMError(message: string): LLMUnavailableCause {
  const m = message.toLowerCase();
  if (
    m.includes("usage limit") ||
    m.includes("credit balance") ||
    m.includes("quota") ||
    m.includes("billing")
  )
    return "usage_limit";
  if (
    m.includes("authentication") ||
    m.includes("invalid x-api-key") ||
    m.includes("invalid api key") ||
    m.includes("401") ||
    m.includes("permission")
  )
    return "auth";
  if (m.includes("rate limit") || m.includes("429") || m.includes("overloaded"))
    return "rate_limit";
  return "other";
}

/**
 * Persist a per-job LLM-scoring status so a silent failure becomes visible
 * (read by monitoring/UI). Best-effort; never throws.
 */
async function markLLMStatus(
  kv:
    | {
        put(
          k: string,
          v: string,
          o?: { expirationTtl?: number },
        ): Promise<void>;
      }
    | undefined,
  jobId: string,
  data: {
    status: "ok" | "partial" | "unavailable";
    cause?: LLMUnavailableCause;
    scored: number;
    failed: number;
  },
): Promise<void> {
  if (!kv) return;
  await kv
    .put(
      `llm:status:${jobId}`,
      JSON.stringify({ ...data, at: new Date().toISOString() }),
      { expirationTtl: 7 * 24 * 60 * 60 },
    )
    .catch(() => {});
}

/** Minimum uncached pages before we use the batch API (otherwise sync is fine). */
const BATCH_THRESHOLD = 5;

export interface LLMScoringInput {
  databaseUrl: string;
  anthropicApiKey: string;
  kvNamespace?: KVNamespace;
  r2Bucket: R2Bucket;
  batchPages: CrawlPageResult[];
  insertedPages: { id: string; url: string }[];
  insertedScores: { id: string; pageId: string }[];
  jobId: string;
  projectId?: string;
}

/** Helper: extract plain text from R2-stored HTML, handling gzip encoding. */
async function extractTextFromR2(
  r2Bucket: R2Bucket,
  r2Key: string,
): Promise<string | null> {
  const r2Obj = await r2Bucket.get(r2Key);
  if (!r2Obj) return null;

  let html: string;
  if (r2Obj.httpMetadata?.contentEncoding === "gzip") {
    const ds = r2Obj.body.pipeThrough(new DecompressionStream("gzip"));
    html = await new Response(ds).text();
  } else {
    html = await r2Obj.text();
  }

  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Helper: re-score a page with LLM scores and persist to DB. */
async function persistLLMScore(
  db: ReturnType<typeof createAppDb>,
  scoreRowId: string,
  pageId: string,
  jobId: string,
  crawlPage: CrawlPageResult,
  llmScores: NonNullable<Awaited<ReturnType<LLMScorer["scoreContent"]>>>,
): Promise<void> {
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
                urlCount: crawlPage.site_context.sitemap_analysis.url_count,
                staleUrlCount:
                  crawlPage.site_context.sitemap_analysis.stale_url_count,
                discoveredPageCount:
                  crawlPage.site_context.sitemap_analysis.discovered_page_count,
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
  await scoreQueries(db).update(scoreRowId, {
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
  await scoreQueries(db).clearIssues(pageId);
  await scoreQueries(db).createIssues(
    result.issues.map((issue) => ({
      pageId,
      jobId,
      category: issue.category,
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      recommendation: issue.recommendation,
      data: issue.data ?? null,
    })),
  );
}

/**
 * Runs async LLM content scoring for each page in a batch.
 * Designed to run inside waitUntil() after the HTTP response is sent.
 *
 * Uses the Anthropic Message Batches API (50% cost savings) when >= 5
 * uncached pages are present. Falls back to synchronous per-page scoring
 * for small batches or on batch submission failure.
 */
export async function runLLMScoring(input: LLMScoringInput): Promise<void> {
  // In Fly.io report service context, databaseUrl is the Supabase connection string
  // which serves as both app-level and agency-level db access
  const db = createAgencyDb(input.databaseUrl) as any;
  const agencyDb = createAgencyDb(input.databaseUrl);
  const scorer = new LLMScorer({
    anthropicApiKey: input.anthropicApiKey,
    kvNamespace: input.kvNamespace,
  });

  // --- Step 1: Extract page text from R2, build page list for batch scoring ---
  const pageTexts: {
    pageId: string;
    text: string;
    contentHash: string;
    crawlPage: CrawlPageResult;
    scoreRowId: string;
  }[] = [];

  for (let i = 0; i < input.insertedPages.length; i++) {
    const crawlPage = input.batchPages[i];
    const scoreRow = input.insertedScores[i];

    if (!scoreRow) continue;
    if (crawlPage.word_count < 200 || !crawlPage.content_hash) continue;

    try {
      const text = await extractTextFromR2(
        input.r2Bucket,
        crawlPage.html_r2_key,
      );
      if (!text) continue;

      pageTexts.push({
        pageId: scoreRow.pageId,
        text,
        contentHash: crawlPage.content_hash,
        crawlPage,
        scoreRowId: scoreRow.id,
      });
    } catch (err) {
      log.error("R2 text extraction failed", {
        pageId: scoreRow.pageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (pageTexts.length === 0) return;

  // --- Step 2: Build batch requests (checks cache internally) ---
  const { cached, requests } = await scorer.buildBatchRequests(
    pageTexts.map((p) => ({
      pageId: p.pageId,
      text: p.text,
      contentHash: p.contentHash,
    })),
  );

  // Build lookup maps for later use
  const pageTextMap = new Map(pageTexts.map((p) => [p.pageId, p]));

  // --- Step 3: Write cached results immediately ---
  for (const hit of cached) {
    const entry = pageTextMap.get(hit.pageId);
    if (!entry) continue;
    try {
      await persistLLMScore(
        db,
        entry.scoreRowId,
        entry.pageId,
        input.jobId,
        entry.crawlPage,
        hit.scores,
      );
    } catch (err) {
      log.error("Failed to persist cached LLM score", {
        pageId: hit.pageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // --- Step 4: If all cached, return early ---
  if (requests.length === 0) {
    log.info("All pages scored from cache", { jobId: input.jobId });
    return;
  }

  // --- Step 5: Sync fallback for small batches ---
  if (requests.length < BATCH_THRESHOLD) {
    log.info("Using sync scoring (below batch threshold)", {
      jobId: input.jobId,
      count: requests.length,
    });
    let syncFailed = 0;
    let syncLastError = "";
    await pMap(
      requests,
      async (req) => {
        const entry = pageTextMap.get(req.custom_id);
        if (!entry) return;
        try {
          const llmScores = await scorer.scoreContent(
            entry.text,
            entry.contentHash,
          );
          if (!llmScores) return;
          await persistLLMScore(
            db,
            entry.scoreRowId,
            entry.pageId,
            input.jobId,
            entry.crawlPage,
            llmScores,
          );
        } catch (err) {
          syncFailed++;
          syncLastError = err instanceof Error ? err.message : String(err);
        }
      },
      { concurrency: 5, settle: true },
    );
    if (syncFailed > 0) {
      log.error(
        "LLM content scoring degraded — pages keep deterministic scores",
        {
          jobId: input.jobId,
          failed: syncFailed,
          total: requests.length,
          cause: classifyLLMError(syncLastError),
          error: syncLastError.slice(0, 300),
        },
      );
    }
    await markLLMStatus(input.kvNamespace, input.jobId, {
      status:
        syncFailed === 0
          ? "ok"
          : syncFailed >= requests.length
            ? "unavailable"
            : "partial",
      cause: syncFailed > 0 ? classifyLLMError(syncLastError) : undefined,
      scored: cached.length + (requests.length - syncFailed),
      failed: syncFailed,
    });
    return;
  }

  // --- Step 6: Submit batch via Anthropic Message Batches API ---
  let batch: Awaited<
    ReturnType<typeof scorer.anthropicClient.messages.batches.create>
  >;
  try {
    log.info("Submitting Anthropic batch", {
      jobId: input.jobId,
      requestCount: requests.length,
    });

    batch = await scorer.anthropicClient.messages.batches.create({
      requests,
    });
  } catch (err) {
    // --- Step 7: classify the SUBMISSION failure ---
    // No batch was accepted here, so a per-page sync retry cannot double-charge.
    const batchMsg = err instanceof Error ? err.message : String(err);
    const cause = classifyLLMError(batchMsg);
    if (cause !== "other") {
      // Hard provider unavailability (usage cap / auth / rate limit). A per-page
      // sync retry just fails the same way, so don't storm the logs — surface it
      // once, clearly, and stop. These pages keep their deterministic-only scores
      // until scoring is re-run after the provider issue is fixed.
      log.error(
        "LLM content scoring UNAVAILABLE — pages keep deterministic-only scores; " +
          "fix the provider issue and re-run scoring",
        {
          jobId: input.jobId,
          cause,
          pages: requests.length,
          error: batchMsg.slice(0, 300),
        },
      );
      await markLLMStatus(input.kvNamespace, input.jobId, {
        status: "unavailable",
        cause,
        scored: cached.length,
        failed: requests.length,
      });
      return;
    }

    // Transient/unknown batch error: fall back to per-page sync scoring.
    log.error("Batch submission failed, falling back to sync", {
      jobId: input.jobId,
      error: batchMsg,
    });
    let failed = 0;
    let lastError = "";
    await pMap(
      requests,
      async (req) => {
        const entry = pageTextMap.get(req.custom_id);
        if (!entry) return;
        try {
          const llmScores = await scorer.scoreContent(
            entry.text,
            entry.contentHash,
          );
          if (!llmScores) return;
          await persistLLMScore(
            db,
            entry.scoreRowId,
            entry.pageId,
            input.jobId,
            entry.crawlPage,
            llmScores,
          );
        } catch (syncErr) {
          failed++;
          lastError =
            syncErr instanceof Error ? syncErr.message : String(syncErr);
        }
      },
      { concurrency: 5, settle: true },
    );
    if (failed > 0) {
      log.error("LLM content scoring degraded after sync fallback", {
        jobId: input.jobId,
        failed,
        total: requests.length,
        cause: classifyLLMError(lastError),
        error: lastError.slice(0, 300),
      });
    }
    await markLLMStatus(input.kvNamespace, input.jobId, {
      status:
        failed === 0
          ? "ok"
          : failed >= requests.length
            ? "unavailable"
            : "partial",
      cause: failed > 0 ? classifyLLMError(lastError) : undefined,
      scored: cached.length + (requests.length - failed),
      failed,
    });
    return;
  }

  // The batch was ACCEPTED by Anthropic (and will be billed). Persist its
  // reference so the poller can collect the results. If this bookkeeping write
  // fails we must NOT re-submit or sync-fallback — that double-charges for work
  // Anthropic is already running. Log the orphaned batch and keep deterministic
  // scores until it is reconciled.
  try {
    await batchJobQueries(agencyDb).create({
      batchId: batch.id,
      jobId: input.jobId,
      projectId: input.projectId ?? "",
      totalRequests: requests.length,
    });
    log.info("Anthropic batch submitted", {
      jobId: input.jobId,
      batchId: batch.id,
      totalRequests: requests.length,
    });
  } catch (bookkeepErr) {
    log.error(
      "Anthropic batch submitted but persisting the batch_jobs row failed — " +
        "the batch will run (and be billed) but the poller cannot collect it. " +
        "NOT retrying, to avoid double-charging; pages keep deterministic scores.",
      {
        jobId: input.jobId,
        batchId: batch.id,
        error:
          bookkeepErr instanceof Error
            ? bookkeepErr.message
            : String(bookkeepErr),
      },
    );
    await markLLMStatus(input.kvNamespace, input.jobId, {
      status: "partial",
      scored: cached.length,
      failed: requests.length,
    });
  }
}

interface RescoreInput {
  databaseUrl: string; // Supabase connection string (Fly.io report service context)
  anthropicApiKey: string;
  kvNamespace?: KVNamespace;
  r2Bucket: R2Bucket;
  jobId: string;
}

/**
 * Re-runs LLM content scoring on all pages in a completed crawl job.
 */
export async function rescoreLLM(input: RescoreInput) {
  const db = createAgencyDb(input.databaseUrl) as any;
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
