import type { Context } from "hono";
import type { AppEnv } from "../index";
import { projectQueries, crawlQueries, pageQueries } from "@llm-boost/db";

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
