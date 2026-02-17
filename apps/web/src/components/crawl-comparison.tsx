"use client";

import { useApiSWR } from "@/lib/use-api-swr";
import { api, type ComparisonItem } from "@/lib/api";
import { useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUp, ArrowDown, Minus, Loader2 } from "lucide-react";

interface CrawlComparisonProps {
  jobId: string;
  otherId: string;
}

export function CrawlComparison({ jobId, otherId }: CrawlComparisonProps) {
  const { data, isLoading } = useApiSWR(
    `crawl-comparison-${jobId}-${otherId}`,
    useCallback(() => api.crawls.compare(jobId, otherId), [jobId, otherId]),
  );

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = (data?.data || []) as ComparisonItem[];

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page URL</TableHead>
            <TableHead className="text-center">Previous Score</TableHead>
            <TableHead className="text-center">New Score</TableHead>
            <TableHead className="text-right">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.url}>
              <TableCell className="max-w-md truncate font-medium">
                {item.url}
              </TableCell>
              <TableCell className="text-center">
                {item.oldScore ?? "-"}
              </TableCell>
              <TableCell className="text-center">
                {item.newScore ?? "-"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {item.delta > 0 ? (
                    <span className="flex items-center gap-0.5 font-medium text-emerald-600">
                      <ArrowUp className="h-3 w-3" />+{item.delta}
                    </span>
                  ) : item.delta < 0 ? (
                    <span className="flex items-center gap-0.5 font-medium text-red-600">
                      <ArrowDown className="h-3 w-3" />
                      {item.delta}
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-muted-foreground">
                      <Minus className="h-3 w-3" />0
                    </span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                No overlapping pages found to compare.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
