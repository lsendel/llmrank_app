"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiscoveryLaunchFooterProps {
  completedCount: number;
  totalCards: number;
  saving: boolean;
  onLaunch: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiscoveryLaunchFooter({
  completedCount,
  totalCards,
  saving,
  onLaunch,
}: DiscoveryLaunchFooterProps) {
  const allComplete = completedCount === totalCards;

  return (
    <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        {/* Completion summary */}
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {Array.from({ length: totalCards }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-4 rounded-full transition-colors",
                  i < completedCount ? "bg-green-500" : "bg-muted",
                )}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {completedCount} of {totalCards} completed
          </span>
        </div>

        {/* CTA */}
        <Button
          onClick={onLaunch}
          disabled={saving}
          className={cn(
            "gap-2",
            allComplete && "bg-green-600 hover:bg-green-700",
          )}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
