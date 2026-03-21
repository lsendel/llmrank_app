import {
  scorePage,
  scoringResultToDimensions,
  generateRecommendations,
  type PageData,
  type ScoringWeights,
} from "@llm-boost/scoring";
import type { CrawlPageResult } from "@llm-boost/shared";
import type { ScoreRepository } from "@llm-boost/repositories";

interface InsertedPage {
  id: string;
  [key: string]: unknown;
}

export function createPageScoringService() {
  return {
    scorePages(
      batchPages: CrawlPageResult[],
      insertedPages: InsertedPage[],
      jobId: string,
      customWeights?: ScoringWeights,
    ): {
      scoreRows: Parameters<ScoreRepository["createBatch"]>[0];
      issueRows: Parameters<ScoreRepository["createIssues"]>[0];
    } {
      const scoreRows: Parameters<ScoreRepository["createBatch"]>[0] = [];
      const issueRows: Parameters<ScoreRepository["createIssues"]>[0] = [];

      for (let i = 0; i < insertedPages.length; i++) {
        const insertedPage = insertedPages[i];
        const crawlPageResult = batchPages[i];

        const sc = crawlPageResult.site_context;
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
          siteContext: sc
            ? {
                hasLlmsTxt: sc.has_llms_txt,
                aiCrawlersBlocked: sc.ai_crawlers_blocked,
                hasSitemap: sc.has_sitemap,
                sitemapAnalysis: sc.sitemap_analysis
                  ? {
                      isValid: sc.sitemap_analysis.is_valid,
                      urlCount: sc.sitemap_analysis.url_count,
                      staleUrlCount: sc.sitemap_analysis.stale_url_count,
                      discoveredPageCount:
                        sc.sitemap_analysis.discovered_page_count,
                    }
                  : undefined,
                contentHashes: new Map(Object.entries(sc.content_hashes ?? {})),
                responseTimeMs: sc.response_time_ms,
                pageSizeBytes: sc.page_size_bytes,
              }
            : undefined,
        };

        const result = scorePage(pageData, customWeights);
        const dims = scoringResultToDimensions(result, result.issues);

        scoreRows.push({
          pageId: insertedPage.id,
          jobId,
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
          lighthousePerf: crawlPageResult.lighthouse?.performance ?? null,
          lighthouseSeo: crawlPageResult.lighthouse?.seo ?? null,
          detail: {
            performanceScore: result.performanceScore,
            letterGrade: result.letterGrade,
            extracted: crawlPageResult.extracted,
            lighthouse: crawlPageResult.lighthouse ?? null,
            is_cross_domain_redirect:
              crawlPageResult.is_cross_domain_redirect || false,
            redirect_url: crawlPageResult.redirect_url ?? null,
          },
          platformScores: result.platformScores,
          recommendations: generateRecommendations(
            result.issues,
            result.overallScore,
          ),
        });

        for (const issue of result.issues) {
          issueRows.push({
            pageId: insertedPage.id,
            jobId,
            category: issue.category,
            severity: issue.severity,
            code: issue.code,
            message: issue.message,
            recommendation: issue.recommendation,
            data: issue.data ?? null,
          });
        }
      }

      return { scoreRows, issueRows };
    },
  };
}
