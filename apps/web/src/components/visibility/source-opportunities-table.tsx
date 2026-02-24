"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, ApiError, type SourceOpportunity } from "@/lib/api";
import { Target } from "lucide-react";
import { UpgradePrompt } from "@/components/upgrade-prompt";

export function SourceOpportunitiesTable({ projectId }: { projectId: string }) {
  const {
    data: opportunities,
    isLoading,
    error,
  } = useApiSWR<SourceOpportunity[]>(
    `source-opportunities-${projectId}`,
    useCallback(
      () => api.visibility.getSourceOpportunities(projectId),
      [projectId],
    ),
  );

  // Plan gate — show upgrade prompt if 403
  if (error instanceof ApiError && error.status === 403) {
    return (
      <UpgradePrompt
        feature="Source Opportunities"
        description="See which competitor sites get cited by AI when you don't — actionable outreach targets."
        nextTier="Pro ($149/mo)"
        nextTierUnlocks="Source opportunities, advanced analytics, 500 pages/crawl"
      />
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!opportunities || opportunities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No source opportunities found yet. Run visibility checks to
              discover competitors that get cited when you don&apos;t.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          Source Opportunities
          <span className="text-sm font-normal text-muted-foreground">
            ({opportunities.length} competitor
            {opportunities.length !== 1 ? "s" : ""})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Competitor Domain</TableHead>
              <TableHead className="text-center">Times Cited</TableHead>
              <TableHead>Queries They Appear In</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.map((opp) => (
              <TableRow key={opp.domain}>
                <TableCell className="font-medium text-sm">
                  {opp.domain}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{opp.mentionCount}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {opp.queries.slice(0, 3).map((q) => (
                      <Badge
                        key={q}
                        variant="outline"
                        className="max-w-[180px] truncate text-xs"
                      >
                        {q}
                      </Badge>
                    ))}
                    {opp.queries.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{opp.queries.length - 3} more
                      </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
