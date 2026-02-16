"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreCircle } from "@/components/score-circle";
import { IssueCard } from "@/components/issue-card";
import { cn, gradeColor, scoreBarColor } from "@/lib/utils";
import { track } from "@/lib/telemetry";
import type { PublicScanResult, QuickWin } from "@/lib/api";

const EFFORT_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Quick Fix", color: "bg-success/10 text-success" },
  medium: { label: "Moderate", color: "bg-warning/10 text-warning" },
  high: { label: "Significant", color: "bg-destructive/10 text-destructive" },
};

export default function ScanResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<PublicScanResult | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("scanResult");
    if (!stored) {
      router.replace("/scan");
      return;
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        const parsed: PublicScanResult = JSON.parse(stored);
        setResult(parsed);
        track("scan.completed", {
          domain: parsed.url,
          grade:
            parsed.scores.overall >= 90
              ? "A"
              : parsed.scores.overall >= 80
                ? "B"
                : parsed.scores.overall >= 70
                  ? "C"
                  : parsed.scores.overall >= 60
                    ? "D"
                    : "F",
          score: parsed.scores.overall,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

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

      {/* Key Findings */}
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
            />
            <Finding pass={meta.hasSitemap} label="Sitemap found" />
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

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Top Quick Wins</h2>
          <div className="space-y-3">
            {quickWins.map((win, i) => (
              <QuickWinCard key={win.code} win={win} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* All Issues */}
      {issues.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">
            All Issues ({issues.length})
          </h2>
          <div className="space-y-3">
            {issues.map((issue, i) => (
              <IssueCard key={`${issue.code}-${i}`} {...issue} />
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
          <Link href="/sign-up">
            <Button size="lg">Sign Up Free</Button>
          </Link>
          <Link href="/scan">
            <Button size="lg" variant="outline">
              Scan Another Site
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Create a free account to download PDF reports and get AI-generated
          executive summaries.
        </p>
      </Card>
    </div>
  );
}

function Finding({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {pass ? (
        <CheckCircle className="h-4 w-4 text-success" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" />
      )}
      <span className={pass ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
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
