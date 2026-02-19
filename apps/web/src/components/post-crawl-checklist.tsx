"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { CheckCircle, Circle, X, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type ChecklistData } from "@/lib/api";

interface ChecklistStep {
  id: string;
  label: string;
  tab: string;
  checkFn: (data: ChecklistData) => boolean;
}

const STEPS: ChecklistStep[] = [
  {
    id: "score",
    label: "Review your AI readiness score",
    tab: "overview",
    checkFn: () => true,
  },
  {
    id: "visibility",
    label: "Run an AI visibility check",
    tab: "visibility",
    checkFn: (d) => d.visibilityCount > 0,
  },
  {
    id: "personas",
    label: "Discover audience personas",
    tab: "personas",
    checkFn: (d) => d.personaCount > 0,
  },
  {
    id: "report",
    label: "Generate your first report",
    tab: "reports",
    checkFn: (d) => d.reportCount > 0,
  },
  {
    id: "schedule",
    label: "Set up visibility monitoring",
    tab: "visibility",
    checkFn: (d) => d.scheduleCount > 0,
  },
];

const EMPTY_SUB = () => () => {};
const SERVER_SNAPSHOT = true;

export function PostCrawlChecklist({ projectId }: { projectId: string }) {
  const storageKey = `checklist-dismissed-${projectId}`;
  const isDismissedFromStorage = useSyncExternalStore(
    EMPTY_SUB,
    () => localStorage.getItem(storageKey) === "true",
    () => SERVER_SNAPSHOT,
  );
  const [manuallyDismissed, setManuallyDismissed] = useState(false);
  const dismissed = isDismissedFromStorage || manuallyDismissed;

  const { data: checklistData } = useApiSWR<ChecklistData>(
    dismissed ? null : `checklist-${projectId}`,
    useCallback(() => api.projects.getChecklistStatus(projectId), [projectId]),
  );

  if (dismissed || !checklistData) return null;

  const completedCount = STEPS.filter((s) => s.checkFn(checklistData)).length;
  if (completedCount === STEPS.length) return null; // All done

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setManuallyDismissed(true);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Get Started &mdash; {completedCount}/{STEPS.length} complete
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {STEPS.map((step) => {
            const done = step.checkFn(checklistData);
            return (
              <li key={step.id} className="flex items-center gap-2 text-sm">
                {done ? (
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span
                  className={cn(done && "line-through text-muted-foreground")}
                >
                  {step.label}
                </span>
                {!done && (
                  <a
                    href={`?tab=${step.tab}`}
                    className="ml-auto text-primary text-xs flex items-center gap-0.5 hover:underline"
                  >
                    Go <ArrowRight className="h-3 w-3" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
