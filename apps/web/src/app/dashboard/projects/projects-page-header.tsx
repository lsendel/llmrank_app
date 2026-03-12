"use client";

import Link from "next/link";
import { Play, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WorkflowGuidance } from "@/components/ui/workflow-guidance";

export function ProjectsPageHeader(props: any) {
  const { lastProjectContext, lastProjectContextHref, projectTabLabel } = props;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your portfolio with shareable filters and bulk actions.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      <WorkflowGuidance
        title="Portfolio execution flow"
        description="Keep portfolio operations predictable: narrow scope, select targets, and run bulk actions."
        actions={[
          { label: "Create Project", href: "/dashboard/projects/new", variant: "outline" },
          { label: "History", href: "/dashboard/history", variant: "ghost" },
        ]}
        steps={[
          {
            title: "Filter to the right portfolio slice",
            description:
              "Use health, anomaly, and sort controls to isolate the projects that need attention now.",
            icon: Search,
          },
          {
            title: "Select projects by outcome",
            description:
              "Use anomaly views to build focused batches for remediation, reruns, or automation updates.",
            icon: Sparkles,
          },
          {
            title: "Execute one-click bulk operations",
            description:
              "Run crawls, enable defaults, or plan smart fixes to convert insights into action quickly.",
            icon: Play,
          },
        ]}
      />

      {lastProjectContext && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Continue where you left off</p>
              <p className="text-xs text-muted-foreground">
                Resume {lastProjectContext.projectName || lastProjectContext.domain || "last project"} in {projectTabLabel(lastProjectContext.tab)}.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={lastProjectContextHref(lastProjectContext)}>
                Resume
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
