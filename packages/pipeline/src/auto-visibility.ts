import {
  createDb,
  savedKeywordQueries,
  projectQueries,
  userQueries,
} from "@llm-boost/db";
import { createVisibilityService } from "./visibility";
import {
  createProjectRepository,
  createUserRepository,
  createVisibilityRepository,
  createCompetitorRepository,
} from "@llm-boost/repositories";
import { createLogger } from "@llm-boost/shared";

export interface AutoVisibilityInput {
  databaseUrl: string;
  projectId: string;
  apiKeys: Record<string, string>;
}

const AUTO_PROVIDERS = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
  "copilot",
  "gemini_ai_mode",
  "grok",
];

// Plan-gated limits for auto-visibility
const AUTO_LIMITS: Record<string, { keywords: number; providers: string[] }> = {
  free: { keywords: 0, providers: [] },
  starter: { keywords: 3, providers: ["chatgpt", "claude", "perplexity"] },
  pro: { keywords: 10, providers: AUTO_PROVIDERS },
  agency: { keywords: 10, providers: AUTO_PROVIDERS },
};

export async function runAutoVisibilityChecks(
  input: AutoVisibilityInput,
): Promise<void> {
  const log = createLogger({ context: "auto-visibility" });
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  const limits = AUTO_LIMITS[user.plan] ?? AUTO_LIMITS.free;
  if (limits.keywords === 0) {
    log.info("Auto-visibility skipped: free plan", {
      projectId: input.projectId,
    });
    return;
  }

  const keywords = await savedKeywordQueries(db).listByProject(input.projectId);
  if (keywords.length === 0) {
    log.info("Auto-visibility skipped: no saved keywords", {
      projectId: input.projectId,
    });
    return;
  }

  const topKeywords = keywords.slice(0, limits.keywords);
  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  for (const kw of topKeywords) {
    try {
      await service.runCheck({
        userId: project.userId,
        projectId: input.projectId,
        query: kw.keyword,
        keywordId: kw.id,
        providers: limits.providers,
        apiKeys: input.apiKeys,
      });
      log.info("Auto-visibility check completed", { keyword: kw.keyword });
    } catch (err) {
      // Plan limit or rate limit — stop early
      if (err instanceof Error && err.message.includes("limit")) break;
      log.error("Auto-visibility check failed", {
        keyword: kw.keyword,
        error: String(err),
      });
    }
  }
}
