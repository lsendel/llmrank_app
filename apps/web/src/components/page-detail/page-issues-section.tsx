import { Card } from "@/components/ui/card";
import { IssueCard } from "@/components/issue-card";
import type { PageIssue } from "@/lib/api";
import { severityRank } from "@llm-boost/shared";

interface PageIssuesSectionProps {
  issues: PageIssue[];
  projectId?: string;
  pageId?: string;
}

export function PageIssuesSection({
  issues,
  projectId,
  pageId,
}: PageIssuesSectionProps) {
  if (issues.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No issues found for this page.</p>
      </Card>
    );
  }

  // Most severe first (critical → warning → info) so a critical NOINDEX never
  // sits below an info-level meta-length note.
  const sortedIssues = [...issues].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );

  return (
    <div className="space-y-3">
      {sortedIssues.map((issue, i) => (
        <IssueCard
          key={`${issue.code}-${i}`}
          {...issue}
          projectId={projectId}
          pageId={pageId}
        />
      ))}
    </div>
  );
}
