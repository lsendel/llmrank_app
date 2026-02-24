"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type BrandPerformance } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  CheckCircle2,
  XCircle,
} from "lucide-react";

function TrendIndicator({ value }: { value: number }) {
  if (value > 0)
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-green-600">
        <TrendingUp className="h-3 w-3" />+{value}%
      </span>
    );
  if (value < 0)
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-red-600">
        <TrendingDown className="h-3 w-3" />
        {value}%
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" />
      0%
    </span>
  );
}

export function BrandPerformanceDashboard({
  projectId,
}: {
  projectId: string;
}) {
  const { data: perf, isLoading } = useApiSWR<BrandPerformance>(
    `brand-performance-${projectId}`,
    useCallback(
      () => api.visibility.getBrandPerformance(projectId),
      [projectId],
    ),
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (
    !perf ||
    (perf.yourBrand.mentionRate === 0 && perf.competitors.length === 0)
  ) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* KPI Hero Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Your Share of Voice</p>
            <p className="mt-1 text-2xl font-bold">
              {perf.yourBrand.sovPercent}%
            </p>
            <TrendIndicator value={perf.weekOverWeek.sovDelta} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Mention Rate</p>
            <p className="mt-1 text-2xl font-bold">
              {perf.yourBrand.mentionRate}%
            </p>
            <TrendIndicator value={perf.weekOverWeek.mentionsDelta} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Citation Rate</p>
            <p className="mt-1 text-2xl font-bold">
              {perf.yourBrand.citationRate}%
            </p>
            <TrendIndicator value={perf.weekOverWeek.citationsDelta} />
          </CardContent>
        </Card>
      </div>

      {/* Competitor SoV Table */}
      {perf.competitors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Competitor Comparison
              <span className="text-sm font-normal text-muted-foreground">
                ({perf.period})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-center">SoV %</TableHead>
                  <TableHead className="text-center">Mention Rate</TableHead>
                  <TableHead className="text-center">Citation Rate</TableHead>
                  <TableHead className="text-center">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Your brand row */}
                <TableRow className="bg-primary/5 font-medium">
                  <TableCell>You</TableCell>
                  <TableCell className="text-center">
                    {perf.yourBrand.sovPercent}%
                  </TableCell>
                  <TableCell className="text-center">
                    {perf.yourBrand.mentionRate}%
                  </TableCell>
                  <TableCell className="text-center">
                    {perf.yourBrand.citationRate}%
                  </TableCell>
                  <TableCell className="text-center">
                    <TrendIndicator value={perf.yourBrand.trend} />
                  </TableCell>
                </TableRow>
                {perf.competitors.map((comp) => (
                  <TableRow key={comp.domain}>
                    <TableCell className="text-sm">{comp.domain}</TableCell>
                    <TableCell
                      className={cn(
                        "text-center text-sm",
                        comp.sovPercent > perf.yourBrand.sovPercent
                          ? "text-red-600 font-medium"
                          : "",
                      )}
                    >
                      {comp.sovPercent}%
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {comp.mentionRate}%
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {comp.citationRate}%
                    </TableCell>
                    <TableCell className="text-center">
                      <TrendIndicator value={comp.trend} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Top Prompts */}
      {perf.topPrompts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Queries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {perf.topPrompts.map((prompt) => (
              <div
                key={prompt.query}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3",
                  !prompt.yourMentioned &&
                    prompt.competitorsMentioned.length > 0
                    ? "border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20"
                    : "",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    &ldquo;{prompt.query}&rdquo;
                  </p>
                  {prompt.competitorsMentioned.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Competitors: {prompt.competitorsMentioned.join(", ")}
                    </p>
                  )}
                </div>
                <div className="ml-3">
                  {prompt.yourMentioned ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
