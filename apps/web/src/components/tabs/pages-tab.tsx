"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRightLeft,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateCard } from "@/components/ui/state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, gradeColor } from "@/lib/utils";
import type { CrawledPage } from "@/lib/api";

type SortField = "url" | "statusCode" | "title" | "overallScore" | "issueCount";
type SortDirection = "asc" | "desc";

export function PagesTab({
  pages,
  projectId,
}: {
  pages: CrawledPage[];
  projectId: string;
}) {
  const [sortField, setSortField] = useState<SortField>("overallScore");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showRedirects, setShowRedirects] = useState(false);

  const redirectCount = pages.filter((p) => p.isCrossDomainRedirect).length;

  const filtered = showRedirects
    ? pages
    : pages.filter((p) => !p.isCrossDomainRedirect);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal == null || bVal == null) return 0;
        const cmp =
          typeof aVal === "string"
            ? aVal.localeCompare(bVal as string)
            : (aVal as number) - (bVal as number);
        return sortDir === "asc" ? cmp : -cmp;
      }),
    [filtered, sortField, sortDir],
  );

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
      <StateCard
        variant="empty"
        description="No pages crawled yet. Run a crawl to see page-level results."
        contentClassName="p-0"
      />
    );
  }

  return (
    <Card>
      {redirectCount > 0 && (
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showRedirects}
              onChange={(e) => setShowRedirects(e.target.checked)}
              className="rounded border-input"
            />
            Show redirects ({redirectCount})
          </label>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              aria-sort={
                sortField === "url"
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("url")}
            >
              URL{" "}
              <SortIndicator
                field="url"
                currentField={sortField}
                currentDir={sortDir}
              />
            </TableHead>
            <TableHead
              aria-sort={
                sortField === "statusCode"
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("statusCode")}
            >
              Status{" "}
              <SortIndicator
                field="statusCode"
                currentField={sortField}
                currentDir={sortDir}
              />
            </TableHead>
            <TableHead
              aria-sort={
                sortField === "title"
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("title")}
            >
              Title{" "}
              <SortIndicator
                field="title"
                currentField={sortField}
                currentDir={sortDir}
              />
            </TableHead>
            <TableHead
              aria-sort={
                sortField === "overallScore"
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("overallScore")}
            >
              Score{" "}
              <SortIndicator
                field="overallScore"
                currentField={sortField}
                currentDir={sortDir}
              />
            </TableHead>
            <TableHead
              aria-sort={
                sortField === "issueCount"
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("issueCount")}
            >
              Issues{" "}
              <SortIndicator
                field="issueCount"
                currentField={sortField}
                currentDir={sortDir}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((page) => (
            <React.Fragment key={page.id}>
              <TableRow
                className="cursor-pointer focus-within:bg-muted/30"
                tabIndex={0}
                role="button"
                aria-expanded={expandedRow === page.id}
                onClick={() =>
                  setExpandedRow(expandedRow === page.id ? null : page.id)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpandedRow(expandedRow === page.id ? null : page.id);
                  }
                }}
              >
                <TableCell className="font-mono text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    {page.url}
                    {page.isCrossDomainRedirect && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 py-0 font-normal gap-0.5"
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                        redirect
                      </Badge>
                    )}
                  </span>
                </TableCell>
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
                    {page.isCrossDomainRedirect && page.redirectUrl && (
                      <div className="mt-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm">
                        <p className="text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                          <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Redirects to:{" "}
                            <a
                              href={page.redirectUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline hover:no-underline"
                            >
                              {page.redirectUrl}
                            </a>
                          </span>
                        </p>
                      </div>
                    )}
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        asChild
                      >
                        <Link
                          href={`/dashboard/projects/${projectId}/pages/${page.id}`}
                        >
                          <FileText className="mr-1.5 h-3.5 w-3.5" />
                          View Details
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        asChild
                      >
                        <a href={page.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Open Page
                        </a>
                      </Button>
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

function SortIndicator({
  field,
  currentField,
  currentDir,
}: {
  field: SortField;
  currentField: SortField;
  currentDir: SortDirection;
}) {
  if (currentField !== field) return null;
  return <span className="ml-1">{currentDir === "asc" ? "^" : "v"}</span>;
}
