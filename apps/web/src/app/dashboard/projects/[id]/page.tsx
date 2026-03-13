"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state";
import {
  AIVisibilityTab,
  AiAnalysisTab,
  AiTrafficTab,
  AutomationTab,
  CompetitorsTab,
  HistoryTab,
  IntegrationsTab,
  IssuesTab,
  KeywordsTab,
  LogsTab,
  PagesTab,
  PersonasTab,
  ProjectTabErrorBoundary,
  ReportsTab,
  StrategyTab,
  VisibilityTab,
} from "./project-tab-registry";
import { useApiSWR } from "@/lib/use-api-swr";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import { normalizeDomain } from "@llm-boost/shared";
import { useProject } from "@/hooks/use-project";
import { useCrawlHistory } from "@/hooks/use-crawl";
import { OverviewTab } from "@/components/tabs/overview-tab";
import { BrandingSettingsForm } from "@/components/forms/branding-settings-form";
import { CrawlSettingsForm } from "@/components/forms/crawl-settings-form";
import { ScoringProfileSection } from "@/components/settings/scoring-profile-section";
import { SiteContextSection } from "@/components/settings/site-context-section";
import { SiteFileGeneratorSection } from "@/components/settings/site-file-generator-section";
import { PostCrawlChecklist } from "@/components/post-crawl-checklist";
import { AlertBanner } from "@/components/alert-banner";
import { TrialBanner } from "@/components/trial-banner";
import { UsageMeter } from "@/components/usage-meter";
import { ProjectRecommendationsCard } from "@/components/cards/project-recommendations-card";
import { ProjectSidebar } from "@/components/project-sidebar";
import { ProjectMobileNav } from "@/components/project-mobile-nav";
import { WORKFLOW_TONE_COPY } from "@/lib/microcopy";
import { saveLastProjectContext } from "@/lib/workflow-memory";
import {
  resolveFirstSevenDaysOrder,
  type FirstSevenDaysStepId,
  type PersonalizationContext,
} from "@/lib/personalization-layout";
import { useProjectPageNavigation } from "./_hooks/use-project-page-navigation";
import {
  ProjectConfigureWorkspaceCard,
  ProjectFirstSevenDaysCard,
  ProjectVisibilityWorkspaceCard,
  ProjectWorkspaceChooser,
} from "./_components/project-page-sections";
import { SnippetSettingsSection } from "./_components/snippet-settings-section";
import {
  INTEGRATION_LABELS,
  isVisibilityMode,
  type VisibilityGuidanceAction,
  visibilityNextStepRecommendation,
} from "./project-page-helpers";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    autoCrawlFailed,
    connectProvider,
    connectedProvider,
    currentConfigureSection,
    currentTab,
    currentWorkspace,
    handleTabChange,
    handleVisibilityModeChange,
    handleWorkspaceChange,
    openAutomationDefaults,
    requestedCrawlId,
    setConfigureSection,
    setProjectTab,
    visibilityMode,
  } = useProjectPageNavigation(params.id);

  const { withAuth } = useApi();
  const [startingCrawl, setStartingCrawl] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const lastSyncedWorkflowContextRef = useRef<string | null>(null);
  const [snippetEnabled, setSnippetEnabled] = useState(false);

  const { data: project, isLoading: projectLoading } = useProject(params.id);
  const projectId = project?.id ?? null;
  const projectName = project?.name ?? null;
  const projectDomain = project?.domain ?? null;

  useEffect(() => {
    if (!projectId) return;
    const nextContext = {
      projectId,
      tab: currentTab,
      projectName,
      domain: projectDomain,
      visitedAt: new Date().toISOString(),
    };
    saveLastProjectContext({
      projectId: nextContext.projectId,
      tab: nextContext.tab,
      projectName: nextContext.projectName,
      domain: nextContext.domain,
      visitedAt: nextContext.visitedAt,
    });

    const signature = [
      nextContext.projectId,
      nextContext.tab,
      nextContext.projectName ?? "",
      nextContext.domain ?? "",
    ].join("|");
    if (lastSyncedWorkflowContextRef.current === signature) return;
    lastSyncedWorkflowContextRef.current = signature;

    void api.account
      .updatePreferences({ lastProjectContext: nextContext })
      .catch(() => {
        // Keep local workflow memory available when server sync fails.
      });
  }, [currentTab, projectDomain, projectId, projectName]);

  // Sync snippetEnabled from project data once loaded
  useEffect(() => {
    if (project) {
      setSnippetEnabled(project.analyticsSnippetEnabled ?? false);
    }
  }, [project?.id, project?.analyticsSnippetEnabled]);

  const latestCrawlId = project?.latestCrawl?.id;
  const selectedCrawlId = requestedCrawlId ?? latestCrawlId;

  const { data: crawlHistoryData } = useCrawlHistory(params.id);

  const { data: pagesData } = useApiSWR(
    selectedCrawlId ? `pages-${selectedCrawlId}` : null,
    useCallback(() => api.pages.list(selectedCrawlId!), [selectedCrawlId]),
  );

  const { data: issuesData } = useApiSWR(
    selectedCrawlId ? `issues-${selectedCrawlId}` : null,
    useCallback(
      () => api.issues.listForCrawl(selectedCrawlId!),
      [selectedCrawlId],
    ),
  );
  const { data: actionItemStats } = useApiSWR(
    `action-items-stats-${params.id}`,
    useCallback(() => api.actionItems.stats(params.id), [params.id]),
  );
  const issueCount = issuesData?.data?.length ?? 0;
  const hasIssueBacklog = issueCount > 0;
  const actionPlanCount = actionItemStats?.total ?? 0;
  const hasActionPlan = actionPlanCount > 0;
  const hasCompletedCrawl = !!latestCrawlId;
  const automationConfigured =
    project?.settings?.schedule !== "manual" &&
    project?.pipelineSettings?.autoRunOnCrawl !== false;
  const visibilityNextStep = visibilityNextStepRecommendation({
    hasCompletedCrawl,
    automationConfigured,
    issueCount,
  });
  const { data: accountMe } = useApiSWR(
    "account-me",
    useCallback(() => api.account.getMe(), []),
  );
  const personalizationContext: PersonalizationContext = {
    persona: accountMe?.persona ?? null,
    isAdmin: accountMe?.isAdmin ?? false,
  };
  const firstSevenDaysOrder = resolveFirstSevenDaysOrder(
    personalizationContext,
  );

  const handleStartCrawl = useCallback(async () => {
    setStartingCrawl(true);
    setCrawlError(null);
    try {
      await withAuth(async () => {
        const crawlJob = await api.crawls.start(params.id);
        router.push(`/dashboard/crawl/${crawlJob.id}`);
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const messages: Record<string, string> = {
          CRAWLER_UNAVAILABLE:
            "The crawler service is temporarily unavailable. Please try again in a few minutes.",
          CRAWLER_TIMEOUT:
            "The crawler service took too long to respond. Please try again.",
          CRAWLER_REJECTED:
            "The crawler could not process this request. Please contact support if this persists.",
          CRAWL_IN_PROGRESS: "A crawl is already running for this project.",
          CRAWL_LIMIT_REACHED:
            "You've used all your crawl credits for this month.",
        };
        setCrawlError(messages[err.code] ?? err.message);
      } else {
        setCrawlError("Failed to start crawl. Please try again.");
      }
      setStartingCrawl(false);
    }
  }, [params.id, router, withAuth]);

  const handleVisibilityGuidanceAction = useCallback(
    (action: VisibilityGuidanceAction) => {
      switch (action) {
        case "open-search-visibility":
          handleVisibilityModeChange("visibility");
          return;
        case "open-ai-visibility":
          handleVisibilityModeChange("ai-visibility");
          return;
        case "open-ai-analysis":
          handleVisibilityModeChange("ai-analysis");
          return;
        case "open-automation-defaults":
          openAutomationDefaults();
          return;
        case "run-crawl":
          void handleStartCrawl();
          return;
      }
    },
    [handleStartCrawl, handleVisibilityModeChange, openAutomationDefaults],
  );
  const firstSevenDaysSteps: Record<
    FirstSevenDaysStepId,
    {
      id: FirstSevenDaysStepId;
      title: string;
      description: string;
      done: boolean;
      ctaLabel: string;
      action: () => void;
    }
  > = {
    crawl: {
      id: "crawl",
      title: hasCompletedCrawl
        ? "Baseline crawl completed"
        : "Run baseline crawl",
      description: hasCompletedCrawl
        ? "Baseline scoring is available. Review crawl history and compare deltas."
        : "Start your first crawl to generate score baselines and issue detection.",
      done: hasCompletedCrawl,
      ctaLabel: hasCompletedCrawl ? "Open history" : "Run crawl",
      action: () =>
        hasCompletedCrawl ? setProjectTab("history") : handleStartCrawl(),
    },
    issues: {
      id: "issues",
      title: hasActionPlan
        ? `Action plan created (${actionPlanCount})`
        : hasIssueBacklog
          ? `Triage issue backlog (${issueCount})`
          : "Review issue backlog",
      description: hasActionPlan
        ? "Action items are ready. Keep execution moving from the Actions workspace."
        : hasIssueBacklog
          ? "Prioritize high-impact fixes and convert them into action items."
          : "No issues detected yet. Re-run after major site updates.",
      done: hasActionPlan,
      ctaLabel: hasActionPlan ? "Open actions" : "Open issues",
      action: () => setProjectTab(hasActionPlan ? "actions" : "issues"),
    },
    automation: {
      id: "automation",
      title: automationConfigured
        ? "Automation defaults configured"
        : "Configure automation defaults",
      description: automationConfigured
        ? "Recurring crawl cadence and post-crawl automation are active."
        : "Set crawl cadence and automation defaults to reduce manual follow-up.",
      done: automationConfigured,
      ctaLabel: "Open settings",
      action: () => openAutomationDefaults(),
    },
    visibility: {
      id: "visibility",
      title: "Start visibility monitoring",
      description:
        "Track Search Visibility, AI Visibility, and AI Analysis in one workspace.",
      done: isVisibilityMode(currentTab),
      ctaLabel: "Open visibility",
      action: () => setProjectTab("visibility"),
    },
  };
  const orderedFirstSevenDaysSteps = firstSevenDaysOrder.map(
    (id) => firstSevenDaysSteps[id],
  );
  const firstSevenDaysCompleted = orderedFirstSevenDaysSteps.filter(
    (step) => step.done,
  ).length;
  const firstSevenDaysTotal = orderedFirstSevenDaysSteps.length;
  const firstSevenDaysCompletionPercent =
    firstSevenDaysTotal > 0
      ? Math.round((firstSevenDaysCompleted / firstSevenDaysTotal) * 100)
      : 0;
  const firstSevenDaysNextStep = orderedFirstSevenDaysSteps.find(
    (step) => !step.done,
  );

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <StateMessage
          variant="loading"
          title="Loading workspace"
          description="Fetching your latest project details."
        />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center py-16">
        <StateMessage
          variant="error"
          title="Project not found"
          description="Return to Projects and select a workspace."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/projects">Go to projects</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      {/* Back + header (full width, above sidebar+content) */}
      <div className="space-y-2 pb-4">
        <Link
          href="/dashboard/projects"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              {project.faviconUrl && (
                <img
                  src={project.faviconUrl}
                  alt=""
                  className="h-7 w-7 rounded-sm"
                />
              )}
              <h1 className="text-2xl font-bold tracking-tight">
                {project.name}
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {WORKFLOW_TONE_COPY.projectWorkspaceSummary}
            </p>
          </div>
          <UsageMeter />
        </div>
        {(crawlError || autoCrawlFailed) && (
          <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {crawlError ??
              'Project created, but the first crawl did not start. Click "Run Crawl" to retry.'}
          </div>
        )}
        {connectedProvider && (
          <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {INTEGRATION_LABELS[connectedProvider]} connected successfully. You
            can sync data or run a connection test from the Integrations tab.
          </div>
        )}
      </div>

      {/* Mobile nav (visible below md) */}
      <ProjectMobileNav
        currentTab={currentTab}
        onTabChange={handleTabChange}
        personalizationContext={personalizationContext}
      />

      {/* Sidebar + Content */}
      <div className="flex">
        <ProjectSidebar
          projectName={project.name}
          domain={normalizeDomain(project.domain)}
          currentTab={currentTab}
          onTabChange={handleTabChange}
          personalizationContext={personalizationContext}
        />

        {/* Content area */}
        <div className="min-w-0 flex-1 space-y-6 py-4 md:pl-6">
          <ProjectWorkspaceChooser
            currentWorkspace={currentWorkspace}
            onWorkspaceChange={handleWorkspaceChange}
          />

          {/* Banners */}
          <AlertBanner projectId={project.id} />

          <ProjectFirstSevenDaysCard
            orderedSteps={orderedFirstSevenDaysSteps}
            completed={firstSevenDaysCompleted}
            total={firstSevenDaysTotal}
            completionPercent={firstSevenDaysCompletionPercent}
            nextStep={firstSevenDaysNextStep}
          />

          {/* Tab content */}
          {currentTab === "actions" && (
            <div className="space-y-6">
              <TrialBanner />
              <PostCrawlChecklist projectId={project.id} />
              <ProjectRecommendationsCard projectId={project.id} />
            </div>
          )}

          {currentTab === "overview" && (
            <ProjectTabErrorBoundary>
              <OverviewTab
                latestCrawl={project.latestCrawl}
                issues={issuesData?.data ?? []}
                projectId={project.id}
                onStartCrawl={handleStartCrawl}
                startingCrawl={startingCrawl}
              />
            </ProjectTabErrorBoundary>
          )}

          {currentTab === "pages" && (
            <ProjectTabErrorBoundary>
              <PagesTab pages={pagesData?.data ?? []} projectId={project.id} />
            </ProjectTabErrorBoundary>
          )}

          {currentTab === "issues" && (
            <ProjectTabErrorBoundary>
              <IssuesTab
                issues={issuesData?.data ?? []}
                crawlId={selectedCrawlId}
                projectId={project?.id}
              />
            </ProjectTabErrorBoundary>
          )}

          {currentTab === "history" && (
            <ProjectTabErrorBoundary>
              <HistoryTab crawlHistory={crawlHistoryData?.data ?? []} />
            </ProjectTabErrorBoundary>
          )}

          {currentTab === "strategy" && (
            <ProjectTabErrorBoundary>
              <StrategyTab projectId={project.id} />
            </ProjectTabErrorBoundary>
          )}

          {currentTab === "competitors" && (
            <CompetitorsTab projectId={project.id} />
          )}

          {/* Visibility workspace (visibility, ai-visibility, ai-analysis tabs) */}
          {isVisibilityMode(currentTab) && (
            <div className="space-y-6">
              <ProjectVisibilityWorkspaceCard
                hasCompletedCrawl={hasCompletedCrawl}
                onGuidanceAction={handleVisibilityGuidanceAction}
                onVisibilityModeChange={handleVisibilityModeChange}
                visibilityMode={visibilityMode}
                visibilityNextStep={visibilityNextStep}
              />

              {visibilityMode === "visibility" && (
                <VisibilityTab
                  projectId={project.id}
                  domain={project.domain}
                  latestCrawlId={latestCrawlId}
                />
              )}

              {visibilityMode === "ai-visibility" && (
                <ProjectTabErrorBoundary>
                  <AIVisibilityTab
                    projectId={project.id}
                    domain={project.domain}
                  />
                </ProjectTabErrorBoundary>
              )}

              {visibilityMode === "ai-analysis" && (
                <ProjectTabErrorBoundary>
                  <AiAnalysisTab crawlJobId={selectedCrawlId} />
                </ProjectTabErrorBoundary>
              )}
            </div>
          )}

          {currentTab === "personas" && <PersonasTab projectId={project.id} />}

          {currentTab === "keywords" && <KeywordsTab projectId={project.id} />}

          {currentTab === "integrations" && (
            <IntegrationsTab
              projectId={project.id}
              connectProvider={connectProvider}
              connectedProvider={connectedProvider}
            />
          )}

          {currentTab === "reports" && (
            <ReportsTab projectId={params.id} crawlJobId={selectedCrawlId} />
          )}

          {currentTab === "automation" && (
            <ProjectTabErrorBoundary>
              <AutomationTab projectId={project.id} />
            </ProjectTabErrorBoundary>
          )}

          {currentTab === "logs" && (
            <ProjectTabErrorBoundary>
              <LogsTab projectId={project.id} />
            </ProjectTabErrorBoundary>
          )}

          {currentTab === "ai-traffic" && (
            <ProjectTabErrorBoundary>
              <div className="space-y-6">
                <SnippetSettingsSection
                  projectId={project.id}
                  snippetEnabled={snippetEnabled}
                  onToggle={setSnippetEnabled}
                />
                <AiTrafficTab projectId={project.id} snippetEnabled={snippetEnabled} />
              </div>
            </ProjectTabErrorBoundary>
          )}

          {currentTab === "settings" && (
            <div className="space-y-6">
              <ProjectConfigureWorkspaceCard
                currentConfigureSection={currentConfigureSection}
                onConfigureSectionChange={setConfigureSection}
              />

              {currentConfigureSection === "site-context" && (
                <SiteContextSection projectId={project.id} />
              )}

              {currentConfigureSection === "crawl-defaults" && (
                <CrawlSettingsForm
                  projectId={project.id}
                  initialSettings={project.settings}
                />
              )}

              {currentConfigureSection === "ai-seo-files" && (
                <SiteFileGeneratorSection projectId={project.id} />
              )}

              {currentConfigureSection === "branding" && (
                <BrandingSettingsForm
                  projectId={project.id}
                  initialBranding={project.branding}
                />
              )}

              {currentConfigureSection === "scoring" && (
                <ScoringProfileSection projectId={project.id} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




