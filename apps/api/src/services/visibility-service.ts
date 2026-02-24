import { ERROR_CODES, canRunVisibilityChecks } from "@llm-boost/shared";
import { VisibilityChecker, analyzeBrandSentiment } from "@llm-boost/llm";
import type {
  ProjectRepository,
  UserRepository,
  VisibilityRepository,
  CompetitorRepository,
} from "../repositories";
import { ServiceError } from "./errors";

export interface VisibilityServiceDeps {
  projects: ProjectRepository;
  users: UserRepository;
  visibility: VisibilityRepository;
  checker?: VisibilityChecker;
  competitors?: CompetitorRepository;
}

export function createVisibilityService(deps: VisibilityServiceDeps) {
  const checker = deps.checker ?? new VisibilityChecker();

  return {
    async runCheck(args: {
      userId: string;
      projectId: string;
      query: string;
      keywordId?: string;
      providers: string[];
      competitors?: string[];
      apiKeys: Record<string, string | undefined>;
      anthropicApiKey?: string;
      region?: string;
      language?: string;
    }) {
      const project = await deps.projects.getById(args.projectId);
      if (!project || project.userId !== args.userId) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Project not found");
      }

      const user = await deps.users.getById(args.userId);
      if (!user) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "User not found");
      }

      const since = startOfMonth(new Date());
      const userProjects = await deps.projects.listByUser(args.userId);
      let used = 0;
      for (const p of userProjects) {
        used += await deps.visibility.countSince(p.id, since);
      }
      if (!canRunVisibilityChecks(user.plan, used, args.providers.length)) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          429,
          `Visibility check limit reached for this month`,
        );
      }

      const competitorDomains = deps.competitors
        ? (await deps.competitors.listByProject(args.projectId)).map(
            (comp) => comp.domain,
          )
        : (args.competitors ?? []);

      const locale =
        args.region && args.language
          ? { region: args.region, language: args.language }
          : undefined;

      const results = await checker.checkAllProviders({
        query: args.query,
        targetDomain: project.domain,
        competitors: competitorDomains,
        providers: args.providers,
        apiKeys: args.apiKeys as Record<string, string>,
        locale,
      });

      // Run sentiment analysis in parallel for checks where brand is mentioned
      const sentimentResults = await Promise.all(
        results.map(async (result) => {
          if (
            result.brandMentioned &&
            result.responseText &&
            args.anthropicApiKey
          ) {
            try {
              return await analyzeBrandSentiment(
                args.anthropicApiKey,
                result.responseText,
                project.domain,
              );
            } catch {
              return null;
            }
          }
          return null;
        }),
      );

      const stored = await Promise.all(
        results.map((result, i) => {
          const sentiment = sentimentResults[i];
          return deps.visibility.create({
            projectId: project.id,
            llmProvider: result.provider as
              | "chatgpt"
              | "claude"
              | "perplexity"
              | "gemini"
              | "copilot",
            query: result.query,
            keywordId: args.keywordId ?? null,
            responseText: result.responseText,
            brandMentioned: result.brandMentioned,
            urlCited: result.urlCited,
            citedUrl: result.citedUrl,
            citationPosition: result.citationPosition,
            competitorMentions: result.competitorMentions,
            ...(sentiment && {
              sentiment: sentiment.sentiment,
              brandDescription: sentiment.brandDescription,
            }),
            region: args.region ?? "us",
            language: args.language ?? "en",
          });
        }),
      );

      return stored;
    },

    async listForProject(
      userId: string,
      projectId: string,
      filters?: { region?: string; language?: string },
    ) {
      const project = await deps.projects.getById(projectId);
      if (!project || project.userId !== userId) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Project not found");
      }
      return deps.visibility.listByProject(projectId, filters);
    },

    async getTrends(userId: string, projectId: string) {
      const project = await deps.projects.getById(projectId);
      if (!project || project.userId !== userId) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Project not found");
      }
      return deps.visibility.getTrends(projectId);
    },
  };
}

function startOfMonth(date: Date) {
  const copy = new Date(date);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
