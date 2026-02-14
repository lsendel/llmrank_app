"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IssueCardProps {
  code: string;
  category: "technical" | "content" | "ai_readiness" | "performance";
  severity: "critical" | "warning" | "info";
  message: string;
  recommendation: string;
  data?: Record<string, unknown>;
  className?: string;
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

export function IssueCard({
  code,
  category,
  severity,
  message,
  recommendation,
  data,
  className,
}: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn("transition-shadow hover:shadow-md", className)}>
      <button
        type="button"
        className="flex w-full items-start gap-3 p-4 text-left"
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
          <p className="text-sm font-medium text-foreground">{message}</p>
        </div>
      </button>
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
              <Button size="sm" variant="outline" className="h-7 text-[10px]">
                <Sparkles className="mr-1.5 h-3 w-3 text-primary" />
                Optimize with AI
              </Button>
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
