"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  Code2,
  FileText,
  LayoutList,
  Gauge,
  Bug,
  Brain,
  Plug,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreCircle } from "@/components/score-circle";
import { IssueCard } from "@/components/issue-card";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { api, type PageScoreDetail, type PageEnrichment } from "@/lib/api";

function gradeColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-warning";
  if (score >= 40) return "bg-orange-500";
  return "bg-destructive";
}

export default function PageDetailPage() {
  const params = useParams<{ id: string; pageId: string }>();
  const { withToken } = useApi();

  const [page, setPage] = useState<PageScoreDetail | null>(null);
  const [enrichments, setEnrichments] = useState<PageEnrichment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      withToken(async (token) => {
        const data = await api.scores.getPage(token, params.pageId);
        setPage(data);
      }),
      withToken(async (token) => {
        const data = await api.pages.getEnrichments(token, params.pageId);
        setEnrichments(data);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [withToken, params.pageId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading page analysis...</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Page not found.</p>
      </div>
    );
  }

  const detail = page.score?.detail ?? {};
  const extracted = (detail.extracted ?? {}) as Record<string, unknown>;
  const lighthouse = detail.lighthouse as Record<string, number> | null;
  const llmScores = detail.llmContentScores as Record<string, number> | null;

  return (
    <div className="space-y-8">
      {/* Back + header */}
      <div>
        <Link
          href={`/dashboard/projects/${params.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Page Analysis</h1>
          <p className="mt-0.5 font-mono text-sm text-muted-foreground">
            {page.url}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">
            <Globe className="mr-1.5 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="technical">
            <Code2 className="mr-1.5 h-4 w-4" />
            Technical
          </TabsTrigger>
          <TabsTrigger value="content">
            <FileText className="mr-1.5 h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="structure">
            <LayoutList className="mr-1.5 h-4 w-4" />
            Structure
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Gauge className="mr-1.5 h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="issues">
            <Bug className="mr-1.5 h-4 w-4" />
            Issues ({page.issues.length})
          </TabsTrigger>
          {llmScores && (
            <TabsTrigger value="llm-quality">
              <Brain className="mr-1.5 h-4 w-4" />
              LLM Quality
            </TabsTrigger>
          )}
          {enrichments.length > 0 && (
            <TabsTrigger value="enrichments">
              <Plug className="mr-1.5 h-4 w-4" />
              Enrichments
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          {page.score ? (
            <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
              <Card className="flex items-center justify-center p-8">
                <ScoreCircle
                  score={page.score.overallScore}
                  size={160}
                  label="Overall Score"
                />
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Category Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {[
                    {
                      label: "Technical SEO",
                      score: page.score.technicalScore,
                    },
                    {
                      label: "Content Quality",
                      score: page.score.contentScore,
                    },
                    {
                      label: "AI Readiness",
                      score: page.score.aiReadinessScore,
                    },
                    {
                      label: "Performance",
                      score: (detail.performanceScore as number) ?? null,
                    },
                  ].map((cat) => (
                    <div key={cat.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{cat.label}</span>
                        <span
                          className={cn(
                            "font-semibold",
                            cat.score != null ? gradeColor(cat.score) : "",
                          )}
                        >
                          {cat.score != null
                            ? `${Math.round(cat.score)} / 100`
                            : "--"}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            cat.score != null
                              ? scoreBarColor(cat.score)
                              : "bg-muted",
                          )}
                          style={{ width: `${cat.score ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No score data available.</p>
            </Card>
          )}

          {/* Key metrics */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Status Code</p>
                <p className="text-2xl font-bold">
                  <Badge
                    variant={
                      page.statusCode === 200 ? "success" : "destructive"
                    }
                  >
                    {page.statusCode ?? "--"}
                  </Badge>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Word Count</p>
                <p className="text-2xl font-bold">{page.wordCount ?? "--"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Title</p>
                <p className="text-sm font-medium truncate">
                  {page.title ?? "--"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Grade</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    page.score ? gradeColor(page.score.overallScore) : "",
                  )}
                >
                  {page.score?.letterGrade ?? "--"}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Technical Tab */}
        <TabsContent value="technical" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Technical Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow label="Canonical URL" value={page.canonicalUrl} />
              <DetailRow label="Meta Description" value={page.metaDesc} />
              <DetailRow
                label="HTTP Status"
                value={page.statusCode?.toString()}
              />
              <DetailRow
                label="Robots Directives"
                value={
                  Array.isArray(extracted.robots_directives)
                    ? (extracted.robots_directives as string[]).join(", ") ||
                      "None"
                    : "N/A"
                }
              />
              <DetailRow
                label="Has Robots Meta"
                value={
                  extracted.has_robots_meta != null
                    ? String(extracted.has_robots_meta)
                    : "N/A"
                }
              />
              <DetailRow
                label="Schema Types"
                value={
                  Array.isArray(extracted.schema_types)
                    ? (extracted.schema_types as string[]).join(", ") ||
                      "None found"
                    : "N/A"
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Heading Hierarchy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((tag) => {
                const headings = (extracted[tag] as string[]) ?? [];
                if (headings.length === 0) return null;
                return (
                  <div key={tag}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      {tag.toUpperCase()} ({headings.length})
                    </p>
                    <ul className="space-y-1">
                      {headings.map((h, i) => (
                        <li
                          key={i}
                          className="text-sm pl-2 border-l-2 border-muted"
                        >
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {!extracted.h1 && (
                <p className="text-sm text-muted-foreground">
                  No extracted heading data available.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow
                label="Word Count"
                value={page.wordCount?.toLocaleString()}
              />
              <DetailRow label="Content Hash" value={page.contentHash} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Structure Tab */}
        <TabsContent value="structure" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Schema.org Types</CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(extracted.schema_types) &&
                (extracted.schema_types as string[]).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(extracted.schema_types as string[]).map((type, i) => (
                      <Badge key={i} variant="secondary">
                        {type}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No Schema.org types found.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Open Graph Tags</CardTitle>
              </CardHeader>
              <CardContent>
                {extracted.og_tags &&
                typeof extracted.og_tags === "object" &&
                Object.keys(extracted.og_tags as object).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(
                      extracted.og_tags as Record<string, string>,
                    ).map(([key, val]) => (
                      <DetailRow key={key} label={key} value={val} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No OG tags found.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internal Links</CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(extracted.internal_links) ? (
                  <p className="text-2xl font-bold">
                    {(extracted.internal_links as string[]).length}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">N/A</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">External Links</CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(extracted.external_links) ? (
                  <p className="text-2xl font-bold">
                    {(extracted.external_links as string[]).length}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">N/A</p>
                )}
              </CardContent>
            </Card>
          </div>

          {extracted.images_without_alt != null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Images Without Alt Text
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    (extracted.images_without_alt as number) > 0
                      ? "text-destructive"
                      : "text-success",
                  )}
                >
                  {extracted.images_without_alt as number}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4 pt-4">
          {lighthouse ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Performance", key: "performance" },
                { label: "SEO", key: "seo" },
                { label: "Accessibility", key: "accessibility" },
                { label: "Best Practices", key: "best_practices" },
              ].map(({ label, key }) => {
                const raw = lighthouse[key];
                const score = raw != null ? Math.round(raw * 100) : null;
                return (
                  <Card
                    key={key}
                    className="flex items-center justify-center p-6"
                  >
                    <ScoreCircle score={score ?? 0} size={120} label={label} />
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No Lighthouse data available for this page.
              </p>
            </Card>
          )}

          {page.score?.lighthousePerf != null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Stored Lighthouse Scores
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <DetailRow
                  label="Lighthouse Performance"
                  value={`${Math.round(page.score.lighthousePerf * 100)}%`}
                />
                <DetailRow
                  label="Lighthouse SEO"
                  value={
                    page.score.lighthouseSeo != null
                      ? `${Math.round(page.score.lighthouseSeo * 100)}%`
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-3 pt-4">
          {page.issues.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No issues found for this page.
              </p>
            </Card>
          ) : (
            page.issues.map((issue, i) => (
              <IssueCard key={`${issue.code}-${i}`} {...issue} />
            ))
          )}
        </TabsContent>

        {/* LLM Quality Tab */}
        {llmScores && (
          <TabsContent value="llm-quality" className="space-y-4 pt-4">
            <LLMQualityTab scores={llmScores} />
          </TabsContent>
        )}

        {/* Enrichments Tab */}
        {enrichments.length > 0 && (
          <TabsContent value="enrichments" className="space-y-4 pt-4">
            <EnrichmentsDisplay enrichments={enrichments} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─── Detail row helper ──────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="w-40 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="text-sm break-all">{value ?? "--"}</span>
    </div>
  );
}

// ─── Enrichments Display ────────────────────────────────────────

function EnrichmentsDisplay({
  enrichments,
}: {
  enrichments: PageEnrichment[];
}) {
  const byProvider = enrichments.reduce<Record<string, PageEnrichment>>(
    (acc, e) => {
      acc[e.provider] = e;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {/* GSC — Google Search Console */}
      {byProvider.gsc && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Google Search Console</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {byProvider.gsc.data.indexedStatus != null && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Indexed Status:</span>
                <Badge
                  variant={
                    byProvider.gsc.data.indexedStatus === "INDEXED"
                      ? "success"
                      : "destructive"
                  }
                >
                  {String(byProvider.gsc.data.indexedStatus)}
                </Badge>
              </div>
            )}
            {Array.isArray(byProvider.gsc.data.queries) &&
              (byProvider.gsc.data.queries as Record<string, unknown>[])
                .length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Top Search Queries</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Query</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">
                          Impressions
                        </TableHead>
                        <TableHead className="text-right">Position</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(
                        byProvider.gsc.data.queries as Record<string, unknown>[]
                      ).map((q, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {String(q.query ?? "")}
                          </TableCell>
                          <TableCell className="text-right">
                            {String(q.clicks ?? 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {String(q.impressions ?? 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {typeof q.position === "number"
                              ? q.position.toFixed(1)
                              : "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* PSI — PageSpeed Insights / Core Web Vitals */}
      {byProvider.psi && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Core Web Vitals (PageSpeed Insights)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  key: "LCP",
                  label: "Largest Contentful Paint",
                  unit: "s",
                  good: 2.5,
                  poor: 4,
                },
                {
                  key: "CLS",
                  label: "Cumulative Layout Shift",
                  unit: "",
                  good: 0.1,
                  poor: 0.25,
                },
                {
                  key: "FID",
                  label: "First Input Delay",
                  unit: "ms",
                  good: 100,
                  poor: 300,
                },
              ].map((metric) => {
                const val = byProvider.psi?.data[metric.key];
                const num = typeof val === "number" ? val : null;
                const status =
                  num == null
                    ? ""
                    : num <= metric.good
                      ? "text-success"
                      : num <= metric.poor
                        ? "text-warning"
                        : "text-destructive";
                return (
                  <div
                    key={metric.key}
                    className="rounded-lg border border-border p-3"
                  >
                    <p className="text-xs text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className={cn("text-2xl font-bold", status)}>
                      {num != null ? `${num}${metric.unit}` : "--"}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* GA4 — Google Analytics */}
      {byProvider.ga4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Google Analytics 4 — Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Bounce Rate</p>
                <p className="text-2xl font-bold">
                  {typeof byProvider.ga4.data.bounceRate === "number"
                    ? `${(byProvider.ga4.data.bounceRate as number).toFixed(1)}%`
                    : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Avg. Engagement Time
                </p>
                <p className="text-2xl font-bold">
                  {typeof byProvider.ga4.data.avgEngagementTime === "number"
                    ? `${(byProvider.ga4.data.avgEngagementTime as number).toFixed(0)}s`
                    : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Sessions</p>
                <p className="text-2xl font-bold">
                  {byProvider.ga4.data.sessions != null
                    ? String(byProvider.ga4.data.sessions)
                    : "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clarity — Microsoft Clarity */}
      {byProvider.clarity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Microsoft Clarity — UX Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Dead Clicks</p>
                <p className="text-2xl font-bold">
                  {byProvider.clarity.data.deadClicks != null
                    ? String(byProvider.clarity.data.deadClicks)
                    : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Rage Clicks</p>
                <p className="text-2xl font-bold">
                  {byProvider.clarity.data.rageClicks != null
                    ? String(byProvider.clarity.data.rageClicks)
                    : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Scroll Depth</p>
                <p className="text-2xl font-bold">
                  {typeof byProvider.clarity.data.scrollDepth === "number"
                    ? `${(byProvider.clarity.data.scrollDepth as number).toFixed(0)}%`
                    : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Engagement Score
                </p>
                <p className="text-2xl font-bold">
                  {byProvider.clarity.data.engagementScore != null
                    ? String(byProvider.clarity.data.engagementScore)
                    : "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fetched at timestamp */}
      {enrichments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Data fetched: {new Date(enrichments[0].fetchedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ─── LLM Quality Tab ────────────────────────────────────────────

function LLMQualityTab({ scores }: { scores: Record<string, number> }) {
  const dimensions = [
    { key: "clarity", label: "Clarity" },
    { key: "authority", label: "Authority" },
    { key: "comprehensiveness", label: "Comprehensiveness" },
    { key: "structure", label: "Structure" },
    { key: "citation_worthiness", label: "Citation Worthiness" },
  ];

  const avg = Math.round(
    dimensions.reduce((sum, d) => sum + (scores[d.key] ?? 0), 0) /
      dimensions.length,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="flex items-center justify-center p-8">
          <ScoreCircle score={avg} size={140} label="LLM Quality" />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Content Quality Dimensions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dimensions.map((dim) => {
              const score = scores[dim.key] ?? 0;
              return (
                <div key={dim.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{dim.label}</span>
                    <span className={cn("font-semibold", gradeColor(score))}>
                      {score} / 100
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        scoreBarColor(score),
                      )}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
