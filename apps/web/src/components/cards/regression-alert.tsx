"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type Regression } from "@/lib/api";

export function RegressionAlert({ projectId }: { projectId: string }) {
  const [dismissed, setDismissed] = useState(false);

  const { data: regressions } = useApiSWR<Regression[]>(
    `regressions-${projectId}`,
    useCallback(() => api.trends.getRegressions(projectId), [projectId]),
  );

  if (dismissed || !regressions || regressions.length === 0) return null;

  const hasCritical = regressions.some((r) => r.severity === "critical");

  return (
    <div
      className={cn(
        "relative rounded-lg border p-4",
        hasCritical
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
          : "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950",
      )}
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <AlertTriangle
          className={cn(
            "mt-0.5 h-5 w-5 flex-shrink-0",
            hasCritical ? "text-red-600" : "text-yellow-600",
          )}
        />
        <div className="space-y-1">
          <p className="text-sm font-medium">Score regression detected</p>
          <ul className="space-y-0.5 text-sm text-muted-foreground">
            {regressions.map((r) => (
              <li key={r.category}>
                {r.category} dropped {Math.abs(r.delta).toFixed(0)} points (
                {r.previousScore} → {r.currentScore})
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
