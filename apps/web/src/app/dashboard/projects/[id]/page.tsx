"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Play,
  BarChart3,
  FileText,
  Bug,
  History,
  Eye,
  Plug,
  Compass,
  Trophy,
  Settings,
  Download,
  Radar,
  User,
  Key,
  Bot,
  Globe,
  Route,
  Palette,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { WORKFLOW_TONE_COPY } from "@/lib/microcopy";
import {
  GROUP_DEFAULT_TABS,
  normalizeProjectTab,
  projectTabGroup,
  type ProjectTab,
  type ProjectTabGroup,
} from "./tab-state";
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

function asVisibilityMode(tab: ProjectTab): VisibilityMode | null {
  return (VISIBILITY_MODES as readonly string[]).includes(tab)
    ? (tab as VisibilityMode)
    : null;
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
  const connectProvider = asIntegrationProvider(searchParams.get("connect"));
  const connectedProvider = asIntegrationProvider(
    searchParams.get("connected"),
  );
  const currentTab = normalizeProjectTab(rawTab);
  const currentGroup = projectTabGroup(currentTab);
  const visibilityMode = asVisibilityMode(currentTab) ?? "visibility";
  const currentGrowTab = asVisibilityMode(currentTab)
    ? "visibility"
    : currentTab;
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

  const handleProjectTabChange = useCallback(
    (value: string) => {
      const safeTab = normalizeProjectTab(value);
      setProjectTab(safeTab);
    },
    [setProjectTab],
  );

  const handleGroupChange = useCallback(
    (value: string) => {
      const group = value as ProjectTabGroup;
      if (!(group in GROUP_DEFAULT_TABS)) return;
      setProjectTab(GROUP_DEFAULT_TABS[group]);
    },
    [setProjectTab],
  );

  const handleVisibilityModeChange = useCallback(
    (mode: VisibilityMode) => {
      setProjectTab(mode);
    },
    [setProjectTab],
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

  const latestCrawlId = project?.latestCrawl?.id;

  const { data: crawlHistoryData } = useCrawlHistory(params.id);

  const { data: pagesData } = useApiSWR(
    latestCrawlId ? `pages-${latestCrawlId}` : null,
    useCallback(() => api.pages.list(latestCrawlId!), [latestCrawlId]),
  );

  const { data: issuesData } = useApiSWR(
    latestCrawlId ? `issues-${latestCrawlId}` : null,
    useCallback(() => api.issues.listForCrawl(latestCrawlId!), [latestCrawlId]),
  );

  async function handleStartCrawl() {
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
  }

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
    <div className="space-y-8">
      {/* Back + header */}
      <div>
        <Link
          href="/dashboard/projects"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {normalizeDomain(project.domain)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {WORKFLOW_TONE_COPY.projectWorkspaceSummary}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <UsageMeter />
            <Button onClick={handleStartCrawl} disabled={startingCrawl}>
              <Play className="h-4 w-4" />
              {startingCrawl ? "Starting..." : "Run crawl now"}
            </Button>
          </div>
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

      {/* Score change alerts */}
      <AlertBanner projectId={project.id} />

      {/* Pro trial banner */}
      <TrialBanner />

      {/* Onboarding Checklist */}
      <PostCrawlChecklist projectId={project.id} />

      {/* Next best actions */}
      <ProjectRecommendationsCard projectId={project.id} />

      {/* Tabs */}
      <Tabs value={currentGroup} onValueChange={handleGroupChange}>
        <TabsList>
          <TabsTrigger value="analyze">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            Analyze
          </TabsTrigger>
          <TabsTrigger value="grow-visibility">
            <Radar className="mr-1.5 h-4 w-4" />
            Grow Visibility
          </TabsTrigger>
          <TabsTrigger value="automate-operate">
            <Play className="mr-1.5 h-4 w-4" />
            Automate & Operate
          </TabsTrigger>
          <TabsTrigger value="configure">
            <Settings className="mr-1.5 h-4 w-4" />
            Configure
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-4 pt-4">
          <Tabs value={currentTab} onValueChange={handleProjectTabChange}>
            <TabsList>
              <TabsTrigger value="overview">
                <BarChart3 className="mr-1.5 h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="pages">
                <FileText className="mr-1.5 h-4 w-4" />
                Pages
              </TabsTrigger>
              <TabsTrigger value="issues">
                <Bug className="mr-1.5 h-4 w-4" />
                Issues
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="mr-1.5 h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 pt-4">
              <TabErrorBoundary>
                <OverviewTab
                  latestCrawl={project.latestCrawl}
                  issues={issuesData?.data ?? []}
                  projectId={project.id}
                />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="pages" className="pt-4">
              <TabErrorBoundary>
                <PagesTab
                  pages={pagesData?.data ?? []}
                  projectId={project.id}
                />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="issues" className="pt-4">
              <TabErrorBoundary>
                <IssuesTab
                  issues={issuesData?.data ?? []}
                  crawlId={latestCrawlId}
                  projectId={project?.id}
                />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              <TabErrorBoundary>
                <HistoryTab crawlHistory={crawlHistoryData?.data ?? []} />
              </TabErrorBoundary>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="grow-visibility" className="space-y-4 pt-4">
          <Tabs value={currentGrowTab} onValueChange={handleProjectTabChange}>
            <TabsList>
              <TabsTrigger value="visibility">
                <Eye className="mr-1.5 h-4 w-4" />
                Visibility Workspace
              </TabsTrigger>
              <TabsTrigger value="strategy">
                <Compass className="mr-1.5 h-4 w-4" />
                Strategy
              </TabsTrigger>
              <TabsTrigger value="competitors">
                <Trophy className="mr-1.5 h-4 w-4" />
                Competitors
              </TabsTrigger>
              <TabsTrigger value="personas" className="gap-1.5">
                <User className="h-4 w-4" />
                Personas
              </TabsTrigger>
              <TabsTrigger value="keywords" className="gap-1.5">
                <Key className="h-4 w-4" />
                Keywords
              </TabsTrigger>
            </TabsList>

            <TabsContent value="strategy" className="pt-4">
              <TabErrorBoundary>
                <StrategyTab projectId={project.id} />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="competitors" className="space-y-6 pt-4">
              <CompetitorsTab projectId={project.id} />
            </TabsContent>

            <TabsContent value="visibility" className="space-y-6 pt-4">
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
                <CardContent className="flex flex-wrap gap-2">
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
                    onClick={() => handleVisibilityModeChange("ai-visibility")}
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
                  <AiAnalysisTab
                    crawlJobId={searchParams.get("crawlId") ?? latestCrawlId}
                  />
                </TabErrorBoundary>
              )}
            </TabsContent>

            <TabsContent value="personas" className="mt-6">
              <PersonasTab projectId={project.id} />
            </TabsContent>

            <TabsContent value="keywords" className="mt-6">
              <KeywordsTab projectId={project.id} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="automate-operate" className="space-y-4 pt-4">
          <Tabs value={currentTab} onValueChange={handleProjectTabChange}>
            <TabsList>
              <TabsTrigger value="automation">
                <Play className="mr-1.5 h-4 w-4" />
                Automation
              </TabsTrigger>
              <TabsTrigger value="integrations">
                <Plug className="mr-1.5 h-4 w-4" />
                Integrations
              </TabsTrigger>
              <TabsTrigger value="reports">
                <Download className="mr-1.5 h-4 w-4" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="logs">
                <Bot className="mr-1.5 h-4 w-4" />
                Logs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="integrations" className="space-y-6 pt-4">
              <IntegrationsTab
                projectId={project.id}
                connectProvider={connectProvider}
                connectedProvider={connectedProvider}
              />
            </TabsContent>

            <TabsContent value="reports" className="space-y-6 pt-4">
              <ReportsTab projectId={params.id} crawlJobId={latestCrawlId} />
            </TabsContent>

            <TabsContent value="automation" className="space-y-6 pt-4">
              <TabErrorBoundary>
                <AutomationTab projectId={project.id} />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="logs" className="space-y-6 pt-4">
              <TabErrorBoundary>
                <LogsTab projectId={project.id} />
              </TabErrorBoundary>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="configure" className="space-y-6 pt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configure workspace</CardTitle>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
