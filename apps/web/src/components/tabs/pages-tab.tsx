"use client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { CrawledPage } from "@/lib/api";

function gradeColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

type SortField = "url" | "statusCode" | "title" | "overallScore" | "issueCount";
type SortDirection = "asc" | "desc";

export function PagesTab({ pages }: { pages: CrawledPage[] }) {
  const [sortField, setSortField] = useState<SortField>("overallScore");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  if (pages.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No pages crawled yet. Run a crawl to see page-level results.
        </p>
      </Card>
    );
  }

  const sorted = [...pages].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal == null || bVal == null) return 0;
    const cmp =
      typeof aVal === "string"
        ? aVal.localeCompare(bVal as string)
        : (aVal as number) - (bVal as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDir === "asc" ? "^" : "v"}</span>;
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("url")}
            >
              URL <SortIndicator field="url" />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("statusCode")}
            >
              Status <SortIndicator field="statusCode" />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("title")}
            >
              Title <SortIndicator field="title" />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("overallScore")}
            >
              Score <SortIndicator field="overallScore" />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("issueCount")}
            >
              Issues <SortIndicator field="issueCount" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((page) => (
            <React.Fragment key={page.id}>
              <TableRow
                className="cursor-pointer"
                onClick={() =>
                  setExpandedRow(expandedRow === page.id ? null : page.id)
                }
              >
                <TableCell className="font-mono text-xs">{page.url}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      page.statusCode === 200 ? "success" : "destructive"
                    }
                  >
                    {page.statusCode}
                  </Badge>
                </TableCell>
                <TableCell>{page.title ?? "--"}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "font-semibold",
                      page.overallScore != null
                        ? gradeColor(page.overallScore)
                        : "",
                    )}
                  >
                    {page.overallScore ?? "--"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    {page.issueCount}
                  </span>
                </TableCell>
              </TableRow>
              {expandedRow === page.id && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-muted/30 p-4">
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Technical
                        </p>
                        <p className="text-lg font-semibold">
                          {page.technicalScore ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Content</p>
                        <p className="text-lg font-semibold">
                          {page.contentScore ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          AI Readiness
                        </p>
                        <p className="text-lg font-semibold">
                          {page.aiReadinessScore ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Performance
                        </p>
                        <p className="text-lg font-semibold">
                          {page.performanceScore ?? "--"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
