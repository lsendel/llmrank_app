"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type GuidanceButtonVariant = "default" | "outline" | "secondary" | "ghost";

export interface WorkflowGuidanceAction {
  label: string;
  href: string;
  variant?: GuidanceButtonVariant;
}

export interface WorkflowGuidanceStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface WorkflowGuidanceProps {
  title: string;
  description: string;
  steps: WorkflowGuidanceStep[];
  actions?: WorkflowGuidanceAction[];
  className?: string;
}

export function WorkflowGuidance({
  title,
  description,
  steps,
  actions,
  className,
}: WorkflowGuidanceProps) {
  return (
    <Card className={cn("border-border/70", className)}>
      <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <Button
                key={`${action.label}-${action.href}`}
                asChild
                size="sm"
                variant={action.variant ?? "outline"}
              >
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="rounded-md border bg-muted/20 p-3">
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
      {actions && actions.length > 0 && (
        <CardContent className="pt-0">
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            Tip: keep this sequence as a daily operating cadence.
            <ArrowRight className="h-3 w-3" />
          </p>
        </CardContent>
      )}
    </Card>
  );
}
