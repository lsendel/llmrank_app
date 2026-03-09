import { describe, expect, it } from "vitest";
import {
  buildSinceLastVisitSummary,
  formatDashboardDelta,
} from "./dashboard-page-helpers";
import type { DashboardActivity } from "@/lib/api/types/dashboard";

describe("dashboard-page-helpers", () => {
  it("formats positive, negative, and neutral score deltas", () => {
    expect(formatDashboardDelta(4)).toEqual({
      label: "+4 vs last crawl",
      className: "text-emerald-600",
    });
    expect(formatDashboardDelta(-2)).toEqual({
      label: "-2 vs last crawl",
      className: "text-red-600",
    });
    expect(formatDashboardDelta(0)).toEqual({
      label: "No change",
      className: "text-muted-foreground",
    });
  });

  it("summarizes all activity when there is no valid baseline", () => {
    const activity = [
      {
        projectId: "proj-1",
        status: "complete",
        completedAt: "2024-03-14T10:00:00.000Z",
        createdAt: "2024-03-14T09:00:00.000Z",
      },
      {
        projectId: "proj-2",
        status: "failed",
        completedAt: "2024-03-14T11:00:00.000Z",
        createdAt: "2024-03-14T10:30:00.000Z",
      },
      {
        projectId: "proj-2",
        status: "crawling",
        completedAt: null,
        createdAt: "2024-03-14T12:00:00.000Z",
      },
    ] as unknown as DashboardActivity[];

    expect(buildSinceLastVisitSummary(activity, null)).toMatchObject({
      hasBaseline: false,
      completed: 1,
      failed: 1,
      inProgress: 1,
      projectsTouched: 2,
      feedEvents: 3,
    });
    expect(buildSinceLastVisitSummary(activity, null).narrative).toMatch(
      /first dashboard visit/i,
    );
  });

  it("filters activity newer than the baseline and builds a narrative", () => {
    const activity = [
      {
        projectId: "proj-old",
        status: "complete",
        completedAt: "2024-03-10T08:00:00.000Z",
        createdAt: "2024-03-10T07:00:00.000Z",
      },
      {
        projectId: "proj-1",
        status: "complete",
        completedAt: "2024-03-13T08:00:00.000Z",
        createdAt: "2024-03-13T07:00:00.000Z",
      },
      {
        projectId: "proj-2",
        status: "failed",
        completedAt: "2024-03-14T09:00:00.000Z",
        createdAt: "2024-03-14T08:30:00.000Z",
      },
      {
        projectId: "proj-2",
        status: "pending",
        completedAt: null,
        createdAt: "2024-03-14T10:00:00.000Z",
      },
    ] as unknown as DashboardActivity[];

    const summary = buildSinceLastVisitSummary(
      activity,
      "2024-03-12T00:00:00.000Z",
    );

    expect(summary).toMatchObject({
      hasBaseline: true,
      completed: 1,
      failed: 1,
      inProgress: 1,
      projectsTouched: 2,
      feedEvents: 3,
    });
    expect(summary.narrative).toBe(
      "Since your last visit: 1 crawl completed, 1 failed, 1 in progress.",
    );
  });
});
