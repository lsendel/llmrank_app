import { describe, it, expect } from "vitest";
import {
  derivePlatformTips,
  type TipIssueDefinition,
  type AggregatedIssue,
} from "../../services/platform-tips";

// Synthetic catalog: one issue per category, equal magnitude + count, so the
// ONLY thing that moves ranking between providers is PLATFORM_WEIGHTS.
const DEFS: Record<string, TipIssueDefinition> = {
  TECH_ISSUE: {
    category: "technical",
    severity: "critical",
    scoreImpact: -10,
    recommendation: "Fix the technical problem",
  },
  CONTENT_ISSUE: {
    category: "content",
    severity: "critical",
    scoreImpact: -10,
    recommendation: "Improve the content",
  },
  AI_ISSUE: {
    category: "ai_readiness",
    severity: "critical",
    scoreImpact: -10,
    recommendation: "Add AI-readiness signals",
  },
  PERF_ISSUE: {
    category: "performance",
    severity: "critical",
    scoreImpact: -10,
    recommendation: "Speed up the page",
  },
};

const allFour: AggregatedIssue[] = [
  { code: "TECH_ISSUE", count: 5 },
  { code: "CONTENT_ISSUE", count: 5 },
  { code: "AI_ISSUE", count: 5 },
  { code: "PERF_ISSUE", count: 5 },
];

describe("derivePlatformTips", () => {
  it("surfaces ai_readiness/content first for ChatGPT (ai_readiness .5, content .3)", () => {
    const tips = derivePlatformTips("chatgpt", allFour, { definitions: DEFS });
    // chatgpt weights: ai_readiness .5 > content .3 > technical .1 = performance .1
    expect(tips[0]).toBe("Add AI-readiness signals");
    expect(tips[1]).toBe("Improve the content");
    expect(tips).toHaveLength(3);
  });

  it("surfaces technical first for Copilot (technical .35, performance .25)", () => {
    const tips = derivePlatformTips("copilot", allFour, { definitions: DEFS });
    // copilot weights: technical .35 > performance .25 = content .25 > ai_readiness .15
    expect(tips[0]).toBe("Fix the technical problem");
    expect(tips).toContain("Speed up the page");
    expect(tips).not.toContain("Add AI-readiness signals"); // lowest weight, off top-3
  });

  it("surfaces content first for Claude (content .4)", () => {
    const tips = derivePlatformTips("claude", allFour, { definitions: DEFS });
    expect(tips[0]).toBe("Improve the content"); // content .4 is the heaviest
  });

  it("ranks by impact = |scoreImpact| × count × providerWeight (count breaks a weight tie)", () => {
    // Perplexity: content .35, technical .25. A widespread technical issue can
    // out-rank a rare content one despite the lower weight.
    const tips = derivePlatformTips(
      "perplexity",
      [
        { code: "CONTENT_ISSUE", count: 1 }, // .35 × 1 = 0.35
        { code: "TECH_ISSUE", count: 5 }, // .25 × 5 = 1.25
      ],
      { definitions: DEFS },
    );
    expect(tips[0]).toBe("Fix the technical problem");
    expect(tips[1]).toBe("Improve the content");
  });

  it("returns the canonical recommendation copy, not invented text", () => {
    const tips = derivePlatformTips("gemini", allFour, { definitions: DEFS });
    for (const t of tips) {
      expect(Object.values(DEFS).map((d) => d.recommendation)).toContain(t);
    }
  });

  it("returns [] when there are no issues (caller falls back to static tips)", () => {
    expect(derivePlatformTips("chatgpt", [], { definitions: DEFS })).toEqual(
      [],
    );
  });

  it("ignores unknown issue codes and zero/negative counts", () => {
    const tips = derivePlatformTips(
      "chatgpt",
      [
        { code: "NOPE_NOT_A_CODE", count: 9 },
        { code: "AI_ISSUE", count: 0 },
        { code: "CONTENT_ISSUE", count: 3 },
      ],
      { definitions: DEFS },
    );
    expect(tips).toEqual(["Improve the content"]);
  });

  it("is deterministic and dedupes identical recommendation copy", () => {
    const defs: Record<string, TipIssueDefinition> = {
      A: {
        category: "content",
        severity: "critical",
        scoreImpact: -10,
        recommendation: "Same copy",
      },
      B: {
        category: "content",
        severity: "warning",
        scoreImpact: -10,
        recommendation: "Same copy",
      },
    };
    const tips = derivePlatformTips(
      "chatgpt",
      [
        { code: "A", count: 2 },
        { code: "B", count: 2 },
      ],
      { definitions: defs },
    );
    expect(tips).toEqual(["Same copy"]); // deduped to a single entry
  });

  it("respects the limit option", () => {
    const tips = derivePlatformTips("gemini", allFour, {
      definitions: DEFS,
      limit: 2,
    });
    expect(tips).toHaveLength(2);
  });
});
