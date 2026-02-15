import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMessagesCreate = vi.fn();

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockMessagesCreate,
      };
    },
  };
});

// Mock retry to avoid real delays
vi.mock("../../retry", () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
  withTimeout: (p: Promise<unknown>) => p,
}));

import { checkClaude } from "../../providers/claude";

describe("checkClaude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setResponse(responseText: string) {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: responseText }],
    });
  }

  it("returns a VisibilityCheckResult with provider 'claude'", async () => {
    setResponse("Acme.com provides excellent solutions.");
    const result = await checkClaude(
      "best AI tools",
      "acme.com",
      [],
      "sk-ant-test",
    );
    expect(result.provider).toBe("claude");
    expect(result.query).toBe("best AI tools");
  });

  it("detects brand mention in the response", async () => {
    setResponse("I recommend acme.com for their comprehensive platform.");
    const result = await checkClaude(
      "recommendations",
      "acme.com",
      [],
      "sk-ant-test",
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.urlCited).toBe(true);
  });

  it("returns false when brand is absent", async () => {
    setResponse("Consider using other platforms like rival.net.");
    const result = await checkClaude(
      "best tools",
      "acme.com",
      [],
      "sk-ant-test",
    );
    expect(result.brandMentioned).toBe(false);
  });

  it("handles multiple text blocks in response", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        { type: "text", text: "First part about " },
        { type: "text", text: "acme.com and more." },
      ],
    });

    const result = await checkClaude("query", "acme.com", [], "sk-ant-test");
    expect(result.responseText).toContain("acme.com");
    expect(result.brandMentioned).toBe(true);
  });

  it("tracks competitor mentions correctly", async () => {
    setResponse(
      "acme.com is better than competitor.io but worse than rival.net.",
    );
    const result = await checkClaude(
      "comparison",
      "acme.com",
      ["competitor.io", "rival.net", "absent.org"],
      "sk-ant-test",
    );
    expect(result.competitorMentions).toHaveLength(3);
    expect(result.competitorMentions[0].mentioned).toBe(true);
    expect(result.competitorMentions[1].mentioned).toBe(true);
    expect(result.competitorMentions[2].mentioned).toBe(false);
  });
});
