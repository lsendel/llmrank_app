import { ERROR_CODES } from "@llm-boost/shared";
import { clusterPagesByTopic } from "@llm-boost/scoring";
import type {
  ProjectRepository,
  CompetitorRepository,
  PageRepository,
  ScoreRepository,
  CrawlRepository,
} from "../repositories";
import { PersonaGenerator, StrategyOptimizer } from "@llm-boost/llm";
import { ServiceError } from "./errors";
import { assertProjectOwnership } from "./shared/assert-ownership";

export interface StrategyServiceDeps {
  projects: ProjectRepository;
  competitors: CompetitorRepository;
  pages: PageRepository;
  scores: ScoreRepository;
  crawls: CrawlRepository;
}

export function createStrategyService(deps: StrategyServiceDeps) {
  return {
    async getTopicMap(userId: string, projectId: string) {
      await assertProjectOwnership(deps.projects, userId, projectId);

      const latestCrawl = await deps.crawls.getLatestByProject(projectId);
      if (!latestCrawl) {
        throw new ServiceError(
          "NOT_FOUND",
          404,
          "No crawls found for this project",
        );
      }

      const scoresWithPages = await deps.scores.listByJobWithPages(
        latestCrawl.id,
      );
      if (scoresWithPages.length === 0) return { nodes: [], edges: [] };

      // 1. Prepare data for clustering
      const clusterInput = scoresWithPages.map((s) => ({
        url: s.page?.url || "",
        title: s.page?.title || null,
        headings: ((s.detail as any)?.extracted?.h1 || []).concat(
          (s.detail as any)?.extracted?.h2 || [],
        ),
      }));

      const clusters = clusterPagesByTopic(clusterInput);

      // 2. Build nodes
      const urlToCluster = new Map<string, string>();
      clusters.forEach((c) => {
        c.pages.forEach((p) => urlToCluster.set(p.url, c.label));
      });

      const nodes = scoresWithPages.map((s) => ({
        id: s.page?.url || "",
        label: s.page?.title || s.page?.url || "Untitled",
        cluster: urlToCluster.get(s.page?.url || "") || "Uncategorized",
        score: s.overallScore,
        wordCount: s.page?.wordCount || 0,
      }));

      // 3. Build edges (internal links)
      const edges: { source: string; target: string; weight: number }[] = [];
      const urlSet = new Set(nodes.map((n) => n.id));

      scoresWithPages.forEach((s) => {
        const sourceUrl = s.page?.url;
        if (!sourceUrl) return;

        const internalLinks =
          (s.detail as any)?.extracted?.internal_links || [];
        internalLinks.forEach((targetUrl: string) => {
          // Only include links to pages within the same crawl
          if (urlSet.has(targetUrl) && sourceUrl !== targetUrl) {
            edges.push({
              source: sourceUrl,
              target: targetUrl,
              weight: 1,
            });
          }
        });
      });

      return {
        nodes,
        edges,
        clusters: clusters.map((c) => ({
          label: c.label,
          keywords: c.keywords,
          pageCount: c.pages.length,
        })),
      };
    },

    async optimize(
      userId: string,
      pageId: string,
      content: string,
      apiKey: string,
    ) {
      await assertPageOwnership(userId, pageId);
      const optimizer = new StrategyOptimizer(apiKey);
      return optimizer.rewriteForAIVisibility(content);
    },

    async optimizeDimension(
      userId: string,
      pageId: string,
      content: string,
      dimension:
        | "clarity"
        | "authority"
        | "comprehensiveness"
        | "structure"
        | "citation_worthiness",
      tone: string | undefined,
      apiKey: string,
    ) {
      await assertPageOwnership(userId, pageId);
      const optimizer = new StrategyOptimizer(apiKey);
      return optimizer.improveDimension({ content, dimension, tone });
    },

    async brief(keyword: string, apiKey: string) {
      const optimizer = new StrategyOptimizer(apiKey);
      return optimizer.generateContentBrief(keyword);
    },

    async gapAnalysis(args: {
      userId: string;
      projectId: string;
      competitorDomain: string;
      query: string;
      apiKey: string;
      pageId?: string;
    }) {
      const project = await assertProjectOwnership(
        deps.projects,
        args.userId,
        args.projectId,
      );
      const page = args.pageId ? await deps.pages.getById(args.pageId) : null;
      if (args.pageId && (!page || page.projectId !== project.id)) {
        throw new ServiceError("NOT_FOUND", 404, "Page not found");
      }
      const optimizer = new StrategyOptimizer(args.apiKey);
      return optimizer.analyzeStructuralGap({
        userDomain: project.domain,
        competitorDomain: args.competitorDomain,
        userStructure: page
          ? { title: page.title, wordCount: page.wordCount }
          : { title: null, wordCount: null },
        query: args.query,
      });
    },

    async personas(
      userId: string,
      projectId: string,
      payload: { description?: string; niche?: string },
      apiKey: string,
    ) {
      const project = await assertProjectOwnership(
        deps.projects,
        userId,
        projectId,
      );
      if (!apiKey) {
        throw new ServiceError(
          "CONFIG_ERROR",
          500,
          "AI service not configured",
        );
      }
      const generator = new PersonaGenerator({ anthropicApiKey: apiKey });
      return generator.generatePersonas({
        domain: project.domain,
        description: payload.description || project.name,
        niche: payload.niche || "General",
      });
    },

    listCompetitors(userId: string, projectId: string) {
      return assertProjectOwnership(deps.projects, userId, projectId).then(() =>
        deps.competitors.listByProject(projectId),
      );
    },

    async addCompetitor(userId: string, projectId: string, domain: string) {
      const project = await assertProjectOwnership(
        deps.projects,
        userId,
        projectId,
      );
      if (!deps.competitors.add) {
        throw new ServiceError(
          "NOT_IMPLEMENTED",
          500,
          "Add competitor not available",
        );
      }
      return deps.competitors.add(project.id, domain);
    },

    async removeCompetitor(userId: string, competitorId: string) {
      const competitor = deps.competitors.getById
        ? await deps.competitors.getById(competitorId)
        : null;
      if (!competitor) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Competitor not found");
      }
      await assertProjectOwnership(deps.projects, userId, competitor.projectId);
      if (!deps.competitors.remove) {
        throw new ServiceError(
          "NOT_IMPLEMENTED",
          500,
          "Remove competitor not available",
        );
      }
      await deps.competitors.remove(competitorId);
      return { id: competitorId, deleted: true };
    },
  };

  async function assertPageOwnership(userId: string, pageId: string) {
    const page = await deps.pages.getById(pageId);
    if (!page) {
      const err = ERROR_CODES.NOT_FOUND;
      throw new ServiceError("NOT_FOUND", err.status, "Page not found");
    }
    await assertProjectOwnership(deps.projects, userId, page.projectId);
    return page;
  }
}
