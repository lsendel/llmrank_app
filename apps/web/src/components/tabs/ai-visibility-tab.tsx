"use client";

import {
  AIVisibilityBacklinksAndDiscoverySection,
  AIVisibilityFreshnessSummary,
  AIVisibilityGapsSection,
  AIVisibilityKeywordPerformanceSection,
  AIVisibilitySummaryCards,
} from "./ai-visibility-tab-sections";
import { useAIVisibilityTabActions } from "./use-ai-visibility-tab-actions";
import { useAIVisibilityTabData } from "./use-ai-visibility-tab-data";

export default function AIVisibilityTab({
  projectId,
}: {
  projectId: string;
  domain: string;
}) {
  const {
    score,
    scoreLoading,
    checks,
    gaps,
    blSummary,
    blLoading,
    llmChecks,
    aiModeChecks,
    llmMentionRate,
    aiModeRate,
    keywordRows,
    visibilityMeta,
    llmProviderSummary,
    llmProviderCount,
  } = useAIVisibilityTabData({ projectId });
  const {
    discovering,
    trackingGaps,
    discoveryResult,
    handleDiscover,
    handleTrackGapsAsKeywords,
  } = useAIVisibilityTabActions({ projectId, gaps });

  return (
    <div className="space-y-6">
      <AIVisibilityFreshnessSummary
        checks={checks}
        visibilityMeta={visibilityMeta}
      />
      <AIVisibilitySummaryCards
        score={score}
        scoreLoading={scoreLoading}
        llmMentionRate={llmMentionRate}
        llmChecks={llmChecks}
        llmProviderCount={llmProviderCount}
        llmProviderSummary={llmProviderSummary}
        aiModeRate={aiModeRate}
        aiModeChecks={aiModeChecks}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <AIVisibilityKeywordPerformanceSection keywordRows={keywordRows} />
        <AIVisibilityGapsSection
          gaps={gaps}
          trackingGaps={trackingGaps}
          onTrackGapsAsKeywords={handleTrackGapsAsKeywords}
        />
      </div>
      <AIVisibilityBacklinksAndDiscoverySection
        blSummary={blSummary}
        blLoading={blLoading}
        discovering={discovering}
        discoveryResult={discoveryResult}
        onDiscover={handleDiscover}
      />
    </div>
  );
}
