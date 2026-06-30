import {
  createAppDb,
  createAgencyDb,
  scoreQueries,
  pageQueries,
  batchJobQueries,
} from "@llm-boost/db";
import { LLMScorer, WorkersAiScorer, type WorkersAi } from "@llm-boost/llm";
import type { CrawlPageResult, LLMContentScores } from "@llm-boost/shared";
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
 * Additive calibration for the Workers AI content scorer ONLY.
 *
 * Phase 0 validation (n=60 families.care pages, Haiku-batch reference vs the
 * production Workers AI small model) found the small model systematically
 * UNDER-scores three of the five content dimensions, stable across 16 page
 * types:
 *   - structure            mean +15.9 (σ7.8) — robust, positive on every page
 *                          type (+9..+26); small models judge structural
 *                          quality worst.            → corrected (+13)
 *   - authority            mean +10.5 (σ11.7) — real but noisy.   → +8
 *   - clarity              mean  +6.3 (σ7.1) — small, consistent. → +5
 *   - citation_worthiness  mean  +3.1 — within noise.            → 0 (uncorrected)
 *   - comprehensiveness    mean  -2.2 — within noise.            → 0 (uncorrected)
 *
 * Offsets are ~80% of the measured means (deliberately under-correct), and the
 * two within-noise dimensions are left untouched.
 *
 * SCOPE & CAVEAT: Workers AI path only — the Anthropic/Haiku scorer is the
 * reference and must NOT be calibrated. The sample is a single domain
 * (eldercare); cross-domain generalization is NOT yet validated. This ships as a
 * reviewable proposal: re-validate on mixed-domain content before relying on it,
 * tune the offsets, or instead route paid tiers to Haiku-batch and keep Workers
 * AI for free-tier screening.
 *
 * Applied exactly ONCE, at the Workers AI boundary (runWorkersAiScoring), to the
 * raw model output before it is stored or feeds the scoring deductions. The
 * scorer's KV cache stores RAW scores, so re-reads re-apply cleanly and the
 * offsets can change without busting the cache. Clamped to [0,100].
 */
export const WORKERS_AI_CALIBRATION: Readonly<LLMContentScores> = {
  clarity: 5,
  authority: 8,
  comprehensiveness: 0,
  structure: 13,
  citation_worthiness: 0,
};

const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

/**
 * Apply {@link WORKERS_AI_CALIBRATION} to a raw Workers AI score. Pure — does not
 * mutate the input. Each dimension is offset then clamped to [0,100], so an
 * already-high score (e.g. structure 92 → 105) saturates at 100 rather than
 * exceeding the scale.
 */
export function applyWorkersAiCalibration(
  raw: LLMContentScores,
): LLMContentScores {
  return {
    clarity: clamp100(raw.clarity + WORKERS_AI_CALIBRATION.clarity),
    authority: clamp100(raw.authority + WORKERS_AI_CALIBRATION.authority),
    comprehensiveness: clamp100(
      raw.comprehensiveness + WORKERS_AI_CALIBRATION.comprehensiveness,
    ),
    structure: clamp100(raw.structure + WORKERS_AI_CALIBRATION.structure),
    citation_worthiness: clamp100(
      raw.citation_worthiness + WORKERS_AI_CALIBRATION.citation_worthiness,
    ),
  };
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
  // Worker context (Cloudflare): the app D1 binding (where page_scores actually
  // live) and the Workers AI binding. When both are present, scoring runs
  // synchronously via Workers AI and persists straight to D1 — the correct, cheap
  // path. `databaseUrl` (the Fly.io/Supabase path) is then unused; it never wrote
  // the worker's D1 scores, which is why worker LLM scoring was previously dead.
  d1?: D1Database;
  ai?: WorkersAi;
  workersAiModel?: string;
}

interface PageTextEntry {
  pageId: string;
  text: string;
  contentHash: string;
  crawlPage: CrawlPageResult;
  scoreRowId: string;
}

/** Extract scoreable page text from R2 for each inserted page (skips thin/no-text). */
async function extractPageTexts(
  input: LLMScoringInput,
): Promise<PageTextEntry[]> {
  const pageTexts: PageTextEntry[] = [];
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
  return pageTexts;
}

/**
 * Worker-context scoring: score each page synchronously via Workers AI and write
 * the result to D1 (with full headline recompute via persistLLMScore). This is
 * the correct path for Cloudflare worker crawls — page_scores live in D1, and
 * Workers AI runs inside the worker, so there is no async batch/poller and no
 * Supabase round-trip. Cheap enough (~8x under batched Claude) to run inline; the
 * per-ingest-batch dispatch keeps each call to a small page set.
 */
async function runWorkersAiScoring(
  input: LLMScoringInput,
  ai: WorkersAi,
  d1: D1Database,
): Promise<void> {
  const appDb = createAppDb(d1);
  const scorer = new WorkersAiScorer({
    ai,
    kvNamespace: input.kvNamespace,
    model: input.workersAiModel,
  });

  const pageTexts = await extractPageTexts(input);
  if (pageTexts.length === 0) return;

  let scored = 0;
  let failed = 0;
  let lastError = "";
  await pMap(
    pageTexts,
    async (p) => {
      try {
        const raw = await scorer.scoreContent(p.text, p.contentHash);
        if (!raw) return; // thin or unparseable — keep deterministic score
        // Correct the small model's known, validated under-scoring before the
        // scores are stored and feed the content/ai-readiness deductions. Raw
        // scores remain in the scorer's KV cache (see WORKERS_AI_CALIBRATION).
        const scores = applyWorkersAiCalibration(raw);
        await persistLLMScore(
          appDb,
          p.scoreRowId,
          p.pageId,
          input.jobId,
          p.crawlPage,
          scores,
        );
        scored++;
      } catch (err) {
        failed++;
        lastError = err instanceof Error ? err.message : String(err);
      }
    },
    { concurrency: 8, settle: true },
  );

  if (failed > 0) {
    log.error(
      "Workers AI content scoring degraded — pages keep deterministic scores",
      {
        jobId: input.jobId,
        failed,
        total: pageTexts.length,
        cause: classifyLLMError(lastError),
        error: lastError.slice(0, 300),
      },
    );
  }
  await markLLMStatus(input.kvNamespace, input.jobId, {
    status:
      failed === 0
        ? "ok"
        : failed >= pageTexts.length
          ? "unavailable"
          : "partial",
    cause: failed > 0 ? classifyLLMError(lastError) : undefined,
    scored,
    failed,
  });

  // Surface partial/total failures so the outbox event is RETRIED (the outbox
  // processor bumps attempts + re-schedules, up to MAX_ATTEMPTS). Without this
  // the event is marked completed and the failed pages keep an inflated
  // deterministic score forever (they never get the LLM content deductions —
  // a scoring *failure* silently makes the grade look *better*). On retry,
  // already-scored pages hit the KV cache so only the failed pages re-attempt;
  // once attempts are exhausted the event stays failed (observable) instead of
  // disappearing. markLLMStatus is written first so the per-job status survives.
  if (failed > 0) {
    throw new Error(
      `Workers AI content scoring failed for ${failed}/${pageTexts.length} page(s) (job ${input.jobId})`,
    );
  }
}

/**
 * Strip stored HTML to plain scoreable text. Removes <script>/<style> blocks
 * (INCLUDING their contents — e.g. JSON-LD structured data) and HTML comments
 * BEFORE stripping tags, so the LLM content scorer isn't fed raw JSON-LD as
 * noise. Mirrors the crawler's get_all_text extraction (which excludes
 * <script>/<style>); these paths previously stripped only tags, leaking the
 * JSON-LD text into the scoring prompt and depressing content scores.
 */
export function htmlToScoringText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  return htmlToScoringText(html);
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
      // Preserve the redirect metadata the initial deterministic score wrote
      // (page-scoring-service); page lists + strategy-service filter on it, so
      // rewriting detail without these fields would un-hide redirect pages.
      is_cross_domain_redirect: crawlPage.is_cross_domain_redirect || false,
      redirect_url: crawlPage.redirect_url ?? null,
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
  // Worker context (Cloudflare): score synchronously via Workers AI and write
  // straight to D1. This is the correct, cheap path; the legacy Supabase/Anthropic
  // path below was built for the Fly.io report service and never wrote the
  // worker's D1 page_scores (so worker LLM scoring was effectively dead).
  if (input.ai && input.d1) {
    return runWorkersAiScoring(input, input.ai, input.d1);
  }

  // --- Legacy path (Fly.io report service): databaseUrl is the Supabase
  // connection string serving as both app-level and agency-level db access. ---
  const db = createAgencyDb(input.databaseUrl) as any;
  const agencyDb = createAgencyDb(input.databaseUrl);
  const scorer = new LLMScorer({
    anthropicApiKey: input.anthropicApiKey,
    kvNamespace: input.kvNamespace,
  });

  // --- Step 1: Extract page text from R2, build page list for batch scoring ---
  const pageTexts = await extractPageTexts(input);

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

  // --- Step 5: Sync fallback for small batches (or when we can't bookkeep) ---
  // Without a valid projectId the batch_jobs row (project_id is a required UUID)
  // can't be persisted, which would orphan an already-billed batch — so score
  // these synchronously instead of submitting an unpollable batch.
  if (requests.length < BATCH_THRESHOLD || !input.projectId) {
    log.info("Using sync scoring (below batch threshold or no projectId)", {
      jobId: input.jobId,
      count: requests.length,
      hasProjectId: Boolean(input.projectId),
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

      const text = htmlToScoringText(html);
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
