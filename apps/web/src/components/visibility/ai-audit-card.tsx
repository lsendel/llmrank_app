"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StateCard } from "@/components/ui/state";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type AIAuditResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Shield, AlertTriangle } from "lucide-react";

const STATUS_CONFIG = {
  pass: {
    label: "Pass",
    variant: "success" as const,
    barColor: "bg-green-500",
  },
  warn: {
    label: "Warning",
    variant: "warning" as const,
    barColor: "bg-amber-500",
  },
  fail: {
    label: "Fail",
    variant: "destructive" as const,
    barColor: "bg-red-500",
  },
};

export function AIAuditCard({ crawlId }: { crawlId: string }) {
  const { data: audit, isLoading } = useApiSWR<AIAuditResult>(
    `ai-audit-${crawlId}`,
    useCallback(() => api.crawls.getAIAudit(crawlId), [crawlId]),
  );

  if (isLoading) {
    return (
      <StateCard
        variant="loading"
        cardTitle="AI Crawlability Audit"
        description="Running crawlability checks..."
      />
    );
  }

  if (!audit || audit.checks.length === 0) return null;

  const passing = audit.checks.filter((c) => c.status === "pass").length;
  const total = audit.checks.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            AI Crawlability Audit
          </CardTitle>
          <Badge
            variant={
              passing === total
                ? "success"
                : passing >= 3
                  ? "warning"
                  : "destructive"
            }
          >
            {passing}/{total} passing
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {audit.criticalCount > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {audit.criticalCount} critical issue
            {audit.criticalCount !== 1 ? "s" : ""} found
          </div>
        )}

        {audit.checks.map((check) => {
          const config = STATUS_CONFIG[check.status];
          return (
            <div key={check.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{check.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {check.score}/100
                  </span>
                  <Badge variant={config.variant} className="text-xs">
                    {config.label}
                  </Badge>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    config.barColor,
                  )}
                  style={{ width: `${check.score}%` }}
                />
              </div>
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground">
          Based on {audit.pagesAudited} page
          {audit.pagesAudited !== 1 ? "s" : ""} audited
        </p>
      </CardContent>
    </Card>
  );
}
