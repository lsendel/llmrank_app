"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  MousePointer2,
  Zap,
  AlertCircle,
  Search,
  Activity,
  MousePointerClick,
} from "lucide-react";
import type { IntegrationInsights } from "@/lib/api";

interface Props {
  insights: IntegrationInsights;
  connectedProviders?: string[];
}

function ConnectToUnlockCard({
  provider,
  description,
}: {
  provider: string;
  description: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium">Connect {provider} to unlock</p>
        <p className="text-xs text-muted-foreground max-w-[200px] text-center">
          {description}
        </p>
      </div>
      <CardContent className="p-6 opacity-30 select-none pointer-events-none">
        <div className="h-[200px] flex items-center justify-center">
          <div className="space-y-3 w-full">
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-8 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-2/3" />
            <div className="h-3 bg-muted rounded w-5/6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationInsightsView({
  insights,
  connectedProviders: _connectedProviders,
}: Props) {
  if (!insights.integrations) return null;

  const { gsc, ga4, clarity } = insights.integrations;

  // Build summary highlights
  const summaryItems: {
    icon: React.ElementType;
    label: string;
    value: string;
  }[] = [];
  if (gsc) {
    const queryCount = gsc.topQueries?.length ?? 0;
    const avgPos =
      queryCount > 0
        ? (
            gsc.topQueries.reduce((sum, q) => sum + q.position, 0) / queryCount
          ).toFixed(1)
        : "N/A";
    summaryItems.push({
      icon: Search,
      label: "GSC",
      value: `${queryCount} queries tracked · avg position ${avgPos}`,
    });
  }
  if (ga4) {
    summaryItems.push({
      icon: Activity,
      label: "GA4",
      value: `${ga4.avgEngagement.toFixed(0)}s avg engagement · ${ga4.bounceRate.toFixed(1)}% bounce rate`,
    });
  }
  if (clarity) {
    summaryItems.push({
      icon: MousePointerClick,
      label: "Clarity",
      value: `${clarity.avgUxScore.toFixed(0)}/100 UX score · ${clarity.rageClickPages.length} rage click pages`,
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      {summaryItems.length > 0 && (
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
                  <p className="text-sm font-medium truncate">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GSC Section */}
      {gsc && (
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
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
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
                  {gsc.topQueries.slice(0, 6).map((q) => (
                    <TableRow key={q.query}>
                      <TableCell className="max-w-[120px] truncate font-medium">
                        {q.query}
                      </TableCell>
                      <TableCell className="text-right">{q.clicks}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={q.position < 10 ? "success" : "outline"}
                          className="text-[10px] h-5 px-1.5"
                        >
                          {q.position.toFixed(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* GA4 Section */}
      {ga4 && (
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
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
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
            <CardContent className="flex flex-col justify-center h-[300px] gap-8">
              <div className="text-center">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                  Average Engagement Time
                </p>
                <p className="text-5xl font-bold mt-2 text-primary">
                  {ga4.avgEngagement.toFixed(0)}
                  <span className="text-2xl ml-1 text-muted-foreground font-normal">
                    sec
                  </span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                  Bounce Rate
                </p>
                <p className="text-5xl font-bold mt-2">
                  {ga4.bounceRate.toFixed(1)}
                  <span className="text-2xl ml-1 text-muted-foreground font-normal">
                    %
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* GSC Connect to Unlock */}
      {!gsc && (
        <ConnectToUnlockCard
          provider="Google Search Console"
          description="See your top queries, impressions, clicks, and search positions"
        />
      )}

      {/* GA4 Connect to Unlock */}
      {!ga4 && (
        <ConnectToUnlockCard
          provider="Google Analytics 4"
          description="Track bounce rate, engagement time, and top landing pages"
        />
      )}

      {/* Clarity Section */}
      {clarity && (
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
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/30 p-4 border">
                  <p className="text-sm font-medium">Average UX Score</p>
                  <p className="text-3xl font-bold mt-1">
                    {clarity.avgUxScore.toFixed(1)}
                    <span className="text-sm ml-1 text-muted-foreground font-normal">
                      / 100
                    </span>
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-medium mb-3">
                    Rage Click Hotspots
                  </p>
                  <ul className="space-y-2">
                    {clarity.rageClickPages?.slice(0, 5).map((url, i) => (
                      <li key={i} className="text-xs flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                        <span className="truncate">{url}</span>
                      </li>
                    ))}
                    {clarity.rageClickPages.length === 0 && (
                      <li className="text-xs text-muted-foreground italic">
                        No rage clicks detected in this period.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
              <div className="flex flex-col justify-center items-center text-center p-6 border rounded-lg bg-primary/5">
                <AlertCircle className="h-12 w-12 text-primary mb-4 opacity-20" />
                <h4 className="font-semibold text-lg mb-2">Lead Capture Tip</h4>
                <p className="text-sm text-muted-foreground max-w-[280px]">
                  Users are rage-clicking on {clarity.rageClickPages.length}{" "}
                  pages. Fix these to improve your AI visibility score by making
                  your content more accessible.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Clarity Connect to Unlock */}
      {!clarity && (
        <ConnectToUnlockCard
          provider="Microsoft Clarity"
          description="Monitor UX scores and detect rage clicks"
        />
      )}
    </div>
  );
}
