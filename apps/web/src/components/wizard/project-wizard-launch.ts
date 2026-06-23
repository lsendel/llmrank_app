import { normalizeDomain } from "@llm-boost/shared";
import { applyProjectWorkspaceDefaults } from "@/lib/project-workspace-defaults";

export interface ProjectWizardKeywordInput {
  keyword: string;
}

export interface ProjectWizardCompetitorInput {
  domain: string;
  selected: boolean;
}

export interface ProjectWizardLaunchInput {
  name: string;
  domain: string;
  keywords: ProjectWizardKeywordInput[];
  competitors: ProjectWizardCompetitorInput[];
  pageLimit: number;
  crawlDepth: number;
  crawlSchedule: "manual" | "daily" | "weekly" | "monthly";
  enablePipeline: boolean;
  enableVisibility: boolean;
}

export interface ProjectWizardLaunchDeps {
  createProject: (input: {
    name: string;
    domain: string;
  }) => Promise<{ id: string; name?: string; domain?: string }>;
  createKeywordsBatch: (
    projectId: string,
    keywords: string[],
  ) => Promise<unknown>;
  addCompetitor: (projectId: string, domain: string) => Promise<unknown>;
  startCrawl: (projectId: string) => Promise<{ id: string }>;
}

export interface ProjectWizardLaunchResult {
  projectId: string;
  crawlId: string | null;
  crawlStartFailed: boolean;
  defaultsFailed: string[];
}

export async function launchProjectWizard(
  input: ProjectWizardLaunchInput,
  deps: ProjectWizardLaunchDeps,
): Promise<ProjectWizardLaunchResult> {
  const normalizedDomain = normalizeDomain(input.domain) ?? input.domain.trim();

  const project = await deps.createProject({
    name: input.name.trim(),
    domain: normalizedDomain,
  });

  const selectedKeywords = input.keywords
    .map((item) => item.keyword.trim())
    .filter((keyword) => keyword.length > 0);

  if (selectedKeywords.length > 0) {
    await deps.createKeywordsBatch(project.id, selectedKeywords);
  }

  let defaultsFailed: string[];
  try {
    const defaults = await applyProjectWorkspaceDefaults({
      projectId: project.id,
      domainOrUrl: normalizedDomain,
      defaults: {
        schedule: input.crawlSchedule,
        maxPages: input.pageLimit,
        maxDepth: input.crawlDepth,
        autoRunOnCrawl: input.enablePipeline,
        enableVisibilitySchedule: input.enableVisibility,
      },
    });
    defaultsFailed = defaults.failed;
  } catch {
    // Workspace defaults are best-effort so project creation never dead-ends.
    defaultsFailed = ["schedule", "pipeline", "visibility_schedule", "digest"];
  }

  const selectedCompetitors = input.competitors
    .filter((competitor) => competitor.selected)
    .map((competitor) => competitor.domain.trim())
    .filter((domain) => domain.length > 0);

  for (const competitorDomain of selectedCompetitors) {
    await deps.addCompetitor(project.id, competitorDomain).catch(() => {});
  }

  try {
    const crawl = await deps.startCrawl(project.id);
    return {
      projectId: project.id,
      crawlId: crawl.id,
      crawlStartFailed: false,
      defaultsFailed,
    };
  } catch {
    return {
      projectId: project.id,
      crawlId: null,
      crawlStartFailed: true,
      defaultsFailed,
    };
  }
}
