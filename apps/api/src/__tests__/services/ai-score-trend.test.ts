import { describe, it, expect } from "vitest";
import {
  computeAIVisibilityScore,
  type AIVisibilityInput,
} from "@llm-boost/scoring";

describe("AI Visibility Score trend comparison", () => {
  it("computes delta between two periods", () => {
    const current: AIVisibilityInput = {
      llmMentionRate: 0.8,
      aiSearchPresenceRate: 0.6,
      shareOfVoice: 0.4,
      backlinkAuthoritySignal: 0.5,
    };
    const previous: AIVisibilityInput = {
      llmMentionRate: 0.6,
      aiSearchPresenceRate: 0.4,
      shareOfVoice: 0.3,
      backlinkAuthoritySignal: 0.5,
    };

    const currentScore = computeAIVisibilityScore(current);
    const previousScore = computeAIVisibilityScore(previous);
    const delta = currentScore.overall - previousScore.overall;

    expect(delta).toBeGreaterThan(0);
    expect(currentScore.overall).toBeGreaterThan(previousScore.overall);
  });

  it("returns zero delta when no previous data", () => {
    const current: AIVisibilityInput = {
      llmMentionRate: 0.5,
      aiSearchPresenceRate: 0.5,
      shareOfVoice: 0.5,
      backlinkAuthoritySignal: 0.5,
    };
    const score = computeAIVisibilityScore(current);
    expect(score.overall).toBe(50);
  });
});
