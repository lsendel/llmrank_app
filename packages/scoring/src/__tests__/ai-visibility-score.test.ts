import { describe, it, expect } from "vitest";
import { computeAIVisibilityScore } from "../ai-visibility-score";

describe("computeAIVisibilityScore", () => {
  it("returns 0 when no data", () => {
    const score = computeAIVisibilityScore({
      llmMentionRate: 0,
      aiSearchPresenceRate: 0,
      shareOfVoice: 0,
      backlinkAuthoritySignal: 0,
    });
    expect(score.overall).toBe(0);
    expect(score.grade).toBe("F");
  });

  it("returns high score when all metrics are strong", () => {
    const score = computeAIVisibilityScore({
      llmMentionRate: 0.9,
      aiSearchPresenceRate: 0.8,
      shareOfVoice: 0.7,
      backlinkAuthoritySignal: 0.6,
    });
    // 0.9*40 + 0.8*30 + 0.7*20 + 0.6*10 = 36 + 24 + 14 + 6 = 80
    expect(score.overall).toBe(80);
    expect(score.grade).toBe("B");
  });

  it("clamps to 0-100 range", () => {
    const score = computeAIVisibilityScore({
      llmMentionRate: 1.5,
      aiSearchPresenceRate: 1.2,
      shareOfVoice: 1.0,
      backlinkAuthoritySignal: 1.0,
    });
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it("assigns correct letter grades", () => {
    expect(
      computeAIVisibilityScore({
        llmMentionRate: 1,
        aiSearchPresenceRate: 1,
        shareOfVoice: 1,
        backlinkAuthoritySignal: 1,
      }).grade,
    ).toBe("A");

    expect(
      computeAIVisibilityScore({
        llmMentionRate: 0.5,
        aiSearchPresenceRate: 0.5,
        shareOfVoice: 0.5,
        backlinkAuthoritySignal: 0.5,
      }).grade,
    ).toBe("F"); // 50 — below 60 threshold
  });

  it("provides correct breakdown", () => {
    const score = computeAIVisibilityScore({
      llmMentionRate: 0.5,
      aiSearchPresenceRate: 0.5,
      shareOfVoice: 0.5,
      backlinkAuthoritySignal: 0.5,
    });
    expect(score.breakdown.llmMentions).toBe(20); // 0.5 * 40
    expect(score.breakdown.aiSearch).toBe(15); // 0.5 * 30
    expect(score.breakdown.shareOfVoice).toBe(10); // 0.5 * 20
    expect(score.breakdown.backlinkAuthority).toBe(5); // 0.5 * 10
  });
});
