"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreCircle } from "@/components/score-circle";
import { cn, gradeColor, scoreBarColor } from "@/lib/utils";
import { api, ApiError, type SharedReport } from "@/lib/api";

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.public
      .getReport(params.token)
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Report not found or sharing has been disabled.");
        }
      })
      .finally(() => setLoading(false));
  }, [params.token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error ?? "Report not found."}</p>
        <Link href="/scan">
          <Button>Scan Your Site Free</Button>
        </Link>
      </div>
    );
  }

  const { scores, pages, quickWins } = report;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Header */}
      <div className="text-center">
        <Badge variant="secondary" className="mb-2">
          Shared Report
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight">
          AI-Readiness Crawl Report
        </h1>
        <p className="text-sm text-muted-foreground">
          {report.pagesScored} pages scored
          {report.completedAt &&
            ` on ${new Date(report.completedAt).toLocaleDateString()}`}
        </p>
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

      {/* AI Summary */}
      {report.summary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">
              {report.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Quick Wins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickWins.map((win, i) => (
              <div key={win.code} className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium">{win.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {win.recommendation}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pages Table */}
      {pages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Page Scores</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.url}>
                  <TableCell className="font-mono text-xs max-w-[300px] truncate">
                    {page.url}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-semibold",
                        gradeColor(page.overallScore),
                      )}
                    >
                      {page.overallScore}
                    </span>
                  </TableCell>
                  <TableCell>{page.issueCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* CTA */}
      <Card className="bg-primary/5 p-8 text-center">
        <h2 className="text-xl font-bold">Get your own AI-readiness report</h2>
        <p className="mt-2 text-muted-foreground">
          Scan any website instantly or sign up for full crawl analysis with
          Lighthouse performance data and AI visibility tracking.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/scan">
            <Button size="lg">Free Scan</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="lg" variant="outline">
              Sign Up
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
