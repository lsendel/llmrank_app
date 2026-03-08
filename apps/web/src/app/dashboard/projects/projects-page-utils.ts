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
