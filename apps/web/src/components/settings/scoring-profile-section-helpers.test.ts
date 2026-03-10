import { describe, expect, it } from "vitest";
import {
  getPresetWeights,
  getScoringProfileName,
  getScoringWeightsTotal,
  isScoringWeightsValid,
} from "./scoring-profile-section-helpers";

describe("scoring profile section helpers", () => {
  it("returns preset weights and names", () => {
    expect(getPresetWeights("default")).toEqual({
      technical: 25,
      content: 30,
      aiReadiness: 30,
      performance: 15,
    });
    expect(getScoringProfileName("saas")).toBe("SaaS");
    expect(getScoringProfileName("custom")).toBe("Custom Profile");
  });

  it("calculates totals and validity", () => {
    expect(
      getScoringWeightsTotal({
        technical: 25,
        content: 30,
        aiReadiness: 30,
        performance: 15,
      }),
    ).toBe(100);
    expect(
      isScoringWeightsValid({
        technical: 40,
        content: 30,
        aiReadiness: 30,
        performance: 15,
      }),
    ).toBe(false);
  });
});
