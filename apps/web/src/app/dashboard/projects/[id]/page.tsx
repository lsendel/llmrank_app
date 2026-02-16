"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiSWR } from "@/lib/use-api-swr";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import { OverviewTab } from "@/components/tabs/overview-tab";
import { PagesTab } from "@/components/tabs/pages-tab";
import { IssuesTab } from "@/components/tabs/issues-tab";
import { HistoryTab } from "@/components/tabs/history-tab";
import { StrategyTab } from "@/components/tabs/strategy-tab";
import { BrandingSettingsForm } from "@/components/forms/branding-settings-form";

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

const CompetitorsTab = dynamic(
  () =>
    import("@/components/tabs/competitors-tab").then((mod) => ({
      default: mod.CompetitorsTab,
    })),
  {
    loading: () => <TabLoadingSkeleton />,
  },
);

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { withAuth } = useApi();
  const [startingCrawl, setStartingCrawl] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useApiSWR(
    `project-${params.id}`,
    useCallback(() => api.projects.get(params.id), [params.id]),
  );

  const latestCrawlId = project?.latestCrawl?.id;

  const { data: crawlHistoryData } = useApiSWR(
    `crawl-history-${params.id}`,
    useCallback(() => api.crawls.list(params.id), [params.id]),
  );

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

      {/* Tabs */}
      <Tabs defaultValue="overview">
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
          <TabsTrigger value="visibility">
            <Eye className="mr-1.5 h-4 w-4" />
            Visibility
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
          <OverviewTab
            latestCrawl={project.latestCrawl}
            issues={issuesData?.data ?? []}
            projectId={project.id}
          />
        </TabsContent>

        <TabsContent value="pages" className="pt-4">
          <PagesTab pages={pagesData?.data ?? []} />
        </TabsContent>

        <TabsContent value="issues" className="pt-4">
          <IssuesTab
            issues={issuesData?.data ?? []}
            crawlId={latestCrawlId}
            projectId={project?.id}
          />
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <HistoryTab crawlHistory={crawlHistoryData?.data ?? []} />
        </TabsContent>

        <TabsContent value="strategy" className="pt-4">
          <StrategyTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="competitors" className="space-y-6 pt-4">
          <CompetitorsTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="visibility" className="space-y-6 pt-4">
          <VisibilityTab
            projectId={project.id}
            domain={project.domain}
            latestCrawlId={latestCrawlId}
          />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6 pt-4">
          <IntegrationsTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6 pt-4">
          <ReportsTab projectId={params.id} crawlJobId={latestCrawlId} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 pt-4">
          <BrandingSettingsForm
            projectId={project.id}
            initialBranding={project.branding as any}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
