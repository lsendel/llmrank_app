"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StateCard } from "@/components/ui/state";
import { IssueCard } from "@/components/issue-card";
import { IssueHeatmap } from "@/components/charts/issue-heatmap";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { usePlan } from "@/hooks/use-plan";
import { useApiSWR } from "@/lib/use-api-swr";
import { track } from "@/lib/telemetry";
import { useUser } from "@/lib/auth-hooks";
import { useToast } from "@/components/ui/use-toast";
import {
  api,
  type PageIssue,
  type ActionItem,
  type ActionItemStatus,
  type ActionItemStats,
} from "@/lib/api";
import {
  CheckCircle2,
  Clock,
  ListChecks,
  Loader2,
  TrendingUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Fix Rate Banner
// ---------------------------------------------------------------------------

interface FixRateBannerProps {
  stats: ActionItemStats;
}

function FixRateBanner({ stats }: FixRateBannerProps) {
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

interface ExecutionLaneSummaryProps {
  items: ActionItem[];
}

function ExecutionLaneSummary({ items }: ExecutionLaneSummaryProps) {
  const [now] = useState(() => Date.now());
  const openItems = items.filter(
    (item) => item.status === "pending" || item.status === "in_progress",
  );
  const openOver14d = openItems.filter((item) => {
    const ageMs = now - new Date(item.createdAt).getTime();
    return ageMs > 14 * 24 * 60 * 60 * 1000;
  }).length;
  const ownerless = openItems.filter((item) => !item.assigneeId).length;
  const overdue = openItems.filter((item) => {
    if (!item.dueAt) return false;
    return new Date(item.dueAt).getTime() < now;
  }).length;

  if (openItems.length === 0) return null;

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
          <Badge variant={openOver14d > 0 ? "warning" : "secondary"}>
            Open {">"}14d: {openOver14d}
          </Badge>
          <Badge variant={ownerless > 0 ? "warning" : "secondary"}>
            Ownerless: {ownerless}
          </Badge>
          <Badge variant={overdue > 0 ? "destructive" : "secondary"}>
            Overdue: {overdue}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Status Filter Buttons
// ---------------------------------------------------------------------------

type StatusFilter = "all" | "open" | "in_progress" | "fixed";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "fixed", label: "Fixed" },
];

const MAX_AUTO_PLAN_ITEMS = 25;

function defaultDueAtIsoBySeverity(
  severity: "critical" | "warning" | "info",
): string {
  const daysToAdd =
    severity === "critical" ? 3 : severity === "warning" ? 7 : 14;
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + daysToAdd);
  due.setUTCHours(12, 0, 0, 0);
  return due.toISOString();
}

function actionItemIdentityKey(issueCode: string, pageId?: string | null) {
  return `${issueCode}::${pageId ?? ""}`;
}

// ---------------------------------------------------------------------------
// Issues Tab
// ---------------------------------------------------------------------------

export function IssuesTab({
  issues,
  crawlId,
  projectId,
}: {
  issues: PageIssue[];
  crawlId?: string;
  projectId?: string;
}) {
  const { user } = useUser();
  const currentUserId = user?.id ?? null;
  const { toast } = useToast();
  const { isFree } = usePlan();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [autoPlanning, setAutoPlanning] = useState(false);

  // Fetch action items and stats for the project
  const { data: actionItems, mutate: mutateItems } = useApiSWR<ActionItem[]>(
    projectId ? `action-items-${projectId}` : null,
    () => api.actionItems.list(projectId!),
  );

  const { data: stats, mutate: mutateStats } = useApiSWR<ActionItemStats>(
    projectId ? `action-item-stats-${projectId}` : null,
    () => api.actionItems.stats(projectId!),
  );

  // Build lookups that prioritize page-scoped identity with legacy fallback.
  const actionItemIndex = useMemo(() => {
    const byIssuePage = new Map<string, ActionItem>();
    const legacyByIssue = new Map<string, ActionItem>();
    const scopedIssueCodes = new Set<string>();
    if (!actionItems) {
      return { byIssuePage, legacyByIssue, scopedIssueCodes };
    }
    for (const item of actionItems) {
      if (item.pageId) {
        const key = actionItemIdentityKey(item.issueCode, item.pageId);
        if (!byIssuePage.has(key)) {
          byIssuePage.set(key, item);
        }
        scopedIssueCodes.add(item.issueCode);
        continue;
      }

      if (!legacyByIssue.has(item.issueCode)) {
        legacyByIssue.set(item.issueCode, item);
      }
    }
    return { byIssuePage, legacyByIssue, scopedIssueCodes };
  }, [actionItems]);

  const getActionItemForIssue = useCallback(
    (issue: PageIssue): ActionItem | undefined => {
      if (issue.pageId) {
        const scoped = actionItemIndex.byIssuePage.get(
          actionItemIdentityKey(issue.code, issue.pageId),
        );
        if (scoped) return scoped;

        if (actionItemIndex.scopedIssueCodes.has(issue.code)) {
          return undefined;
        }
      }

      return actionItemIndex.legacyByIssue.get(issue.code);
    },
    [actionItemIndex],
  );

  const handleStatusChange = useCallback(
    async (actionItemId: string, newStatus: ActionItemStatus) => {
      await api.actionItems.updateStatus(actionItemId, newStatus);
      if (newStatus === "fixed") {
        const item = (actionItems ?? []).find(
          (candidate) => candidate.id === actionItemId,
        );
        track("fix_applied", {
          projectId,
          actionItemId,
          issueCode: item?.issueCode ?? null,
          source: "issues_tab",
        });
      }
      mutateItems();
      mutateStats();
    },
    [actionItems, mutateItems, mutateStats, projectId],
  );

  const handleTaskUpdate = useCallback(
    async (
      actionItemId: string,
      updates: {
        assigneeId?: string | null;
        dueAt?: string | null;
      },
    ) => {
      const assigneeId =
        updates.assigneeId === "me" ? currentUserId : updates.assigneeId;
      await api.actionItems.update(actionItemId, {
        ...(assigneeId !== undefined ? { assigneeId } : {}),
        ...(updates.dueAt !== undefined ? { dueAt: updates.dueAt } : {}),
      });
      mutateItems();
      mutateStats();
    },
    [currentUserId, mutateItems, mutateStats],
  );

  const handleCreateTask = useCallback(
    async (
      issue: PageIssue,
      args: {
        assigneeId: string | null;
        dueAt: string | null;
      },
    ) => {
      if (!projectId) return;
      const assigneeId = args.assigneeId === "me" ? currentUserId : null;
      await api.actionItems.create({
        projectId,
        pageId: issue.pageId ?? null,
        issueCode: issue.code,
        status: "pending",
        severity: issue.severity,
        category: issue.category,
        scoreImpact: 0,
        title: issue.message,
        description: issue.recommendation,
        assigneeId,
        dueAt: args.dueAt ?? defaultDueAtIsoBySeverity(issue.severity),
      });
      mutateItems();
      mutateStats();
    },
    [currentUserId, mutateItems, mutateStats, projectId],
  );

  const highPriorityBacklog = useMemo(
    () =>
      issues.filter((issue) => {
        const isHighPriority =
          issue.severity === "critical" || issue.severity === "warning";
        if (!isHighPriority) return false;
        return !getActionItemForIssue(issue);
      }),
    [issues, getActionItemForIssue],
  );

  const handleAutoPlanHighPriority = useCallback(async () => {
    if (!projectId || highPriorityBacklog.length === 0) return;
    setAutoPlanning(true);

    const candidates = highPriorityBacklog.slice(0, MAX_AUTO_PLAN_ITEMS);
    let createdCount = 0;
    let failedCount = 0;

    for (const issue of candidates) {
      try {
        await api.actionItems.create({
          projectId,
          pageId: issue.pageId ?? null,
          issueCode: issue.code,
          status: "pending",
          severity: issue.severity,
          category: issue.category,
          scoreImpact: 0,
          title: issue.message,
          description: issue.recommendation,
          assigneeId: currentUserId,
          dueAt: defaultDueAtIsoBySeverity(issue.severity),
        });
        createdCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    await Promise.all([mutateItems(), mutateStats()]);
    setAutoPlanning(false);

    const remaining = highPriorityBacklog.length - candidates.length;
    if (createdCount > 0) {
      toast({
        title: "High-priority tasks planned",
        description:
          remaining > 0
            ? `Created ${createdCount} tasks. ${remaining} additional issues remain for the next batch.`
            : `Created ${createdCount} tasks with owners and due dates.`,
      });
    }

    if (createdCount === 0 || failedCount > 0) {
      toast({
        title: "Some tasks could not be created",
        description:
          createdCount === 0
            ? "No new tasks were created. Please retry."
            : `${failedCount} task(s) failed to create.`,
        variant: "destructive",
      });
    }
  }, [
    highPriorityBacklog,
    mutateItems,
    mutateStats,
    projectId,
    toast,
    currentUserId,
  ]);

  const filtered = useMemo(() => {
    return issues.filter((issue) => {
      if (severityFilter !== "all" && issue.severity !== severityFilter) {
        return false;
      }
      if (categoryFilter !== "all" && issue.category !== categoryFilter) {
        return false;
      }

      // Status filter: match against action item status
      if (statusFilter !== "all") {
        const actionItem = getActionItemForIssue(issue);
        const itemStatus = actionItem?.status ?? "pending";

        if (statusFilter === "open") {
          if (itemStatus !== "pending") return false;
        } else if (statusFilter === "in_progress") {
          if (itemStatus !== "in_progress") return false;
        } else if (statusFilter === "fixed") {
          if (itemStatus !== "fixed" && itemStatus !== "dismissed")
            return false;
        }
      }

      return true;
    });
  }, [
    issues,
    severityFilter,
    categoryFilter,
    statusFilter,
    getActionItemForIssue,
  ]);

  return (
    <div className="space-y-4">
      {/* Fix Rate Banner */}
      {stats && stats.total > 0 && <FixRateBanner stats={stats} />}
      {actionItems && actionItems.length > 0 && (
        <ExecutionLaneSummary items={actionItems} />
      )}
      {highPriorityBacklog.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Auto-plan priority fixes</p>
              <p className="text-xs text-muted-foreground">
                {highPriorityBacklog.length} critical or warning issues do not
                have tasks yet.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => void handleAutoPlanHighPriority()}
              disabled={autoPlanning}
            >
              {autoPlanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Planning...
                </>
              ) : (
                `Create up to ${Math.min(
                  highPriorityBacklog.length,
                  MAX_AUTO_PLAN_ITEMS,
                )} tasks`
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Issue Heatmap */}
      {crawlId && projectId && (
        <IssueHeatmap crawlId={crawlId} projectId={projectId} />
      )}

      {isFree && (
        <UpgradePrompt
          feature="AI-Powered Issue Priority"
          description="Sort issues by AI-estimated impact to fix the most important problems first."
          nextTier="Starter ($79/mo)"
          nextTierUnlocks="AI priority sorting, 100 pages/crawl, 10 crawls/month"
        />
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
        {actionItems && actionItems.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Status:
            </span>
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Issue list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
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
          filtered.map((issue, i) => {
            const actionItem = getActionItemForIssue(issue);
            return (
              <IssueCard
                key={`${issue.code}-${issue.pageUrl ?? ""}-${i}`}
                {...issue}
                projectId={projectId}
                pageId={issue.pageId}
                actionItemId={actionItem?.id}
                actionItemStatus={actionItem?.status}
                actionItemAssigneeId={actionItem?.assigneeId}
                actionItemDueAt={actionItem?.dueAt}
                onStatusChange={actionItem ? handleStatusChange : undefined}
                onTaskCreate={(args) => handleCreateTask(issue, args)}
                onTaskUpdate={actionItem ? handleTaskUpdate : undefined}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
