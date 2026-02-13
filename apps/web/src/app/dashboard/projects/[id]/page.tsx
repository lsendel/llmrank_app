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

const VisibilityTab = dynamic(
  () => import("@/components/tabs/visibility-tab"),
  {
    loading: () => (
      <div className="py-8 text-center text-muted-foreground">
        Loading visibility data...
      </div>
    ),
  },
);

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { withToken } = useApi();
  const [startingCrawl, setStartingCrawl] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useApiSWR(
    `project-${params.id}`,
    useCallback(
      (token: string) => api.projects.get(token, params.id),
      [params.id],
    ),
  );

  const latestCrawlId = project?.latestCrawl?.id;

  const { data: crawlHistoryData } = useApiSWR(
    `crawl-history-${params.id}`,
    useCallback(
      (token: string) => api.crawls.list(token, params.id),
      [params.id],
    ),
  );

  const { data: pagesData } = useApiSWR(
    latestCrawlId ? `pages-${latestCrawlId}` : null,
    useCallback(
      (token: string) => api.pages.list(token, latestCrawlId!),
      [latestCrawlId],
    ),
  );

  const { data: issuesData } = useApiSWR(
    latestCrawlId ? `issues-${latestCrawlId}` : null,
    useCallback(
      (token: string) => api.issues.listForCrawl(token, latestCrawlId!),
      [latestCrawlId],
    ),
  );

  async function handleStartCrawl() {
    setStartingCrawl(true);
    setCrawlError(null);
    try {
      await withToken(async (token) => {
        const crawlJob = await api.crawls.start(token, params.id);
        router.push(`/dashboard/crawl/${crawlJob.id}`);
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setCrawlError(err.message);
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
          <TabsTrigger value="visibility">
            <Eye className="mr-1.5 h-4 w-4" />
            Visibility
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
          <IssuesTab issues={issuesData?.data ?? []} />
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <HistoryTab crawlHistory={crawlHistoryData?.data ?? []} />
        </TabsContent>

        <TabsContent value="visibility" className="space-y-6 pt-4">
          <VisibilityTab
            projectId={project.id}
            domain={project.domain}
            latestCrawlId={latestCrawlId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
