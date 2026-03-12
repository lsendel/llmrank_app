"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Profile" },
  { label: "Website" },
  { label: "Discovery" },
];

export function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;
        return (
          <div key={step.label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8 sm:w-12",
                  isCompleted ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  isCompleted && "bg-primary text-primary-foreground",
                  isActive &&
                    "border-2 border-primary bg-primary/10 text-primary",
                  !isCompleted &&
                    !isActive &&
                    "border border-border text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
