"use client";

import { TopicClusterGraph } from "../strategy/topic-cluster-graph";
import { CrawlerTimelineChart } from "@/components/charts/crawler-timeline-chart";
import {
  CompetitorTrackingSection,
  DemandModelFlowSection,
  PersonaDiscoverySection,
} from "./strategy-tab-sections";
import { useStrategyTabActions } from "./use-strategy-tab-actions";
import { useStrategyTabData } from "./use-strategy-tab-data";

export function StrategyTab({ projectId }: { projectId: string }) {
  const {
    topicMap,
    competitors,
    addCompetitor,
    removeCompetitor,
    personas,
    generating,
    personaError,
    generatePersonas,
    persistedPersonas,
    savedKeywords,
    visibilitySchedules,
    recommendedCompetitorDomains,
    mutatePersistedPersonas,
    mutateSavedKeywords,
    mutateVisibilitySchedules,
  } = useStrategyTabData(projectId);

  const {
    addingComp,
    newCompDomain,
    setNewCompDomain,
    keywordSuggestions,
    selectedSuggestions,
    discoveringKeywords,
    acceptingKeywords,
    addingRecommendedCompetitors,
    runningDemandFlow,
    handleGeneratePersonas,
    handleDiscoverKeywordSuggestions,
    handleAcceptSuggestedKeywords,
    handleAcceptRecommendedCompetitors,
    handleRunDemandFlow,
    handleToggleSuggestion,
    handleAddCompetitor,
    handleRemoveCompetitor,
  } = useStrategyTabActions({
    projectId,
    personaError,
    persistedPersonas,
    savedKeywords,
    visibilitySchedules,
    recommendedCompetitorDomains,
    generatePersonas,
    addCompetitor,
    removeCompetitor,
    mutatePersistedPersonas,
    mutateSavedKeywords,
    mutateVisibilitySchedules,
  });

  return (
    <div className="space-y-8">
      {/* AI Crawler Timeline */}
      <CrawlerTimelineChart projectId={projectId} />

      {/* Topic Cluster Map */}
      {topicMap && <TopicClusterGraph data={topicMap} />}

      <DemandModelFlowSection
        persistedPersonaCount={persistedPersonas?.length ?? 0}
        savedKeywordCount={savedKeywords?.length ?? 0}
        competitorCount={competitors?.length ?? 0}
        visibilityScheduleCount={visibilitySchedules?.length ?? 0}
        discoveringKeywords={discoveringKeywords}
        acceptingKeywords={acceptingKeywords}
        addingRecommendedCompetitors={addingRecommendedCompetitors}
        runningDemandFlow={runningDemandFlow}
        keywordSuggestions={keywordSuggestions}
        selectedSuggestions={selectedSuggestions}
        recommendedCompetitorDomains={recommendedCompetitorDomains}
        onDiscoverKeywords={() => void handleDiscoverKeywordSuggestions()}
        onAcceptKeywords={() => void handleAcceptSuggestedKeywords()}
        onAcceptRecommendedCompetitors={() =>
          void handleAcceptRecommendedCompetitors()
        }
        onRunDemandFlow={() => void handleRunDemandFlow()}
        onToggleSuggestion={handleToggleSuggestion}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Competitor Tracking */}
        <div className="space-y-6">
          <CompetitorTrackingSection
            competitors={competitors}
            newCompDomain={newCompDomain}
            addingComp={addingComp}
            onNewCompDomainChange={setNewCompDomain}
            onAddCompetitor={() => void handleAddCompetitor()}
            onRemoveCompetitor={(id) => void handleRemoveCompetitor(id)}
          />
        </div>

        {/* Persona Finder */}
        <div className="space-y-6">
          <PersonaDiscoverySection
            personas={personas}
            generating={generating}
            onGeneratePersonas={() => void handleGeneratePersonas()}
          />
        </div>
      </div>
    </div>
  );
}
