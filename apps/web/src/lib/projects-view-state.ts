import type {
  AccountProjectsViewState,
  ProjectsAnomalyFilterPreference,
  ProjectsHealthFilterPreference,
  ProjectsSortPreference,
} from "@/lib/api";

const VALID_HEALTH_FILTERS: readonly ProjectsHealthFilterPreference[] = [
  "all",
  "good",
  "needs_work",
  "poor",
  "no_crawl",
  "in_progress",
  "failed",
];

const VALID_SORTS: readonly ProjectsSortPreference[] = [
  "activity_desc",
  "score_desc",
  "score_asc",
  "name_asc",
  "name_desc",
  "created_desc",
  "created_asc",
];

const VALID_ANOMALY_FILTERS: readonly ProjectsAnomalyFilterPreference[] = [
  "all",
  "failed",
  "stale",
  "no_crawl",
  "in_progress",
  "low_score",
  "manual_schedule",
  "pipeline_disabled",
];

export function normalizeProjectsViewState(
  value: unknown,
): AccountProjectsViewState | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<AccountProjectsViewState>;
  if (
    typeof parsed.health !== "string" ||
    !VALID_HEALTH_FILTERS.includes(
      parsed.health as ProjectsHealthFilterPreference,
    )
  ) {
    return null;
  }
  if (
    typeof parsed.sort !== "string" ||
    !VALID_SORTS.includes(parsed.sort as ProjectsSortPreference)
  ) {
    return null;
  }
  if (
    typeof parsed.anomaly !== "string" ||
    !VALID_ANOMALY_FILTERS.includes(
      parsed.anomaly as ProjectsAnomalyFilterPreference,
    )
  ) {
    return null;
  }
  const health = parsed.health as ProjectsHealthFilterPreference;
  const sort = parsed.sort as ProjectsSortPreference;
  const anomaly = parsed.anomaly as ProjectsAnomalyFilterPreference;
  return {
    health,
    sort,
    anomaly,
  };
}

export function projectsViewStateSignature(
  value: AccountProjectsViewState | null | undefined,
): string | null {
  if (!value) return null;
  return `${value.health}|${value.sort}|${value.anomaly}`;
}
