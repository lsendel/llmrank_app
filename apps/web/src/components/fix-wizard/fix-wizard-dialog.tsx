"use client";

import { useState } from "react";
import {
  Clock,
  Gauge,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FixStep } from "./fix-step";

interface FixGuideStep {
  title: string;
  description: string;
  codeSnippet?: string;
  language?: string;
  tip?: string;
  docsUrl?: string;
}

interface FixGuide {
  issueCode: string;
  title: string;
  estimatedMinutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  platforms: Record<string, FixGuideStep[]>;
  aiFixAvailable: boolean;
}

interface FixWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guide: FixGuide | null;
  onComplete?: () => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  generic: "Generic HTML",
  wordpress: "WordPress",
  nextjs: "Next.js",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner:
    "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400",
  intermediate:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400",
  advanced: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400",
};

export function FixWizardDialog({
  open,
  onOpenChange,
  guide,
  onComplete,
}: FixWizardDialogProps) {
  const [platform, setPlatform] = useState<string>("generic");
  // Reset step when dialog opens with a (potentially different) guide
  const resetKey = open ? (guide?.issueCode ?? "") : "";
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  const [currentStep, setCurrentStep] = useState(0);

  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setCurrentStep(0);
  }

  if (!guide) return null;

  const platforms = Object.keys(guide.platforms);
  const steps = guide.platforms[platform] ?? guide.platforms.generic ?? [];
  const totalSteps = steps.length;
  const isLastStep = currentStep >= totalSteps - 1;
  const isOverview = currentStep === -1;

  function handleNext() {
    if (isLastStep) {
      // Move to verification step
      setCurrentStep(totalSteps);
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (currentStep <= 0) {
      setCurrentStep(-1); // back to overview
    } else {
      setCurrentStep((s) => s - 1);
    }
  }

  // Overview screen
  if (isOverview || currentStep === -1) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">{guide.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Meta badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />~{guide.estimatedMinutes} min
              </Badge>
              <Badge
                variant="secondary"
                className={DIFFICULTY_COLORS[guide.difficulty]}
              >
                <Gauge className="mr-1 h-3 w-3" />
                {guide.difficulty}
              </Badge>
              {guide.aiFixAvailable && (
                <Badge variant="secondary">AI Fix Available</Badge>
              )}
            </div>

            {/* Platform selector */}
            <div>
              <p className="mb-2 text-sm font-medium">Choose your platform:</p>
              <div className="flex gap-2">
                {platforms.map((p) => (
                  <Button
                    key={p}
                    variant={platform === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPlatform(p)}
                  >
                    {PLATFORM_LABELS[p] ?? p}
                  </Button>
                ))}
              </div>
            </div>

            {/* Steps preview */}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {steps.length} step{steps.length !== 1 ? "s" : ""}:
              </p>
              <ol className="ml-4 list-decimal space-y-0.5 text-sm text-muted-foreground">
                {steps.map((step, i) => (
                  <li key={i}>{step.title}</li>
                ))}
              </ol>
            </div>

            <Button className="w-full" onClick={() => setCurrentStep(0)}>
              Start Guide
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Verification / completion screen
  if (currentStep >= totalSteps) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Fix Complete</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <p className="text-sm text-muted-foreground">
              You&apos;ve completed all steps. Mark this item as complete and
              re-crawl to verify the fix.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  onComplete?.();
                  onOpenChange(false);
                }}
              >
                Mark as Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Individual step
  const step = steps[currentStep];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">
              Step {currentStep + 1} of {totalSteps}
            </DialogTitle>
            <span className="text-xs text-muted-foreground">
              {PLATFORM_LABELS[platform]}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width: `${((currentStep + 1) / totalSteps) * 100}%`,
              }}
            />
          </div>
        </DialogHeader>

        <div className="py-2">
          <FixStep
            stepNumber={currentStep + 1}
            title={step.title}
            description={step.description}
            codeSnippet={step.codeSnippet}
            language={step.language}
            tip={step.tip}
            docsUrl={step.docsUrl}
          />
        </div>

        <div className="flex justify-between">
          <Button variant="outline" size="sm" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button size="sm" onClick={handleNext}>
            {isLastStep ? "Finish" : "Next"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
