"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Eye, Lock, XCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreCircle } from "@/components/score-circle";
import { IssueCard } from "@/components/issue-card";
import { EmailCaptureGate } from "@/components/email-capture-gate";
import { cn, gradeColor, scoreBarColor } from "@/lib/utils";
import { track } from "@/lib/telemetry";
import { api } from "@/lib/api";
import type { PublicScanResult, QuickWin } from "@/lib/api";

const EFFORT_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Quick Fix", color: "bg-success/10 text-success" },
  medium: { label: "Moderate", color: "bg-warning/10 text-warning" },
  high: { label: "Significant", color: "bg-destructive/10 text-destructive" },
};

function ScanResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanId = searchParams.get("id");

  const [result, setResult] = useState<PublicScanResult | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Persist unlock token across refreshes
  const [unlockToken, setUnlockToken] = useState<string | null>(() => {
    if (typeof window === "undefined" || !scanId) return null;
    return localStorage.getItem(`scan-unlocked-${scanId}`);
  });

  const fetchResult = useCallback(async (id: string, token?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.public.getScanResult(id, token ?? undefined);
      setResult(data);
      // If quickWins are present, the result is unlocked
      setIsUnlocked(!!data.quickWins);
    } catch {
      setError("Failed to load scan results. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (scanId) {
      // API-based flow: fetch from server
      fetchResult(scanId, unlockToken);
      return;
    }

    // Fallback: read from sessionStorage (backwards compat)
    const stored = sessionStorage.getItem("scanResult");
    if (!stored) {
      router.replace("/scan");
      return;
    }

    const parsed: PublicScanResult = JSON.parse(stored);
    setResult(parsed);
    setIsUnlocked(true); // sessionStorage always has full data
    setLoading(false);
    track("scan.completed", {
      domain: parsed.url,
      grade: parsed.scores.letterGrade,
      score: parsed.scores.overall,
    });
  }, [scanId, unlockToken, router, fetchResult]);

  // Track scan completion when result loads via API
  useEffect(() => {
    if (result && scanId) {
      track("scan.completed", {
        domain: result.url ?? result.domain,
        grade: result.scores?.letterGrade,
        score: result.scores?.overall,
      });
    }
  }, [result, scanId]);

  function handleEmailCaptured(leadId: string) {
    if (scanId) {
      // Persist the unlock token so refreshes stay unlocked
      localStorage.setItem(`scan-unlocked-${scanId}`, leadId);
      setUnlockToken(leadId);
      // Refetch with the unlock token to get full results
      fetchResult(scanId, leadId);
    } else {
      // sessionStorage flow -- already fully unlocked
      setIsUnlocked(true);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" asChild>
          <Link href="/scan">Scan Another Site</Link>
        </Button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  const { scores, issues, quickWins, meta } = result;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Header */}
      <div>
        <Link
          href="/scan"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Scan another site
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          AI-Readiness Report
        </h1>
        <p className="text-muted-foreground">{result.url}</p>
      </div>

      {/* Score Overview */}
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="flex items-center justify-center p-8">
          <ScoreCircle
            score={scores.overall}
            size={160}
            label="Overall Score"
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { label: "Technical SEO", score: scores.technical },
              { label: "Content Quality", score: scores.content },
              { label: "AI Readiness", score: scores.aiReadiness },
              { label: "Performance", score: scores.performance },
            ].map((cat) => (
              <div key={cat.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{cat.label}</span>
                  <span className={cn("font-semibold", gradeColor(cat.score))}>
                    {cat.score} / 100
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      scoreBarColor(cat.score),
                    )}
                    style={{ width: `${cat.score}%` }}
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
              Need every issue and quick win?
            </p>
            <p className="text-sm text-muted-foreground">
              Unlock the full checklist for this {scores.letterGrade ?? "—"}{" "}
              grade page and get a PDF summary plus AI-ready recommendations.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="sm" asChild>
              <Link href="/sign-up">Unlock detailed quick wins</Link>
            </Button>
            {!isUnlocked && (
              <Button size="sm" variant="outline" asChild>
                <a href="#unlock">Unlock this report</a>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Key Findings — only shown if meta is available (full data or sessionStorage) */}
      {meta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Finding pass={meta.hasLlmsTxt} label="llms.txt file" />
              <Finding
                pass={meta.aiCrawlersBlocked.length === 0}
                label="AI crawlers allowed"
                details={
                  meta.aiCrawlersBlocked.length > 0
                    ? `Blocked: ${meta.aiCrawlersBlocked.join(", ")}`
                    : undefined
                }
              />
              <Finding
                pass={meta.hasSitemap}
                label="Sitemap found"
                details={
                  meta.sitemapUrls > 0
                    ? `${meta.sitemapUrls} URLs found`
                    : undefined
                }
              />
              <Finding
                pass={meta.schemaTypes.length > 0}
                label="Structured data"
              />
              <Finding
                pass={
                  !!meta.title &&
                  meta.title.length >= 30 &&
                  meta.title.length <= 60
                }
                label="Title tag (30-60 chars)"
              />
              <Finding
                pass={Object.keys(meta.ogTags).length > 0}
                label="Open Graph tags"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Visibility Preview */}
      {result.visibility && (
        <Card
          className={cn(
            "border-2",
            result.visibility.brandMentioned
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
              We asked <span className="font-medium">Perplexity</span> about
              your brand.{" "}
              {result.visibility.brandMentioned ? (
                <span className="font-semibold text-success">
                  Your site was mentioned!
                </span>
              ) : (
                <span className="font-semibold text-warning">
                  Your site wasn&apos;t mentioned.
                </span>
              )}
            </p>
            {!result.visibility.brandMentioned && (
              <p className="mt-2 text-sm text-muted-foreground">
                Your site isn&apos;t appearing in AI responses yet. LLM Boost
                can help you improve your AI visibility.
              </p>
            )}
            <div className="mt-3">
              <Button size="sm" variant="outline" asChild>
                <Link href="/sign-up">
                  Track visibility across 5 AI platforms
                  <ArrowLeft className="ml-1 h-3 w-3 rotate-180" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Issues (always visible -- gated view shows up to 3) */}
      {issues && issues.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">
            {isUnlocked
              ? `All Issues (${issues.length})`
              : `Top Issues (${issues.length})`}
          </h2>
          <div className="space-y-3">
            {issues.map((issue, i) => (
              <IssueCard key={`${issue.code}-${i}`} {...issue} />
            ))}
          </div>
        </div>
      )}

      {/* Email gate -- shown when results are gated (not unlocked) */}
      {!isUnlocked && scanId && (
        <div className="space-y-3" id="unlock">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span className="text-sm">
              Full results including Quick Wins are locked
            </span>
          </div>
          <EmailCaptureGate
            scanResultId={scanId}
            onCaptured={handleEmailCaptured}
          />
        </div>
      )}

      {/* Quick Wins -- only shown when unlocked */}
      {isUnlocked && quickWins && quickWins.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Top Quick Wins</h2>
          <div className="space-y-3">
            {quickWins.map((win, i) => (
              <QuickWinCard key={win.code} win={win} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <Card className="bg-primary/5 p-8 text-center">
        <h2 className="text-xl font-bold">Want deeper analysis?</h2>
        <p className="mt-2 text-muted-foreground">
          Sign up for free to crawl up to 10 pages with Lighthouse performance
          data, LLM content scoring, and AI visibility checks.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/sign-up">Sign Up Free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/scan">Scan Another Site</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Create a free account to download PDF reports and get AI-generated
          executive summaries.
        </p>
      </Card>
    </div>
  );
}

export default function ScanResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      }
    >
      <ScanResultsContent />
    </Suspense>
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
      {details && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{details}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

function QuickWinCard({ win, rank }: { win: QuickWin; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const effort = EFFORT_LABELS[win.effortLevel] ?? EFFORT_LABELS.medium;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/30"
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="flex items-start gap-4 py-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {rank}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{win.message}</span>
            <Badge variant="secondary" className={cn("text-xs", effort.color)}>
              {effort.label}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {Math.abs(win.scoreImpact)} pts
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{win.recommendation}</p>
          {expanded && win.implementationSnippet && (
            <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
              <code>{win.implementationSnippet}</code>
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
