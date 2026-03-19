"use client";

import { useCallback } from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StateMessage } from "@/components/ui/state";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import type { Project } from "@/lib/api";
import {
  resolveFirstSevenDaysOrder,
  type FirstSevenDaysStepId,
  type PersonalizationContext,
} from "@/lib/personalization-layout";

function buildSteps(project: Project) {
  const projectUrl = `/dashboard/projects/${project.id}`;
  const hasCompletedCrawl = !!project.latestCrawl;
  const automationConfigured =
    project.settings?.schedule !== "manual" &&
    project.pipelineSettings?.autoRunOnCrawl !== false;

  const steps: Record<
    FirstSevenDaysStepId,
    {
      id: FirstSevenDaysStepId;
      title: string;
      done: boolean;
      ctaLabel: string;
      href: string;
    }
  > = {
    crawl: {
      id: "crawl",
      title: hasCompletedCrawl
        ? "Baseline crawl completed"
        : "Run baseline crawl",
      done: hasCompletedCrawl,
      ctaLabel: hasCompletedCrawl ? "View history" : "Run crawl",
      href: `${projectUrl}?tab=history`,
    },
    issues: {
      id: "issues",
      title: "Review issue backlog",
      done: false,
      ctaLabel: "Open issues",
      href: `${projectUrl}?tab=issues`,
    },
    automation: {
      id: "automation",
      title: automationConfigured
        ? "Automation configured"
        : "Configure automation",
      done: automationConfigured,
      ctaLabel: "Open settings",
      href: `${projectUrl}?tab=settings&configure=crawl-defaults`,
    },
    visibility: {
      id: "visibility",
      title: "Start visibility monitoring",
      done: false,
      ctaLabel: "Open visibility",
      href: `${projectUrl}?tab=visibility`,
    },
  };
  return steps;
}

export default function PlanPage() {
  const { data: projectsData, isLoading } = useApiSWR(
    "projects-plan",
    useCallback(() => api.projects.list({ limit: 50 }), []),
  );
  const projects = projectsData?.data ?? [];

  const { data: accountMe } = useApiSWR(
    "account-me",
    useCallback(() => api.account.getMe(), []),
  );

  const personalizationContext: PersonalizationContext = {
    persona: accountMe?.persona ?? null,
    isAdmin: accountMe?.isAdmin ?? false,
  };
  const stepOrder = resolveFirstSevenDaysOrder(personalizationContext);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <StateMessage
          variant="loading"
          title="Loading plan"
          description="Fetching project progress."
        />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <StateMessage
          variant="empty"
          title="No projects yet"
          description="Create your first project to get started with the 7-day plan."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/projects/new/wizard">Create project</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">7 Days Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational checklist for faster adoption. Complete milestones per
          project, then switch to recurring optimization.
        </p>
      </div>

      {projects.map((project) => {
        const steps = buildSteps(project);
        const ordered = stepOrder.map((id) => steps[id]);
        const completed = ordered.filter((s) => s.done).length;
        const total = ordered.length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const nextStep = ordered.find((s) => !s.done);

        return (
          <Card key={project.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {project.faviconUrl && (
                    <img
                      src={project.faviconUrl}
                      alt=""
                      className="h-5 w-5 rounded-sm"
                    />
                  )}
                  <CardTitle className="text-base">{project.name}</CardTitle>
                </div>
                <Badge variant="secondary">{pct}% complete</Badge>
              </div>
              <Progress value={pct} className="mt-2 h-2" />
            </CardHeader>
            <CardContent className="space-y-2">
              {ordered.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">{step.title}</span>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={step.href}>{step.ctaLabel}</Link>
                  </Button>
                </div>
              ))}
              {nextStep && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Next: {nextStep.title}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
