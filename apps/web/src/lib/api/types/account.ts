export type ProjectsDefaultPreset =
  | "seo_manager"
  | "content_lead"
  | "exec_summary";

export interface AccountLastProjectContext {
  projectId: string;
  tab: string;
  projectName: string | null;
  domain: string | null;
  visitedAt: string;
}

export type ProjectsHealthFilterPreference =
  | "all"
  | "good"
  | "needs_work"
  | "poor"
  | "no_crawl"
  | "in_progress"
  | "failed";

export type ProjectsSortPreference =
  | "activity_desc"
  | "score_desc"
  | "score_asc"
  | "name_asc"
  | "name_desc"
  | "created_desc"
  | "created_asc";

export type ProjectsAnomalyFilterPreference =
  | "all"
  | "failed"
  | "stale"
  | "no_crawl"
  | "in_progress"
  | "low_score"
  | "manual_schedule"
  | "pipeline_disabled";

export interface AccountProjectsViewState {
  health: ProjectsHealthFilterPreference;
  sort: ProjectsSortPreference;
  anomaly: ProjectsAnomalyFilterPreference;
}

export interface AccountPreferences {
  projectsDefaultPreset: ProjectsDefaultPreset | null;
  lastProjectContext: AccountLastProjectContext | null;
  dashboardLastVisitedAt: string | null;
  projectsLastVisitedAt: string | null;
  projectsLastViewState: AccountProjectsViewState | null;
}

export interface NotificationPreferences {
  notifyOnCrawlComplete: boolean;
  notifyOnScoreDrop: boolean;
  webhookUrl: string | null;
}

export interface DigestPreferences {
  digestFrequency: string;
  digestDay: number;
  lastDigestSentAt: string | null;
}
