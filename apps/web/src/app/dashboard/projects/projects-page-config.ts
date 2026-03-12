export type HealthFilter =
  | "all"
  | "good"
  | "needs_work"
  | "poor"
  | "no_crawl"
  | "in_progress"
  | "failed";

export type SortBy =
  | "activity_desc"
  | "score_desc"
  | "score_asc"
  | "name_asc"
  | "name_desc"
  | "created_desc"
  | "created_asc";

export type ViewPreset = "seo_manager" | "content_lead" | "exec_summary";
export type AnomalyFilter =
  | "all"
  | "failed"
  | "stale"
  | "no_crawl"
  | "in_progress"
  | "low_score"
  | "manual_schedule"
  | "pipeline_disabled";

export type ActionableAnomalyFilter = Exclude<AnomalyFilter, "all">;

export const VALID_HEALTH_FILTERS: HealthFilter[] = [
  "all",
  "good",
  "needs_work",
  "poor",
  "no_crawl",
  "in_progress",
  "failed",
];

export const VALID_SORTS: SortBy[] = [
  "activity_desc",
  "score_desc",
  "score_asc",
  "name_asc",
  "name_desc",
  "created_desc",
  "created_asc",
];

export const VALID_ANOMALY_FILTERS: AnomalyFilter[] = [
  "all",
  "failed",
  "stale",
  "no_crawl",
  "in_progress",
  "low_score",
  "manual_schedule",
  "pipeline_disabled",
];

export const ANOMALY_SHORTCUTS: Record<
  ActionableAnomalyFilter,
  {
    title: string;
    description: string;
    tab: string;
    cta: string;
  }
> = {
  failed: {
    title: "Recover failed crawls",
    description:
      "Open Issues for affected projects to inspect blockers and relaunch stable runs.",
    tab: "issues",
    cta: "Open issues",
  },
  stale: {
    title: "Refresh stale monitoring",
    description:
      "Open Automation to tighten crawl cadence and keep rankings current.",
    tab: "automation",
    cta: "Open automation",
  },
  no_crawl: {
    title: "Run first crawl",
    description:
      "Open Overview for projects with no crawl history and trigger first analysis.",
    tab: "overview",
    cta: "Open overview",
  },
  in_progress: {
    title: "Monitor active jobs",
    description:
      "Open Logs for active crawls to spot stuck stages and resolve them quickly.",
    tab: "logs",
    cta: "Open logs",
  },
  low_score: {
    title: "Prioritize highest-impact fixes",
    description:
      "Open Issues for low-score projects and address core SEO blockers first.",
    tab: "issues",
    cta: "Open issues",
  },
  manual_schedule: {
    title: "Reduce manual overhead",
    description:
      "Open Settings and switch from manual schedule to recurring scans where needed.",
    tab: "settings",
    cta: "Open settings",
  },
  pipeline_disabled: {
    title: "Re-enable automation pipeline",
    description:
      "Open Automation and restore post-crawl auto-run for faster issue remediation.",
    tab: "automation",
    cta: "Open automation",
  },
};

export const VIEW_PRESETS: Record<
  ViewPreset,
  {
    label: string;
    health: HealthFilter;
    sort: SortBy;
  }
> = {
  seo_manager: {
    label: "SEO Manager",
    health: "poor",
    sort: "score_asc",
  },
  content_lead: {
    label: "Content Lead",
    health: "needs_work",
    sort: "score_asc",
  },
  exec_summary: {
    label: "Exec Summary",
    health: "all",
    sort: "activity_desc",
  },
};

export const DEFAULT_PRESET_STORAGE_KEY = "projects-default-view-preset";
export const PROJECTS_LAST_VISIT_STORAGE_KEY = "projects-last-visit-at";
