"use client";

import React, { useCallback, useState } from "react";
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
  AlertTriangle,
  Radar,
  User,
  Key,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiSWR } from "@/lib/use-api-swr";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import { useProject } from "@/hooks/use-project";
import { useCrawlHistory } from "@/hooks/use-crawl";
import { OverviewTab } from "@/components/tabs/overview-tab";
import { BrandingSettingsForm } from "@/components/forms/branding-settings-form";
import { CrawlSettingsForm } from "@/components/forms/crawl-settings-form";
import { ScoringProfileSection } from "@/components/settings/scoring-profile-section";
import { SiteContextSection } from "@/components/settings/site-context-section";
import { PostCrawlChecklist } from "@/components/post-crawl-checklist";

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
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">
            Something went wrong loading this tab.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </Button>
        </div>
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

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentTab = searchParams.get("tab") ?? "overview";

  const handleTabChange = useCallback(
    (value: string) => {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("tab", value);
      router.push(`/dashboard/projects/${params.id}?${newParams.toString()}`);
    },
    [router, searchParams, params.id],
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
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Project not found.</p>
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
          Back to Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {project.domain}
            </p>
          </div>
          <Button onClick={handleStartCrawl} disabled={startingCrawl}>
            <Play className="h-4 w-4" />
            {startingCrawl ? "Starting..." : "Run Crawl"}
          </Button>
        </div>
        {crawlError && (
          <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {crawlError}
          </div>
        )}
      </div>

      {/* Onboarding Checklist */}
      <PostCrawlChecklist projectId={project.id} />

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={handleTabChange}>
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
          <TabsTrigger value="strategy">
            <Compass className="mr-1.5 h-4 w-4" />
            Strategy
          </TabsTrigger>
          <TabsTrigger value="competitors">
            <Trophy className="mr-1.5 h-4 w-4" />
            Competitors
          </TabsTrigger>
          <TabsTrigger value="ai-visibility">
            <Radar className="mr-1.5 h-4 w-4" />
            AI Visibility
          </TabsTrigger>
          <TabsTrigger value="ai-analysis">
            <Brain className="mr-1.5 h-4 w-4" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="visibility">
            <Eye className="mr-1.5 h-4 w-4" />
            Visibility
          </TabsTrigger>
          <TabsTrigger value="personas" className="gap-1.5">
            <User className="h-4 w-4" />
            Personas
          </TabsTrigger>
          <TabsTrigger value="keywords" className="gap-1.5">
            <Key className="h-4 w-4" />
            Keywords
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Plug className="mr-1.5 h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="reports">
            <Download className="mr-1.5 h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-1.5 h-4 w-4" />
            Settings
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
            <PagesTab pages={pagesData?.data ?? []} />
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

        <TabsContent value="strategy" className="pt-4">
          <TabErrorBoundary>
            <StrategyTab projectId={project.id} />
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="competitors" className="space-y-6 pt-4">
          <CompetitorsTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="ai-visibility" className="space-y-6 pt-4">
          <TabErrorBoundary>
            <AIVisibilityTab projectId={project.id} domain={project.domain} />
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="ai-analysis" className="space-y-6 pt-4">
          <TabErrorBoundary>
            <AiAnalysisTab
              crawlJobId={searchParams.get("crawlId") ?? latestCrawlId}
            />
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="visibility" className="space-y-6 pt-4">
          <VisibilityTab
            projectId={project.id}
            domain={project.domain}
            latestCrawlId={latestCrawlId}
          />
        </TabsContent>

        <TabsContent value="personas" className="mt-6">
          <PersonasTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="keywords" className="mt-6">
          <KeywordsTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6 pt-4">
          <IntegrationsTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6 pt-4">
          <ReportsTab projectId={params.id} crawlJobId={latestCrawlId} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 pt-4">
          <SiteContextSection projectId={project.id} />
          <CrawlSettingsForm
            projectId={project.id}
            initialSettings={project.settings}
          />
          <BrandingSettingsForm
            projectId={project.id}
            initialBranding={project.branding}
          />
          <ScoringProfileSection projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
