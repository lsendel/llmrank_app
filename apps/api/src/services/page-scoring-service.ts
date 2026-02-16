import {
  scorePage,
  generateRecommendations,
  type PageData,
  type ScoringWeights,
} from "@llm-boost/scoring";
import type { CrawlPageResult } from "@llm-boost/shared";
import type { ScoreRepository } from "../repositories";

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

        const result = scorePage(pageData, customWeights);

        scoreRows.push({
          pageId: insertedPage.id,
          jobId,
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
