import type { ProjectRepository, CrawlRepository } from "@llm-boost/repositories";
import { ServiceError } from "@llm-boost/shared";

/**
 * Assert that a project belongs to a user. Returns the project if valid.
 * Throws NOT_FOUND if project doesn't exist or doesn't belong to user.
 */
const NOT_FOUND_MESSAGE = "Resource does not exist";

export async function assertProjectOwnership(
  projects: Pick<ProjectRepository, "getById">,
  userId: string,
  projectId: string,
) {
  const project = await projects.getById(projectId);
  if (!project || project.userId !== userId) {
    throw new ServiceError("NOT_FOUND", 404, NOT_FOUND_MESSAGE);
  }
  return project;
}

/**
 * Assert that a crawl belongs to a user (via its project).
 * Returns { crawl, project } if valid.
 */
export async function assertCrawlAccess(
  deps: {
    crawls: Pick<CrawlRepository, "getById">;
    projects: Pick<ProjectRepository, "getById">;
  },
  userId: string,
  crawlId: string,
) {
  const crawl = await deps.crawls.getById(crawlId);
  if (!crawl) {
    throw new ServiceError("NOT_FOUND", 404, "Crawl not found");
  }
  const project = await deps.projects.getById(crawl.projectId);
  if (!project || project.userId !== userId) {
    throw new ServiceError("NOT_FOUND", 404, NOT_FOUND_MESSAGE);
  }
  return { crawl, project };
}
