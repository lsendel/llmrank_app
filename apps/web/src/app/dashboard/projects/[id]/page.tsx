"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  FileText,
  Globe,
  Route,
  Palette,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StateMessage } from "@/components/ui/state";
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
import {
  GROUP_DEFAULT_TABS,
  normalizeProjectTab,
  projectTabGroup,
  PROJECT_TAB_GROUPS,
  type ProjectTab,
  type ProjectTabGroup,
} from "./tab-state";
import { saveLastProjectContext } from "@/lib/workflow-memory";
import {
  resolveFirstSevenDaysOrder,
  type FirstSevenDaysStepId,
  type PersonalizationContext,
} from "@/lib/personalization-layout";
import {
  normalizeConfigureSection,
  type ConfigureSection,
} from "./configure-state";

function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 pt-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-lg border bg-muted/30" />
        <div className="h-40 animate-pulse rounded-lg border bg-muted/30" />
      </div>
      <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
    </div>
  );
}
class TabErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <StateMessage
          variant="error"
          title="This tab could not be loaded"
          description="Reload this section to continue."
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-8"
          retry={{ onClick: () => this.setState({ hasError: false }) }}
        />
      );
    }
    return this.props.children;
  }
}

const PagesTab = dynamic(
  () =>
    import("@/components/tabs/pages-tab").then((mod) => ({
      default: mod.PagesTab,
    })),
  { loading: () => <TabLoadingSkeleton /> },
);

const IssuesTab = dynamic(
  () =>
    import("@/components/tabs/issues-tab").then((mod) => ({
      default: mod.IssuesTab,
    })),
  { loading: () => <TabLoadingSkeleton /> },
);

const HistoryTab = dynamic(
  () =>
    import("@/components/tabs/history-tab").then((mod) => ({
      default: mod.HistoryTab,
    })),
  { loading: () => <TabLoadingSkeleton /> },
);

const StrategyTab = dynamic(
  () =>
    import("@/components/tabs/strategy-tab").then((mod) => ({
      default: mod.StrategyTab,
    })),
  { loading: () => <TabLoadingSkeleton /> },
);

const VisibilityTab = dynamic(
  () => import("@/components/tabs/visibility-tab"),
  {
    loading: () => <TabLoadingSkeleton />,
  },
);

const IntegrationsTab = dynamic(
  () => import("@/components/tabs/integrations-tab"),
  {
    loading: () => <TabLoadingSkeleton />,
  },
);

const ReportsTab = dynamic(() => import("@/components/reports/reports-tab"), {
  loading: () => <TabLoadingSkeleton />,
});

const LogsTab = dynamic(
  () =>
    import("@/components/tabs/logs-tab").then((mod) => ({
      default: mod.LogsTab,
    })),
  { loading: () => <TabLoadingSkeleton /> },
);

const AutomationTab = dynamic(
  () =>
    import("@/components/tabs/automation-tab").then((mod) => ({
      default: mod.AutomationTab,
    })),
  { loading: () => <TabLoadingSkeleton /> },
);

const AIVisibilityTab = dynamic(
  () => import("@/components/tabs/ai-visibility-tab"),
  {
    loading: () => <TabLoadingSkeleton />,
  },
);

const CompetitorsTab = dynamic(
  () =>
    import("@/components/tabs/competitors-tab").then((mod) => ({
      default: mod.CompetitorsTab,
    })),
  {
    loading: () => <TabLoadingSkeleton />,
  },
);

const PersonasTab = dynamic(
  () =>
    import("@/components/tabs/personas-tab").then((mod) => ({
      default: mod.PersonasTab,
    })),
  { loading: () => <TabLoadingSkeleton /> },
);

const KeywordsTab = dynamic(
  () =>
    import("@/components/tabs/keywords-tab").then((mod) => ({
      default: mod.KeywordsTab,
    })),
  { loading: () => <TabLoadingSkeleton /> },
);

const AiAnalysisTab = dynamic(
  () =>
    import("@/components/tabs/ai-analysis-tab").then((mod) => ({
      default: mod.AiAnalysisTab,
    })),
  { loading: () => <TabLoadingSkeleton /> },
);

const INTEGRATION_PROVIDERS = ["gsc", "psi", "ga4", "clarity"] as const;
type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

function asIntegrationProvider(
  value: string | null,
): IntegrationProvider | null {
  if (!value) return null;
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(value)
    ? (value as IntegrationProvider)
    : null;
}

const INTEGRATION_LABELS: Record<IntegrationProvider, string> = {
  gsc: "Google Search Console",
  ga4: "Google Analytics 4",
  psi: "PageSpeed Insights",
  clarity: "Microsoft Clarity",
};

const VISIBILITY_MODES = [
  "visibility",
  "ai-visibility",
  "ai-analysis",
] as const;
type VisibilityMode = (typeof VISIBILITY_MODES)[number];
const VISIBILITY_MODE_STORAGE_PREFIX = "llmrank:project:visibility-mode";
const WORKSPACE_LAST_TAB_STORAGE_PREFIX = "llmrank:project:workspace-last-tab";

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

type VisibilityGuidanceAction =
  | "open-search-visibility"
  | "open-ai-visibility"
  | "open-ai-analysis"
  | "open-automation-defaults"
  | "run-crawl";

const VISIBILITY_GUIDANCE_ORDER: VisibilityMode[] = [
  "visibility",
  "ai-visibility",
  "ai-analysis",
];

const VISIBILITY_MODE_GUIDANCE: Record<
  VisibilityMode,
  {
    label: string;
    whenToUse: string;
    value: string;
    requiresCrawl?: boolean;
  }
> = {
  visibility: {
    label: "Search Visibility",
    whenToUse:
      "You need weekly share-of-voice, competitor movement, and region-aware trend tracking.",
    value:
      "Turns visibility checks into backlog-ready opportunities and confidence-scored coverage.",
  },
  "ai-visibility": {
    label: "AI Visibility",
    whenToUse:
      "You need provider-by-provider mention rate and keyword gap discovery across LLM engines.",
    value:
      "Shows where your brand is missing and lets you convert gaps into tracked keywords quickly.",
  },
  "ai-analysis": {
    label: "AI Analysis",
    whenToUse:
      "You need crawl-based narrative insights and prioritized recommendations for what to fix next.",
    value:
      "Translates crawl output into strategy guidance for content, technical SEO, and AI-readiness.",
    requiresCrawl: true,
  },
};

function visibilityNextStepRecommendation(context: {
  hasCompletedCrawl: boolean;
  automationConfigured: boolean;
  issueCount: number;
}): {
  title: string;
  description: string;
  actionLabel: string;
  action: VisibilityGuidanceAction;
} {
  if (!context.hasCompletedCrawl) {
    return {
      title: "Run baseline crawl to unlock AI Analysis",
      description:
        "Start with one crawl so AI Analysis can generate insight-driven recommendations.",
      actionLabel: "Run crawl",
      action: "run-crawl",
    };
  }

  if (!context.automationConfigured) {
    return {
      title: "Enable recurring monitoring defaults",
      description:
        "Set crawl cadence and post-crawl automation so visibility updates happen without manual work.",
      actionLabel: "Open defaults",
      action: "open-automation-defaults",
    };
  }

  if (context.issueCount > 0) {
    return {
      title: `Review AI Analysis for your ${context.issueCount} open issues`,
      description:
        "Use narrative insights to prioritize the highest-impact fixes before the next crawl cycle.",
      actionLabel: "Open AI Analysis",
      action: "open-ai-analysis",
    };
  }

  return {
    title: "Expand coverage with AI Visibility",
    description:
      "Benchmark brand mention rate across providers and convert uncovered opportunities into tracked keywords.",
    actionLabel: "Open AI Visibility",
    action: "open-ai-visibility",
  };
}

function isVisibilityMode(tab: ProjectTab): tab is VisibilityMode {
  return (VISIBILITY_MODES as readonly string[]).includes(tab);
}

function asVisibilityMode(value: string | null): VisibilityMode | null {
  if (!value) return null;
  return (VISIBILITY_MODES as readonly string[]).includes(value)
    ? (value as VisibilityMode)
    : null;
}

function visibilityModeStorageKey(projectId: string): string {
  return `${VISIBILITY_MODE_STORAGE_PREFIX}:${projectId}`;
}

function workspaceLastTabStorageKey(
  projectId: string,
  workspace: ProjectTabGroup,
): string {
  return `${WORKSPACE_LAST_TAB_STORAGE_PREFIX}:${projectId}:${workspace}`;
}

function parseWorkspaceStoredTab(
  rawTab: string | null,
  workspace: ProjectTabGroup,
): ProjectTab | null {
  if (!rawTab) return null;
  const normalized = normalizeProjectTab(rawTab);
  if (normalized !== rawTab) return null;
  return projectTabGroup(normalized) === workspace ? normalized : null;
}

const CONFIGURE_SECTION_META: Record<
  ConfigureSection,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
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

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const rawConfigure = searchParams.get("configure");
  const requestedCrawlId = searchParams.get("crawlId");
  const connectProvider = asIntegrationProvider(searchParams.get("connect"));
  const connectedProvider = asIntegrationProvider(
    searchParams.get("connected"),
  );
  const currentTab = normalizeProjectTab(rawTab);
  const currentWorkspace = projectTabGroup(currentTab);
  const visibilityMode: VisibilityMode = isVisibilityMode(currentTab)
    ? currentTab
    : "visibility";
  const currentConfigureSection = normalizeConfigureSection(rawConfigure);
  const autoCrawlFailed = searchParams.get("autocrawl") === "failed";

  useEffect(() => {
    if (!rawTab || rawTab === currentTab) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", currentTab);
    router.replace(`/dashboard/projects/${params.id}?${nextParams.toString()}`);
  }, [currentTab, params.id, rawTab, router, searchParams]);

  useEffect(() => {
    if (!rawConfigure || rawConfigure === currentConfigureSection) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("configure", currentConfigureSection);
    router.replace(`/dashboard/projects/${params.id}?${nextParams.toString()}`);
  }, [currentConfigureSection, params.id, rawConfigure, router, searchParams]);

  useEffect(() => {
    if (!isVisibilityMode(currentTab) || typeof window === "undefined") return;
    window.localStorage.setItem(
      visibilityModeStorageKey(params.id),
      currentTab,
    );
  }, [currentTab, params.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      workspaceLastTabStorageKey(params.id, currentWorkspace),
      currentTab,
    );
  }, [currentTab, currentWorkspace, params.id]);

  const resolveVisibilityModeTab = useCallback((): VisibilityMode => {
    if (isVisibilityMode(currentTab)) return currentTab;
    if (typeof window === "undefined") return "visibility";
    return (
      asVisibilityMode(
        window.localStorage.getItem(visibilityModeStorageKey(params.id)),
      ) ?? "visibility"
    );
  }, [currentTab, params.id]);

  const resolveWorkspaceTab = useCallback(
    (workspace: ProjectTabGroup): ProjectTab => {
      if (projectTabGroup(currentTab) === workspace) return currentTab;
      if (typeof window === "undefined") return GROUP_DEFAULT_TABS[workspace];

      const stored = parseWorkspaceStoredTab(
        window.localStorage.getItem(
          workspaceLastTabStorageKey(params.id, workspace),
        ),
        workspace,
      );
      return stored ?? GROUP_DEFAULT_TABS[workspace];
    },
    [currentTab, params.id],
  );

  const setProjectTab = useCallback(
    (tab: ProjectTab, mode: "push" | "replace" = "push") => {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("tab", tab);
      const url = `/dashboard/projects/${params.id}?${newParams.toString()}`;
      if (mode === "replace") {
        router.replace(url);
        return;
      }
      router.push(url);
    },
    [params.id, router, searchParams],
  );

  const handleTabChange = useCallback(
    (tab: ProjectTab) => {
      if (tab === "visibility") {
        setProjectTab(resolveVisibilityModeTab());
        return;
      }

      setProjectTab(tab);
    },
    [resolveVisibilityModeTab, setProjectTab],
  );

  const handleVisibilityModeChange = useCallback(
    (mode: VisibilityMode) => {
      setProjectTab(mode);
    },
    [setProjectTab],
  );

  const handleWorkspaceChange = useCallback(
    (workspace: ProjectTabGroup) => {
      setProjectTab(resolveWorkspaceTab(workspace));
    },
    [resolveWorkspaceTab, setProjectTab],
  );

  const setConfigureSection = useCallback(
    (section: ConfigureSection, mode: "push" | "replace" = "replace") => {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("configure", section);
      const url = `/dashboard/projects/${params.id}?${nextParams.toString()}`;
      if (mode === "push") {
        router.push(url);
        return;
      }
      router.replace(url);
    },
    [params.id, router, searchParams],
  );

  const { withAuth } = useApi();
  const [startingCrawl, setStartingCrawl] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useProject(params.id);

  useEffect(() => {
    if (!project) return;
    saveLastProjectContext({
      projectId: project.id,
      tab: currentTab,
      projectName: project.name,
      domain: project.domain,
    });
  }, [currentTab, project]);

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
  const issueCount = issuesData?.data?.length ?? 0;
  const hasIssueBacklog = issueCount > 0;
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

  const openAutomationDefaults = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", "settings");
    nextParams.set("configure", "crawl-defaults");
    router.push(`/dashboard/projects/${params.id}?${nextParams.toString()}`);
  }, [params.id, router, searchParams]);

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
      title: hasIssueBacklog
        ? `Issue backlog ready (${issueCount})`
        : "Review issue backlog",
      description: hasIssueBacklog
        ? "Prioritize high-impact fixes and convert them into action items."
        : "No issues detected yet. Re-run after major site updates.",
      done: hasIssueBacklog,
      ctaLabel: "Open issues",
      action: () => setProjectTab("issues"),
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
                    onClick={() => handleWorkspaceChange(workspace)}
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

          {/* Banners */}
          <AlertBanner projectId={project.id} />

          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">First 7 days plan</CardTitle>
              <CardDescription>
                Operational checklist for faster adoption. Complete the first
                milestones, then switch to recurring optimization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {orderedFirstSevenDaysSteps.map((step) => (
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

          {/* Tab content */}
          {currentTab === "actions" && (
            <div className="space-y-6">
              <TrialBanner />
              <PostCrawlChecklist projectId={project.id} />
              <ProjectRecommendationsCard projectId={project.id} />
            </div>
          )}

          {currentTab === "overview" && (
            <TabErrorBoundary>
              <OverviewTab
                latestCrawl={project.latestCrawl}
                issues={issuesData?.data ?? []}
                projectId={project.id}
                onStartCrawl={handleStartCrawl}
                startingCrawl={startingCrawl}
              />
            </TabErrorBoundary>
          )}

          {currentTab === "pages" && (
            <TabErrorBoundary>
              <PagesTab pages={pagesData?.data ?? []} projectId={project.id} />
            </TabErrorBoundary>
          )}

          {currentTab === "issues" && (
            <TabErrorBoundary>
              <IssuesTab
                issues={issuesData?.data ?? []}
                crawlId={selectedCrawlId}
                projectId={project?.id}
              />
            </TabErrorBoundary>
          )}

          {currentTab === "history" && (
            <TabErrorBoundary>
              <HistoryTab crawlHistory={crawlHistoryData?.data ?? []} />
            </TabErrorBoundary>
          )}

          {currentTab === "strategy" && (
            <TabErrorBoundary>
              <StrategyTab projectId={project.id} />
            </TabErrorBoundary>
          )}

          {currentTab === "competitors" && (
            <CompetitorsTab projectId={project.id} />
          )}

          {/* Visibility workspace (visibility, ai-visibility, ai-analysis tabs) */}
          {isVisibilityMode(currentTab) && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Visibility workspace
                  </CardTitle>
                  <CardDescription>
                    Use one workflow for monitoring search performance, AI
                    presence, and analysis insights.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleVisibilityModeChange("visibility")}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        visibilityMode === "visibility"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      Search Visibility
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleVisibilityModeChange("ai-visibility")
                      }
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        visibilityMode === "ai-visibility"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      AI Visibility
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVisibilityModeChange("ai-analysis")}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        visibilityMode === "ai-analysis"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      AI Analysis
                    </button>
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
                      onClick={() =>
                        handleVisibilityGuidanceAction(
                          visibilityNextStep.action,
                        )
                      }
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
                            isActiveMode
                              ? "border-primary bg-primary/5"
                              : "border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              {modeGuide.label}
                            </p>
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
                                handleVisibilityGuidanceAction("run-crawl");
                                return;
                              }
                              handleVisibilityModeChange(mode);
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

              {visibilityMode === "visibility" && (
                <VisibilityTab
                  projectId={project.id}
                  domain={project.domain}
                  latestCrawlId={latestCrawlId}
                />
              )}

              {visibilityMode === "ai-visibility" && (
                <TabErrorBoundary>
                  <AIVisibilityTab
                    projectId={project.id}
                    domain={project.domain}
                  />
                </TabErrorBoundary>
              )}

              {visibilityMode === "ai-analysis" && (
                <TabErrorBoundary>
                  <AiAnalysisTab crawlJobId={selectedCrawlId} />
                </TabErrorBoundary>
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
            <TabErrorBoundary>
              <AutomationTab projectId={project.id} />
            </TabErrorBoundary>
          )}

          {currentTab === "logs" && (
            <TabErrorBoundary>
              <LogsTab projectId={project.id} />
            </TabErrorBoundary>
          )}

          {currentTab === "settings" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Configure workspace
                  </CardTitle>
                  <CardDescription>
                    Choose a task to configure. Each area is focused so setup is
                    faster and easier to review.
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
                        onClick={() => setConfigureSection(section)}
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
