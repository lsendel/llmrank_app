"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  Circle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ActionItemStatus } from "@/lib/api";
import { AiFixButton } from "@/components/ai-fix-button";

interface IssueCardProps {
  code: string;
  category: "technical" | "content" | "ai_readiness" | "performance";
  severity: "critical" | "warning" | "info";
  message: string;
  recommendation: string;
  data?: Record<string, unknown>;
  pageUrl?: string | null;
  pageId?: string;
  projectId?: string;
  className?: string;
  actionItemId?: string;
  actionItemStatus?: ActionItemStatus;
  onStatusChange?: (
    id: string,
    status: ActionItemStatus,
  ) => void | Promise<void>;
}

const severityVariantMap: Record<string, "destructive" | "warning" | "info"> = {
  critical: "destructive",
  warning: "warning",
  info: "info",
};

const categoryLabels: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  ai_readiness: "AI Readiness",
  performance: "Performance",
};

const statusConfig: Record<
  ActionItemStatus,
  { label: string; icon: typeof Circle; className: string }
> = {
  pending: {
    label: "Pending",
    icon: Circle,
    className: "text-muted-foreground",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "text-blue-500",
  },
  fixed: {
    label: "Fixed",
    icon: CheckCircle2,
    className: "text-green-500",
  },
  dismissed: {
    label: "Won't Fix",
    icon: XCircle,
    className: "text-gray-400",
  },
};

export function IssueCard({
  code,
  category,
  severity,
  message,
  recommendation,
  data,
  pageUrl,
  pageId,
  projectId,
  className,
  actionItemId,
  actionItemStatus,
  onStatusChange,
}: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isFaded =
    actionItemStatus === "fixed" || actionItemStatus === "dismissed";

  return (
    <Card
      className={cn(
        "transition-shadow hover:shadow-md",
        isFaded && "opacity-60",
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          className="flex flex-1 items-start gap-3 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="mt-0.5 text-muted-foreground">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={severityVariantMap[severity]}>{severity}</Badge>
              <Badge variant="secondary">
                {categoryLabels[category] ?? category}
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">
                {code}
              </span>
            </div>
            {pageUrl && (
              <p className="text-xs text-muted-foreground font-mono truncate">
                {pageUrl}
              </p>
            )}
            <p className="text-sm font-medium text-foreground">{message}</p>
          </div>
        </button>

        {actionItemId && onStatusChange && (
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Select
              value={actionItemStatus ?? "pending"}
              onValueChange={(value) =>
                onStatusChange(actionItemId, value as ActionItemStatus)
              }
            >
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(statusConfig) as [
                    ActionItemStatus,
                    (typeof statusConfig)[ActionItemStatus],
                  ][]
                ).map(([value, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-1.5">
                        <Icon className={cn("h-3 w-3", config.className)} />
                        {config.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {expanded && (
        <CardContent className="border-t border-border pt-4">
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recommendation
              </h4>
              <p className="mt-1 text-sm text-foreground">{recommendation}</p>
            </div>
            <div className="flex gap-2">
              {projectId ? (
                <AiFixButton
                  projectId={projectId}
                  pageId={pageId}
                  issueCode={code}
                  issueTitle={message}
                  onGenerated={() => {
                    if (actionItemId && onStatusChange) {
                      void onStatusChange(actionItemId, "in_progress");
                    }
                  }}
                />
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-[10px]">
                  <Sparkles className="mr-1.5 h-3 w-3 text-primary" />
                  Optimize with AI
                </Button>
              )}
            </div>
            {data && Object.keys(data).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Details
                </h4>
                <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
