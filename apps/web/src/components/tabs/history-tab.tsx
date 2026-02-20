"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, GitCompare, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, gradeColor } from "@/lib/utils";
import type { CrawlJob } from "@/lib/api";
import { CrawlHistoryChart } from "@/components/score-trend-chart";
import { CrawlComparison } from "@/components/crawl-comparison";

export function HistoryTab({ crawlHistory }: { crawlHistory: CrawlJob[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  if (crawlHistory.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No crawl history yet. Run your first crawl to see results.
        </p>
      </Card>
    );
  }

  const completedCrawls = crawlHistory.filter(
    (crawl) => crawl.status === "complete",
  );
  const canCompare = completedCrawls.length >= 2;

  function toggleSelect(id: string): void {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function clearComparison(): void {
    setSelected([]);
    setComparing(false);
  }

  return (
    <div className="space-y-6">
      <CrawlHistoryChart crawlHistory={crawlHistory} />

      {canCompare && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={selected.length !== 2}
            onClick={() => setComparing(true)}
          >
            <GitCompare className="h-4 w-4" />
            Compare Selected ({selected.length}/2)
          </Button>
          {(selected.length > 0 || comparing) && (
            <Button variant="ghost" size="sm" onClick={clearComparison}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      )}

      {comparing && selected.length === 2 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Crawl Comparison</h3>
          <CrawlComparison jobId={selected[0]} otherId={selected[1]} />
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {canCompare && <TableHead className="w-10"></TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pages</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crawlHistory.map((crawl) => {
              const isComplete = crawl.status === "complete";
              const isSelected = selected.includes(crawl.id);

              return (
                <TableRow key={crawl.id}>
                  {canCompare && (
                    <TableCell>
                      {isComplete && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(crawl.id)}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {crawl.startedAt
                      ? new Date(crawl.startedAt).toLocaleDateString()
                      : "--"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        crawl.status === "complete"
                          ? "success"
                          : crawl.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {crawl.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {crawl.pagesCrawled ?? crawl.pagesScored}
                    </span>
                  </TableCell>
                  <TableCell>
                    {crawl.overallScore != null ? (
                      <span
                        className={cn(
                          "font-semibold",
                          gradeColor(crawl.overallScore),
                        )}
                      >
                        {crawl.overallScore}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {crawl.letterGrade ?? "--"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/crawl/${crawl.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Details
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
