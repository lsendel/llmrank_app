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

export interface PortfolioPriorityItem {
  id: string;
  projectId: string;
  projectName: string;
  projectDomain: string;
  priority: "critical" | "high" | "medium" | "low";
  category: "onboarding" | "issues" | "crawl" | "keywords" | "competitors";
  channel: "google" | "llm" | "both";
  title: string;
  description: string;
  reason: string;
  action: string;
  owner: string | null;
  dueDate: string;
  expectedImpact: "high" | "medium" | "low";
  impactScore: number;
  effort: "low" | "medium" | "high";
  freshness: {
    generatedAt: string;
    lastCrawlAt: string | null;
  };
  source: {
    signals: string[];
    confidence: number;
  };
}

export function createRecommendationsService(db: Database) {
  function dueDateForPriority(
    priority: PortfolioPriorityItem["priority"],
  ): string {
    const days =
      priority === "critical"
        ? 1
        : priority === "high"
          ? 3
          : priority === "medium"
            ? 7
            : 14;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  function expectedImpactFromScore(
    impactScore: number,
  ): PortfolioPriorityItem["expectedImpact"] {
    if (impactScore >= 80) return "high";
    if (impactScore >= 60) return "medium";
    return "low";
  }

  return {
    async getPortfolioPriorityFeed(
      userId: string,
      options?: { limit?: number },
    ): Promise<PortfolioPriorityItem[]> {
      const limit = Math.min(Math.max(options?.limit ?? 15, 1), 50);
      const generatedAt = new Date().toISOString();
      const projects = await projectQueries(db).listByUser(userId, {
        sort: "activity_desc",
      });

      if (projects.length === 0) return [];

      const latestCrawls = await crawlQueries(db).getLatestByProjects(
        projects.map((project) => project.id),
      );
      const crawlByProject = new Map(
        latestCrawls.map((crawl) => [crawl.projectId, crawl]),
      );

      const items = await Promise.all(
        projects.map(async (project) => {
          const crawl = crawlByProject.get(project.id) ?? null;

          if (!crawl) {
            return {
              id: `${project.id}:first-crawl`,
              projectId: project.id,
              projectName: project.name,
              projectDomain: project.domain,
              priority: "critical",
              category: "onboarding",
              channel: "both",
              title: "Run first crawl",
              description:
                "No crawl exists yet, so no ranking opportunities can be prioritized.",
              reason:
                "Portfolio ranking improvements require baseline crawl data.",
              action: `/dashboard/projects/${project.id}`,
              owner: null,
              dueDate: dueDateForPriority("critical"),
              expectedImpact: expectedImpactFromScore(100),
              impactScore: 100,
              effort: "low",
              freshness: {
                generatedAt,
                lastCrawlAt: null,
              },
              source: {
                signals: ["project_created", "crawl_missing"],
                confidence: 1,
              },
            } satisfies PortfolioPriorityItem;
          }

          const lastCrawlAt =
            crawl.completedAt?.toISOString() ?? crawl.createdAt.toISOString();

          if (crawl.status !== "complete") {
            return {
              id: `${project.id}:crawl-in-progress`,
              projectId: project.id,
              projectName: project.name,
              projectDomain: project.domain,
              priority: "high",
              category: "crawl",
              channel: "both",
              title: "Crawl in progress",
              description:
                "Insights are pending until crawl and scoring complete.",
              reason: "Current crawl status prevents complete prioritization.",
              action: `/dashboard/projects/${project.id}`,
              owner: null,
              dueDate: dueDateForPriority("high"),
              expectedImpact: expectedImpactFromScore(85),
              impactScore: 85,
              effort: "low",
              freshness: {
                generatedAt,
                lastCrawlAt,
              },
              source: {
                signals: ["crawl_status"],
                confidence: 0.95,
              },
            } satisfies PortfolioPriorityItem;
          }

          const [issues, keywordCount, competitors] = await Promise.all([
            scoreQueries(db).getIssuesByJob(crawl.id),
            savedKeywordQueries(db).countByProject(project.id),
            competitorQueries(db).listByProject(project.id),
          ]);
          const criticalIssues = issues.filter(
            (issue) => issue.severity === "critical",
          );
          const warningIssues = issues.filter(
            (issue) => issue.severity === "warning",
          );
          const daysSinceCrawl = crawl.completedAt
            ? Math.floor(
                (Date.now() - crawl.completedAt.getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : 0;

          if (criticalIssues.length > 0) {
            return {
              id: `${project.id}:critical-issues`,
              projectId: project.id,
              projectName: project.name,
              projectDomain: project.domain,
              priority: "critical",
              category: "issues",
              channel: "both",
              title: `${criticalIssues.length} critical issue${criticalIssues.length === 1 ? "" : "s"} blocking visibility`,
              description: criticalIssues
                .slice(0, 2)
                .map((issue) => issue.message)
                .join("; "),
              reason:
                "Critical technical/content blockers have the largest near-term ranking impact.",
              action: `/dashboard/projects/${project.id}?tab=issues`,
              owner: null,
              dueDate: dueDateForPriority("critical"),
              expectedImpact: expectedImpactFromScore(
                Math.min(100, 70 + criticalIssues.length * 8),
              ),
              impactScore: Math.min(100, 70 + criticalIssues.length * 8),
              effort: "medium",
              freshness: {
                generatedAt,
                lastCrawlAt,
              },
              source: {
                signals: ["issue_severity", "issue_count"],
                confidence: 0.96,
              },
            } satisfies PortfolioPriorityItem;
          }

          if (keywordCount < 5) {
            return {
              id: `${project.id}:keyword-coverage`,
              projectId: project.id,
              projectName: project.name,
              projectDomain: project.domain,
              priority: "high",
              category: "keywords",
              channel: "llm",
              title: "Increase keyword/query coverage",
              description: `Only ${keywordCount} tracked keywords. Add at least 5 to improve monitoring depth.`,
              reason:
                "Insufficient query coverage reduces ability to identify ranking opportunities.",
              action: `/dashboard/projects/${project.id}?tab=keywords`,
              owner: null,
              dueDate: dueDateForPriority("high"),
              expectedImpact: expectedImpactFromScore(78),
              impactScore: 78,
              effort: "low",
              freshness: {
                generatedAt,
                lastCrawlAt,
              },
              source: {
                signals: ["keyword_count"],
                confidence: 0.88,
              },
            } satisfies PortfolioPriorityItem;
          }

          if (competitors.length === 0) {
            return {
              id: `${project.id}:competitor-coverage`,
              projectId: project.id,
              projectName: project.name,
              projectDomain: project.domain,
              priority: "high",
              category: "competitors",
              channel: "both",
              title: "Add competitor tracking",
              description:
                "No competitors configured, so benchmark and gap insights are limited.",
              reason:
                "Competitor baselines are required to prioritize the highest-impact wins.",
              action: `/dashboard/projects/${project.id}?tab=competitors`,
              owner: null,
              dueDate: dueDateForPriority("high"),
              expectedImpact: expectedImpactFromScore(74),
              impactScore: 74,
              effort: "low",
              freshness: {
                generatedAt,
                lastCrawlAt,
              },
              source: {
                signals: ["competitor_count"],
                confidence: 0.86,
              },
            } satisfies PortfolioPriorityItem;
          }

          if (daysSinceCrawl > 14) {
            return {
              id: `${project.id}:crawl-recency`,
              projectId: project.id,
              projectName: project.name,
              projectDomain: project.domain,
              priority: "medium",
              category: "crawl",
              channel: "both",
              title: "Refresh crawl data",
              description: `Last completed crawl was ${daysSinceCrawl} days ago.`,
              reason:
                "Stale crawl data reduces confidence in current prioritization.",
              action: `/dashboard/projects/${project.id}`,
              owner: null,
              dueDate: dueDateForPriority("medium"),
              expectedImpact: expectedImpactFromScore(58),
              impactScore: 58,
              effort: "low",
              freshness: {
                generatedAt,
                lastCrawlAt,
              },
              source: {
                signals: ["crawl_age_days"],
                confidence: 0.83,
              },
            } satisfies PortfolioPriorityItem;
          }

          return {
            id: `${project.id}:warning-issues`,
            projectId: project.id,
            projectName: project.name,
            projectDomain: project.domain,
            priority: warningIssues.length >= 8 ? "high" : "medium",
            category: "issues",
            channel: "both",
            title: `${warningIssues.length} warning issue${warningIssues.length === 1 ? "" : "s"} to optimize`,
            description:
              warningIssues.length > 0
                ? warningIssues
                    .slice(0, 2)
                    .map((issue) => issue.message)
                    .join("; ")
                : "No major blockers detected. Focus on incremental quality improvements.",
            reason:
              warningIssues.length > 0
                ? "Addressing warning-level issues increases consistency and long-tail visibility."
                : "Project is stable; incremental improvements maintain ranking momentum.",
            action: `/dashboard/projects/${project.id}?tab=issues`,
            owner: null,
            dueDate: dueDateForPriority(
              warningIssues.length >= 8 ? "high" : "medium",
            ),
            expectedImpact: expectedImpactFromScore(
              Math.min(68, 40 + warningIssues.length * 2),
            ),
            impactScore: Math.min(68, 40 + warningIssues.length * 2),
            effort: warningIssues.length > 10 ? "high" : "medium",
            freshness: {
              generatedAt,
              lastCrawlAt,
            },
            source: {
              signals: ["warning_issue_count", "crawl_recency"],
              confidence: warningIssues.length > 0 ? 0.78 : 0.7,
            },
          } satisfies PortfolioPriorityItem;
        }),
      );

      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return items
        .sort((a, b) => {
          const prio = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (prio !== 0) return prio;
          return b.impactScore - a.impactScore;
        })
        .slice(0, limit);
    },

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
