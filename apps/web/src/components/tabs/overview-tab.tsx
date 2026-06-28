"use client";

import { IntegrationPromptBanner } from "@/components/integration-prompt-banner";
import { type CrawlJob, type PageIssue } from "@/lib/api";
import type { OverviewActiveCrawl } from "./overview-tab-helpers";
import {
  OverviewExecutiveSummary,
  OverviewFreshnessSummary,
  OverviewHeroSection,
  OverviewStatusStateCard,
  OverviewSupportingSections,
  OverviewToolbar,
  OverviewTopIssuesSection,
} from "./overview-tab-sections";
import { useOverviewTabActions } from "./use-overview-tab-actions";
import { useOverviewTabData } from "./use-overview-tab-data";

export function OverviewTab({
  latestCrawl,
  issues,
  projectId,
  onStartCrawl,
  startingCrawl,
  activeCrawl,
}: {
  latestCrawl: CrawlJob | null | undefined;
  issues: PageIssue[];
  projectId: string;
  onStartCrawl?: () => void;
  startingCrawl?: boolean;
  activeCrawl?: OverviewActiveCrawl | null;
}) {
  const { handleExportCsv, handleExportJson } = useOverviewTabActions({
    projectId,
  });
  const {
    crawlId,
    insights,
    progress,
    hasScores,
    pagesSampled,
    crawlTimestamp,
    dataConfidence,
    statusState,
  } = useOverviewTabData({ latestCrawl, projectId });
  const activeCrawlState =
    activeCrawl?.id && activeCrawl.id !== latestCrawl?.id
      ? ({ kind: "loading", crawlId: activeCrawl.id } as const)
      : null;

  if (!hasScores && (activeCrawlState || statusState)) {
    return (
      <OverviewStatusStateCard state={(activeCrawlState ?? statusState)!} />
    );
  }

  if (!latestCrawl) {
    return <OverviewStatusStateCard state={{ kind: "empty" }} />;
  }

  return (
    <>
      <OverviewToolbar
        projectId={projectId}
        onStartCrawl={onStartCrawl}
        startingCrawl={startingCrawl}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
      />
      {activeCrawlState && <OverviewStatusStateCard state={activeCrawlState} />}
      <OverviewFreshnessSummary
        crawlTimestamp={crawlTimestamp}
        pagesSampled={pagesSampled}
        dataConfidence={dataConfidence}
        crawlId={crawlId}
      />
      <IntegrationPromptBanner projectId={projectId} />
      <OverviewHeroSection
        latestCrawl={latestCrawl}
        progress={progress}
        issues={issues}
      />
      <OverviewExecutiveSummary summary={latestCrawl.summary} />
      <OverviewSupportingSections
        latestCrawl={latestCrawl}
        projectId={projectId}
        insights={insights}
      />
      <OverviewTopIssuesSection issues={issues} projectId={projectId} />
    </>
  );
}
