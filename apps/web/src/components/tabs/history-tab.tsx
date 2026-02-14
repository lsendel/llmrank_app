"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ScoreTrendChart } from "@/components/score-trend-chart";

export function HistoryTab({ crawlHistory }: { crawlHistory: CrawlJob[] }) {
  if (crawlHistory.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No crawl history yet. Run your first crawl to see results.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ScoreTrendChart crawlHistory={crawlHistory} />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pages</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crawlHistory.map((crawl) => (
              <TableRow key={crawl.id}>
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
                    {crawl.pagesScored}
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
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
