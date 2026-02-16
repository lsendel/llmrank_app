import type { Database } from "@llm-boost/db";
import {
  createProjectRepository,
  createUserRepository,
  createCrawlRepository,
  createScoreRepository,
  createPageRepository,
  type ProjectRepository,
  type UserRepository,
  type CrawlRepository,
  type ScoreRepository,
  type PageRepository,
} from "./repositories";
import { createProjectService } from "./services/project-service";
import { createCrawlService } from "./services/crawl-service";
import { createProgressService } from "./services/progress-service";

export interface Container {
  // Repositories (exposed for direct access in routes that need them)
  projects: ProjectRepository;
  users: UserRepository;
  crawls: CrawlRepository;
  scores: ScoreRepository;
  pages: PageRepository;
  // Services
  projectService: ReturnType<typeof createProjectService>;
  crawlService: ReturnType<typeof createCrawlService>;
  progressService: ReturnType<typeof createProgressService>;
}

export function createContainer(db: Database): Container {
  const projects = createProjectRepository(db);
  const users = createUserRepository(db);
  const crawls = createCrawlRepository(db);
  const scores = createScoreRepository(db);
  const pages = createPageRepository(db);

  return {
    projects,
    users,
    crawls,
    scores,
    pages,
    projectService: createProjectService({ projects, users, crawls, scores }),
    crawlService: createCrawlService({ crawls, projects, users, scores }),
    progressService: createProgressService({ crawls, projects, scores, pages }),
  };
}
