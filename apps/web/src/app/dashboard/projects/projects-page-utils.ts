import type { Project } from "@/lib/api";

export const PROJECTS_PER_PAGE = 12;
export const STALE_CRAWL_THRESHOLD_DAYS = 14;

export function gradeBadgeVariant(
  score: number,
): "success" | "warning" | "destructive" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "destructive";
}

export function gradeLabel(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 60) return "Needs Work";
  return "Poor";
}

export function isInProgress(project: Project): boolean {
  const status = project.latestCrawl?.status;
  return status === "pending" || status === "crawling" || status === "scoring";
}

export function parsePage(value: string | null): number {
  const n = Number(value ?? "1");
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function lastActivityTimestamp(project: Project): number {
  const reference =
    project.latestCrawl?.createdAt ?? project.updatedAt ?? project.createdAt;
  const timestamp = new Date(reference).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function projectScore(project: Project): number {
  return project.latestCrawl?.overallScore ?? -1;
}

export function matchesSearch(project: Project, query: string): boolean {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    project.name.toLowerCase().includes(normalized) ||
    project.domain.toLowerCase().includes(normalized)
  );
}

export function compareProjectsBySort(
  a: Project,
  b: Project,
  sortBy: string,
): number {
  switch (sortBy) {
    case "score_desc":
      return projectScore(b) - projectScore(a);
    case "score_asc":
      return projectScore(a) - projectScore(b);
    case "name_asc":
      return a.name.localeCompare(b.name);
    case "name_desc":
      return b.name.localeCompare(a.name);
    case "created_asc":
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case "created_desc":
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    case "activity_desc":
    default:
      return lastActivityTimestamp(b) - lastActivityTimestamp(a);
  }
}

export function matchesAnomaly(project: Project, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "failed") return project.latestCrawl?.status === "failed";
  if (filter === "no_crawl") return !project.latestCrawl;
  if (filter === "in_progress") return isInProgress(project);
  if (filter === "low_score") {
    const score = project.latestCrawl?.overallScore;
    return score != null && score < 60;
  }
  if (filter === "manual_schedule") {
    return project.settings.schedule === "manual";
  }
  if (filter === "pipeline_disabled") {
    return project.pipelineSettings?.autoRunOnCrawl === false;
  }
  if (filter === "stale") {
    const latest = project.latestCrawl;
    if (!latest || latest.status !== "complete") return false;
    const reference = latest.completedAt ?? latest.createdAt;
    const timestamp = new Date(reference).getTime();
    if (!Number.isFinite(timestamp)) return false;
    return (
      Date.now() - timestamp > STALE_CRAWL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
    );
  }
  return false;
}
