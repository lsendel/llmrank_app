import { useState, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  DollarSign,
  Gauge,
  MousePointer2,
  Search,
  Share2,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { IntegrationInsights } from "@/lib/api";
import {
  INSIGHT_TOOLTIP_STYLE,
  isIndexedStatus,
  stripUrlOrigin,
  type SummaryItem,
} from "./integration-insights-view-helpers";

type Integrations = NonNullable<IntegrationInsights["integrations"]>;
type GscInsights = NonNullable<Integrations["gsc"]>;
type Ga4Insights = NonNullable<Integrations["ga4"]>;
type MetaInsights = NonNullable<Integrations["meta"]>;
type ClarityInsights = NonNullable<Integrations["clarity"]>;
type PsiInsights = NonNullable<Integrations["psi"]>;

export function ConnectToUnlockCard({
  provider,
  description,
  isConnected,
}: {
  provider: string;
  description: string;
  isConnected?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
        {isConnected ? (
          <>
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <p className="text-sm font-medium">{provider} — No data yet</p>
            <p className="max-w-[240px] text-center text-xs text-muted-foreground">
              Sync failed or no matching property found. Check the integration
              settings and try Sync Now again.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">Connect {provider} to unlock</p>
            <p className="max-w-[200px] text-center text-xs text-muted-foreground">
              {description}
            </p>
          </>
        )}
      </div>
      <CardContent className="pointer-events-none select-none p-6 opacity-30">
        <div className="flex h-[200px] items-center justify-center">
          <div className="w-full space-y-3">
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="h-8 w-full rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-3 w-5/6 rounded bg-muted" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationInsightsSummaryBanner({
  summaryItems,
}: {
  summaryItems: SummaryItem[];
}) {
  if (summaryItems.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {summaryItems.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3"
          >
            <div className="rounded-md bg-primary/10 p-1.5">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {item.label}
              </p>
              <p className="truncate text-sm font-medium">{item.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GscQueriesSection({ gsc }: { gsc: GscInsights }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Top Search Queries (Impressions)
          </CardTitle>
          <CardDescription>
            High visibility queries in Google search
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(gsc.topQueries ?? []).slice(0, 8)}
                layout="vertical"
                margin={{ left: 40, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="query"
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip contentStyle={INSIGHT_TOOLTIP_STYLE} />
                <Bar
                  dataKey="impressions"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MousePointer2 className="h-4 w-4 text-primary" />
            Query Clicks vs. Position
          </CardTitle>
          <CardDescription>Search intent performance</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Pos.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gsc.topQueries.slice(0, 6).map((query) => (
                <TableRow key={query.query}>
                  <TableCell className="max-w-[120px] truncate font-medium">
                    {query.query}
                  </TableCell>
                  <TableCell className="text-right">{query.clicks}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={query.position < 10 ? "success" : "outline"}
                      className="h-5 px-1.5 text-[10px]"
                    >
                      {query.position.toFixed(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const PAGE_LIMIT = 10;

type FilterCategory = {
  key: string;
  label: string;
  count: number;
};

function buildFilterCategories(
  pages: GscInsights["indexedPages"],
): FilterCategory[] {
  const total = pages.length;
  const notIndexed = pages.filter((p) =>
    p.status.toLowerCase().includes("not indexed"),
  ).length;
  const unknown = pages.filter((p) =>
    p.status.toLowerCase().includes("unknown"),
  ).length;
  const indexed = pages.filter(
    (p) =>
      p.status === "Submitted and indexed" ||
      p.status === "Indexed, not submitted in sitemap",
  ).length;

  const cats: FilterCategory[] = [{ key: "all", label: "All", count: total }];
  if (notIndexed > 0)
    cats.push({ key: "not-indexed", label: "Not indexed", count: notIndexed });
  if (unknown > 0)
    cats.push({ key: "unknown", label: "Unknown to Google", count: unknown });
  if (indexed > 0)
    cats.push({ key: "indexed", label: "Indexed", count: indexed });
  return cats;
}

function filterPages(
  pages: GscInsights["indexedPages"],
  filterKey: string,
): GscInsights["indexedPages"] {
  if (filterKey === "all") return pages;
  if (filterKey === "not-indexed")
    return pages.filter((p) => p.status.toLowerCase().includes("not indexed"));
  if (filterKey === "unknown")
    return pages.filter((p) => p.status.toLowerCase().includes("unknown"));
  if (filterKey === "indexed")
    return pages.filter(
      (p) =>
        p.status === "Submitted and indexed" ||
        p.status === "Indexed, not submitted in sitemap",
    );
  return pages;
}

export function GscIndexStatusSection({ gsc }: { gsc: GscInsights }) {
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const filterCategories = useMemo(
    () => buildFilterCategories(gsc.indexedPages),
    [gsc.indexedPages],
  );

  const filteredPages = useMemo(
    () => filterPages(gsc.indexedPages, statusFilter),
    [gsc.indexedPages, statusFilter],
  );

  const visiblePages = showAll
    ? filteredPages
    : filteredPages.slice(0, PAGE_LIMIT);
  const hasMore = filteredPages.length > PAGE_LIMIT;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4 text-primary" />
          Google Search Console — Index Status
        </CardTitle>
        <CardDescription>
          {gsc.totalImpressions > 0
            ? `${gsc.totalClicks} clicks · ${gsc.totalImpressions} impressions (last 28 days)`
            : "No search query data yet — showing page index status"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {gsc.indexedPages.length > 0 ? (
          <>
            {filterCategories.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {filterCategories.map((cat) => (
                  <Button
                    key={cat.key}
                    variant={statusFilter === cat.key ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setStatusFilter(cat.key);
                      setShowAll(false);
                    }}
                  >
                    {cat.label}
                    <span className="ml-1 opacity-70">({cat.count})</span>
                  </Button>
                ))}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Index Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePages.map((page) => (
                  <TableRow key={page.url}>
                    <TableCell className="max-w-[300px] truncate text-xs font-medium">
                      {stripUrlOrigin(page.url)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          isIndexedStatus(page.status) ? "success" : "outline"
                        }
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {page.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {hasMore && (
              <div className="mt-3 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowAll((prev) => !prev)}
                >
                  {showAll
                    ? "Show less"
                    : `Show all ${filteredPages.length} pages`}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No search queries found yet. This site may be new to Google Search.
            Run another crawl after the site gains more search visibility.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function Ga4Section({ ga4 }: { ga4: Ga4Insights }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            Top Landing Pages
          </CardTitle>
          <CardDescription>Traffic distribution by session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(ga4.topPages ?? []).slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="url"
                  tick={false}
                  label={{
                    value: "Pages",
                    position: "insideBottom",
                    offset: -5,
                  }}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(label) => `URL: ${label}`}
                  contentStyle={INSIGHT_TOOLTIP_STYLE}
                />
                <Bar
                  dataKey="sessions"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engagement Summary</CardTitle>
          <CardDescription>User retention metrics</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] flex-col justify-center gap-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Average Engagement Time
            </p>
            <p className="mt-2 text-5xl font-bold text-primary">
              {ga4.avgEngagement.toFixed(0)}
              <span className="ml-1 text-2xl font-normal text-muted-foreground">
                sec
              </span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Bounce Rate
            </p>
            <p className="mt-2 text-5xl font-bold">
              {ga4.bounceRate.toFixed(1)}
              <span className="ml-1 text-2xl font-normal text-muted-foreground">
                %
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function MetaSection({ meta }: { meta: MetaInsights }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4 text-primary" />
            Top Pages by Social Engagement
          </CardTitle>
          <CardDescription>
            Combined shares, reactions, and comments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meta.topSocialPages.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={meta.topSocialPages.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 40, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="url"
                    width={100}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(url: string) =>
                      stripUrlOrigin(url).slice(0, 20) || "/"
                    }
                  />
                  <Tooltip
                    labelFormatter={(label) => `URL: ${label}`}
                    contentStyle={INSIGHT_TOOLTIP_STYLE}
                  />
                  <Bar
                    dataKey="engagement"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No social engagement data found for your pages yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social Engagement Summary</CardTitle>
          <CardDescription>
            Total social signals across all pages
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] flex-col justify-center gap-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <MetricBlock
              label="Shares"
              value={meta.totalShares.toLocaleString()}
              highlighted
            />
            <MetricBlock
              label="Reactions"
              value={meta.totalReactions.toLocaleString()}
            />
            <MetricBlock
              label="Comments"
              value={meta.totalComments.toLocaleString()}
            />
          </div>
          {meta.adSummary && (
            <div className="border-t pt-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                Ad Performance (Last 28 Days)
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <CompactMetricBlock
                  label="Spend"
                  value={`$${meta.adSummary.spend.toLocaleString()}`}
                />
                <CompactMetricBlock
                  label="Clicks"
                  value={meta.adSummary.clicks.toLocaleString()}
                />
                <CompactMetricBlock
                  label="Impressions"
                  value={meta.adSummary.impressions.toLocaleString()}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ClaritySection({ clarity }: { clarity: ClarityInsights }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-4 w-4 text-destructive" />
          Clarity UX Findings
        </CardTitle>
        <CardDescription>
          User frustration alerts and rage clicks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`grid gap-6 ${clarity.rageClickPages.length > 0 ? "md:grid-cols-2" : ""}`}
        >
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">Average UX Score</p>
              <p className="mt-1 text-3xl font-bold">
                {clarity.avgUxScore.toFixed(1)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / 100
                </span>
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="mb-3 text-sm font-medium">Rage Click Hotspots</p>
              <ul className="space-y-2">
                {clarity.rageClickPages?.slice(0, 5).map((url, index) => (
                  <li key={index} className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                    <span className="truncate">{url}</span>
                  </li>
                ))}
                {clarity.rageClickPages.length === 0 && (
                  <li className="text-xs italic text-muted-foreground">
                    No rage clicks detected in this period.
                  </li>
                )}
              </ul>
            </div>
          </div>
          {clarity.rageClickPages.length > 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border bg-primary/5 p-6 text-center">
              <AlertCircle className="mb-4 h-12 w-12 text-primary opacity-20" />
              <h4 className="mb-2 text-lg font-semibold">Lead Capture Tip</h4>
              <p className="max-w-[280px] text-sm text-muted-foreground">
                Users are rage-clicking on {clarity.rageClickPages.length}{" "}
                pages. Fix these to improve your AI visibility score by making
                your content more accessible.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PsiSection({ psi }: { psi: PsiInsights }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-primary" />
          PageSpeed Insights — Core Web Vitals
        </CardTitle>
        <CardDescription>
          Lab performance scores and field data from CrUX
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">Avg Performance Score</p>
              <p className="mt-1 text-3xl font-bold">
                {psi.avgPerformanceScore}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / 100
                </span>
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">CWV Pass Rate</p>
              {psi.hasCruxData ? (
                <p className="mt-1 text-3xl font-bold">
                  {psi.cwvPassRate}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    %
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  No field data — site needs more traffic for Chrome UX Report
                </p>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {psi.avgLcp != null && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">LCP</span>
                <span className="text-sm">
                  {(psi.avgLcp / 1000).toFixed(1)}s
                </span>
              </div>
            )}
            {psi.avgCls != null && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">CLS</span>
                <span className="text-sm">{psi.avgCls.toFixed(3)}</span>
              </div>
            )}
            {psi.avgFcp != null && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">FCP</span>
                <span className="text-sm">
                  {(psi.avgFcp / 1000).toFixed(1)}s
                </span>
              </div>
            )}
          </div>
        </div>
        {psi.pageScores.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Lowest Performing Pages</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {psi.pageScores.slice(0, 10).map((page) => (
                  <TableRow key={page.url}>
                    <TableCell className="max-w-[300px] truncate text-xs">
                      {stripUrlOrigin(page.url)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          page.score >= 90
                            ? "success"
                            : page.score >= 50
                              ? "outline"
                              : "destructive"
                        }
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {page.score}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBlock({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-3xl font-bold ${highlighted ? "text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function CompactMetricBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
