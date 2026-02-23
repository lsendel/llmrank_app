import type { Database } from "@llm-boost/db";
import {
  projectQueries,
  crawlQueries,
  scoreQueries,
  savedKeywordQueries,
  competitorQueries,
  pipelineRunQueries,
} from "@llm-boost/db";

export interface Recommendation {
  type: "gap" | "platform" | "issue" | "trend" | "coverage";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  provider?: string;
  fixUrl?: string;
}

interface GapData {
  query: string;
  competitorsCited: Array<{ domain: string }>;
}

interface PlatformFailure {
  platform: string;
  label: string;
  issueCode: string;
  importance: "critical" | "important" | "recommended";
}

interface TrendData {
  provider: string;
  currentRate: number;
  previousRate: number;
}

export function generateRecommendations(input: {
  gaps: GapData[];
  platformFailures: PlatformFailure[];
  issueCodesPresent: Set<string>;
  trends: TrendData[];
  providersUsed: Set<string>;
  projectId: string;
}): Recommendation[] {
  const recs: Recommendation[] = [];

  // 1. Visibility gaps — queries where competitors are cited but user is not
  for (const gap of input.gaps.slice(0, 3)) {
    recs.push({
      type: "gap",
      title: `Invisible for "${gap.query}"`,
      description: `Competitors ${gap.competitorsCited.map((c) => c.domain).join(", ")} are cited for this query but you are not. Create targeted content addressing this topic.`,
      impact: "high",
      fixUrl: `/dashboard/projects/${input.projectId}?tab=strategy`,
    });
  }

  // 2. Platform readiness — critical checks failing
  const criticalFailures = input.platformFailures.filter(
    (f) => f.importance === "critical",
  );
  for (const failure of criticalFailures.slice(0, 3)) {
    const descriptions: Record<string, string> = {
      AI_CRAWLER_BLOCKED: `${failure.platform}'s crawler is blocked by your robots.txt. This prevents the AI from accessing your content entirely.`,
      NO_STRUCTURED_DATA: `Missing JSON-LD schema markup. ${failure.platform} uses structured data to understand and cite your content accurately.`,
      MISSING_LLMS_TXT: `No llms.txt file found. This file tells AI engines how to interpret and cite your content.`,
      THIN_CONTENT: `Content is too thin for ${failure.platform} to consider citation-worthy. Aim for 1500+ words with factual depth.`,
      CITATION_WORTHINESS: `Content lacks citation-worthy elements (statistics, original data, expert quotes) that ${failure.platform} looks for.`,
    };

    recs.push({
      type: "platform",
      title: `${failure.label} failing for ${failure.platform}`,
      description:
        descriptions[failure.issueCode] ??
        `Fix "${failure.label}" to improve ${failure.platform} visibility.`,
      impact: "high",
      provider: failure.platform.toLowerCase().replace(/ /g, "_"),
      fixUrl: `/dashboard/projects/${input.projectId}?tab=issues`,
    });
  }

  // 3. SoV trend drops — providers where visibility is declining
  for (const trend of input.trends) {
    const drop = trend.previousRate - trend.currentRate;
    if (drop > 0.15) {
      recs.push({
        type: "trend",
        title: `${trend.provider} visibility dropped ${Math.round(drop * 100)}%`,
        description: `Your brand mention rate on ${trend.provider} fell from ${Math.round(trend.previousRate * 100)}% to ${Math.round(trend.currentRate * 100)}% this week. Review recent content changes and competitor activity.`,
        impact: drop > 0.3 ? "high" : "medium",
        provider: trend.provider,
      });
    }
  }

  // 4. Provider coverage gaps — providers not yet checked
  const allProviders = [
    "chatgpt",
    "claude",
    "perplexity",
    "gemini",
    "copilot",
    "gemini_ai_mode",
    "grok",
  ];
  const unchecked = allProviders.filter((p) => !input.providersUsed.has(p));
  if (unchecked.length > 0) {
    recs.push({
      type: "coverage",
      title: `Not tracking ${unchecked.length} AI provider${unchecked.length > 1 ? "s" : ""}`,
      description: `You haven't run visibility checks on ${unchecked.join(", ")}. Add these providers to get a complete picture.`,
      impact: unchecked.length >= 3 ? "medium" : "low",
    });
  }

  // Sort by impact (high first)
  const impactOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return recs.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Dashboard "Next Best Actions" — queries DB to surface project-level actions
// ---------------------------------------------------------------------------

export interface NextAction {
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  action?: string;
}

export function createRecommendationsService(db: Database) {
  return {
    async getForProject(projectId: string): Promise<NextAction[]> {
      const project = await projectQueries(db).getById(projectId);
      if (!project) return [];

      const recommendations: NextAction[] = [];

      // Check latest crawl
      const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
      if (!latestCrawl) {
        recommendations.push({
          priority: "critical",
          category: "crawl",
          title: "Run your first crawl",
          description:
            "No crawl data yet. Start a crawl to get your AI-readiness score.",
          action: "start_crawl",
        });
        return recommendations;
      }

      // Check crawl age
      const daysSinceCrawl = latestCrawl.completedAt
        ? Math.floor(
            (Date.now() - latestCrawl.completedAt.getTime()) / 86400000,
          )
        : null;
      if (daysSinceCrawl && daysSinceCrawl > 14) {
        recommendations.push({
          priority: "medium",
          category: "crawl",
          title: "Re-crawl your site",
          description: `Last crawl was ${daysSinceCrawl} days ago. Re-crawl to check for changes.`,
          action: "start_crawl",
        });
      }

      // Check critical issues
      if (latestCrawl.id && latestCrawl.status === "complete") {
        const issues = await scoreQueries(db).getIssuesByJob(latestCrawl.id);
        const criticalIssues = issues.filter((i) => i.severity === "critical");
        if (criticalIssues.length > 0) {
          recommendations.push({
            priority: "critical",
            category: "issues",
            title: `${criticalIssues.length} critical issues found`,
            description: criticalIssues
              .map((i) => i.message)
              .slice(0, 3)
              .join("; "),
            action: "get_action_items",
          });
        }
      }

      // Check keyword coverage
      const keywordCount =
        await savedKeywordQueries(db).countByProject(projectId);
      if (keywordCount < 5) {
        recommendations.push({
          priority: "high",
          category: "keywords",
          title: "Add more keywords",
          description: `Only ${keywordCount} keywords tracked. Add at least 5 for meaningful visibility data.`,
          action: "discover_keywords_from_visibility",
        });
      }

      // Check competitor tracking
      const competitors = await competitorQueries(db).listByProject(projectId);
      if (competitors.length === 0) {
        recommendations.push({
          priority: "high",
          category: "competitors",
          title: "Track competitors",
          description:
            "No competitors tracked. Discover competitors to benchmark against.",
          action: "run_full_analysis",
        });
      }

      // Check pipeline hasn't run
      const latestPipeline =
        await pipelineRunQueries(db).getLatestByProject(projectId);
      if (!latestPipeline) {
        recommendations.push({
          priority: "medium",
          category: "pipeline",
          title: "Run full analysis",
          description:
            "Run the AI intelligence pipeline for comprehensive insights.",
          action: "run_full_analysis",
        });
      }

      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      recommendations.sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
      );

      return recommendations.slice(0, 5);
    },
  };
}
