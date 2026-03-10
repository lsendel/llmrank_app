"use client";

import { Check } from "lucide-react";

interface WizardStepperProps {
  steps: string[];
  currentStep: number;
}

export function WizardStepper({ steps, currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((label, i) => {
        const state =
          i < currentStep
            ? "completed"
            : i === currentStep
              ? "active"
              : "upcoming";
        return (
          <div
            key={label}
            data-step
            data-state={state}
            className="flex flex-1 items-center"
          >
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors ${
                  state === "completed"
                    ? "border-primary bg-primary text-primary-foreground"
                    : state === "active"
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                }`}
              >
                {state === "completed" ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-xs ${
                  state === "active"
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-2 h-px flex-1 ${
                  i < currentStep ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
