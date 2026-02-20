"use client";

import { useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
}

interface AlertBannerProps {
  projectId: string;
}

export function AlertBanner({ projectId }: AlertBannerProps) {
  const { data, mutate } = useApiSWR(
    `alerts-${projectId}`,
    useCallback(() => api.alerts.list(projectId), [projectId]),
  );

  const alerts: Alert[] = data ?? [];
  if (alerts.length === 0) return null;

  async function dismissAll() {
    await api.alerts.acknowledgeAll(projectId);
    mutate();
  }

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const isCritical = criticalCount > 0;

  const borderColor = isCritical
    ? "border-red-300 dark:border-red-800"
    : "border-yellow-300 dark:border-yellow-800";
  const bgColor = isCritical
    ? "bg-red-50 dark:bg-red-950"
    : "bg-yellow-50 dark:bg-yellow-950";
  const iconColor = isCritical ? "text-red-600" : "text-yellow-600";

  const preview = alerts
    .slice(0, 2)
    .map((a) => a.message)
    .join("; ");
  const overflow = alerts.length > 2 ? ` and ${alerts.length - 2} more` : "";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${borderColor} ${bgColor}`}
    >
      <AlertTriangle className={`h-5 w-5 shrink-0 ${iconColor}`} />
      <div className="flex-1 text-sm">
        <strong>
          {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
        </strong>
        {": "}
        {preview}
        {overflow}
      </div>
      <Button variant="ghost" size="sm" onClick={dismissAll}>
        <X className="h-4 w-4" /> Dismiss
      </Button>
    </div>
  );
}
