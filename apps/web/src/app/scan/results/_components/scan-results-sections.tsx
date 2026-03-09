import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Eye, Info, Lock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmailCaptureGate } from "@/components/email-capture-gate";
import { IssueCard } from "@/components/issue-card";
import { ScoreCircle } from "@/components/score-circle";
import type { PublicScanResult, QuickWin } from "@/lib/api";
import { relativeTimeLabel } from "@/lib/insight-metadata";
import { WORKFLOW_CTA_COPY } from "@/lib/microcopy";
import { cn, gradeColor, scoreBarColor } from "@/lib/utils";
import {
  getFindingItems,
  getQuickWinEffort,
  getScoreCategories,
  getVisibilityProviderLabel,
  type ScanResultCta,
  type ScanResultCtaPlacement,
  type ScanVisibilityCheck,
} from "../scan-results-helpers";

export function ScanResultsLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading report...</p>
    </div>
  );
}

export function ScanResultsErrorState({ error }: { error: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <p className="text-destructive">{error}</p>
      <Button variant="outline" asChild>
        <Link href="/scan">Run Another Scan</Link>
      </Button>
    </div>
  );
}

interface ScanResultsReportProps {
  result: PublicScanResult;
  scanId: string | null;
  isUnlocked: boolean;
  isSignedIn: boolean;
  creatingWorkspace: boolean;
  workspaceError: string | null;
  recurringScanDestination: string;
  pagesSampled: number;
  sampleConfidence: {
    label: string;
    variant: "success" | "warning" | "destructive";
  };
  visibilityChecks: ScanVisibilityCheck[];
  visibilityProviders: string[];
  anyVisibilityMention: boolean;
  onTrackCta: (
    cta: ScanResultCta,
    destination: string,
    placement: ScanResultCtaPlacement,
  ) => void;
  onEmailCaptured: (leadId: string) => void;
  onCreateWorkspace: () => void | Promise<void>;
}

export function ScanResultsReport({
  result,
  scanId,
  isUnlocked,
  isSignedIn,
  creatingWorkspace,
  workspaceError,
  recurringScanDestination,
  pagesSampled,
  sampleConfidence,
  visibilityChecks,
  visibilityProviders,
  anyVisibilityMention,
  onTrackCta,
  onEmailCaptured,
  onCreateWorkspace,
}: ScanResultsReportProps) {
  const categories = getScoreCategories(result.scores);
  const findings = result.meta ? getFindingItems(result.meta) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div>
        <Link
          href="/scan"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Scan another site
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          AI visibility report
        </h1>
        <p className="text-muted-foreground">{result.url}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            Last scanned: {relativeTimeLabel(result.createdAt)}
          </Badge>
          <Badge variant="secondary">Pages sampled: {pagesSampled}</Badge>
          <Badge variant={sampleConfidence.variant}>
            Confidence: {sampleConfidence.label}
          </Badge>
          {visibilityChecks.length > 0 ? (
            <Badge variant="outline">
              LLM probes: {visibilityChecks.length}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="flex items-center justify-center p-8">
          <ScoreCircle
            score={result.scores.overall}
            size={160}
            label="Overall Score"
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {categories.map((category) => (
              <div key={category.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{category.label}</span>
                  <span
                    className={cn("font-semibold", gradeColor(category.score))}
                  >
                    {category.score} / 100
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      scoreBarColor(category.score),
                    )}
                    style={{ width: `${category.score}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-primary/30 bg-primary/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">
              Unlock full issue coverage
            </p>
            <p className="text-sm text-muted-foreground">
              Get complete quick wins for this{" "}
              {result.scores.letterGrade ?? "-"} grade page and share-ready
              summaries for your team.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="sm" asChild>
              <Link
                href="/sign-up"
                onClick={() =>
                  onTrackCta("create_project", "/sign-up", "unlock_banner")
                }
              >
                Create free account
              </Link>
            </Button>
            {!isUnlocked ? (
              <Button size="sm" variant="outline" asChild>
                <a href="#unlock">Unlock report</a>
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {result.meta ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {findings.map((finding) => (
                <Finding key={finding.label} {...finding} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {visibilityChecks.length > 0 ? (
        <Card
          className={cn(
            "border-2",
            anyVisibilityMention
              ? "border-success/30 bg-success/5"
              : "border-warning/30 bg-warning/5",
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" />
              AI Visibility Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              We queried{" "}
              <span className="font-medium">
                {visibilityProviders
                  .map((provider) => getVisibilityProviderLabel(provider))
                  .join(", ")}
              </span>{" "}
              for your brand.{" "}
              {anyVisibilityMention ? (
                <span className="font-semibold text-success">
                  Your site was mentioned.
                </span>
              ) : (
                <span className="font-semibold text-warning">
                  Your site was not mentioned.
                </span>
              )}
            </p>
            {!anyVisibilityMention ? (
              <p className="mt-2 text-sm text-muted-foreground">
                This is an opportunity to strengthen structured answers,
                authority signals, and citation-focused content.
              </p>
            ) : null}
            <div className="mt-3">
              <Button size="sm" variant="outline" asChild>
                <Link href="/sign-up">
                  Track across 5 AI platforms
                  <ArrowLeft className="ml-1 h-3 w-3 rotate-180" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result.issues.length > 0 ? (
        <div>
          <h2 className="mb-4 text-lg font-semibold">
            {isUnlocked
              ? `All Detected Issues (${result.issues.length})`
              : `Top issues to fix (${result.issues.length})`}
          </h2>
          <div className="space-y-3">
            {result.issues.map((issue, index) => (
              <IssueCard key={`${issue.code}-${index}`} {...issue} />
            ))}
          </div>
        </div>
      ) : null}

      {!isUnlocked && scanId ? (
        <div className="space-y-3" id="unlock">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span className="text-sm">
              Full results and quick wins are locked
            </span>
          </div>
          <EmailCaptureGate
            scanResultId={scanId}
            onCaptured={onEmailCaptured}
          />
        </div>
      ) : null}

      {isUnlocked && result.quickWins && result.quickWins.length > 0 ? (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Top Quick Wins</h2>
          <div className="space-y-3">
            {result.quickWins.map((win, index) => (
              <QuickWinCard key={win.code} win={win} rank={index + 1} />
            ))}
          </div>
        </div>
      ) : null}

      <Card className="bg-primary/5 p-8">
        <h2 className="text-center text-xl font-bold">
          Recommended next actions
        </h2>
        <p className="mt-2 text-center text-muted-foreground">
          Move from one-time audit to repeatable execution.
        </p>
        <div className="mt-5 space-y-3">
          <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Primary action
          </p>
          {isSignedIn ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                void onCreateWorkspace();
              }}
              disabled={creatingWorkspace}
            >
              {creatingWorkspace
                ? "Creating Workspace..."
                : WORKFLOW_CTA_COPY.createWorkspace}
            </Button>
          ) : (
            <Button size="lg" className="w-full" asChild>
              <Link
                href="/sign-up"
                onClick={() =>
                  onTrackCta(
                    "create_project",
                    "/sign-up",
                    "results_next_actions",
                  )
                }
              >
                {WORKFLOW_CTA_COPY.createWorkspace}
              </Link>
            </Button>
          )}
          {isSignedIn ? (
            <p className="text-center text-xs text-muted-foreground">
              We will preconfigure weekly crawl cadence, weekly visibility
              tracking, and digest defaults.
            </p>
          ) : null}
          {workspaceError ? (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {workspaceError}
            </div>
          ) : null}
          <p className="pt-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Secondary actions
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" variant="outline" className="w-full" asChild>
              <Link
                href="/integrations"
                onClick={() =>
                  onTrackCta(
                    "connect_integration",
                    "/integrations",
                    "results_next_actions",
                  )
                }
              >
                {WORKFLOW_CTA_COPY.connectIntegrations}
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full" asChild>
              <Link
                href={recurringScanDestination}
                onClick={() =>
                  onTrackCta(
                    "schedule_recurring_scan",
                    recurringScanDestination,
                    "results_next_actions",
                  )
                }
              >
                {WORKFLOW_CTA_COPY.scheduleRecurringScans}
              </Link>
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {isSignedIn
              ? "Use any existing workspace to enable recurring crawl cadence."
              : "Sign up to activate recurring scans and reporting."}
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Need another baseline first?{" "}
          <Link
            href="/scan"
            className="font-medium text-primary hover:underline"
          >
            Run another scan
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}

function Finding({
  pass,
  label,
  details,
}: {
  pass: boolean;
  label: string;
  details?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {pass ? (
        <CheckCircle className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600" />
      )}
      <span className={pass ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      {details ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{details}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}

function QuickWinCard({ win, rank }: { win: QuickWin; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const effort = getQuickWinEffort(win.effortLevel);

  return (
    <Card className="transition-colors hover:bg-muted/30">
      <CardContent className="py-4">
        <button
          type="button"
          className="flex w-full items-start gap-4 text-left"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {rank}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{win.message}</span>
              <Badge
                variant="secondary"
                className={cn("text-xs", effort.color)}
              >
                {effort.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {Math.abs(win.scoreImpact)} pts
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {win.recommendation}
            </p>
            {expanded && win.implementationSnippet ? (
              <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                <code>{win.implementationSnippet}</code>
              </pre>
            ) : null}
          </div>
        </button>
      </CardContent>
    </Card>
  );
}
