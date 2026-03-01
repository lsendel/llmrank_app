import type { Metadata } from "next";
import Link from "next/link";
import type { PublicReport, RecommendationConfidence } from "@/lib/api";
import {
  confidenceFromRecommendation,
  relativeTimeLabel,
} from "@/lib/insight-metadata";
import { cn } from "@/lib/utils";
import { SortablePageTable } from "./page-table";

// ─── Data fetching ──────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.llmrank.app";

async function getReport(token: string): Promise<PublicReport | null> {
  try {
    const res = await fetch(`${API_URL}/api/public/reports/${token}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as PublicReport;
  } catch {
    return null;
  }
}

// ─── Grade helpers ──────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
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

function gradeColor(grade: string): string {
  return GRADE_COLORS[grade] ?? "#6b7280";
}

function scoreBgClass(score: number): string {
  if (score >= 80) return "bg-[#22c55e]";
  if (score >= 60) return "bg-[#eab308]";
  if (score >= 40) return "bg-[#f97316]";
  return "bg-[#ef4444]";
}

function scoreTextClass(score: number): string {
  if (score >= 80) return "text-[#22c55e]";
  if (score >= 60) return "text-[#eab308]";
  if (score >= 40) return "text-[#f97316]";
  return "text-[#ef4444]";
}

// ─── Severity badge helpers ─────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
};

const EFFORT_STYLES: Record<string, { label: string; className: string }> = {
  low: { label: "Quick Fix", className: "bg-green-100 text-green-800" },
  medium: { label: "Moderate", className: "bg-yellow-100 text-yellow-800" },
  high: { label: "Significant", className: "bg-red-100 text-red-700" },
};

const CONFIDENCE_STYLES: Record<"success" | "warning" | "destructive", string> =
  {
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    destructive: "bg-red-100 text-red-800 border-red-200",
  };

function recommendationMeta(
  win: PublicReport["quickWins"][number],
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

function recommendationDataLabel(timestamp: string | null | undefined): string {
  if (!timestamp) return "Data unavailable";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "Data unavailable";
  return `Data ${parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

// ─── Metadata ───────────────────────────────────────────────────────

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const report = await getReport(token);
  if (!report) return { title: "Report Not Found" };

  return {
    title: `${report.project.domain} AI Readiness: ${report.scores.letterGrade} (${Math.round(report.scores.overall)}/100)`,
    description: `AI readiness score for ${report.project.domain}: ${report.scores.letterGrade} grade with ${Math.round(report.scores.overall)}/100 overall score.`,
    openGraph: {
      title: `${report.project.domain} — AI Readiness: ${report.scores.letterGrade}`,
      description: `Score: ${Math.round(report.scores.overall)}/100 | Tech: ${Math.round(report.scores.technical)} | Content: ${Math.round(report.scores.content)} | AI: ${Math.round(report.scores.aiReadiness)} | Perf: ${Math.round(report.scores.performance)}`,
    },
  };
}

// ─── Page component ─────────────────────────────────────────────────

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const report = await getReport(token);

  if (!report) {
    return <NotFoundView />;
  }

  const level = report.shareLevel as "summary" | "issues" | "full";
  const evidencePages = Math.max(
    report.pagesScored ?? 0,
    report.pagesCrawled ?? 0,
    report.pages?.length ?? 0,
  );
  const dataFreshness = relativeTimeLabel(report.completedAt);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Header */}
          <header className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              AI Readiness Report
            </h1>
            <p className="text-lg text-muted-foreground">
              {report.project.domain}
            </p>
          </header>

          {/* Hero score card -- all levels */}
          <HeroCard report={report} />

          {/* Category breakdown -- all levels */}
          <CategoryBreakdown report={report} />

          {/* Stats row -- all levels */}
          <StatsRow report={report} />

          {/* Executive summary -- all levels */}
          {report.summary && (
            <ExecutiveSummarySection
              summary={report.summary}
              completedAt={report.completedAt}
            />
          )}

          {(level === "issues" || level === "full") &&
            report.quickWins.length > 0 && (
              <ExecutiveActionsSection
                quickWins={report.quickWins}
                completedAt={report.completedAt}
                pagesScored={evidencePages}
                dataFreshness={dataFreshness}
              />
            )}

          {/* Quick wins section -- issues and full levels */}
          {(level === "issues" || level === "full") &&
            report.quickWins.length > 0 && (
              <QuickWinsSection
                quickWins={report.quickWins}
                completedAt={report.completedAt}
                pagesScored={evidencePages}
              />
            )}

          {/* Score deltas -- full level only */}
          {level === "full" && report.scoreDeltas && (
            <ScoreDeltasSection deltas={report.scoreDeltas} />
          )}

          {/* Per-page table -- full level only */}
          {level === "full" && report.pages.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">
                Page-by-Page Scores
              </h2>
              <SortablePageTable pages={report.pages} />
            </section>
          )}

          {/* CTA */}
          <CtaSection />

          {/* Footer */}
          <footer className="border-t border-border pt-6 text-center">
            <Link
              href="https://llmrank.app"
              className="text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Powered by LLM Rank
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function NotFoundView() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold text-foreground">
          Report not found or expired
        </h1>
        <p className="text-muted-foreground max-w-md">
          This shared report link is no longer available. It may have expired or
          been revoked by the owner.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
      >
        Get Your Free AI Readiness Scan
      </Link>
    </div>
  );
}

function HeroCard({ report }: { report: PublicReport }) {
  const { scores } = report;
  const color = gradeColor(scores.letterGrade);

  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
        {/* Letter grade box */}
        <div
          className="flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ backgroundColor: color }}
        >
          <span className="text-5xl font-bold">{scores.letterGrade}</span>
        </div>

        {/* Score number and label */}
        <div className="text-center sm:text-left">
          <div className="text-5xl font-bold text-foreground">
            {Math.round(scores.overall)}
            <span className="text-2xl text-muted-foreground font-normal">
              /100
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Overall AI Readiness Score
          </p>
        </div>
      </div>
    </div>
  );
}

function CategoryBreakdown({ report }: { report: PublicReport }) {
  const { scores } = report;
  const categories = [
    { label: "Technical SEO", score: scores.technical, weight: "25%" },
    { label: "Content Quality", score: scores.content, weight: "30%" },
    { label: "AI Readiness", score: scores.aiReadiness, weight: "30%" },
    { label: "Performance", score: scores.performance, weight: "15%" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold text-foreground">
        Category Breakdown
      </h2>
      <div className="space-y-5">
        {categories.map((cat) => (
          <div key={cat.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {cat.label}{" "}
                <span className="text-muted-foreground font-normal">
                  ({cat.weight})
                </span>
              </span>
              <span className={cn("font-semibold", scoreTextClass(cat.score))}>
                {Math.round(cat.score)} / 100
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  scoreBgClass(cat.score),
                )}
                style={{ width: `${Math.max(cat.score, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsRow({ report }: { report: PublicReport }) {
  const stats = [
    {
      label: "Pages Scanned",
      value: String(report.pagesCrawled ?? report.pagesScored),
    },
    { label: "Issues Found", value: String(report.issueCount) },
    {
      label: "Scan Date",
      value: report.completedAt
        ? new Date(report.completedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "N/A",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-border bg-card p-4 text-center shadow-sm"
        >
          <div className="text-2xl font-bold text-foreground">{stat.value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

function ExecutiveSummarySection({
  summary,
  completedAt,
}: {
  summary: string;
  completedAt: string | null | undefined;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-primary/5 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-xl font-bold text-foreground">
            Executive Summary
          </h2>
          {completedAt && (
            <span className="inline-flex rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Data{" "}
              {new Date(completedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {summary}
        </p>
      </div>
    </section>
  );
}

function ExecutiveActionsSection({
  quickWins,
  completedAt,
  pagesScored,
  dataFreshness,
}: {
  quickWins: PublicReport["quickWins"];
  completedAt: string | null | undefined;
  pagesScored: number;
  dataFreshness: string;
}) {
  const prioritized = quickWins.slice(0, 3);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Executive Action Brief
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with these top actions to move the overall score fastest.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-muted-foreground">
              Updated: {dataFreshness}
            </span>
            <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-muted-foreground">
              Evidence: {pagesScored} pages
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {prioritized.map((win, i) => {
            const meta = recommendationMeta(win, pagesScored, completedAt);
            return (
              <div
                key={`${win.code}-brief-${i}`}
                className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {win.message}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                      +{win.scoreImpact} pts
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 font-semibold uppercase",
                        CONFIDENCE_STYLES[meta.confidence.variant],
                      )}
                    >
                      Confidence {meta.confidence.label}
                    </span>
                    <span className="inline-flex rounded-md border border-border px-2 py-0.5 font-medium text-muted-foreground">
                      {win.affectedPages} pages affected
                    </span>
                    <span className="inline-flex rounded-md border border-border px-2 py-0.5 font-medium text-muted-foreground">
                      {recommendationDataLabel(meta.dataTimestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function QuickWinsSection({
  quickWins,
  completedAt,
  pagesScored,
}: {
  quickWins: PublicReport["quickWins"];
  completedAt: string | null | undefined;
  pagesScored: number;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Top Quick Wins</h2>
      <div className="space-y-3">
        {quickWins.map((win, i) => {
          const effort = EFFORT_STYLES[win.effortLevel] ?? EFFORT_STYLES.medium;
          const severity =
            SEVERITY_STYLES[win.severity] ?? SEVERITY_STYLES.info;
          const meta = recommendationMeta(win, pagesScored, completedAt);

          return (
            <div
              key={`${win.code}-${i}`}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {win.message}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase",
                        severity,
                      )}
                    >
                      {win.severity}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold",
                        effort.className,
                      )}
                    >
                      {effort.label}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      +{win.scoreImpact} pts
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase",
                        CONFIDENCE_STYLES[meta.confidence.variant],
                      )}
                    >
                      Confidence {meta.confidence.label}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {win.recommendation}
                  </p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      {win.affectedPages} page
                      {win.affectedPages !== 1 ? "s" : ""} affected
                    </span>
                    <span className="capitalize">
                      Category: {win.category.replace("_", " ")}
                    </span>
                    <span>{recommendationDataLabel(meta.dataTimestamp)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScoreDeltasSection({ deltas }: { deltas: Record<string, number> }) {
  const rows = [
    { label: "Overall", key: "overall" },
    { label: "Technical", key: "technical" },
    { label: "Content", key: "content" },
    { label: "AI Readiness", key: "aiReadiness" },
    { label: "Performance", key: "performance" },
  ];

  const hasAnyDelta = rows.some((r) => (deltas[r.key] ?? 0) !== 0);
  if (!hasAnyDelta) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">
        Score Changes vs. Previous Crawl
      </h2>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="divide-y divide-border">
          {rows.map((row) => {
            const delta = deltas[row.key] ?? 0;
            const isPositive = delta > 0;
            const isNegative = delta < 0;

            return (
              <div
                key={row.key}
                className="flex items-center justify-between px-5 py-3"
              >
                <span className="text-sm font-medium text-foreground">
                  {row.label}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isPositive && "text-[#22c55e]",
                    isNegative && "text-[#ef4444]",
                    !isPositive && !isNegative && "text-muted-foreground",
                  )}
                >
                  {isPositive ? "+" : ""}
                  {delta}
                  {delta === 0 ? " (no change)" : " pts"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <div className="rounded-xl border border-border bg-primary/5 p-8 text-center shadow-sm">
      <h2 className="text-xl font-bold text-foreground">
        Want to improve your AI readiness?
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Run a free scan on any URL to see your AI readiness score with
        actionable recommendations. No signup required.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
        >
          Get Your Free AI Readiness Scan
        </Link>
      </div>
    </div>
  );
}
