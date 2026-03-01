import { normalizeDomain } from "@llm-boost/shared";
import { api } from "@/lib/api";

export const DEFAULT_PROJECT_VISIBILITY_PROVIDERS = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
] as const;

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function deriveProjectName(
  domainOrUrl: string,
  title?: string | null,
): string {
  const cleanedTitle = title?.split(/[|:\-•]/)[0]?.trim() ?? "";
  if (cleanedTitle.length >= 3 && cleanedTitle.length <= 80) {
    return cleanedTitle;
  }

  const normalized = normalizeDomain(domainOrUrl);
  const labels = normalized.split(".");
  const secondLevel =
    labels.length >= 2
      ? labels[labels.length - 2]
      : (labels[0] ?? "Website Project");
  const name = secondLevel.replace(/[-_]+/g, " ").trim();
  return name ? toTitleCase(name) : "Website Project";
}

export function deriveVisibilitySeedQuery(
  domainOrUrl: string,
  title?: string | null,
): string {
  const projectName = deriveProjectName(domainOrUrl, title);
  return `${projectName} reviews`;
}

type DefaultOperation =
  | "schedule"
  | "pipeline"
  | "visibility_schedule"
  | "digest";

export interface ApplyWorkspaceDefaultsInput {
  projectId: string;
  domainOrUrl: string;
  title?: string | null;
  defaults?: {
    schedule?: "manual" | "daily" | "weekly" | "monthly";
    autoRunOnCrawl?: boolean;
    enableVisibilitySchedule?: boolean;
    enableWeeklyDigest?: boolean;
  };
}

export interface ApplyWorkspaceDefaultsResult {
  failed: DefaultOperation[];
  digestEnabled: boolean;
}

export async function applyProjectWorkspaceDefaults(
  input: ApplyWorkspaceDefaultsInput,
): Promise<ApplyWorkspaceDefaultsResult> {
  const { projectId, domainOrUrl, title, defaults } = input;

  const schedule = defaults?.schedule ?? "weekly";
  const autoRunOnCrawl = defaults?.autoRunOnCrawl ?? true;
  const enableVisibilitySchedule = defaults?.enableVisibilitySchedule ?? true;
  const enableWeeklyDigest = defaults?.enableWeeklyDigest ?? true;

  const operations: Promise<unknown>[] = [
    api.projects.update(projectId, {
      settings: {
        schedule,
      },
    }),
    api.pipeline.updateSettings(projectId, {
      autoRunOnCrawl,
    }),
  ];

  if (enableVisibilitySchedule) {
    operations.push(
      api.visibility.schedules.create({
        projectId,
        query: deriveVisibilitySeedQuery(domainOrUrl, title),
        providers: [...DEFAULT_PROJECT_VISIBILITY_PROVIDERS],
        frequency: "weekly",
      }),
    );
  } else {
    operations.push(Promise.resolve("skipped_visibility_schedule"));
  }

  if (enableWeeklyDigest) {
    operations.push(
      (async () => {
        const prefs = await api.account.getDigestPreferences();
        if (prefs.digestFrequency === "off") {
          await api.account.updateDigestPreferences({
            digestFrequency: "weekly",
            digestDay: 1,
          });
          return true;
        }
        return false;
      })(),
    );
  } else {
    operations.push(Promise.resolve(false));
  }

  const outcomes = await Promise.allSettled(operations);

  const failed: DefaultOperation[] = [];

  if (outcomes[0].status === "rejected") failed.push("schedule");
  if (outcomes[1].status === "rejected") failed.push("pipeline");
  if (outcomes[2].status === "rejected") failed.push("visibility_schedule");
  if (outcomes[3].status === "rejected") failed.push("digest");

  return {
    failed,
    digestEnabled:
      outcomes[3].status === "fulfilled" && outcomes[3].value === true,
  };
}
