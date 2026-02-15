import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

// Mock the openai module (Perplexity uses OpenAI-compatible API)
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

// Mock retry
vi.mock("../../retry", () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
  withTimeout: (p: Promise<unknown>) => p,
}));

import { checkPerplexity } from "../../providers/perplexity";

describe("checkPerplexity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setResponse(responseText: string) {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: responseText } }],
    });
  }

  it("returns a VisibilityCheckResult with provider 'perplexity'", async () => {
    setResponse("According to acme.com, this is the best approach.");
    const result = await checkPerplexity(
      "best SEO tools",
      "acme.com",
      [],
      "pplx-test",
    );
    expect(result.provider).toBe("perplexity");
    expect(result.query).toBe("best SEO tools");
  });

  it("detects brand mention", async () => {
    setResponse("Acme offers a comprehensive SEO platform at acme.com.");
    const result = await checkPerplexity(
      "SEO tools",
      "acme.com",
      [],
      "pplx-test",
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.urlCited).toBe(true);
  });

  it("returns false when brand is not mentioned", async () => {
    setResponse("Consider tools like moz.com and ahrefs.com.");
    const result = await checkPerplexity(
      "SEO tools",
      "acme.com",
      [],
      "pplx-test",
    );
    expect(result.brandMentioned).toBe(false);
  });

  it("handles null content in choices", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await checkPerplexity("query", "acme.com", [], "pplx-test");
    expect(result.responseText).toBe("");
    expect(result.brandMentioned).toBe(false);
  });

  it("tracks competitor mentions", async () => {
    setResponse("acme.com beats competitor.io in every category.");
    const result = await checkPerplexity(
      "comparison",
      "acme.com",
      ["competitor.io"],
      "pplx-test",
    );
    expect(result.competitorMentions[0].mentioned).toBe(true);
    expect(result.competitorMentions[0].domain).toBe("competitor.io");
  });
});
