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

import { SummaryGenerator } from "../summary";

describe("SummaryGenerator", () => {
  function createGenerator() {
    return new SummaryGenerator({ anthropicApiKey: "test-key" });
  }

  it("returns a trimmed string summary", async () => {
    const gen = createGenerator();
    // Access the internal client to mock it
    const client = (
      gen as unknown as {
        client: { messages: { create: ReturnType<typeof vi.fn> } };
      }
    ).client;
    client.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "  Your site scores 75/100 overall.  " }],
    });

    const result = await gen.generateExecutiveSummary({
      projectName: "Acme",
      domain: "acme.com",
      overallScore: 75,
      categoryScores: {
        technical: 80,
        content: 70,
        aiReadiness: 65,
        performance: 85,
      },
      quickWins: [],
      pagesScored: 10,
    });

    expect(typeof result).toBe("string");
    expect(result).toBe("Your site scores 75/100 overall.");
  });

  it("passes correct data to the LLM prompt", async () => {
    const gen = createGenerator();
    const client = (
      gen as unknown as {
        client: { messages: { create: ReturnType<typeof vi.fn> } };
      }
    ).client;
    client.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "Summary" }],
    });

    await gen.generateExecutiveSummary({
      projectName: "TestProject",
      domain: "test.com",
      overallScore: 42,
      categoryScores: {
        technical: 50,
        content: 30,
        aiReadiness: 40,
        performance: 60,
      },
      quickWins: [
        {
          message: "Add meta descriptions",
          scoreImpact: -10,
          affectedPages: 5,
          code: "MISSING_META_DESC",
          category: "technical",
          severity: "warning",
          effortLevel: "low",
          recommendation: "Add meta descriptions",
          priority: 20,
        },
      ],
      pagesScored: 25,
    });

    const callArgs = client.messages.create.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain("TestProject");
    expect(callArgs.messages[0].content).toContain("test.com");
    expect(callArgs.messages[0].content).toContain("42");
  });

  it("handles empty text block gracefully", async () => {
    const gen = createGenerator();
    const client = (
      gen as unknown as {
        client: { messages: { create: ReturnType<typeof vi.fn> } };
      }
    ).client;
    client.messages.create.mockResolvedValue({
      content: [{ type: "image", source: {} }],
    });

    const result = await gen.generateExecutiveSummary({
      projectName: "Test",
      domain: "test.com",
      overallScore: 50,
      categoryScores: {
        technical: 50,
        content: 50,
        aiReadiness: 50,
        performance: 50,
      },
      quickWins: [],
      pagesScored: 1,
    });

    expect(result).toBe("");
  });
});
