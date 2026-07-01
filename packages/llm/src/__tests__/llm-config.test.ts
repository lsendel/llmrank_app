import { describe, it, expect } from "vitest";
import { estimateCostUsd, MODEL_PRICING } from "../llm-config";

describe("estimateCostUsd", () => {
  it("computes Sonnet 5 standard cost ($2 in / $10 out per M)", () => {
    // 1M input @ $2 + 1M output @ $10 = $12
    expect(
      estimateCostUsd("claude-sonnet-5", 1_000_000, 1_000_000),
    ).toBeCloseTo(12, 5);
  });

  it("applies the 50% batch discount", () => {
    expect(
      estimateCostUsd("claude-sonnet-5", 1_000_000, 1_000_000, { batch: true }),
    ).toBeCloseTo(6, 5);
  });

  it("Sonnet 5 is cheaper than Sonnet 4.6 for the same usage", () => {
    const s5 = estimateCostUsd("claude-sonnet-5", 1000, 1000);
    const s46 = estimateCostUsd("claude-sonnet-4-6", 1000, 1000);
    expect(s5).toBeLessThan(s46);
  });

  it("falls back to a conservative Sonnet-class rate for unknown models", () => {
    // fallback input rate is $3/M — never silently under-counts
    expect(estimateCostUsd("some-future-model", 1_000_000, 0)).toBeCloseTo(
      3,
      5,
    );
  });

  it("tracks Workers AI at ~$0", () => {
    expect(
      estimateCostUsd("@cf/openai/gpt-oss-120b", 1_000_000, 1_000_000),
    ).toBe(0);
  });

  it("real-world ~250/250-token description on Sonnet 5 batch is sub-cent", () => {
    const c = estimateCostUsd("claude-sonnet-5", 244, 247, { batch: true });
    expect(c).toBeGreaterThan(0.001);
    expect(c).toBeLessThan(0.002);
  });

  it("exposes pricing for the models actually used", () => {
    for (const m of ["claude-sonnet-5", "claude-sonnet-4-6", "gpt-4o-mini"]) {
      expect(MODEL_PRICING[m].input).toBeGreaterThan(0);
      expect(MODEL_PRICING[m].output).toBeGreaterThan(0);
    }
  });
});
