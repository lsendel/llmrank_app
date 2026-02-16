"use client";

import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PercentileBadgeProps {
  avgScore: number;
  className?: string;
}

function getPercentileInfo(avgScore: number) {
  if (avgScore >= 90) {
    return { percentile: 99, label: "Top 1%", variant: "success" as const };
  }
  if (avgScore >= 80) {
    return { percentile: 90, label: "Top 10%", variant: "success" as const };
  }
  if (avgScore >= 70) {
    return { percentile: 75, label: "Top 25%", variant: "default" as const };
  }
  if (avgScore >= 50) {
    return { percentile: 50, label: "Top 50%", variant: "secondary" as const };
  }
  return {
    percentile: 25,
    label: "Bottom 25%",
    variant: "destructive" as const,
  };
}

export function PercentileBadge({ avgScore, className }: PercentileBadgeProps) {
  const { percentile, label, variant } = getPercentileInfo(avgScore);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <Trophy className="h-5 w-5 text-primary" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Market Position</p>
          <Badge variant={variant} className="text-[10px] h-5 px-1.5">
            {label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Your average score is better than {percentile}% of tracked sites.
        </p>
      </div>
    </div>
  );
}
