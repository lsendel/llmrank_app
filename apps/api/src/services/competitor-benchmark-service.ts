import { ServiceError } from "./errors";
import { scorePage, type PageData } from "@llm-boost/scoring";
import { parseHtml } from "../lib/html-parser";
import { analyzeSitemap } from "../lib/sitemap";

interface CompetitorBenchmarkDeps {
  competitorBenchmarks: {
    create: (data: any) => Promise<any>;
    listByProject: (projectId: string) => Promise<any[]>;
    getLatest: (projectId: string, domain: string) => Promise<any | undefined>;
  };
  competitors: {
    listByProject: (projectId: string) => Promise<any[]>;
    add: (projectId: string, domain: string) => Promise<any>;
  };
}

export function createCompetitorBenchmarkService(
  deps: CompetitorBenchmarkDeps,
) {
  return {
    async benchmarkCompetitor(args: {
      projectId: string;
      competitorDomain: string;
      competitorLimit: number;
    }) {
      // 1. Check if competitor limit is reached
      const existingCompetitors = await deps.competitors.listByProject(
        args.projectId,
      );
      const existingDomains = existingCompetitors.map((c) => c.domain);

      if (!existingDomains.includes(args.competitorDomain)) {
        if (existingCompetitors.length >= args.competitorLimit) {
          throw new ServiceError(
            "PLAN_LIMIT_REACHED",
            403,
            `Competitor limit reached (${args.competitorLimit}). Upgrade your plan for more.`,
          );
        }
        // Add competitor to project if not already tracked
        await deps.competitors.add(args.projectId, args.competitorDomain);
      }

      // 2. Fetch the competitor's homepage
      const domain = args.competitorDomain;
      const pageUrl = `https://${domain}`;

      const fetchWithTimeout = async (
        url: string,
      ): Promise<Response | null> => {
        try {
          return await fetch(url, {
            headers: { "User-Agent": "AISEOBot/1.0" },
            signal: AbortSignal.timeout(10_000),
          });
        } catch {
          return null;
        }
      };

      const [htmlResponse, robotsResponse, llmsResponse, sitemapResult] =
        await Promise.all([
          fetchWithTimeout(pageUrl),
          fetchWithTimeout(`https://${domain}/robots.txt`),
          fetchWithTimeout(`https://${domain}/llms.txt`),
          analyzeSitemap(domain),
        ]);

      if (!htmlResponse || !htmlResponse.ok) {
        throw new ServiceError(
          "FETCH_FAILED",
          422,
          `Could not fetch ${pageUrl} (status: ${htmlResponse?.status ?? "timeout"})`,
        );
      }

      const html = await htmlResponse.text();
      const parsed = parseHtml(html, pageUrl);

      // 3. Parse robots.txt for AI blocks
      const aiCrawlersBlocked: string[] = [];
      if (robotsResponse?.ok) {
        const robotsTxt = await robotsResponse.text();
        const aiAgents = [
          "GPTBot",
          "ClaudeBot",
          "PerplexityBot",
          "Google-Extended",
        ];
        for (const agent of aiAgents) {
          const agentBlock = new RegExp(
            `User-agent:\\s*${agent}[\\s\\S]*?Disallow:\\s*/`,
            "i",
          );
          if (agentBlock.test(robotsTxt)) {
            aiCrawlersBlocked.push(agent);
          }
        }
      }

      const hasLlmsTxt = llmsResponse?.ok ?? false;

      // 4. Build PageData and score
      const pageData: PageData = {
        url: pageUrl,
        statusCode: htmlResponse.status,
        title: parsed.title,
        metaDescription: parsed.metaDescription,
        canonicalUrl: parsed.canonicalUrl,
        wordCount: parsed.wordCount,
        contentHash: String(html.length),
        extracted: {
          h1: parsed.h1,
          h2: parsed.h2,
          h3: parsed.h3,
          h4: parsed.h4,
          h5: parsed.h5,
          h6: parsed.h6,
          schema_types: parsed.schemaTypes,
          internal_links: parsed.internalLinks,
          external_links: parsed.externalLinks,
          images_without_alt: parsed.imagesWithoutAlt,
          has_robots_meta: parsed.hasRobotsMeta,
          robots_directives: parsed.robotsDirectives,
          og_tags: parsed.ogTags,
          structured_data: parsed.structuredData,
          pdf_links: [],
          cors_unsafe_blank_links: 0,
          cors_mixed_content: 0,
          cors_has_issues: false,
          sentence_length_variance: null,
          top_transition_words: [],
        },
        lighthouse: null,
        llmScores: null,
        siteContext: {
          hasLlmsTxt,
          aiCrawlersBlocked,
          hasSitemap: sitemapResult.exists,
          sitemapAnalysis: sitemapResult.exists
            ? {
                isValid: sitemapResult.isValid,
                urlCount: sitemapResult.urlCount,
                staleUrlCount: sitemapResult.staleUrlCount,
                discoveredPageCount: 1,
              }
            : undefined,
          contentHashes: new Map(),
        },
      };

      const result = scorePage(pageData);

      // 5. Store benchmark
      const benchmark = await deps.competitorBenchmarks.create({
        projectId: args.projectId,
        competitorDomain: domain,
        overallScore: result.overallScore,
        technicalScore: result.technicalScore,
        contentScore: result.contentScore,
        aiReadinessScore: result.aiReadinessScore,
        performanceScore: result.performanceScore,
        letterGrade: result.letterGrade,
        issueCount: result.issues.length,
        topIssues: result.issues.slice(0, 5).map((i) => i.code),
      });

      return benchmark;
    },

    async getComparison(args: {
      projectId: string;
      projectScores: {
        overall: number;
        technical: number;
        content: number;
        aiReadiness: number;
        performance: number;
        letterGrade: string;
      };
    }) {
      const benchmarks = await deps.competitorBenchmarks.listByProject(
        args.projectId,
      );

      // Group by domain, take latest per domain
      const latestByDomain = new Map<string, (typeof benchmarks)[0]>();
      for (const b of benchmarks) {
        if (!latestByDomain.has(b.competitorDomain)) {
          latestByDomain.set(b.competitorDomain, b);
        }
      }

      return Array.from(latestByDomain.values()).map((b) => ({
        competitorDomain: b.competitorDomain,
        scores: {
          overall: b.overallScore,
          technical: b.technicalScore,
          content: b.contentScore,
          aiReadiness: b.aiReadinessScore,
          performance: b.performanceScore,
          letterGrade: b.letterGrade,
        },
        comparison: {
          overall: args.projectScores.overall - (b.overallScore ?? 0),
          technical: args.projectScores.technical - (b.technicalScore ?? 0),
          content: args.projectScores.content - (b.contentScore ?? 0),
          aiReadiness:
            args.projectScores.aiReadiness - (b.aiReadinessScore ?? 0),
          performance:
            args.projectScores.performance - (b.performanceScore ?? 0),
        },
        crawledAt: b.crawledAt,
      }));
    },
  };
}
