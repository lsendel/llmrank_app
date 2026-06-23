import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/lib/api";
import { useProjectsPageSummaries } from "./use-projects-page-summaries";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Project",
    domain: "example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    settings: { schedule: "weekly" },
    pipelineSettings: { autoRunOnCrawl: true },
    latestCrawl: null,
    ...overrides,
  } as Project;
}

describe("useProjectsPageSummaries", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts recent activity after the last visit", () => {
    const { result } = renderHook(() =>
      useProjectsPageSummaries({
        recentActivity: [
          { createdAt: "2026-03-01T12:00:00.000Z", status: "complete" },
          { createdAt: "2026-03-01T12:05:00.000Z", status: "failed" },
          { createdAt: "2026-03-01T12:10:00.000Z", status: "pending" },
          { createdAt: "2026-03-01T11:00:00.000Z", status: "complete" },
        ],
        effectiveLastVisitedAt: "2026-03-01T11:30:00.000Z",
        anomalyProjects: [],
        projects: [],
      }),
    );

    expect(result.current.sinceLastVisitSummary).toEqual({
      total: 3,
      completed: 1,
      failed: 1,
      running: 1,
    });
  });

  it("computes anomaly and page summaries from the provided projects", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const daysAgo = (days: number) =>
      new Date(now - days * DAY_MS).toISOString();

    // Dates are relative to "now" so the test is independent of the wall clock:
    // the stale project's crawl is well past the staleness threshold, the
    // low-score project's crawl is recent.
    const staleProject = makeProject({
      id: "stale",
      latestCrawl: {
        status: "complete",
        overallScore: 82,
        createdAt: daysAgo(65),
        completedAt: daysAgo(60),
      },
    });
    const lowScoreProject = makeProject({
      id: "low",
      latestCrawl: {
        status: "complete",
        overallScore: 45,
        createdAt: daysAgo(2),
        completedAt: daysAgo(2),
      },
    });
    const inProgressProject = makeProject({
      id: "running",
      latestCrawl: {
        status: "crawling",
        overallScore: null,
        createdAt: daysAgo(1),
      },
    });
    const failedManualProject = makeProject({
      id: "failed",
      settings: { schedule: "manual" },
      pipelineSettings: { autoRunOnCrawl: false },
      latestCrawl: {
        status: "failed",
        overallScore: 70,
        createdAt: daysAgo(3),
      },
    });
    const noCrawlProject = makeProject({ id: "new", latestCrawl: null });

    const { result } = renderHook(() =>
      useProjectsPageSummaries({
        recentActivity: [],
        effectiveLastVisitedAt: null,
        anomalyProjects: [
          staleProject,
          lowScoreProject,
          inProgressProject,
          failedManualProject,
          noCrawlProject,
        ],
        projects: [
          staleProject,
          lowScoreProject,
          inProgressProject,
          failedManualProject,
        ],
      }),
    );

    expect(result.current.anomalySummary).toEqual({
      failed: 1,
      stale: 1,
      noCrawl: 1,
      inProgress: 1,
      lowScore: 1,
      manualSchedule: 1,
      pipelineDisabled: 1,
    });
    expect(result.current.pageSummary).toEqual({
      good: 1,
      needsWork: 1,
      poor: 1,
      inProgress: 1,
    });
  });
});
