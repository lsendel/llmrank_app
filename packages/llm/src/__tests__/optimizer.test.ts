import { describe, it, expect, vi } from "vitest";

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn(),
      };
    },
  };
});

// Mock retry
vi.mock("../retry", () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

import { StrategyOptimizer } from "../optimizer";

describe("StrategyOptimizer", () => {
  function createOptimizer() {
    return new StrategyOptimizer("test-key");
  }

  function getClient(opt: StrategyOptimizer) {
    return (
      opt as unknown as {
        client: { messages: { create: ReturnType<typeof vi.fn> } };
      }
    ).client;
  }

  it("rewriteForAIVisibility returns an OptimizationResult", async () => {
    const opt = createOptimizer();
    const client = getClient(opt);
    const result = {
      optimized: "Rewritten content optimized for AI search.",
      explanation: "Improved clarity and direct answer format.",
    };
    client.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(result) }],
    });

    const output = await opt.rewriteForAIVisibility("Original content here.");
    expect(output.optimized).toContain("Rewritten content");
    expect(output.explanation).toContain("Improved clarity");
  });

  it("generateContentBrief returns a ContentBrief", async () => {
    const opt = createOptimizer();
    const client = getClient(opt);
    const brief = {
      keyword: "AI SEO tools",
      wordCount: "2000-2500",
      headings: [
        "What is AI SEO",
        "Top Tools",
        "How to Choose",
        "Implementation",
        "Conclusion",
      ],
      secondaryKeywords: ["LLM optimization", "search visibility"],
      lsiKeywords: ["content scoring", "AI readiness"],
      searchIntent: "informational",
    };
    client.messages.create.mockResolvedValue({
      content: [
        { type: "text", text: "```json\n" + JSON.stringify(brief) + "\n```" },
      ],
    });

    const output = await opt.generateContentBrief("AI SEO tools");
    expect(output.keyword).toBe("AI SEO tools");
    expect(output.headings).toHaveLength(5);
    expect(output.searchIntent).toBe("informational");
  });

  it("analyzeStructuralGap returns missing elements and recommendation", async () => {
    const opt = createOptimizer();
    const client = getClient(opt);
    const gapResult = {
      missingElements: ["FAQ Schema", "Comparison Table"],
      recommendation:
        "Add a FAQ section and comparison table to compete with the competitor.",
    };
    client.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(gapResult) }],
    });

    const output = await opt.analyzeStructuralGap({
      userDomain: "acme.com",
      competitorDomain: "rival.com",
      userStructure: { headings: ["H1", "H2"] },
      query: "best project tools",
    });
    expect(output.missingElements).toContain("FAQ Schema");
    expect(output.recommendation).toContain("FAQ section");
  });
});
