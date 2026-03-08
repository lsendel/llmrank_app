import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StrategyCompetitor, StrategyPersona } from "@/lib/api";
import {
  CompetitorTrackingSection,
  DemandModelFlowSection,
  PersonaDiscoverySection,
} from "./strategy-tab-sections";

describe("strategy-tab-sections", () => {
  it("renders demand flow controls, suggestions, and competitor recommendations", () => {
    const onDiscoverKeywords = vi.fn();
    const onAcceptKeywords = vi.fn();
    const onAcceptRecommendedCompetitors = vi.fn();
    const onRunDemandFlow = vi.fn();
    const onToggleSuggestion = vi.fn();

    render(
      <DemandModelFlowSection
        persistedPersonaCount={3}
        savedKeywordCount={5}
        competitorCount={2}
        visibilityScheduleCount={1}
        discoveringKeywords={false}
        acceptingKeywords={false}
        addingRecommendedCompetitors={false}
        runningDemandFlow={false}
        keywordSuggestions={["alpha", "beta"]}
        selectedSuggestions={["alpha"]}
        recommendedCompetitorDomains={["example.com"]}
        onDiscoverKeywords={onDiscoverKeywords}
        onAcceptKeywords={onAcceptKeywords}
        onAcceptRecommendedCompetitors={onAcceptRecommendedCompetitors}
        onRunDemandFlow={onRunDemandFlow}
        onToggleSuggestion={onToggleSuggestion}
      />,
    );

    expect(screen.getByText("Demand Model Flow")).toBeInTheDocument();
    expect(
      screen.getByText("Suggested Keywords (deduped against existing list)"),
    ).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Suggest Keywords"));
    fireEvent.click(screen.getByText("Accept All Recommended"));
    fireEvent.click(screen.getByText("Add Recommended Competitors"));
    fireEvent.click(screen.getByText("Run Guided Setup"));
    fireEvent.click(screen.getByText("beta"));

    expect(onDiscoverKeywords).toHaveBeenCalledTimes(1);
    expect(onAcceptKeywords).toHaveBeenCalledTimes(1);
    expect(onAcceptRecommendedCompetitors).toHaveBeenCalledTimes(1);
    expect(onRunDemandFlow).toHaveBeenCalledTimes(1);
    expect(onToggleSuggestion).toHaveBeenCalledWith("beta");
  });

  it("renders competitor tracking empty state and add/remove actions", () => {
    const onNewCompDomainChange = vi.fn();
    const onAddCompetitor = vi.fn();
    const onRemoveCompetitor = vi.fn();

    const competitors = [
      {
        id: "comp-1",
        projectId: "proj-1",
        domain: "competitor.com",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ] satisfies StrategyCompetitor[];

    const { rerender } = render(
      <CompetitorTrackingSection
        competitors={[]}
        newCompDomain=""
        addingComp={false}
        onNewCompDomainChange={onNewCompDomainChange}
        onAddCompetitor={onAddCompetitor}
        onRemoveCompetitor={onRemoveCompetitor}
      />,
    );

    expect(screen.getByText("No competitors added yet")).toBeInTheDocument();

    rerender(
      <CompetitorTrackingSection
        competitors={competitors}
        newCompDomain="new.com"
        addingComp={false}
        onNewCompDomainChange={onNewCompDomainChange}
        onAddCompetitor={onAddCompetitor}
        onRemoveCompetitor={onRemoveCompetitor}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("competitor.com"), {
      target: { value: "updated.com" },
    });
    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getAllByRole("button")[1]);

    expect(screen.getByText("competitor.com")).toBeInTheDocument();
    expect(onNewCompDomainChange).toHaveBeenCalledWith("updated.com");
    expect(onAddCompetitor).toHaveBeenCalledTimes(1);
    expect(onRemoveCompetitor).toHaveBeenCalledWith("comp-1");
  });

  it("renders persona discovery empty and populated states", () => {
    const onGeneratePersonas = vi.fn();
    const personas = [
      {
        name: "Ops Leader",
        role: "Director",
        demographics: "B2B SaaS",
        goals: ["Improve AI visibility"],
        pains: ["Limited resources"],
        keywords: ["ai seo"],
        typicalQueries: ["best ai seo tools"],
      },
    ] satisfies StrategyPersona[];

    const { rerender } = render(
      <PersonaDiscoverySection
        personas={[]}
        generating={false}
        onGeneratePersonas={onGeneratePersonas}
      />,
    );

    fireEvent.click(screen.getByText("Discover Personas"));
    expect(onGeneratePersonas).toHaveBeenCalledTimes(1);

    rerender(
      <PersonaDiscoverySection
        personas={personas}
        generating={false}
        onGeneratePersonas={onGeneratePersonas}
      />,
    );

    expect(screen.getByText("Ops Leader")).toBeInTheDocument();
    expect(screen.getByText("Director")).toBeInTheDocument();
    expect(screen.getByText("Improve AI visibility")).toBeInTheDocument();
    expect(screen.getByText("best ai seo tools")).toBeInTheDocument();
    expect(screen.getByText("Regenerate")).toBeInTheDocument();
  });
});
