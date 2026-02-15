import { describe, it, expect } from "vitest";
import {
  ProjectProgressSchema,
  PageProgressSchema,
  CategoryDeltaSchema,
} from "../../schemas/scoring";

describe("progress schemas", () => {
  it("validates a project progress response", () => {
    const data = {
      currentCrawlId: "c1",
      previousCrawlId: "c2",
      scoreDelta: 8,
      currentScore: 72,
      previousScore: 64,
      categoryDeltas: {
        technical: { current: 75, previous: 68, delta: 7 },
        content: { current: 80, previous: 70, delta: 10 },
        aiReadiness: { current: 65, previous: 60, delta: 5 },
        performance: { current: 70, previous: 62, delta: 8 },
      },
      issuesFixed: 12,
      issuesNew: 3,
      issuesPersisting: 18,
      gradeChanges: { improved: 5, regressed: 1, unchanged: 14 },
      velocity: 4.2,
      topImprovedPages: [
        { url: "https://example.com/a", delta: 15, current: 85 },
      ],
      topRegressedPages: [
        { url: "https://example.com/b", delta: -8, current: 52 },
      ],
    };
    expect(ProjectProgressSchema.safeParse(data).success).toBe(true);
  });

  it("validates a page progress entry", () => {
    const data = {
      url: "https://example.com/page",
      currentScore: 78,
      previousScore: 65,
      delta: 13,
      issuesFixed: ["MISSING_H1", "THIN_CONTENT"],
      issuesNew: ["MISSING_SCHEMA"],
      categoryDeltas: {
        technical: { current: 80, previous: 70, delta: 10 },
        content: { current: 85, previous: 60, delta: 25 },
        aiReadiness: { current: 70, previous: 65, delta: 5 },
        performance: { current: 75, previous: 70, delta: 5 },
      },
    };
    expect(PageProgressSchema.safeParse(data).success).toBe(true);
  });

  it("rejects category delta with missing fields", () => {
    const data = { current: 80 }; // missing previous and delta
    expect(CategoryDeltaSchema.safeParse(data).success).toBe(false);
  });
});
