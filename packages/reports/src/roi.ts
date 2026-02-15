import type { ReportROI } from "./types";

interface ROIInput {
  code: string;
  severity: "critical" | "warning" | "info";
  scoreDeduction: number;
  affectedPages: number;
  totalPages: number;
  gscImpressions: number | null;
}

const AVG_CTR_IMPROVEMENT = 0.02; // 2% CTR improvement per 10-point score gain

export function estimateIssueROI(input: ROIInput): ReportROI {
  const {
    severity,
    scoreDeduction,
    affectedPages,
    totalPages,
    gscImpressions,
  } = input;
  const pageRatio = totalPages > 0 ? affectedPages / totalPages : 0;

  let visibilityImpact: "high" | "medium" | "low";
  if (severity === "critical" && pageRatio > 0.5) {
    visibilityImpact = "high";
  } else if (
    severity === "critical" ||
    severity === "warning" ||
    pageRatio > 0.2
  ) {
    visibilityImpact = "medium";
  } else {
    visibilityImpact = "low";
  }

  let trafficEstimate: string | null = null;
  if (gscImpressions !== null && gscImpressions > 0) {
    const estimatedClicks = Math.round(
      gscImpressions * AVG_CTR_IMPROVEMENT * (scoreDeduction / 10),
    );
    if (estimatedClicks > 0) {
      trafficEstimate = `+${estimatedClicks.toLocaleString()} clicks/month`;
    }
  }

  return {
    scoreImpact: scoreDeduction,
    pageReach: affectedPages,
    visibilityImpact,
    trafficEstimate,
  };
}
