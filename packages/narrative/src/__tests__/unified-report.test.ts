import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  }));
  return { default: MockAnthropic };
});

import { UnifiedReportGenerator } from "../unified-report";
import Anthropic from "@anthropic-ai/sdk";

function makeData() {
  return {
    project: { domain: "example.com" },
    scores: {
      overall: 80,
      letterGrade: "B",
      technical: 80,
      content: 80,
      aiReadiness: 80,
    },
    issues: { items: [] },
    quickWins: [],
  };
}

describe("UnifiedReportGenerator", () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  let generator: UnifiedReportGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new UnifiedReportGenerator({ anthropicApiKey: "test-key" });
    const instance = (Anthropic as unknown as ReturnType<typeof vi.fn>).mock
      .results[0].value;
    mockCreate = instance.messages.create;
  });

  it("returns content for a normal text response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "# Report\n\nLooks good." }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await generator.generate(makeData());
    expect(result.content).toContain("Report");
  });

  it("throws (never emits an empty report) on a non-text response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "t", name: "x", input: {} }],
      usage: { input_tokens: 100, output_tokens: 0 },
    });

    await expect(generator.generate(makeData())).rejects.toThrow(
      /empty content/i,
    );
  });

  it("throws when the response text is only whitespace", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "  \n  " }],
      usage: { input_tokens: 100, output_tokens: 1 },
    });

    await expect(generator.generate(makeData())).rejects.toThrow(
      /empty content/i,
    );
  });
});
