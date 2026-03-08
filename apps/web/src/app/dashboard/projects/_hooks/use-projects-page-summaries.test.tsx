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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T00:00:00.000Z"));

    const staleProject = makeProject({
      id: "stale",
      latestCrawl: {
        status: "complete",
        overallScore: 82,
        createdAt: "2026-02-20T00:00:00.000Z",
        completedAt: "2026-02-25T00:00:00.000Z",
      },
    });
    const lowScoreProject = makeProject({
      id: "low",
      latestCrawl: {
        status: "complete",
        overallScore: 45,
        createdAt: "2026-03-10T00:00:00.000Z",
        completedAt: "2026-03-10T00:00:00.000Z",
      },
    });
    const inProgressProject = makeProject({
      id: "running",
      latestCrawl: {
        status: "crawling",
        overallScore: null,
        createdAt: "2026-03-19T00:00:00.000Z",
      },
    });
    const failedManualProject = makeProject({
      id: "failed",
      settings: { schedule: "manual" },
      pipelineSettings: { autoRunOnCrawl: false },
      latestCrawl: {
        status: "failed",
        overallScore: 70,
        createdAt: "2026-03-18T00:00:00.000Z",
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
