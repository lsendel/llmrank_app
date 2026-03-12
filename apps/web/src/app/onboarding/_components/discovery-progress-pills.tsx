"use client";

import { Check, Circle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardStatus } from "@/hooks/use-discovery-completion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PillCard {
  id: string;
  label: string;
  status: CardStatus;
}

interface DiscoveryProgressPillsProps {
  cards: PillCard[];
}

// ---------------------------------------------------------------------------
// Status icon per card state
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: CardStatus }) {
  switch (status) {
    case "completed":
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
          <Check className="h-3 w-3" />
        </div>
      );
    case "active":
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500">
          <div className="h-2 w-2 rounded-full bg-white" />
        </div>
      );
    case "locked":
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Lock className="h-3 w-3" />
        </div>
      );
    default:
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground/30">
          <Circle className="h-2 w-2 text-muted-foreground/30" />
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiscoveryProgressPills({ cards }: DiscoveryProgressPillsProps) {
  function scrollToCard(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
      {cards.map((card, idx) => (
        <div key={card.id} className="flex items-center gap-1 sm:gap-2">
          {idx > 0 && (
            <div
              className={cn(
                "h-px w-4 sm:w-6",
                card.status === "completed" ||
                  cards[idx - 1]?.status === "completed"
                  ? "bg-green-500/40"
                  : "bg-border",
              )}
            />
          )}
          <button
            type="button"
            onClick={() => scrollToCard(card.id)}
            disabled={card.status === "locked"}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              card.status === "completed" &&
                "bg-green-500/10 text-green-700 dark:text-green-400",
              card.status === "active" &&
                "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
              card.status === "pending" &&
                "bg-muted text-muted-foreground hover:bg-muted/80",
              card.status === "locked" &&
                "bg-muted/50 text-muted-foreground/60 cursor-not-allowed",
            )}
          >
            <StatusIcon status={card.status} />
            <span className="hidden sm:inline whitespace-nowrap">
              {card.label}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
