"use client";

import { RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface RescanPromptCardProps {
  completedCount: number;
  onRescan: () => void;
  isLoading?: boolean;
}

export function RescanPromptCard({
  completedCount,
  onRescan,
  isLoading,
}: RescanPromptCardProps) {
  if (completedCount <= 0) return null;

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
      <CardContent className="flex items-center gap-4 py-4">
        <CheckCircle className="h-5 w-5 shrink-0 text-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-medium">
            You&apos;ve fixed {completedCount} issue
            {completedCount !== 1 ? "s" : ""} since your last crawl!
          </p>
          <p className="text-xs text-muted-foreground">
            Re-scan to verify your fixes and update your score.
          </p>
        </div>
        <Button size="sm" onClick={onRescan} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Starting..." : "Re-scan Now"}
        </Button>
      </CardContent>
    </Card>
  );
}
