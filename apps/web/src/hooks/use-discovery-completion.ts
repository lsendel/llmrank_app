"use client";

import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiscoveryState {
  businessGoal: string | null;
  selectedPersonas: Array<{ label: string; role: string; custom: boolean }>;
  keywords: string[];
  selectedCompetitors: string[];
  isFree: boolean;
  crawlComplete: boolean;
}

export type CardStatus = "completed" | "active" | "pending" | "locked";

export interface DiscoveryCompletionResult {
  completedCount: number;
  totalCards: number;
  cardStatuses: Record<string, CardStatus>;
  isGoalsComplete: boolean;
  isPersonasComplete: boolean;
  isKeywordsComplete: boolean;
  isCompetitorsComplete: boolean;
}

// ---------------------------------------------------------------------------
// Card ordering — drives the sequential auto-advance logic
// ---------------------------------------------------------------------------

const CARD_IDS = ["goals", "personas", "keywords", "competitors"] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDiscoveryCompletion(
  state: DiscoveryState,
): DiscoveryCompletionResult {
  return useMemo(() => {
    const isGoalsComplete = state.businessGoal !== null;
    const isPersonasComplete = state.selectedPersonas.length > 0;
    const isKeywordsComplete = state.keywords.length > 0;

    // Competitors: auto-skipped (treated as complete) for free-tier users
    // since competitor features are Pro-gated.
    const isCompetitorsComplete =
      state.isFree || state.selectedCompetitors.length > 0;

    const completionByCard: Record<string, boolean> = {
      goals: isGoalsComplete,
      personas: isPersonasComplete,
      keywords: isKeywordsComplete,
      competitors: isCompetitorsComplete,
    };

    // Competitors is "locked" when crawl is still in progress AND no
    // competitors have been manually entered yet — we need crawl data to
    // generate AI suggestions.
    const isCompetitorsLocked =
      !state.crawlComplete && state.selectedCompetitors.length === 0;

    // Build statuses: cards auto-advance so the first incomplete card is
    // "active", everything before it is "completed", everything after is
    // "pending". Competitors override to "locked" when appropriate.
    const cardStatuses: Record<string, CardStatus> = {};
    let foundActive = false;

    for (const id of CARD_IDS) {
      if (id === "competitors" && isCompetitorsLocked && !state.isFree) {
        cardStatuses[id] = "locked";
        continue;
      }

      if (completionByCard[id]) {
        cardStatuses[id] = foundActive ? "pending" : "completed";
      } else if (!foundActive) {
        cardStatuses[id] = "active";
        foundActive = true;
      } else {
        cardStatuses[id] = "pending";
      }
    }

    const completedCount = CARD_IDS.filter(
      (id) => cardStatuses[id] === "completed",
    ).length;

    return {
      completedCount,
      totalCards: CARD_IDS.length,
      cardStatuses,
      isGoalsComplete,
      isPersonasComplete,
      isKeywordsComplete,
      isCompetitorsComplete,
    };
  }, [
    state.businessGoal,
    state.selectedPersonas.length,
    state.keywords.length,
    state.selectedCompetitors.length,
    state.isFree,
    state.crawlComplete,
  ]);
}
