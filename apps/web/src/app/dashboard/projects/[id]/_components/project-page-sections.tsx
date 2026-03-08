import type { ComponentType } from "react";
import {
  CheckCircle2,
  Circle,
  FileText,
  Globe,
  Palette,
  Route,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { FirstSevenDaysStepId } from "@/lib/personalization-layout";
import type { ConfigureSection } from "../configure-state";
import { PROJECT_TAB_GROUPS, type ProjectTabGroup } from "../tab-state";
import {
  VISIBILITY_GUIDANCE_ORDER,
  VISIBILITY_MODE_GUIDANCE,
  type VisibilityGuidanceAction,
  type VisibilityMode,
} from "../project-page-helpers";

const WORKSPACE_META: Record<
  ProjectTabGroup,
  { label: string; description: string }
> = {
  analyze: {
    label: "Analyze",
    description: "Track score health, crawl output, and issue backlog.",
  },
  "grow-visibility": {
    label: "Grow Visibility",
    description:
      "Build strategy, monitor competitors, and improve AI presence.",
  },
  "automate-operate": {
    label: "Automate & Operate",
    description:
      "Run integrations, reporting, automation, and operational logs.",
  },
  configure: {
    label: "Configure",
    description: "Set crawl defaults, branding, scoring, and site context.",
  },
};

const CONFIGURE_SECTION_META: Record<
  ConfigureSection,
  {
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  "site-context": {
    title: "Site Context",
    description: "Keep your site description and market context accurate.",
    icon: Globe,
  },
  "crawl-defaults": {
    title: "Crawl Defaults",
    description: "Set depth, schedule, and behavior for every crawl run.",
    icon: Route,
  },
  "ai-seo-files": {
    title: "AI/SEO Files",
    description: "Generate sitemap.xml and llms.txt from crawl output.",
    icon: FileText,
  },
  branding: {
    title: "Branding",
    description: "Tune tone, positioning, and content style settings.",
    icon: Palette,
  },
  scoring: {
    title: "Scoring Weights",
    description: "Control how technical, content, AI, and performance score.",
    icon: SlidersHorizontal,
  },
};

type FirstSevenDaysStep = {
  id: FirstSevenDaysStepId;
  title: string;
  description: string;
  done: boolean;
  ctaLabel: string;
  action: () => void;
};

export function ProjectWorkspaceChooser({
  currentWorkspace,
  onWorkspaceChange,
}: {
  currentWorkspace: ProjectTabGroup;
  onWorkspaceChange: (workspace: ProjectTabGroup) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Workspace</CardTitle>
        <CardDescription>
          Focus work by job to be done. Your last tab in each workspace is
          remembered.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PROJECT_TAB_GROUPS.map((workspace) => {
          const meta = WORKSPACE_META[workspace];
          const isActive = currentWorkspace === workspace;
          return (
            <button
              key={workspace}
              type="button"
              onClick={() => onWorkspaceChange(workspace)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
              aria-pressed={isActive}
            >
              <p className="text-sm font-medium">{meta.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {meta.description}
              </p>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ProjectFirstSevenDaysCard({
  orderedSteps,
  completed,
  total,
  completionPercent,
  nextStep,
}: {
  orderedSteps: FirstSevenDaysStep[];
  completed: number;
  total: number;
  completionPercent: number;
  nextStep?: FirstSevenDaysStep;
}) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">First 7 days plan</CardTitle>
        <CardDescription>
          Operational checklist for faster adoption. Complete the first
          milestones, then switch to recurring optimization.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Progress: {completed}/{total} milestones completed
            </p>
            <Badge variant="secondary">{completionPercent}% complete</Badge>
          </div>
          <Progress value={completionPercent} className="h-2" />
          {nextStep ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-2">
              <p className="text-xs text-muted-foreground">
                Recommended next step: {nextStep.title}
              </p>
              <Button size="sm" variant="outline" onClick={nextStep.action}>
                {nextStep.ctaLabel}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              All onboarding milestones are complete. Continue with recurring
              optimization workflows.
            </p>
          )}
        </div>
        {orderedSteps.map((step) => (
          <div
            key={step.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
          >
            <div className="flex min-w-0 items-start gap-2">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={step.action}>
              {step.ctaLabel}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ProjectVisibilityWorkspaceCard({
  hasCompletedCrawl,
  onGuidanceAction,
  onVisibilityModeChange,
  visibilityMode,
  visibilityNextStep,
}: {
  hasCompletedCrawl: boolean;
  onGuidanceAction: (action: VisibilityGuidanceAction) => void;
  onVisibilityModeChange: (mode: VisibilityMode) => void;
  visibilityMode: VisibilityMode;
  visibilityNextStep: {
    title: string;
    description: string;
    actionLabel: string;
    action: VisibilityGuidanceAction;
  };
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Visibility workspace</CardTitle>
        <CardDescription>
          Use one workflow for monitoring search performance, AI presence, and
          analysis insights.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {VISIBILITY_GUIDANCE_ORDER.map((mode) => {
            const isActive = visibilityMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onVisibilityModeChange(mode)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {VISIBILITY_MODE_GUIDANCE[mode].label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Recommended next step: {visibilityNextStep.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {visibilityNextStep.description}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => onGuidanceAction(visibilityNextStep.action)}
          >
            {visibilityNextStep.actionLabel}
          </Button>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {VISIBILITY_GUIDANCE_ORDER.map((mode) => {
            const modeGuide = VISIBILITY_MODE_GUIDANCE[mode];
            const isActiveMode = visibilityMode === mode;
            const needsCrawl =
              modeGuide.requiresCrawl === true && !hasCompletedCrawl;

            return (
              <div
                key={mode}
                className={`rounded-lg border p-3 ${
                  isActiveMode ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{modeGuide.label}</p>
                  {isActiveMode && <Badge>Active</Badge>}
                  {!isActiveMode && needsCrawl && (
                    <Badge variant="secondary">Needs crawl</Badge>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Use when
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {modeGuide.whenToUse}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Value
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {modeGuide.value}
                    </p>
                  </div>
                </div>

                <Button
                  className="mt-3"
                  size="sm"
                  variant={isActiveMode ? "secondary" : "outline"}
                  disabled={isActiveMode}
                  onClick={() => {
                    if (needsCrawl) {
                      onGuidanceAction("run-crawl");
                      return;
                    }
                    onVisibilityModeChange(mode);
                  }}
                >
                  {needsCrawl
                    ? "Run crawl first"
                    : isActiveMode
                      ? "In use"
                      : `Open ${modeGuide.label}`}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectConfigureWorkspaceCard({
  currentConfigureSection,
  onConfigureSectionChange,
}: {
  currentConfigureSection: ConfigureSection;
  onConfigureSectionChange: (section: ConfigureSection) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Configure workspace</CardTitle>
        <CardDescription>
          Choose a task to configure. Each area is focused so setup is faster
          and easier to review.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(
          Object.entries(CONFIGURE_SECTION_META) as Array<
            [
              ConfigureSection,
              (typeof CONFIGURE_SECTION_META)[ConfigureSection],
            ]
          >
        ).map(([section, meta]) => {
          const Icon = meta.icon;
          const isActive = currentConfigureSection === section;

          return (
            <button
              key={section}
              type="button"
              onClick={() => onConfigureSectionChange(section)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
              aria-pressed={isActive}
            >
              <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4" />
                {meta.title}
              </div>
              <p className="text-xs text-muted-foreground">
                {meta.description}
              </p>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
