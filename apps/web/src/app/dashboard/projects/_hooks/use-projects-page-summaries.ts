import { useMemo } from "react";
import type { Project } from "@/lib/api";
import {
  isInProgress,
  STALE_CRAWL_THRESHOLD_DAYS,
} from "../projects-page-utils";

const STALE_CUTOFF =
  Date.now() - STALE_CRAWL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

type RecentActivityItem = {
  createdAt: string;
  status: string;
};

export function useProjectsPageSummaries({
  recentActivity,
  effectiveLastVisitedAt,
  anomalyProjects,
  projects,
}: {
  recentActivity: RecentActivityItem[] | null | undefined;
  effectiveLastVisitedAt: string | null;
  anomalyProjects: Project[];
  projects: Project[];
}) {
  const sinceLastVisitSummary = useMemo(() => {
    const activity = recentActivity ?? [];
    if (activity.length === 0) {
      return { total: 0, completed: 0, failed: 0, running: 0 };
    }

    const since = effectiveLastVisitedAt
      ? new Date(effectiveLastVisitedAt).getTime()
      : Number.NEGATIVE_INFINITY;

    const fresh = activity.filter((entry) => {
      const created = new Date(entry.createdAt).getTime();
      return Number.isFinite(created) && created > since;
    });

    return {
      total: fresh.length,
      completed: fresh.filter((entry) => entry.status === "complete").length,
      failed: fresh.filter((entry) => entry.status === "failed").length,
      running: fresh.filter(
        (entry) =>
          entry.status === "pending" ||
          entry.status === "crawling" ||
          entry.status === "scoring",
      ).length,
    };
  }, [effectiveLastVisitedAt, recentActivity]);

  const anomalySummary = useMemo(() => {
    return {
      failed: anomalyProjects.filter(
        (project) => project.latestCrawl?.status === "failed",
      ).length,
      stale: anomalyProjects.filter((project) => {
        const latest = project.latestCrawl;
        if (!latest || latest.status !== "complete") return false;
        const reference = latest.completedAt ?? latest.createdAt;
        const timestamp = new Date(reference).getTime();
        if (!Number.isFinite(timestamp)) return false;
        return timestamp < STALE_CUTOFF;
      }).length,
      noCrawl: anomalyProjects.filter((project) => !project.latestCrawl).length,
      inProgress: anomalyProjects.filter(isInProgress).length,
      lowScore: anomalyProjects.filter(
        (project) => (project.latestCrawl?.overallScore ?? 100) < 60,
      ).length,
      manualSchedule: anomalyProjects.filter(
        (project) => project.settings.schedule === "manual",
      ).length,
      pipelineDisabled: anomalyProjects.filter(
        (project) => project.pipelineSettings?.autoRunOnCrawl === false,
      ).length,
    };
  }, [anomalyProjects]);

  const pageSummary = useMemo(() => {
    const withScore = projects.filter(
      (project) => project.latestCrawl?.overallScore != null,
    );

    return {
      good: withScore.filter(
        (project) => (project.latestCrawl?.overallScore ?? 0) >= 80,
      ).length,
      needsWork: withScore.filter((project) => {
        const score = project.latestCrawl?.overallScore ?? 0;
        return score >= 60 && score < 80;
      }).length,
      poor: withScore.filter(
        (project) => (project.latestCrawl?.overallScore ?? 0) < 60,
      ).length,
      inProgress: projects.filter(isInProgress).length,
    };
  }, [projects]);

  return { sinceLastVisitSummary, anomalySummary, pageSummary };
}
