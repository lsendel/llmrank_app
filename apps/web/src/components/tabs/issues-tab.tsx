"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IssueCard } from "@/components/issue-card";
import { IssueHeatmap } from "@/components/charts/issue-heatmap";
import type { PageIssue } from "@/lib/api";

export function IssuesTab({
  issues,
  crawlId,
  projectId,
}: {
  issues: PageIssue[];
  crawlId?: string;
  projectId?: string;
}) {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = issues.filter((issue) => {
    if (severityFilter !== "all" && issue.severity !== severityFilter)
      return false;
    if (categoryFilter !== "all" && issue.category !== categoryFilter)
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Issue Heatmap */}
      {crawlId && projectId && (
        <IssueHeatmap crawlId={crawlId} projectId={projectId} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Severity:
          </span>
          {["all", "critical", "warning", "info"].map((sev) => (
            <Button
              key={sev}
              variant={severityFilter === sev ? "default" : "outline"}
              size="sm"
              onClick={() => setSeverityFilter(sev)}
            >
              {sev === "all"
                ? "All"
                : sev.charAt(0).toUpperCase() + sev.slice(1)}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Category:
          </span>
          {["all", "technical", "content", "ai_readiness", "performance"].map(
            (cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === "all"
                  ? "All"
                  : cat === "ai_readiness"
                    ? "AI Readiness"
                    : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Button>
            ),
          )}
        </div>
      </div>

      {/* Issue list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {issues.length === 0
              ? "No issues found. Run a crawl to check for issues."
              : "No issues match the selected filters."}
          </Card>
        ) : (
          filtered.map((issue, i) => (
            <IssueCard key={`${issue.code}-${i}`} {...issue} />
          ))
        )}
      </div>
    </div>
  );
}
