import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  }));
  return { default: MockAnthropic };
});

import { NarrativeEngine } from "../engine";
import Anthropic from "@anthropic-ai/sdk";
import type { NarrativeInput } from "../types";

function makeInput(overrides: Partial<NarrativeInput> = {}): NarrativeInput {
  return {
    tone: "technical",
    crawlJob: {
      id: "crawl-1",
      domain: "example.com",
      overallScore: 75,
      letterGrade: "C",
      pagesScored: 50,
      categoryScores: {
        technical: 80,
        content: 70,
        aiReadiness: 65,
        performance: 85,
      },
    },
    categoryScores: {
      technical: 80,
      content: 70,
      aiReadiness: 65,
      performance: 85,
    },
    issues: [
      {
        code: "MISSING_LLMS_TXT",
        category: "ai_readiness",
        severity: "critical",
        message: "No LLMs.txt",
        recommendation: "Add LLMs.txt",
        affectedPages: 50,
        scoreImpact: 15,
      },
    ],
    quickWins: [
      {
        code: "MISSING_LLMS_TXT",
        message: "No LLMs.txt",
        recommendation: "Add LLMs.txt",
        scoreImpact: 15,
        pillar: "ai_readiness",
      },
    ],
    contentHealth: {
      avgWordCount: 800,
      avgClarity: 75,
      avgAuthority: 70,
      avgComprehensiveness: 65,
      avgStructure: 80,
      avgCitationWorthiness: 60,
    },
    pages: [
      {
        url: "https://example.com/",
        title: "Home",
        overallScore: 80,
        letterGrade: "B",
        issueCount: 3,
      },
    ],
    ...overrides,
  };
}

describe("NarrativeEngine", () => {
  let engine: NarrativeEngine;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new NarrativeEngine({ anthropicApiKey: "test-key" });
    const instance = (Anthropic as unknown as ReturnType<typeof vi.fn>).mock
      .results[0].value;
    mockCreate = instance.messages.create;
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "<p>Analysis content here.</p>" }],
      usage: { input_tokens: 500, output_tokens: 200 },
    });
  });

  it("generates sections for all applicable types", async () => {
    const result = await engine.generate(makeInput());
    // No previousCrawl or competitors, so 6 sections (not trend or competitive)
    expect(result.sections).toHaveLength(6);
    expect(result.sections[0].type).toBe("executive_summary");
    expect(result.sections[5].type).toBe("priority_recommendations");
  });

  it("includes trend_analysis when previousCrawl is provided", async () => {
    const input = makeInput({
      previousCrawl: {
        id: "crawl-0",
        domain: "example.com",
        overallScore: 60,
        letterGrade: "D",
        pagesScored: 40,
        categoryScores: {
          technical: 65,
          content: 55,
          aiReadiness: 50,
          performance: 70,
        },
      },
    });
    const result = await engine.generate(input);
    const types = result.sections.map((s) => s.type);
    expect(types).toContain("trend_analysis");
  });

  it("includes competitive_positioning when competitors are provided", async () => {
    const input = makeInput({
      competitors: [
        {
          domain: "rival.com",
          mentionCount: 10,
          platforms: ["chatgpt"],
          queries: ["test query"],
        },
      ],
    });
    const result = await engine.generate(input);
    const types = result.sections.map((s) => s.type);
    expect(types).toContain("competitive_positioning");
  });

  it("tracks total token usage across sections", async () => {
    const result = await engine.generate(makeInput());
    expect(result.tokenUsage.input).toBe(500 * 6);
    expect(result.tokenUsage.output).toBe(200 * 6);
    expect(result.tokenUsage.costCents).toBeGreaterThan(0);
  });

  it("handles partial failures gracefully", async () => {
    let callCount = 0;
    mockCreate.mockImplementation(() => {
      callCount++;
      if (callCount === 3) throw new Error("LLM unavailable");
      return Promise.resolve({
        content: [{ type: "text", text: "<p>OK</p>" }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    });
    const result = await engine.generate(makeInput());
    expect(result.sections).toHaveLength(5); // 6 - 1 failed
  });

  it("throws when every section generation fails", async () => {
    mockCreate.mockRejectedValue(new Error("LLM unavailable"));

    await expect(engine.generate(makeInput())).rejects.toThrow(
      "No narrative sections could be generated",
    );
  });

  it("excludes sections that come back empty/non-text (never emits blank sections)", async () => {
    // Every section returns a successful-but-empty response → each is rejected
    // → none included, rather than a narrative full of blank sections.
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "   " }],
      usage: { input_tokens: 10, output_tokens: 0 },
    });

    await expect(engine.generate(makeInput())).rejects.toThrow(
      "No narrative sections could be generated",
    );
  });

  it("regenerates a single section with custom instructions", async () => {
    const section = await engine.regenerateSection(
      "executive_summary",
      makeInput(),
      "Focus more on mobile performance",
    );
    expect(section.type).toBe("executive_summary");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain(
      "Focus more on mobile performance",
    );
  });

  it("throws (never returns empty) when the response is non-text", async () => {
    // A successful-but-non-text response must not yield empty content — callers
    // overwrite the stored section with this, so empty would wipe it.
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "t", name: "x", input: {} }],
      usage: { input_tokens: 10, output_tokens: 0 },
    });

    await expect(
      engine.regenerateSection("executive_summary", makeInput(), undefined),
    ).rejects.toThrow(/empty content/i);
  });

  it("throws when the response text is only whitespace", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "   \n  " }],
      usage: { input_tokens: 10, output_tokens: 1 },
    });

    await expect(
      engine.regenerateSection("executive_summary", makeInput(), undefined),
    ).rejects.toThrow(/empty content/i);
  });
});
