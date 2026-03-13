import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { rateLimit } from "../../middleware/rate-limit";
import {
  createProjectRepository,
  createUserRepository,
} from "../../repositories";
import { handleServiceError } from "../../services/errors";
import { suggestKeywords } from "@llm-boost/llm";
import {
  enrichmentQueries,
  crawlQueries,
  scheduledVisibilityQueryQueries,
} from "@llm-boost/db";
import { validateKeyword } from "@llm-boost/shared";

export const visibilityKeywordRoutes = new Hono<AppEnv>();
visibilityKeywordRoutes.post(
  "/:projectId/discover-keywords",
  rateLimit({ limit: 3, windowSeconds: 60, keyPrefix: "rl:vis-discover" }),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId")!;

    const project = await createProjectRepository(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const { createKeywordDiscoveryService } =
      await import("../../services/keyword-discovery-service");

    const service = createKeywordDiscoveryService({
      projects: createProjectRepository(db),
      enrichments: {
        async listByJobAndProvider(jobId: string, provider: string) {
          return enrichmentQueries(db).listByJobAndProvider(
            jobId,
            provider as any,
          );
        },
      },
      schedules: {
        async listByProject(pid: string) {
          return scheduledVisibilityQueryQueries(db).listByProject(pid);
        },
      },
      crawls: {
        async getLatestByProject(pid: string) {
          return crawlQueries(db).getLatestByProject(pid);
        },
      },
      llm: {
        async generateKeywords(domain: string, context: string) {
          return suggestKeywords(c.env.ANTHROPIC_API_KEY, domain, context);
        },
      },
    });

    try {
      const result = await service.discover(userId, projectId);

      // Persist discovered keywords
      const { savedKeywordQueries: savedKwQueries } =
        await import("@llm-boost/db");
      const { PLAN_LIMITS } = await import("@llm-boost/shared");
      const kwRepo = savedKwQueries(db);
      const existingCount = await kwRepo.countByProject(projectId);
      const user = await createUserRepository(db).getById(userId);
      const limits = PLAN_LIMITS[user?.plan ?? "free"];
      const remainingSlots = Math.max(
        0,
        limits.savedKeywordsPerProject - existingCount,
      );

      if (remainingSlots > 0 && result.llmKeywords?.length > 0) {
        const toSave = result.llmKeywords
          .slice(0, remainingSlots)
          .map((kw: string) => ({
            projectId,
            keyword: kw,
            source: "auto_discovered" as const,
          }));
        await kwRepo.createMany(toSave);
      }

      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:projectId/suggest-keywords — AI-powered keyword suggestions
// ---------------------------------------------------------------------------

visibilityKeywordRoutes.post(
  "/:projectId/suggest-keywords",
  rateLimit({ limit: 10, windowSeconds: 60, keyPrefix: "rl:vis-suggest" }),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId")!;

    const project = await createProjectRepository(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    // Get existing keywords to avoid duplicates
    const { savedKeywordQueries: savedKwQueries } =
      await import("@llm-boost/db");
    const existing = await savedKwQueries(db).listByProject(projectId);
    const existingSet = new Set(existing.map((k) => k.keyword.toLowerCase()));

    const context =
      existing.length > 0
        ? `Existing keywords (avoid duplicates): ${existing.map((k) => k.keyword).join(", ")}`
        : "";

    let suggestions: string[];
    try {
      suggestions = await suggestKeywords(
        c.env.ANTHROPIC_API_KEY,
        project.domain,
        context,
      );
    } catch (err) {
      c.var.logger.error("suggestKeywords failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json(
        {
          error: {
            code: "LLM_ERROR",
            message:
              err instanceof Error
                ? err.message
                : "Failed to generate keyword suggestions",
          },
        },
        500,
      );
    }

    // Filter out duplicates and invalid keywords
    const fresh = suggestions
      .filter((kw: string) => !existingSet.has(kw.toLowerCase()))
      .filter((kw: string) => validateKeyword(kw).valid)
      .slice(0, 10);

    return c.json({ data: fresh });
  },
);
