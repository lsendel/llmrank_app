import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

// Mock the openai module before importing the function under test
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

// Mock retry to avoid real delays
vi.mock("../../retry", () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
  withTimeout: (p: Promise<unknown>) => p,
}));

import { checkChatGPT } from "../../providers/chatgpt";

describe("checkChatGPT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setResponse(responseText: string) {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: responseText } }],
    });
  }

  it("returns a VisibilityCheckResult with provider 'chatgpt'", async () => {
    setResponse("Here is some information about acme.com and their tools.");
    const result = await checkChatGPT(
      "best project management tools",
      "acme.com",
      [],
      "sk-test",
    );
    expect(result.provider).toBe("chatgpt");
    expect(result.query).toBe("best project management tools");
    expect(result.responseText).toContain("acme.com");
  });

  it("detects brand mention in the response", async () => {
    setResponse("I recommend checking out acme.com for project management.");
    const result = await checkChatGPT("best tools", "acme.com", [], "sk-test");
    expect(result.brandMentioned).toBe(true);
    expect(result.urlCited).toBe(true);
  });

  it("detects when brand is not mentioned", async () => {
    setResponse("Try competitor.io or rival.net for great results.");
    const result = await checkChatGPT(
      "best tools",
      "acme.com",
      ["competitor.io"],
      "sk-test",
    );
    expect(result.brandMentioned).toBe(false);
    expect(result.urlCited).toBe(false);
  });

  it("tracks competitor mentions", async () => {
    setResponse("Both acme.com and competitor.io offer solutions.");
    const result = await checkChatGPT(
      "best tools",
      "acme.com",
      ["competitor.io", "absent.org"],
      "sk-test",
    );
    expect(result.competitorMentions).toHaveLength(2);
    expect(result.competitorMentions[0].mentioned).toBe(true);
    expect(result.competitorMentions[1].mentioned).toBe(false);
  });

  it("handles empty response text gracefully", async () => {
    setResponse("");
    const result = await checkChatGPT("some query", "acme.com", [], "sk-test");
    expect(result.responseText).toBe("");
    expect(result.brandMentioned).toBe(false);
  });
});
