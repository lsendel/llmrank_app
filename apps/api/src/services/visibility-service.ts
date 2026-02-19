import { ERROR_CODES, canRunVisibilityChecks } from "@llm-boost/shared";
import { VisibilityChecker } from "@llm-boost/llm";
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

      const results = await checker.checkAllProviders({
        query: args.query,
        targetDomain: project.domain,
        competitors: competitorDomains,
        providers: args.providers,
        apiKeys: args.apiKeys as Record<string, string>,
      });

      const stored = await Promise.all(
        results.map((result) =>
          deps.visibility.create({
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
            citationPosition: result.citationPosition,
            competitorMentions: result.competitorMentions,
          }),
        ),
      );

      return stored;
    },

    async listForProject(userId: string, projectId: string) {
      const project = await deps.projects.getById(projectId);
      if (!project || project.userId !== userId) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Project not found");
      }
      return deps.visibility.listByProject(projectId);
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
