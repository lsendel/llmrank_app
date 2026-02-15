import { describe, it, expect } from "vitest";
import { estimateIssueROI } from "../roi";

describe("estimateIssueROI", () => {
  it("estimates high ROI for critical issue affecting many pages", () => {
    const roi = estimateIssueROI({
      code: "MISSING_LLMS_TXT",
      severity: "critical",
      scoreDeduction: 8,
      affectedPages: 50,
      totalPages: 50,
      gscImpressions: 10000,
    });
    expect(roi.scoreImpact).toBe(8);
    expect(roi.pageReach).toBe(50);
    expect(roi.visibilityImpact).toBe("high");
    expect(roi.trafficEstimate).toBeTruthy();
  });

  it("estimates medium ROI for warning issue", () => {
    const roi = estimateIssueROI({
      code: "MISSING_META_DESC",
      severity: "warning",
      scoreDeduction: 5,
      affectedPages: 10,
      totalPages: 100,
      gscImpressions: 5000,
    });
    expect(roi.visibilityImpact).toBe("medium");
    expect(roi.trafficEstimate).toBeTruthy();
  });

  it("estimates low ROI for info issue on few pages", () => {
    const roi = estimateIssueROI({
      code: "MISSING_OG_IMAGE",
      severity: "info",
      scoreDeduction: 2,
      affectedPages: 3,
      totalPages: 100,
      gscImpressions: null,
    });
    expect(roi.visibilityImpact).toBe("low");
    expect(roi.trafficEstimate).toBeNull();
  });

  it("returns null traffic estimate without GSC data", () => {
    const roi = estimateIssueROI({
      code: "MISSING_LLMS_TXT",
      severity: "critical",
      scoreDeduction: 8,
      affectedPages: 50,
      totalPages: 50,
      gscImpressions: null,
    });
    expect(roi.trafficEstimate).toBeNull();
  });

  it("handles zero total pages gracefully", () => {
    const roi = estimateIssueROI({
      code: "TEST",
      severity: "info",
      scoreDeduction: 1,
      affectedPages: 0,
      totalPages: 0,
      gscImpressions: null,
    });
    expect(roi.visibilityImpact).toBe("low");
    expect(roi.pageReach).toBe(0);
  });
});
