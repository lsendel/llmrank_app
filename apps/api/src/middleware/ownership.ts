import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";
import { projectQueries, crawlQueries, pageQueries } from "@llm-boost/db";
import { ServiceError } from "../services/errors";

const NOT_FOUND = {
  error: { code: "NOT_FOUND", message: "Not found" },
} as const;

/**
 * Verifies that the authenticated user owns the given project.
 * Returns the project row on success, or a 404 Response if not found/not owned.
 */
export async function requireProjectOwnership(
  c: Context<AppEnv>,
  projectId: string,
) {
  const db = c.get("db");
  const userId = c.get("userId");
  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return { ok: false as const, response: c.json(NOT_FOUND, 404) };
  }
  return { ok: true as const, project };
}

/**
 * Verifies ownership through a crawl job: crawl → project → user.
 * Returns both the crawl job and project on success.
 */
export async function requireCrawlOwnership(
  c: Context<AppEnv>,
  crawlId: string,
) {
  const db = c.get("db");
  const crawl = await crawlQueries(db).getById(crawlId);
  if (!crawl) {
    return { ok: false as const, response: c.json(NOT_FOUND, 404) };
  }
  const result = await requireProjectOwnership(c, crawl.projectId);
  if (!result.ok) return result;
  return { ok: true as const, crawl, project: result.project };
}

/**
 * Verifies ownership through a page: page → project → user.
 * Returns both the page and project on success.
 */
export async function requirePageOwnership(c: Context<AppEnv>, pageId: string) {
  const db = c.get("db");
  const page = await pageQueries(db).getById(pageId);
  if (!page) {
    return { ok: false as const, response: c.json(NOT_FOUND, 404) };
  }
  const result = await requireProjectOwnership(c, page.projectId);
  if (!result.ok) return result;
  return { ok: true as const, page, project: result.project };
}

// ---------------------------------------------------------------------------
// Middleware factory — sets `project` and/or `crawl` on the context
// ---------------------------------------------------------------------------

type ResourceType = "project" | "crawl";

/**
 * Hono middleware that verifies ownership of a resource before the handler runs.
 *
 * - `withOwnership("project")` — reads `:id` (or `:projectId`) from the URL,
 *   verifies the authenticated user owns the project, and sets `c.get("project")`.
 * - `withOwnership("crawl")` — reads `:id` from the URL, verifies ownership
 *   through the crawl's parent project, and sets both `c.get("crawl")` and
 *   `c.get("project")`.
 *
 * Uses 404 NOT_FOUND for all ownership failures to prevent resource enumeration.
 */
export function withOwnership(
  resource: ResourceType,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const userId = c.get("userId");
    const id = c.req.param("id") ?? c.req.param("projectId");
    if (!id)
      throw new ServiceError("VALIDATION_ERROR", 400, "Missing resource ID");

    const { projects, crawls } = c.get("container");

    if (resource === "project") {
      const project = await projects.getById(id);
      if (!project)
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      if (project.userId !== userId)
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      c.set("project", project);
    } else if (resource === "crawl") {
      const crawl = await crawls.getById(id);
      if (!crawl) throw new ServiceError("NOT_FOUND", 404, "Crawl not found");
      // Verify via project ownership
      const project = await projects.getById(crawl.projectId);
      if (!project || project.userId !== userId)
        throw new ServiceError("NOT_FOUND", 404, "Crawl not found");
      c.set("crawl", crawl);
      c.set("project", project);
    }

    await next();
  };
}
