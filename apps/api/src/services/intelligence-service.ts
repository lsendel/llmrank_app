import { averageScores, ISSUE_DEFINITIONS } from "@llm-boost/shared";
import type {
  CrawlRepository,
  ProjectRepository,
  ScoreRepository,
  PageRepository,
  EnrichmentRepository,
  VisibilityRepository,
} from "@llm-boost/repositories";
import { assertCrawlAccess } from "./shared/assert-ownership";

export interface IntelligenceServiceDeps {
  crawls: CrawlRepository;
  projects: ProjectRepository;
  scores: ScoreRepository;
  pages: PageRepository;
  enrichments: EnrichmentRepository;
  visibility: VisibilityRepository;
}

export function createIntelligenceService(deps: IntelligenceServiceDeps) {
  return {
    async getFusedInsights(userId: string, crawlId: string) {
      const { project } = await assertCrawlAccess(deps, userId, crawlId);

      const [allScores, allIssues, allPages] = await Promise.all([
        deps.scores.listByJob(crawlId),
        deps.scores.getIssuesByJob(crawlId),
        deps.pages.listByJob(crawlId),
      ]);

      // --- AI Visibility Readiness ---
      // Composite: avg(aiReadinessScore) weighted 60% + avg(LLM citation_worthiness) weighted 40%
      const aiReadinessScores = allScores
        .map((s: any) => s.aiReadinessScore)
        .filter((v: any): v is number => v != null);
      const llmCitationScores = allScores
        .map(
          (s: any) => (s.detail as any)?.llmContentScores?.citation_worthiness,
        )
        .filter((v: any): v is number => v != null);

      const avgAiReadiness = averageScores(aiReadinessScores);
      const avgCitationWorthiness = averageScores(llmCitationScores);

      let aiVisibilityReadiness: number;
      if (llmCitationScores.length > 0) {
        aiVisibilityReadiness = Math.round(
          avgAiReadiness * 0.6 + avgCitationWorthiness * 0.4,
        );
      } else {
        aiVisibilityReadiness = avgAiReadiness;
      }

      // --- Platform Opportunities ---
      // Aggregate platform scores from all pages (if extension port has been applied)
      const platformOpportunities: any[] = [];
      const platformAgg = new Map<
        string,
        { scores: number[]; tips: Set<string> }
      >();

      for (const score of allScores) {
        const ps = (score as any).platformScores;
        if (!ps) continue;
        for (const [platform, data] of Object.entries(ps) as [string, any][]) {
          if (!platformAgg.has(platform)) {
            platformAgg.set(platform, { scores: [], tips: new Set() });
          }
          const agg = platformAgg.get(platform)!;
          agg.scores.push(data.score);
          if (data.tips) {
            for (const tip of data.tips) agg.tips.add(tip);
          }
        }
      }

      // Optionally include visibility rates per platform
      const visibilityRateByPlatform = new Map<string, number>();
      try {
        const trends = await deps.visibility.getTrends(project.id);
        for (const t of trends as any[]) {
          if (t.provider && t.mentionRate != null) {
            visibilityRateByPlatform.set(t.provider, t.mentionRate);
          }
        }
      } catch {
        // Visibility data is optional
      }

      for (const [platform, agg] of platformAgg) {
        const avgScore = averageScores(agg.scores);
        platformOpportunities.push({
          platform,
          currentScore: avgScore,
          opportunityScore: 100 - avgScore,
          topTips: [...agg.tips].slice(0, 3),
          visibilityRate: visibilityRateByPlatform.get(platform) ?? null,
        });
      }
      // Sort by opportunity (highest gap first)
      platformOpportunities.sort(
        (a, b) => b.opportunityScore - a.opportunityScore,
      );

      // --- Content Health Matrix ---
      const avgOverall = averageScores(
        allScores.map((s: any) => s.overallScore),
      );
      const llmScores = allScores
        .map((s: any) => {
          const lcs = (s.detail as any)?.llmContentScores;
          if (!lcs) return null;
          const vals = [
            lcs.clarity,
            lcs.authority,
            lcs.comprehensiveness,
            lcs.structure,
            lcs.citation_worthiness,
          ].filter((v: any): v is number => v != null);
          return vals.length
            ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length
            : null;
        })
        .filter((v: any): v is number => v != null);
      const avgLlm = llmScores.length ? averageScores(llmScores) : null;

      // GA4 + Clarity data (check enrichments for first page as sample)
      let engagementScore: number | null = null;
      let uxScore: number | null = null;

      if (allPages.length > 0) {
        try {
          const enrichments = await deps.enrichments.listByPage(allPages[0].id);
          for (const e of enrichments) {
            const data = e.data as any;
            if (e.provider === "ga4" && data?.bounceRate != null) {
              // Convert bounce rate to engagement score (lower bounce = higher engagement)
              engagementScore = Math.round(
                Math.max(0, 100 - data.bounceRate * 100),
              );
            }
            if (e.provider === "clarity" && data?.engagementScore != null) {
              uxScore = Math.round(data.engagementScore);
            }
          }
        } catch {
          // Enrichments are optional
        }
      }

      // --- ROI Quick Wins ---
      // Group issues by code, count affected pages, lookup score impact from ISSUE_DEFINITIONS
      const issueCountByCode = new Map<string, number>();
      for (const issue of allIssues) {
        issueCountByCode.set(
          issue.code,
          (issueCountByCode.get(issue.code) ?? 0) + 1,
        );
      }

      const roiQuickWins: any[] = [];
      for (const [code, affectedPages] of issueCountByCode) {
        const def = ISSUE_DEFINITIONS[code];
        if (!def) continue;
        roiQuickWins.push({
          issueCode: code,
          scoreImpact: Math.abs(def.scoreImpact),
          estimatedTrafficImpact: null, // GSC enrichment would go here in future
          effort: def.effortLevel,
          affectedPages,
        });
      }
      // Sort by total impact (scoreImpact x affectedPages) desc
      roiQuickWins.sort(
        (a, b) =>
          b.scoreImpact * b.affectedPages - a.scoreImpact * a.affectedPages,
      );

      return {
        aiVisibilityReadiness,
        platformOpportunities,
        contentHealthMatrix: {
          scoring: avgOverall,
          llmQuality: avgLlm,
          engagement: engagementScore,
          uxQuality: uxScore,
        },
        roiQuickWins: roiQuickWins.slice(0, 10),
      };
    },
  };
}
