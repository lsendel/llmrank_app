import { describe, expect, it } from "vitest";
import {
  normalizeProjectsViewState,
  projectsViewStateSignature,
} from "../projects-view-state";

describe("projects view state helpers", () => {
  it("normalizes valid payloads", () => {
    expect(
      normalizeProjectsViewState({
        health: "needs_work",
        sort: "score_asc",
        anomaly: "stale",
      }),
    ).toEqual({
      health: "needs_work",
      sort: "score_asc",
      anomaly: "stale",
    });
  });

  it("rejects missing or invalid values", () => {
    expect(
      normalizeProjectsViewState({
        health: "all",
        sort: "activity_desc",
      }),
    ).toBeNull();
    expect(
      normalizeProjectsViewState({
        health: "invalid",
        sort: "activity_desc",
        anomaly: "all",
      }),
    ).toBeNull();
    expect(normalizeProjectsViewState(null)).toBeNull();
  });

  it("builds stable signatures for dedupe", () => {
    expect(
      projectsViewStateSignature({
        health: "poor",
        sort: "score_asc",
        anomaly: "low_score",
      }),
    ).toBe("poor|score_asc|low_score");
    expect(projectsViewStateSignature(null)).toBeNull();
  });
});
