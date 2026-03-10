import {
  confidenceFromRecommendation,
  relativeTimeLabel,
} from "@/lib/insight-metadata";
import type { RecommendationConfidence, SharedReport } from "@/lib/api";

const REPORT_DELTA_ROW_KEYS = [
  ["Overall", "overall"],
  ["Technical", "technical"],
  ["Content", "content"],
  ["AI Readiness", "aiReadiness"],
  ["Performance", "performance"],
] as const satisfies ReadonlyArray<
  readonly [string, keyof SharedReport["scoreDeltas"]]
>;

export function getReportRecommendationMeta(
  win: SharedReport["quickWins"][number],
  totalPages: number,
  fallbackTimestamp: string | null | undefined,
): {
  confidence: RecommendationConfidence;
  dataTimestamp: string | null;
} {
  const confidence =
    win.confidence ??
    confidenceFromRecommendation({
      severity: win.severity,
      scoreImpact: win.scoreImpact,
      affectedPages: win.affectedPages,
      totalPages,
    });

  return {
    confidence,
    dataTimestamp: win.dataTimestamp ?? fallbackTimestamp ?? null,
  };
}

export function getReportRecommendationDataLabel(
  timestamp: string | null | undefined,
): string {
  if (!timestamp) return "Data unavailable";

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "Data unavailable";

  return `Data ${parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function formatReportDate(
  timestamp: string | null | undefined,
): string | null {
  if (!timestamp) return null;

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getReportBrandColor(report: SharedReport): string {
  return report.project.branding?.primaryColor || "#4f46e5";
}

export function isAgencySharedReport(report: SharedReport): boolean {
  return !!report.project.branding?.companyName;
}

export function getReportCoverageHighlights(
  report: SharedReport,
): SharedReport["readinessCoverage"] {
  return (report.readinessCoverage ?? []).slice(0, 4);
}

export function getReportEvidencePages(report: SharedReport): number {
  return Math.max(report.pages.length, report.pagesScored ?? 0);
}

export function getReportDataFreshness(
  completedAt: string | null | undefined,
): string {
  return relativeTimeLabel(completedAt);
}

export function getReportDeltaRows(
  report: SharedReport,
): Array<{ label: string; value: number }> {
  return REPORT_DELTA_ROW_KEYS.map(([label, key]) => ({
    label,
    value: report.scoreDeltas[key],
  }));
}

export function getReportCategoryScores(report: SharedReport) {
  return [
    { label: "Technical SEO", score: report.scores.technical },
    { label: "Content Quality", score: report.scores.content },
    { label: "AI Readiness", score: report.scores.aiReadiness },
    { label: "Performance", score: report.scores.performance },
  ];
}
