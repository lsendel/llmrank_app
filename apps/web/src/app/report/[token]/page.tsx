"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, ExternalLink, ShieldCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreCircle } from "@/components/score-circle";
import { cn, gradeColor } from "@/lib/utils";
import { api, ApiError, type SharedReport } from "@/lib/api";
import { EmailCaptureGate } from "@/components/email-capture-gate";

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailCaptured, setEmailCaptured] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`report-unlocked-${params.token}`) === "true";
    }
    return false;
  });

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

  const { scores, pages, quickWins, project } = report;
  const isAgencyReport = !!project.branding?.companyName;
  const brandColor = project.branding?.primaryColor || "#4f46e5";

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-3">
          {project.branding?.logoUrl ? (
            <img
              src={project.branding.logoUrl}
              alt={project.branding.companyName}
              className="h-10 w-auto object-contain"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white font-bold"
              style={{ backgroundColor: brandColor }}
            >
              {project.branding?.companyName?.charAt(0) || "L"}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold leading-none">
              {project.branding?.companyName || "LLM Boost"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              AI-Readiness Intelligence
            </p>
          </div>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            Crawl ID: {report.crawlId.substring(0, 8)}
          </Badge>
          <p className="text-[10px] text-muted-foreground mt-1">
            {report.completedAt &&
              new Date(report.completedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
          </p>
        </div>
      </div>

      {/* Hero */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          AI SEO Audit: {project.domain}
        </h1>
        <p className="text-muted-foreground">
          Comprehensive analysis of how AI search engines perceive and cite this
          domain.
        </p>
      </div>

      {/* Score Overview */}
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="flex items-center justify-center p-8 border-2 shadow-sm">
          <ScoreCircle
            score={scores.overall}
            size={180}
            label="Overall Grade"
          />
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Readiness Breakdown</CardTitle>
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
                  <span className="font-medium text-muted-foreground">
                    {cat.label}
                  </span>
                  <span className={cn("font-semibold", gradeColor(cat.score))}>
                    {cat.score} / 100
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                    )}
                    style={{
                      width: `${cat.score}%`,
                      backgroundColor: cat.score >= 70 ? brandColor : undefined,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* AI Summary */}
      {report.summary && (
        <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden">
          <div className="h-1 w-full" style={{ backgroundColor: brandColor }} />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" style={{ color: brandColor }} />
              Strategic Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">
              {report.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Gated sections: Quick Wins + Pages Table */}
      {emailCaptured ? (
        <>
          {/* Quick Wins */}
          {quickWins.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-success" />
                Top Recommended Improvements
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {quickWins.map((win, i) => (
                  <Card
                    key={win.code}
                    className="shadow-sm border-l-4 border-l-primary"
                    style={{ borderLeftColor: brandColor }}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
                          style={{ backgroundColor: brandColor }}
                        >
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{win.message}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {win.recommendation}
                          </p>
                          <div className="mt-3">
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase font-semibold"
                            >
                              Impact: +{win.scoreImpact} pts
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pages Table */}
          {pages.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Affected Pages & Scores</h2>
              <Card className="shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Target URL</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="text-right">Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.slice(0, 15).map((page) => (
                      <TableRow key={page.url}>
                        <TableCell className="font-mono text-[11px] max-w-[400px] truncate py-3">
                          {page.url}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "font-bold text-sm",
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
                {pages.length > 15 && (
                  <div className="p-4 text-center border-t bg-muted/20">
                    <p className="text-xs text-muted-foreground">
                      Showing top 15 of {pages.length} pages.
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      ) : (
        <EmailCaptureGate
          reportToken={params.token}
          onCaptured={() => setEmailCaptured(true)}
        />
      )}

      {/* Lead Capture / CTA */}
      <Card
        className="text-white p-10 text-center shadow-xl border-none relative overflow-hidden"
        style={{ backgroundColor: brandColor }}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 blur-xl" />

        <div className="relative z-10">
          <h2 className="text-2xl font-bold">
            {isAgencyReport
              ? `Ready to optimize your site for AI Search?`
              : "Boost your visibility in AI Search results"}
          </h2>
          <p className="mt-3 opacity-90 max-w-xl mx-auto">
            {isAgencyReport
              ? `Contact ${project.branding?.companyName} to implement these fixes and stay ahead of the competition in the age of AI.`
              : "Start monitoring your domain's AI-readiness today. Full crawl analysis, AI visibility tracking, and automated reporting."}
          </p>
          <div className="mt-8 flex justify-center gap-4">
            {isAgencyReport ? (
              <Button
                size="lg"
                variant="secondary"
                className="font-bold px-8 shadow-lg group"
                asChild
              >
                <a
                  href={`mailto:hello@${project.branding?.companyName?.toLowerCase().replace(/\s+/g, "")}.com?subject=AI Readiness Report Inquiry`}
                >
                  Contact Us{" "}
                  <ExternalLink className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
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
                    className="bg-black/20 hover:bg-black/30 border-white/20 text-white font-bold backdrop-blur-sm"
                  >
                    Start Free Trial
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </Card>

      <footer className="text-center pt-8 border-t">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
          Powered by LLM Boost &bull; The AI SEO Intelligence Platform
        </p>
      </footer>
    </div>
  );
}
