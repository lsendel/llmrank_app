import type { Metadata } from "next";
import type { PublicReport, RecommendationConfidence } from "@/lib/api";
import {
  confidenceFromRecommendation,
  relativeTimeLabel,
} from "@/lib/insight-metadata";

type ShareLevel = "summary" | "issues" | "full";
type ShareQuickWin = PublicReport["quickWins"][number];

const SHARE_GRADE_COLORS: Record<string, string> = {
  "A+": "#22c55e",
  A: "#22c55e",
  "A-": "#22c55e",
  "B+": "#3b82f6",
  B: "#3b82f6",
  "B-": "#3b82f6",
  "C+": "#eab308",
  C: "#eab308",
  "C-": "#eab308",
  "D+": "#f97316",
  D: "#f97316",
  "D-": "#f97316",
  F: "#ef4444",
};

export const SHARE_SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
};

export const SHARE_EFFORT_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  low: { label: "Quick Fix", className: "bg-green-100 text-green-800" },
  medium: { label: "Moderate", className: "bg-yellow-100 text-yellow-800" },
  high: { label: "Significant", className: "bg-red-100 text-red-700" },
};

export const SHARE_CONFIDENCE_STYLES: Record<
  RecommendationConfidence["variant"],
  string
> = {
  success: "bg-green-100 text-green-800 border-green-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  destructive: "bg-red-100 text-red-800 border-red-200",
};

export const SHARE_DELTA_ROWS = [
  { label: "Overall", key: "overall" },
  { label: "Technical", key: "technical" },
  { label: "Content", key: "content" },
  { label: "AI Readiness", key: "aiReadiness" },
  { label: "Performance", key: "performance" },
] as const;

export function getShareGradeColor(grade: string): string {
  return SHARE_GRADE_COLORS[grade] ?? "#6b7280";
}

export function getShareScoreBgClass(score: number): string {
  if (score >= 80) return "bg-[#22c55e]";
  if (score >= 60) return "bg-[#eab308]";
  if (score >= 40) return "bg-[#f97316]";
  return "bg-[#ef4444]";
}

export function getShareScoreTextClass(score: number): string {
  if (score >= 80) return "text-[#22c55e]";
  if (score >= 60) return "text-[#eab308]";
  if (score >= 40) return "text-[#f97316]";
  return "text-[#ef4444]";
}

export function getShareLevel(shareLevel: string): ShareLevel {
  return shareLevel === "issues" || shareLevel === "full"
    ? shareLevel
    : "summary";
}

export function getShareEvidencePages(report: PublicReport): number {
  return Math.max(
    report.pagesScored ?? 0,
    report.pagesCrawled ?? 0,
    report.pages?.length ?? 0,
  );
}

export function getShareDataFreshness(
  completedAt: string | null | undefined,
): string {
  return relativeTimeLabel(completedAt);
}

export function formatShareDate(
  value: string | null | undefined,
  fallback = "N/A",
): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getRecommendationMeta(
  win: ShareQuickWin,
  totalPages: number,
  fallbackTimestamp: string | null | undefined,
): { confidence: RecommendationConfidence; dataTimestamp: string | null } {
  return {
    confidence:
      win.confidence ??
      confidenceFromRecommendation({
        severity: win.severity,
        scoreImpact: win.scoreImpact,
        affectedPages: win.affectedPages,
        totalPages,
      }),
    dataTimestamp: win.dataTimestamp ?? fallbackTimestamp ?? null,
  };
}

export function getRecommendationDataLabel(
  timestamp: string | null | undefined,
): string {
  const formatted = formatShareDate(timestamp, "Data unavailable");
  return formatted === "Data unavailable" ? formatted : `Data ${formatted}`;
}

export function getShareCategoryScores(report: PublicReport) {
  const { scores } = report;
  return [
    { label: "Technical SEO", score: scores.technical, weight: "25%" },
    { label: "Content Quality", score: scores.content, weight: "30%" },
    { label: "AI Readiness", score: scores.aiReadiness, weight: "30%" },
    { label: "Performance", score: scores.performance, weight: "15%" },
  ];
}

export function getShareStats(report: PublicReport) {
  return [
    {
      label: "Pages Scanned",
      value: String(report.pagesCrawled ?? report.pagesScored),
    },
    { label: "Issues Found", value: String(report.issueCount) },
    { label: "Scan Date", value: formatShareDate(report.completedAt) },
  ];
}

export function buildSharePageMetadata(report: PublicReport): Metadata {
  return {
    title: `${report.project.domain} AI Readiness: ${report.scores.letterGrade} (${Math.round(report.scores.overall)}/100)`,
    description: `AI readiness score for ${report.project.domain}: ${report.scores.letterGrade} grade with ${Math.round(report.scores.overall)}/100 overall score.`,
    openGraph: {
      title: `${report.project.domain} — AI Readiness: ${report.scores.letterGrade}`,
      description: `Score: ${Math.round(report.scores.overall)}/100 | Tech: ${Math.round(report.scores.technical)} | Content: ${Math.round(report.scores.content)} | AI: ${Math.round(report.scores.aiReadiness)} | Perf: ${Math.round(report.scores.performance)}`,
    },
  };
}
