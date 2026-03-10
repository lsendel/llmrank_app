import Link from "next/link";
import { Brain, ExternalLink, ShieldCheck } from "lucide-react";
import { EmailCaptureGate } from "@/components/email-capture-gate";
import { ScoreCircle } from "@/components/score-circle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SharedReport } from "@/lib/api";
import { cn, gradeColor } from "@/lib/utils";
import {
  formatReportDate,
  getReportBrandColor,
  getReportCategoryScores,
  getReportCoverageHighlights,
  getReportDataFreshness,
  getReportDeltaRows,
  getReportEvidencePages,
  getReportRecommendationDataLabel,
  getReportRecommendationMeta,
  isAgencySharedReport,
} from "../report-page-helpers";

export function ReportPageLayout({
  report,
  reportToken,
  emailCaptured,
  onEmailCaptured,
}: {
  report: SharedReport;
  reportToken: string;
  emailCaptured: boolean;
  onEmailCaptured: () => void;
}) {
  const brandColor = getReportBrandColor(report);
  const isAgencyReport = isAgencySharedReport(report);
  const coverageHighlights = getReportCoverageHighlights(report);
  const evidencePages = getReportEvidencePages(report);
  const dataFreshness = getReportDataFreshness(report.completedAt);
  const deltaRows = getReportDeltaRows(report);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <BrandHeader report={report} brandColor={brandColor} />
      <HeroSection domain={report.project.domain} />
      <ScoreOverviewSection report={report} brandColor={brandColor} />

      {report.summary ? (
        <SummarySection summary={report.summary} brandColor={brandColor} />
      ) : null}

      {report.quickWins.length > 0 ? (
        <ExecutiveActionBrief
          quickWins={report.quickWins}
          completedAt={report.completedAt}
          evidencePages={evidencePages}
          dataFreshness={dataFreshness}
        />
      ) : null}

      {coverageHighlights.length > 0 ||
      deltaRows.some((row) => row.value !== 0) ? (
        <MomentumAndCoverageSection
          coverageHighlights={coverageHighlights}
          deltaRows={deltaRows}
        />
      ) : null}

      {emailCaptured ? (
        <UnlockedReportSections
          report={report}
          brandColor={brandColor}
          evidencePages={evidencePages}
        />
      ) : (
        <EmailCaptureGate
          reportToken={reportToken}
          onCaptured={() => onEmailCaptured()}
        />
      )}

      <ReportCtaSection
        report={report}
        brandColor={brandColor}
        isAgencyReport={isAgencyReport}
      />

      <footer className="border-t pt-8 text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {isAgencyReport
            ? `Prepared by ${report.project.branding?.companyName}`
            : "Powered by LLM Rank • The AI SEO Intelligence Platform"}
        </p>
      </footer>
    </div>
  );
}

function BrandHeader({
  report,
  brandColor,
}: {
  report: SharedReport;
  brandColor: string;
}) {
  const completedDate = formatReportDate(report.completedAt);

  return (
    <div className="flex items-center justify-between border-b pb-6">
      <div className="flex items-center gap-3">
        {report.project.branding?.logoUrl ? (
          <img
            src={report.project.branding.logoUrl}
            alt={report.project.branding.companyName}
            className="h-10 w-auto object-contain"
          />
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary font-bold text-white"
            style={{ backgroundColor: brandColor }}
          >
            {report.project.branding?.companyName?.charAt(0) || "L"}
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold leading-none">
            {report.project.branding?.companyName || "LLM Rank"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            AI-Readiness Intelligence
          </p>
        </div>
      </div>
      <div className="text-right">
        <Badge variant="outline" className="font-mono text-[10px] uppercase">
          Crawl ID: {report.crawlId.substring(0, 8)}
        </Badge>
        {completedDate ? (
          <p className="mt-1 text-[10px] text-muted-foreground">
            {completedDate}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function HeroSection({ domain }: { domain: string }) {
  return (
    <div className="space-y-2 text-center">
      <h1 className="text-3xl font-bold tracking-tight">
        AI SEO Audit: {domain}
      </h1>
      <p className="text-muted-foreground">
        Comprehensive analysis of how AI search engines perceive and cite this
        domain.
      </p>
    </div>
  );
}

function ScoreOverviewSection({
  report,
  brandColor,
}: {
  report: SharedReport;
  brandColor: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <Card className="flex items-center justify-center border-2 p-8 shadow-sm">
        <ScoreCircle
          score={report.scores.overall}
          size={180}
          label="Overall Grade"
        />
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Readiness Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {getReportCategoryScores(report).map((category) => (
            <div key={category.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">
                  {category.label}
                </span>
                <span
                  className={cn("font-semibold", gradeColor(category.score))}
                >
                  {category.score} / 100
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${category.score}%`,
                    backgroundColor:
                      category.score >= 70 ? brandColor : undefined,
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummarySection({
  summary,
  brandColor,
}: {
  summary: string;
  brandColor: string;
}) {
  return (
    <Card className="overflow-hidden border-primary/20 bg-primary/5 shadow-sm">
      <div className="h-1 w-full" style={{ backgroundColor: brandColor }} />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4" style={{ color: brandColor }} />
          Strategic Executive Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground">{summary}</p>
      </CardContent>
    </Card>
  );
}

function ExecutiveActionBrief({
  quickWins,
  completedAt,
  evidencePages,
  dataFreshness,
}: {
  quickWins: SharedReport["quickWins"];
  completedAt: string | null;
  evidencePages: number;
  dataFreshness: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Executive Action Brief</CardTitle>
        <CardDescription>
          Prioritized actions to unlock the fastest score improvement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline">Updated: {dataFreshness}</Badge>
          <Badge variant="outline">Evidence: {evidencePages} pages</Badge>
        </div>
        {quickWins.slice(0, 3).map((win, index) => {
          const meta = getReportRecommendationMeta(
            win,
            evidencePages,
            completedAt,
          );

          return (
            <div
              key={`${win.code}-brief-${index}`}
              className="rounded-lg border border-border/70 bg-muted/20 p-3"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{win.message}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <Badge variant="outline">Impact: +{win.scoreImpact}</Badge>
                    <Badge variant={meta.confidence.variant}>
                      Confidence: {meta.confidence.label}
                    </Badge>
                    <Badge variant="outline">
                      {win.affectedPages} pages affected
                    </Badge>
                    <Badge variant="outline">
                      {getReportRecommendationDataLabel(meta.dataTimestamp)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function MomentumAndCoverageSection({
  coverageHighlights,
  deltaRows,
}: {
  coverageHighlights: SharedReport["readinessCoverage"];
  deltaRows: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score Momentum</CardTitle>
          <CardDescription>
            Change since the previous completed crawl
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deltaRows.map((row) => {
            const delta = row.value;
            const color =
              delta > 0
                ? "text-emerald-600"
                : delta < 0
                  ? "text-red-600"
                  : "text-muted-foreground";
            const label =
              delta > 0
                ? `+${delta} vs last crawl`
                : delta < 0
                  ? `${delta} vs last crawl`
                  : "No change";

            return (
              <div
                key={row.label}
                className="flex items-center justify-between border-b border-dashed border-border/60 pb-2 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className={cn("text-xs", color)}>{label}</p>
                </div>
                <p className={cn("text-lg font-semibold", color)}>
                  {delta > 0 ? `+${delta}` : delta}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {coverageHighlights.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Readiness Coverage</CardTitle>
            <CardDescription>
              Share of pages compliant with critical technical controls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {coverageHighlights.map((metric) => (
              <div key={metric.code} className="space-y-1">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{metric.label}</span>
                  <span>{metric.coveragePercent}%</span>
                </div>
                <Progress value={metric.coveragePercent} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {metric.totalPages - metric.affectedPages}/{metric.totalPages}{" "}
                  pages compliant
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function UnlockedReportSections({
  report,
  brandColor,
  evidencePages,
}: {
  report: SharedReport;
  brandColor: string;
  evidencePages: number;
}) {
  return (
    <>
      {report.quickWins.length > 0 ? (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <ShieldCheck className="h-5 w-5 text-success" />
            Top Recommended Improvements
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {report.quickWins.map((win, index) => {
              const meta = getReportRecommendationMeta(
                win,
                evidencePages,
                report.completedAt,
              );

              return (
                <Card
                  key={win.code}
                  className="border-l-4 border-l-primary shadow-sm"
                  style={{ borderLeftColor: brandColor }}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: brandColor }}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{win.message}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {win.recommendation}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span>Owner: {win.owner ?? "SEO"}</span>
                          <span>Effort: {win.effort ?? win.effortLevel}</span>
                          {win.pillar ? <span>{win.pillar}</span> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold uppercase"
                          >
                            Impact: +{win.scoreImpact} pts
                          </Badge>
                          <Badge
                            variant={meta.confidence.variant}
                            className="text-[10px] uppercase"
                          >
                            Confidence: {meta.confidence.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase"
                          >
                            {win.affectedPages} pages
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase"
                          >
                            {getReportRecommendationDataLabel(
                              meta.dataTimestamp,
                            )}
                          </Badge>
                          {win.docsUrl ? (
                            <a
                              href={win.docsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-primary hover:underline"
                            >
                              Playbook ↗
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {report.pages.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Affected Pages & Scores</h2>
          <Card className="overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Target URL</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-right">Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.pages.slice(0, 15).map((page) => (
                  <TableRow key={page.url}>
                    <TableCell className="max-w-[400px] truncate py-3 font-mono text-[11px]">
                      {page.url}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "text-sm font-bold",
                          gradeColor(page.overallScore),
                        )}
                      >
                        {page.overallScore}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="font-normal">
                        {page.issueCount} issues
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {report.pages.length > 15 ? (
              <div className="border-t bg-muted/20 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Showing top 15 of {report.pages.length} pages.
                </p>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </>
  );
}

function ReportCtaSection({
  report,
  brandColor,
  isAgencyReport,
}: {
  report: SharedReport;
  brandColor: string;
  isAgencyReport: boolean;
}) {
  return (
    <Card
      className="relative overflow-hidden border-none p-10 text-center text-white shadow-xl"
      style={{ backgroundColor: brandColor }}
    >
      <div className="absolute top-0 right-0 h-32 w-32 -mr-16 -mt-16 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute bottom-0 left-0 h-24 w-24 -mb-12 -ml-12 rounded-full bg-black/10 blur-xl" />

      <div className="relative z-10">
        <h2 className="text-2xl font-bold">
          {isAgencyReport
            ? "Ready to optimize your site for AI Search?"
            : "Boost your visibility in AI Search results"}
        </h2>
        <p className="mx-auto mt-3 max-w-xl opacity-90">
          {isAgencyReport
            ? `Contact ${report.project.branding?.companyName} to implement these fixes and stay ahead of the competition in the age of AI.`
            : "Start monitoring your domain's AI-readiness today. Full crawl analysis, AI visibility tracking, and automated reporting."}
        </p>
        <div className="mt-8 flex justify-center gap-4">
          {isAgencyReport ? (
            <Button
              size="lg"
              variant="secondary"
              className="group px-8 font-bold shadow-lg"
              asChild
            >
              <a
                href={`mailto:?subject=${encodeURIComponent(`AI Readiness Report Inquiry - ${report.project.domain}`)}`}
              >
                Contact Us{" "}
                <ExternalLink className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </Button>
          ) : (
            <>
              <Link href="/scan">
                <Button
                  size="lg"
                  variant="secondary"
                  className="font-bold shadow-lg"
                >
                  New Free Scan
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="border-white/20 bg-black/20 font-bold text-white backdrop-blur-sm hover:bg-black/30"
                >
                  Start Free Trial
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
