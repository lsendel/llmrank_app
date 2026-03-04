import { describe, expect, it } from "vitest";
import {
  buildAnomalySmartFix,
  type ActionableAnomalyFilter,
} from "@/lib/anomaly-smart-fixes";

const ANOMALIES: ActionableAnomalyFilter[] = [
  "failed",
  "stale",
  "no_crawl",
  "in_progress",
  "low_score",
  "manual_schedule",
  "pipeline_disabled",
];

describe("anomaly smart fixes", () => {
  it("builds a smart-fix draft for every actionable anomaly", () => {
    for (const anomaly of ANOMALIES) {
      const draft = buildAnomalySmartFix({
        anomaly,
        projectName: "Acme Site",
        domain: "acme.com",
        assigneeId: "user-1",
      });

      expect(draft.issueCode).toMatch(/^PORTFOLIO_/);
      expect(draft.status).toBe("pending");
      expect(draft.title.toLowerCase()).toContain("acme");
      expect(draft.description.length).toBeGreaterThan(20);
      expect(typeof draft.scoreImpact).toBe("number");
      expect(draft.assigneeId).toBe("user-1");
      expect(draft.dueAt).toBeTypeOf("string");
    }
  });

  it("falls back to domain when project name is blank", () => {
    const draft = buildAnomalySmartFix({
      anomaly: "manual_schedule",
      projectName: "   ",
      domain: "example.com",
    });
    expect(draft.title.toLowerCase()).toContain("example.com");
  });
});
