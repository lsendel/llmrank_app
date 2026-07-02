"use client";

import { useCallback } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus, Loader2 } from "lucide-react";
import { computeIssueCodeDeltas } from "./issue-code-breakdown-helpers";

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
    case "warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        severityBadgeClass(severity),
      )}
    >
      {severity}
    </span>
  );
}

function DeltaCell({ delta }: { delta: number }) {
  // For issue counts, DOWN is good (fewer issues) and UP is bad.
  if (delta < 0) {
    return (
      <span className="flex items-center justify-end gap-0.5 font-medium text-emerald-600">
        <ArrowDown className="h-3 w-3" />
        {delta}
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="flex items-center justify-end gap-0.5 font-medium text-red-600">
        <ArrowUp className="h-3 w-3" />+{delta}
      </span>
    );
  }
  return (
    <span className="flex items-center justify-end gap-0.5 text-muted-foreground">
      <Minus className="h-3 w-3" />0
    </span>
  );
}

function LoadingBlock() {
  return (
    <div className="flex h-24 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-crawl breakdown (Issues tab)
// ---------------------------------------------------------------------------

export function IssueCodeBreakdown({ crawlId }: { crawlId: string }) {
  const { data, isLoading } = useApiSWR(
    `issue-codes-${crawlId}`,
    useCallback(() => api.crawls.getIssueCodeCounts(crawlId), [crawlId]),
  );

  if (isLoading) return <LoadingBlock />;

  const rows = data ?? [];
  if (rows.length === 0) return null;

  return (
    <div className="rounded-md border">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Issues by code</h3>
        <p className="text-xs text-muted-foreground">
          Counts for this crawl. Compare two crawls in the History tab to track
          these over time.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead className="text-right">Pages affected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.code}-${row.severity}`}>
              <TableCell className="font-mono text-xs font-medium">
                {row.code}
              </TableCell>
              <TableCell className="capitalize">{row.category}</TableCell>
              <TableCell>
                <SeverityBadge severity={row.severity} />
              </TableCell>
              <TableCell className="text-right font-medium">
                {row.count}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Two-crawl delta (History tab comparison)
// ---------------------------------------------------------------------------

export function IssueCodeDelta({
  jobId,
  otherId,
}: {
  /** Previous (older) crawl — same convention as CrawlComparison. */
  jobId: string;
  /** New (newer) crawl. */
  otherId: string;
}) {
  const { data: previous, isLoading: loadingPrev } = useApiSWR(
    `issue-codes-${jobId}`,
    useCallback(() => api.crawls.getIssueCodeCounts(jobId), [jobId]),
  );
  const { data: current, isLoading: loadingCurr } = useApiSWR(
    `issue-codes-${otherId}`,
    useCallback(() => api.crawls.getIssueCodeCounts(otherId), [otherId]),
  );

  if (loadingPrev || loadingCurr) return <LoadingBlock />;

  const rows = computeIssueCodeDeltas(previous ?? [], current ?? []);

  return (
    <div className="rounded-md border">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Issue changes by code</h3>
        <p className="text-xs text-muted-foreground">
          Issue-code counts are the reliable crawl-over-crawl signal — score
          averages shift with sampling and scoring updates.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead className="text-center">Previous</TableHead>
            <TableHead className="text-center">New</TableHead>
            <TableHead className="text-right">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.code}>
              <TableCell className="font-mono text-xs font-medium">
                {row.code}
              </TableCell>
              <TableCell>
                <SeverityBadge severity={row.severity} />
              </TableCell>
              <TableCell className="text-center">{row.previous}</TableCell>
              <TableCell className="text-center">{row.current}</TableCell>
              <TableCell className="text-right">
                <DeltaCell delta={row.delta} />
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                Neither crawl recorded any issues.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
