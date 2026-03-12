"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const GOALS = [
  {
    value: "ai_mentions",
    label: "Get mentioned in AI responses",
    description: "ChatGPT, Claude, Perplexity",
  },
  {
    value: "lead_gen",
    label: "Generate more leads from AI search",
    description: "Convert AI-referred traffic",
  },
  {
    value: "outrank",
    label: "Outrank competitors in AI recommendations",
    description: "Be the top suggestion",
  },
  {
    value: "brand_understanding",
    label: "Understand how AI sees my brand",
    description: "Audit AI perception",
  },
] as const;

interface GoalsCardContentProps {
  selected: string | null;
  onSelect: (goal: string) => void;
}

export function GoalsCardContent({
  selected,
  onSelect,
}: GoalsCardContentProps) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Business goals">
      {GOALS.map((goal) => {
        const isSelected = selected === goal.value;
        return (
          <button
            key={goal.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(goal.value)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
              "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border bg-background",
            )}
          >
            <div
              className={cn(
                "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40",
              )}
            >
              {isSelected && <Check className="h-3 w-3" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{goal.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {goal.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
