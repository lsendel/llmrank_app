import { CheckCircle2, Copy } from "lucide-react";
import { AiFixButton } from "@/components/ai-fix-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  impactBadge,
  toDateInput,
  type OptimizationTask,
  type OptimizationTaskItem,
} from "./page-optimization-workspace-helpers";

export function PageOptimizationTaskList({
  items,
  drafts,
  implemented,
  dueDateDrafts,
  savingTaskKey,
  pageId,
  projectId,
  onSuggestedChange,
  onCopySuggested,
  onMarkImplemented,
  onDueDateChange,
  onSaveTask,
}: {
  items: OptimizationTaskItem[];
  drafts: Record<string, string>;
  implemented: Record<string, boolean>;
  dueDateDrafts: Record<string, string>;
  savingTaskKey: string | null;
  pageId: string;
  projectId: string;
  onSuggestedChange: (taskKey: string, value: string) => void;
  onCopySuggested: (taskKey: string) => void;
  onMarkImplemented: (taskKey: string) => void;
  onDueDateChange: (taskKey: string, value: string) => void;
  onSaveTask: (task: OptimizationTask) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      {items.map(({ task, actionItem }) => (
        <Card key={task.key}>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{task.label}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={impactBadge(task.impactScore)}>
                  Impact {Math.round(task.impactScore)}
                </Badge>
                {implemented[task.key] && (
                  <Badge variant="success">Implemented</Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{task.rationale}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Before
                </p>
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  {task.before}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested
                </p>
                <Textarea
                  value={drafts[task.key] ?? ""}
                  onChange={(event) =>
                    onSuggestedChange(task.key, event.target.value)
                  }
                  rows={4}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {task.issueCode && (
                <AiFixButton
                  projectId={projectId}
                  pageId={pageId}
                  issueCode={task.issueCode}
                  issueTitle={task.label}
                />
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCopySuggested(task.key)}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy Suggested
              </Button>
              <Button size="sm" onClick={() => onMarkImplemented(task.key)}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Mark Implemented
              </Button>
            </div>

            {task.issueCode && (
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium">Execution Task Controls</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Assign owner and due date for this optimization from page
                  context.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    Status: {actionItem?.status ?? "pending"}
                  </Badge>
                  <Badge variant="outline">
                    Owner: {actionItem?.assigneeId ? "Assigned" : "Unassigned"}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    className="h-8 w-[180px]"
                    value={
                      dueDateDrafts[task.key] ?? toDateInput(actionItem?.dueAt)
                    }
                    onChange={(event) =>
                      onDueDateChange(task.key, event.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSaveTask(task)}
                    disabled={savingTaskKey === task.key}
                  >
                    {savingTaskKey === task.key
                      ? "Saving..."
                      : "Save Task Plan"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
