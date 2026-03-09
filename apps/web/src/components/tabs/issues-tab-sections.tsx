import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StateCard } from "@/components/ui/state";
import { IssueCard } from "@/components/issue-card";
import {
  CheckCircle2,
  Clock,
  ListChecks,
  Loader2,
  TrendingUp,
} from "lucide-react";
import type {
  ActionItem,
  ActionItemStats,
  ActionItemStatus,
  PageIssue,
} from "@/lib/api";
import {
  ISSUE_CATEGORY_FILTERS,
  ISSUE_SEVERITY_FILTERS,
  MAX_AUTO_PLAN_ITEMS,
  STATUS_FILTERS,
  summarizeExecutionLanes,
  type IssueCategoryFilter,
  type IssueSeverityFilter,
  type StatusFilter,
} from "./issues-tab-helpers";

export function IssuesFixRateBanner({ stats }: { stats: ActionItemStats }) {
  if (stats.total === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Fix Rate</p>
            <p className="text-xs text-muted-foreground">
              {stats.fixed} of {stats.total} issues resolved
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              {stats.fixed} Fixed
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              {stats.inProgress} In Progress
            </span>
            <span className="flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              {stats.pending} Pending
            </span>
          </div>
          <Badge
            variant={stats.fixRate >= 75 ? "default" : "secondary"}
            className="text-sm font-bold"
          >
            {stats.fixRate}%
          </Badge>
        </div>
      </div>
    </Card>
  );
}

export function IssuesExecutionLaneSummary({ items }: { items: ActionItem[] }) {
  const summary = summarizeExecutionLanes(items);
  if (summary.openCount === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Execution Lanes</p>
          <p className="text-xs text-muted-foreground">
            Track aging, ownership, and deadlines for active issue tasks.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant={summary.openOver14d > 0 ? "warning" : "secondary"}>
            Open {">"}14d: {summary.openOver14d}
          </Badge>
          <Badge variant={summary.ownerless > 0 ? "warning" : "secondary"}>
            Ownerless: {summary.ownerless}
          </Badge>
          <Badge variant={summary.overdue > 0 ? "destructive" : "secondary"}>
            Overdue: {summary.overdue}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

export function IssuesAutoPlanBanner({
  backlogCount,
  autoPlanning,
  onAutoPlan,
}: {
  backlogCount: number;
  autoPlanning: boolean;
  onAutoPlan: () => void | Promise<void>;
}) {
  if (backlogCount === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Auto-plan priority fixes</p>
          <p className="text-xs text-muted-foreground">
            {backlogCount} critical or warning issues do not have tasks yet.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => void onAutoPlan()}
          disabled={autoPlanning}
        >
          {autoPlanning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Planning...
            </>
          ) : (
            `Create up to ${Math.min(backlogCount, MAX_AUTO_PLAN_ITEMS)} tasks`
          )}
        </Button>
      </div>
    </Card>
  );
}

function formatCategoryLabel(category: IssueCategoryFilter) {
  if (category === "all") return "All";
  if (category === "ai_readiness") return "AI Readiness";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatSeverityLabel(severity: IssueSeverityFilter) {
  if (severity === "all") return "All";
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function IssuesFilters({
  severityFilter,
  categoryFilter,
  statusFilter,
  showStatusFilter,
  onSeverityChange,
  onCategoryChange,
  onStatusChange,
}: {
  severityFilter: IssueSeverityFilter;
  categoryFilter: IssueCategoryFilter;
  statusFilter: StatusFilter;
  showStatusFilter: boolean;
  onSeverityChange: (value: IssueSeverityFilter) => void;
  onCategoryChange: (value: IssueCategoryFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Severity:
        </span>
        {ISSUE_SEVERITY_FILTERS.map((severity) => (
          <Button
            key={severity}
            variant={severityFilter === severity ? "default" : "outline"}
            size="sm"
            onClick={() => onSeverityChange(severity)}
          >
            {formatSeverityLabel(severity)}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Category:
        </span>
        {ISSUE_CATEGORY_FILTERS.map((category) => (
          <Button
            key={category}
            variant={categoryFilter === category ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(category)}
          >
            {formatCategoryLabel(category)}
          </Button>
        ))}
      </div>
      {showStatusFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Status:
          </span>
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusChange(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function IssuesList({
  issues,
  filteredIssues,
  projectId,
  getActionItemForIssue,
  onStatusChange,
  onTaskCreate,
  onTaskUpdate,
}: {
  issues: PageIssue[];
  filteredIssues: PageIssue[];
  projectId?: string;
  getActionItemForIssue: (issue: PageIssue) => ActionItem | undefined;
  onStatusChange: (
    actionItemId: string,
    newStatus: ActionItemStatus,
  ) => Promise<void>;
  onTaskCreate: (
    issue: PageIssue,
    args: { assigneeId: string | null; dueAt: string | null },
  ) => Promise<void>;
  onTaskUpdate: (
    actionItemId: string,
    updates: { assigneeId?: string | null; dueAt?: string | null },
  ) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {filteredIssues.length === 0 ? (
        <StateCard
          variant="empty"
          description={
            issues.length === 0
              ? "No issues found. Run a crawl to check for issues."
              : "No issues match the selected filters."
          }
          contentClassName="p-0"
        />
      ) : (
        filteredIssues.map((issue, index) => {
          const actionItem = getActionItemForIssue(issue);
          return (
            <IssueCard
              key={`${issue.code}-${issue.pageUrl ?? ""}-${index}`}
              {...issue}
              projectId={projectId}
              pageId={issue.pageId}
              actionItemId={actionItem?.id}
              actionItemStatus={actionItem?.status}
              actionItemAssigneeId={actionItem?.assigneeId}
              actionItemDueAt={actionItem?.dueAt}
              onStatusChange={actionItem ? onStatusChange : undefined}
              onTaskCreate={(args) => onTaskCreate(issue, args)}
              onTaskUpdate={actionItem ? onTaskUpdate : undefined}
            />
          );
        })
      )}
    </div>
  );
}
