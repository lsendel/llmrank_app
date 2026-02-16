"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IssueCard } from "@/components/issue-card";
import { cn, scoreColor } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { api, type CrawledPage, type PageDetail } from "@/lib/api";

type SortField = "url" | "statusCode" | "title" | "overallScore" | "issueCount";
type SortDirection = "asc" | "desc";

export default function PagesPage() {
  const params = useParams<{ id: string }>();
  const { withAuth } = useApi();

  const [pages, setPages] = useState<CrawledPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("overallScore");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedPageDetail, setExpandedPageDetail] =
    useState<PageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scoreMin, setScoreMin] = useState<string>("");
  const [scoreMax, setScoreMax] = useState<string>("");

  useEffect(() => {
    withAuth(async () => {
      // Get the project to find the latest crawl ID
      const project = await api.projects.get(params.id);
      if (project.latestCrawl?.id) {
        const result = await api.pages.list(project.latestCrawl.id);
        setPages(result.data);
      }
    })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load pages");
      })
      .finally(() => setLoading(false));
  }, [withAuth, params.id]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  async function handleExpandRow(pageId: string) {
    if (expandedRow === pageId) {
      setExpandedRow(null);
      setExpandedPageDetail(null);
      return;
    }
    setExpandedRow(pageId);
    try {
      await withAuth(async () => {
        const detail = await api.pages.get(pageId);
        setExpandedPageDetail(detail);
      });
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading pages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href={`/dashboard/projects/${params.id}`}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Project
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Pages</h1>
        </div>
        <Card className="p-8 text-center">
          <p className="text-destructive">{error}</p>
        </Card>
      </div>
    );
  }

  const filtered = pages.filter((page) => {
    const min = scoreMin ? parseInt(scoreMin, 10) : 0;
    const max = scoreMax ? parseInt(scoreMax, 10) : 100;
    const score = page.overallScore ?? 0;
    return score >= min && score <= max;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal == null || bVal == null) return 0;
    const cmp =
      typeof aVal === "string"
        ? aVal.localeCompare(bVal as string)
        : (aVal as number) - (bVal as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/projects/${params.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Pages</h1>
        <p className="mt-1 text-muted-foreground">
          All crawled pages and their scores.
        </p>
      </div>

      {pages.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No pages crawled yet. Run a crawl to see page-level results.
          </p>
        </Card>
      ) : (
        <>
          {/* Score range filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              Filter by score:
            </span>
            <Input
              type="number"
              placeholder="Min"
              className="w-20"
              value={scoreMin}
              onChange={(e) => setScoreMin(e.target.value)}
              min={0}
              max={100}
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="Max"
              className="w-20"
              value={scoreMax}
              onChange={(e) => setScoreMax(e.target.value)}
              min={0}
              max={100}
            />
            {(scoreMin || scoreMax) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setScoreMin("");
                  setScoreMax("");
                }}
              >
                Clear
              </Button>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader
                    field="url"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                  >
                    URL
                  </SortHeader>
                  <SortHeader
                    field="statusCode"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                  >
                    Status
                  </SortHeader>
                  <SortHeader
                    field="title"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                  >
                    Title
                  </SortHeader>
                  <SortHeader
                    field="overallScore"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                  >
                    Score
                  </SortHeader>
                  <SortHeader
                    field="issueCount"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                  >
                    Issues
                  </SortHeader>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No pages match the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((page) => (
                    <React.Fragment key={page.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => handleExpandRow(page.id)}
                      >
                        <TableCell className="font-mono text-xs">
                          {page.url}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              page.statusCode === 200
                                ? "success"
                                : "destructive"
                            }
                          >
                            {page.statusCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {page.title ?? "--"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "font-semibold",
                              page.overallScore != null
                                ? scoreColor(page.overallScore)
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
                        <TableCell>
                          <Link
                            href={`/dashboard/projects/${params.id}/pages/${page.id}`}
                            className="text-sm font-medium text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Details
                          </Link>
                        </TableCell>
                      </TableRow>
                      {expandedRow === page.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-6">
                            <div className="space-y-4">
                              {/* Score breakdown */}
                              <div className="grid gap-4 sm:grid-cols-4">
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Technical
                                  </p>
                                  <p
                                    className={cn(
                                      "text-lg font-semibold",
                                      page.technicalScore != null
                                        ? scoreColor(page.technicalScore)
                                        : "",
                                    )}
                                  >
                                    {page.technicalScore ?? "--"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Content
                                  </p>
                                  <p
                                    className={cn(
                                      "text-lg font-semibold",
                                      page.contentScore != null
                                        ? scoreColor(page.contentScore)
                                        : "",
                                    )}
                                  >
                                    {page.contentScore ?? "--"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    AI Readiness
                                  </p>
                                  <p
                                    className={cn(
                                      "text-lg font-semibold",
                                      page.aiReadinessScore != null
                                        ? scoreColor(page.aiReadinessScore)
                                        : "",
                                    )}
                                  >
                                    {page.aiReadinessScore ?? "--"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Performance
                                  </p>
                                  <p
                                    className={cn(
                                      "text-lg font-semibold",
                                      page.performanceScore != null
                                        ? scoreColor(page.performanceScore)
                                        : "",
                                    )}
                                  >
                                    {page.performanceScore ?? "--"}
                                  </p>
                                </div>
                              </div>
                              {/* Page issues from detail */}
                              {expandedPageDetail &&
                                expandedPageDetail.id === page.id &&
                                expandedPageDetail.issues.length > 0 && (
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">
                                      Issues
                                    </h4>
                                    {expandedPageDetail.issues.map((issue) => (
                                      <IssueCard key={issue.code} {...issue} />
                                    ))}
                                  </div>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

function SortHeader({
  field,
  children,
  currentField,
  currentDir,
  onSort,
}: {
  field: SortField;
  children: React.ReactNode;
  currentField: SortField;
  currentDir: SortDirection;
  onSort: (field: SortField) => void;
}) {
  return (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {currentField === field && (
          <span>{currentDir === "asc" ? "^" : "v"}</span>
        )}
      </span>
    </TableHead>
  );
}
