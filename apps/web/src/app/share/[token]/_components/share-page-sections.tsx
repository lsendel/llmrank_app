import Link from "next/link";
import type { PublicReport } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SortablePageTable } from "../page-table";
import {
  SHARE_CONFIDENCE_STYLES,
  SHARE_DELTA_ROWS,
  SHARE_EFFORT_STYLES,
  SHARE_SEVERITY_STYLES,
  formatShareDate,
  getRecommendationDataLabel,
  getRecommendationMeta,
  getShareCategoryScores,
  getShareDataFreshness,
  getShareEvidencePages,
  getShareGradeColor,
  getShareLevel,
  getShareScoreBgClass,
  getShareScoreTextClass,
  getShareStats,
} from "../share-page-helpers";

export function SharePageNotFoundView() {
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

export function SharePageLayout({ report }: { report: PublicReport }) {
  const level = getShareLevel(report.shareLevel);
  const evidencePages = getShareEvidencePages(report);
  const dataFreshness = getShareDataFreshness(report.completedAt);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <header className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              AI Readiness Report
            </h1>
            <p className="text-lg text-muted-foreground">
              {report.project.domain}
            </p>
          </header>

          <HeroCard report={report} />
          <CategoryBreakdown report={report} />
          <StatsRow report={report} />

          {report.summary ? (
            <ExecutiveSummarySection
              summary={report.summary}
              completedAt={report.completedAt}
            />
          ) : null}

          {(level === "issues" || level === "full") &&
          report.quickWins.length > 0 ? (
            <ExecutiveActionsSection
              quickWins={report.quickWins}
              completedAt={report.completedAt}
              pagesScored={evidencePages}
              dataFreshness={dataFreshness}
            />
          ) : null}

          {(level === "issues" || level === "full") &&
          report.quickWins.length > 0 ? (
            <QuickWinsSection
              quickWins={report.quickWins}
              completedAt={report.completedAt}
              pagesScored={evidencePages}
            />
          ) : null}

          {level === "full" && report.scoreDeltas ? (
            <ScoreDeltasSection deltas={report.scoreDeltas} />
          ) : null}

          {level === "full" && report.pages.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">
                Page-by-Page Scores
              </h2>
              <SortablePageTable pages={report.pages} />
            </section>
          ) : null}

          <CtaSection />

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

function HeroCard({ report }: { report: PublicReport }) {
  const color = getShareGradeColor(report.scores.letterGrade);

  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
        <div
          className="flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ backgroundColor: color }}
        >
          <span className="text-5xl font-bold">
            {report.scores.letterGrade}
          </span>
        </div>
        <div className="text-center sm:text-left">
          <div className="text-5xl font-bold text-foreground">
            {Math.round(report.scores.overall)}
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
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold text-foreground">
        Category Breakdown
      </h2>
      <div className="space-y-5">
        {getShareCategoryScores(report).map((category) => (
          <div key={category.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {category.label}{" "}
                <span className="text-muted-foreground font-normal">
                  ({category.weight})
                </span>
              </span>
              <span
                className={cn(
                  "font-semibold",
                  getShareScoreTextClass(category.score),
                )}
              >
                {Math.round(category.score)} / 100
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  getShareScoreBgClass(category.score),
                )}
                style={{ width: `${Math.max(category.score, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsRow({ report }: { report: PublicReport }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {getShareStats(report).map((stat) => (
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
          {completedAt ? (
            <span className="inline-flex rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Data {formatShareDate(completedAt)}
            </span>
          ) : null}
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
          {quickWins.slice(0, 3).map((win, index) => {
            const meta = getRecommendationMeta(win, pagesScored, completedAt);
            return (
              <div
                key={`${win.code}-brief-${index}`}
                className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
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
                        SHARE_CONFIDENCE_STYLES[meta.confidence.variant],
                      )}
                    >
                      Confidence {meta.confidence.label}
                    </span>
                    <span className="inline-flex rounded-md border border-border px-2 py-0.5 font-medium text-muted-foreground">
                      {win.affectedPages} pages affected
                    </span>
                    <span className="inline-flex rounded-md border border-border px-2 py-0.5 font-medium text-muted-foreground">
                      {getRecommendationDataLabel(meta.dataTimestamp)}
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
        {quickWins.map((win, index) => {
          const effort =
            SHARE_EFFORT_STYLES[win.effortLevel] ?? SHARE_EFFORT_STYLES.medium;
          const severity =
            SHARE_SEVERITY_STYLES[win.severity] ?? SHARE_SEVERITY_STYLES.info;
          const meta = getRecommendationMeta(win, pagesScored, completedAt);

          return (
            <div
              key={`${win.code}-${index}`}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {index + 1}
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
                        SHARE_CONFIDENCE_STYLES[meta.confidence.variant],
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
                    <span>
                      {getRecommendationDataLabel(meta.dataTimestamp)}
                    </span>
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
  const hasAnyDelta = SHARE_DELTA_ROWS.some(
    (row) => (deltas[row.key] ?? 0) !== 0,
  );
  if (!hasAnyDelta) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">
        Score Changes vs. Previous Crawl
      </h2>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="divide-y divide-border">
          {SHARE_DELTA_ROWS.map((row) => {
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
