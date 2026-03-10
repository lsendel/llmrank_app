"use client";

import { useCallback } from "react";
import { api } from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import { buildPlatformGuideModel } from "./platform-guide-helpers";
import {
  PlatformGuideDocumentationLink,
  PlatformGuideEmptyStateCard,
  PlatformGuideFailureSection,
  PlatformGuideHeader,
  PlatformGuideLoadingCard,
  PlatformGuidePassingSection,
  PlatformGuideProgressSummary,
  PlatformGuideTipsSection,
} from "./platform-guide-sections";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PlatformGuideProps {
  projectId: string;
  platform: string;
  crawlId?: string;
}

export function PlatformGuide({
  projectId,
  platform,
  crawlId,
}: PlatformGuideProps) {
  const { data: allPlatforms, isLoading } = useApiSWR(
    crawlId ? `platform-readiness-${crawlId}` : null,
    useCallback(() => api.platformReadiness.get(crawlId!), [crawlId]),
  );

  const guide = buildPlatformGuideModel(platform, allPlatforms);

  return (
    <div className="space-y-6">
      <PlatformGuideHeader
        platformIcon={guide.platformIcon}
        displayName={guide.displayName}
        description={guide.description}
        score={guide.readiness?.score}
        grade={guide.readiness?.grade}
        scoreToneClass={guide.scoreToneClass}
      />

      {guide.readiness && (
        <PlatformGuideProgressSummary
          passCount={guide.passCount}
          totalCount={guide.totalCount}
          passRate={guide.passRate}
          criticalFailsCount={guide.criticalFails.length}
          importantFailsCount={guide.importantFails.length}
          recommendedFailsCount={guide.recommendedFails.length}
          passingCount={guide.passing.length}
        />
      )}

      {isLoading && <PlatformGuideLoadingCard />}

      {!crawlId && !isLoading && (
        <PlatformGuideEmptyStateCard
          displayName={guide.displayName}
          projectId={projectId}
        />
      )}

      <PlatformGuideFailureSection
        title="Critical Issues"
        tone="critical"
        checks={guide.criticalFails}
      />
      <PlatformGuideFailureSection
        title="Important Improvements"
        tone="important"
        checks={guide.importantFails}
      />
      <PlatformGuideFailureSection
        title="Recommended Improvements"
        tone="recommended"
        checks={guide.recommendedFails}
      />
      <PlatformGuidePassingSection checks={guide.passing} />
      <PlatformGuideTipsSection
        displayName={guide.displayName}
        tips={guide.readiness?.tips ?? []}
      />
      <PlatformGuideDocumentationLink
        displayName={guide.displayName}
        docUrl={guide.docUrl}
      />
    </div>
  );
}
