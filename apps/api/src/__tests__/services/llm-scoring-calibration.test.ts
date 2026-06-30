import { describe, it, expect } from "vitest";
import type { LLMContentScores } from "@llm-boost/shared";
import {
  WORKERS_AI_CALIBRATION,
  applyWorkersAiCalibration,
} from "../../services/llm-scoring";

const raw = (over: Partial<LLMContentScores> = {}): LLMContentScores => ({
  clarity: 60,
  authority: 50,
  comprehensiveness: 60,
  structure: 60,
  citation_worthiness: 50,
  ...over,
});

describe("Workers AI score calibration", () => {
  it("(a) adds exactly the configured offset to each dimension (mid-range, no clamp)", () => {
    const result = applyWorkersAiCalibration(raw());
    expect(result).toEqual({
      clarity: 65, // 60 + 5
      authority: 58, // 50 + 8
      comprehensiveness: 60, // 60 + 0
      structure: 73, // 60 + 13
      citation_worthiness: 50, // 50 + 0
    });
    // ...and that matches the published offsets exactly.
    expect(result.clarity - 60).toBe(WORKERS_AI_CALIBRATION.clarity);
    expect(result.authority - 50).toBe(WORKERS_AI_CALIBRATION.authority);
    expect(result.structure - 60).toBe(WORKERS_AI_CALIBRATION.structure);
  });

  it("(b) clamps at 100 so a high score saturates instead of exceeding the scale", () => {
    // structure 92 + 13 = 105 -> 100; authority 95 + 8 = 103 -> 100.
    const result = applyWorkersAiCalibration(
      raw({ structure: 92, authority: 95, clarity: 100 }),
    );
    expect(result.structure).toBe(100);
    expect(result.authority).toBe(100);
    expect(result.clarity).toBe(100); // 100 + 5 -> 100
    expect(Object.values(result).every((v) => v <= 100)).toBe(true);
  });

  it("(c) leaves citation_worthiness and comprehensiveness unchanged (within-noise dims)", () => {
    expect(WORKERS_AI_CALIBRATION.citation_worthiness).toBe(0);
    expect(WORKERS_AI_CALIBRATION.comprehensiveness).toBe(0);
    const input = raw({ citation_worthiness: 37, comprehensiveness: 41 });
    const result = applyWorkersAiCalibration(input);
    expect(result.citation_worthiness).toBe(37);
    expect(result.comprehensiveness).toBe(41);
  });

  it("(d) calibration is additive-only and isolated — the Anthropic/Haiku path is never offset", () => {
    // The offsets only ever raise scores (the small model under-scores); none
    // is negative, so calibration cannot penalise a page.
    for (const v of Object.values(WORKERS_AI_CALIBRATION)) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
    // applyWorkersAiCalibration is a pure function applied ONLY at the Workers
    // AI boundary (runWorkersAiScoring). The Anthropic/Haiku scorer is the
    // reference: its output is persisted directly, never passed through this
    // function. Guard purity so a future edit can't make it mutate in place and
    // accidentally leak into a shared score object.
    const input = raw();
    const snapshot = { ...input };
    applyWorkersAiCalibration(input);
    expect(input).toEqual(snapshot);
  });

  it("floors at 0 defensively (offsets never push below the scale, but the clamp holds)", () => {
    const result = applyWorkersAiCalibration(
      raw({ authority: 0, structure: 0 }),
    );
    expect(result.authority).toBe(8);
    expect(result.structure).toBe(13);
    expect(Object.values(result).every((v) => v >= 0)).toBe(true);
  });
});
