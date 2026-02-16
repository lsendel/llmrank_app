"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IssueCard } from "@/components/issue-card";
import { useApi } from "@/lib/use-api";
import { api, type PageIssue } from "@/lib/api";

type GroupBy = "none" | "category" | "severity";

const ITEMS_PER_PAGE = 8;

const categoryLabels: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  ai_readiness: "AI Readiness",
  performance: "Performance",
};

const severityOrder: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export default function IssuesPage() {
  const params = useParams<{ id: string }>();
  const { withAuth } = useApi();

  const [allIssues, setAllIssues] = useState<PageIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [page, setPage] = useState(1);

  useEffect(() => {
    withAuth(async () => {
      const project = await api.projects.get(params.id);
      if (project.latestCrawl?.id) {
        const result = await api.issues.listForCrawl(project.latestCrawl.id);
        setAllIssues(result.data);
      }
    })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load issues");
      })
      .finally(() => setLoading(false));
  }, [withAuth, params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading issues...</p>
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
          <h1 className="text-2xl font-bold tracking-tight">Issues</h1>
        </div>
        <Card className="p-8 text-center">
          <p className="text-destructive">{error}</p>
        </Card>
      </div>
    );
  }

  const filtered = allIssues.filter((issue) => {
    if (severityFilter !== "all" && issue.severity !== severityFilter)
      return false;
    if (categoryFilter !== "all" && issue.category !== categoryFilter)
      return false;
    return true;
  });

  // Counts for badges
  const criticalCount = allIssues.filter(
    (i) => i.severity === "critical",
  ).length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const infoCount = allIssues.filter((i) => i.severity === "info").length;

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  // Group issues
  const grouped =
    groupBy !== "none"
      ? filtered.reduce<Record<string, typeof allIssues>>((acc, issue) => {
          const key = groupBy === "category" ? issue.category : issue.severity;
          if (!acc[key]) acc[key] = [];
          acc[key].push(issue);
          return acc;
        }, {})
      : null;

  const groupKeys = grouped
    ? Object.keys(grouped).sort((a, b) => {
        if (groupBy === "severity") {
          return (severityOrder[a] ?? 99) - (severityOrder[b] ?? 99);
        }
        return a.localeCompare(b);
      })
    : [];

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
        <h1 className="text-2xl font-bold tracking-tight">Issues</h1>
        <p className="mt-1 text-muted-foreground">
          {allIssues.length === 0
            ? "No issues found. Run a crawl to check for issues."
            : `All issues found across your pages. ${filtered.length} total issues.`}
        </p>
      </div>

      {allIssues.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No issues found. Run a crawl to check for issues.
          </p>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <div className="space-y-3">
            {/* Severity filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Severity:
              </span>
              <Button
                variant={severityFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSeverityFilter("all");
                  setPage(1);
                }}
              >
                All ({allIssues.length})
              </Button>
              <Button
                variant={severityFilter === "critical" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSeverityFilter("critical");
                  setPage(1);
                }}
              >
                Critical ({criticalCount})
              </Button>
              <Button
                variant={severityFilter === "warning" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSeverityFilter("warning");
                  setPage(1);
                }}
              >
                Warning ({warningCount})
              </Button>
              <Button
                variant={severityFilter === "info" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSeverityFilter("info");
                  setPage(1);
                }}
              >
                Info ({infoCount})
              </Button>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Category:
              </span>
              {[
                "all",
                "technical",
                "content",
                "ai_readiness",
                "performance",
              ].map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setCategoryFilter(cat);
                    setPage(1);
                  }}
                >
                  {cat === "all" ? "All" : (categoryLabels[cat] ?? cat)}
                </Button>
              ))}
            </div>

            {/* Group by toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Group by:
              </span>
              {(["none", "category", "severity"] as GroupBy[]).map((g) => (
                <Button
                  key={g}
                  variant={groupBy === g ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGroupBy(g)}
                >
                  {g === "none"
                    ? "None"
                    : g.charAt(0).toUpperCase() + g.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Issue list */}
          {grouped ? (
            <div className="space-y-6">
              {groupKeys.map((key) => (
                <div key={key}>
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-base font-semibold">
                      {groupBy === "category"
                        ? (categoryLabels[key] ?? key)
                        : key.charAt(0).toUpperCase() + key.slice(1)}
                    </h3>
                    <Badge variant="secondary">{grouped[key].length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {grouped[key].map((issue, i) => (
                      <IssueCard key={`${issue.code}-${i}`} {...issue} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginated.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    No issues match the selected filters.
                  </Card>
                ) : (
                  paginated.map((issue, i) => (
                    <IssueCard key={`${issue.code}-${i}`} {...issue} />
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
