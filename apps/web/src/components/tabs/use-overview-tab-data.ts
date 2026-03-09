import { useCallback, useMemo } from "react";
import {
  api,
  type CrawlInsights,
  type CrawlJob,
  type ProjectProgress,
} from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import { buildOverviewMeta } from "./overview-tab-helpers";

type UseOverviewTabDataArgs = {
  latestCrawl: CrawlJob | null | undefined;
  projectId: string;
};

export function useOverviewTabData({
  latestCrawl,
  projectId,
}: UseOverviewTabDataArgs) {
  const crawlId = latestCrawl?.id;

  const { data: insights } = useApiSWR<CrawlInsights>(
    crawlId ? `insights-${crawlId}` : null,
    useCallback(() => api.crawls.getInsights(crawlId!), [crawlId]),
  );

  const { data: progress } = useApiSWR<ProjectProgress | null>(
    `progress-${projectId}`,
    useCallback(() => api.projects.progress(projectId), [projectId]),
  );

  const overviewMeta = useMemo(
    () => buildOverviewMeta(latestCrawl),
    [latestCrawl],
  );

  return {
    crawlId,
    insights,
    progress,
    ...overviewMeta,
  };
}
