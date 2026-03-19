import { createDb, projectQueries, userQueries } from "@llm-boost/db";
import { createNarrativeService } from "./narrative-service";
import {
  createNarrativeRepository,
  createProjectRepository,
  createUserRepository,
  createCrawlRepository,
} from "@llm-boost/repositories";
import { createLogger } from "@llm-boost/shared";

export interface AutoNarrativeInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
  anthropicApiKey: string;
}

export async function runAutoNarrativeRegeneration(
  input: AutoNarrativeInput,
): Promise<void> {
  const log = createLogger({ context: "auto-narrative" });
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  // Only Pro and Agency get narratives
  if (user.plan !== "pro" && user.plan !== "agency") return;

  const narrativeRepo = createNarrativeRepository(db);

  // Check if a narrative exists for this project (any crawl)
  const existingNarratives = await narrativeRepo.listByProject(
    input.projectId,
    1,
  );
  if (existingNarratives.length === 0) {
    log.info("Auto-narrative skipped: no existing narrative to regenerate", {
      projectId: input.projectId,
    });
    return;
  }

  const service = createNarrativeService({
    narratives: narrativeRepo,
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  // Generate a fresh narrative for the new crawl in "technical" tone
  try {
    await service.generate(project.userId, input.crawlJobId, "technical", {
      anthropicApiKey: input.anthropicApiKey,
    });
    log.info("Auto-narrative generated (technical)", {
      crawlJobId: input.crawlJobId,
    });
  } catch (err) {
    log.error("Auto-narrative generation failed", { error: String(err) });
  }
}
