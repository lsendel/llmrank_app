import {
  scorePage,
  scoringResultToDimensions,
  generateRecommendations,
  type PageData,
} from "@llm-boost/scoring";
import {
  scoreQueries,
  pageQueries,
  crawlQueries,
  type AppDatabase,
} from "@llm-boost/db";
import {
  ServiceError,
  createLogger,
  type ExtractedData,
  type LighthouseResult,
  type LLMContentScores,
} from "@llm-boost/shared";

const log = createLogger({ service: "factor-rescoring" });

export interface RescoreFactorsInput {
  db: AppDatabase;
  jobId: string;
  cursor?: string;
  limit?: number;
}

export interface RescoreFactorsResult {
  jobId: string;
  processed: number;
  updated: number;
  skipped: number;
  nextCursor: string | null;
  done: boolean;
}

/** The shape we persist into page_scores.detail during ingest + LLM rescore. */
interface StoredDetail {
  extracted?: ExtractedData;
  lighthouse?: LighthouseResult | null;
  llmContentScores?: LLMContentScores | null;
  [key: string]: unknown;
}

function parseJson<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Rebuild the cross-page site context from the job-level `site_context` blob.
 *
 * Note: per-page signals that were only present in the original crawl batch
 * (response time, page size, the duplicate-detection content-hash map) are not
 * persisted, so issues that depend solely on them (SLOW_RESPONSE,
 * LARGE_PAGE_SIZE, DUPLICATE_CONTENT) are recomputed from whatever is available
 * and may differ from the original crawl. The deterministic page factors this
 * endpoint exists to correct (title, meta, schema/@graph) do not depend on them.
 */
function buildSiteContext(raw: unknown): PageData["siteContext"] {
  const sc = parseJson<Record<string, unknown>>(raw);
  if (!sc) return undefined;
  const sm = sc.sitemap_analysis as Record<string, unknown> | undefined;
  return {
    hasLlmsTxt: Boolean(sc.has_llms_txt),
    aiCrawlersBlocked: Array.isArray(sc.ai_crawlers_blocked)
      ? (sc.ai_crawlers_blocked as string[])
      : [],
    hasSitemap: Boolean(sc.has_sitemap),
    sitemapAnalysis: sm
      ? {
          isValid: Boolean(sm.is_valid),
          urlCount: Number(sm.url_count ?? 0),
          staleUrlCount: Number(sm.stale_url_count ?? 0),
          discoveredPageCount: Number(sm.discovered_page_count ?? 0),
        }
      : undefined,
    contentHashes: new Map(
      Object.entries((sc.content_hashes as Record<string, string>) ?? {}),
    ),
  };
}

/**
 * Re-run the deterministic factor scoring for one cursor-bounded batch of a
 * completed crawl job, rewriting page_scores + issues in place. Reconstructs
 * PageData from the persisted page row + page_scores.detail.extracted + the
 * job's site_context — no recrawl or R2 re-fetch needed, because the fixed
 * scoring engine is resilient to already-stored (e.g. @graph) extracted data.
 *
 * Batched by page id so a large job stays under Workers' per-request subrequest
 * limit: the caller loops, passing `nextCursor` until `done` is true.
 */
export async function rescoreFactors(
  input: RescoreFactorsInput,
): Promise<RescoreFactorsResult> {
  const { db, jobId } = input;
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200);
  const scores = scoreQueries(db);
  const pagesQ = pageQueries(db);
  const crawls = crawlQueries(db);

  const job = await crawls.getById(jobId);
  if (!job) {
    throw new ServiceError("NOT_FOUND", 404, "Crawl job not found");
  }
  const siteContext = buildSiteContext(job.siteContext);

  // Paginate by page id. Fetch one extra row to detect "more pages remain".
  const pageBatch = await pagesQ.listByJob(jobId, {
    cursor: input.cursor,
    limit,
  });
  const hasMore = pageBatch.length > limit;
  const batch = hasMore ? pageBatch.slice(0, limit) : pageBatch;

  let updated = 0;
  let skipped = 0;

  for (const page of batch) {
    const score = await scores.getByPage(page.id);
    const detail = parseJson<StoredDetail>(score?.detail);
    if (!score || !detail?.extracted) {
      skipped++;
      continue;
    }

    const pageData: PageData = {
      url: page.url,
      statusCode: page.statusCode ?? 200,
      title: page.title ?? null,
      metaDescription: page.metaDesc ?? null,
      canonicalUrl: page.canonicalUrl ?? null,
      wordCount: page.wordCount ?? 0,
      contentHash: page.contentHash ?? "",
      extracted: detail.extracted,
      lighthouse: detail.lighthouse ?? null,
      llmScores: detail.llmContentScores ?? null,
      siteContext,
    };

    const result = scorePage(pageData);
    const dims = scoringResultToDimensions(result, result.issues);

    await scores.update(score.id, {
      overallScore: result.overallScore,
      technicalScore: result.technicalScore,
      contentScore: result.contentScore,
      aiReadinessScore: result.aiReadinessScore,
      llmsTxtScore: dims.llms_txt,
      robotsTxtScore: dims.robots_crawlability,
      sitemapScore: dims.sitemap,
      schemaMarkupScore: dims.schema_markup,
      metaTagsScore: dims.meta_tags,
      botAccessScore: dims.bot_access,
      contentCiteabilityScore: dims.content_citeability,
      // Preserve everything already in detail (extracted, lighthouse, LLM
      // scores), refreshing only the derived performanceScore + letterGrade.
      detail: {
        ...detail,
        performanceScore: result.performanceScore,
        letterGrade: result.letterGrade,
      },
      platformScores: result.platformScores,
      recommendations: generateRecommendations(
        result.issues,
        result.overallScore,
      ),
    });

    await scores.clearIssues(page.id);
    await scores.createIssues(
      result.issues.map((issue) => ({
        pageId: page.id,
        jobId,
        category: issue.category,
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
        recommendation: issue.recommendation,
        data: issue.data ?? null,
      })),
    );
    updated++;
  }

  const nextCursor = hasMore ? batch[batch.length - 1].id : null;
  if (nextCursor === null) {
    log.info("factor rescore complete", { jobId, updated, skipped });
  }
  return {
    jobId,
    processed: batch.length,
    updated,
    skipped,
    nextCursor,
    done: !hasMore,
  };
}
