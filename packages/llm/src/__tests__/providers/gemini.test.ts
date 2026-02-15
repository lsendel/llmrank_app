import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Google Generative AI module
vi.mock("@google/generative-ai", () => {
  const mockGenerateContent = vi.fn();
  return {
    GoogleGenerativeAI: class MockGoogleGenAI {
      getGenerativeModel() {
        return { generateContent: mockGenerateContent };
      }
    },
    __mockGenerateContent: mockGenerateContent,
  };
});

// Mock retry
vi.mock("../../retry", () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
  withTimeout: (p: Promise<unknown>) => p,
}));

import { checkGemini } from "../../providers/gemini";

// Access the mock through the module
async function getMockGenerateContent() {
  const mod = await vi.importMock<{
    __mockGenerateContent: ReturnType<typeof vi.fn>;
  }>("@google/generative-ai");
  return mod.__mockGenerateContent;
}

describe("checkGemini", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function mockResponse(responseText: string) {
    const mockFn = await getMockGenerateContent();
    mockFn.mockResolvedValue({
      response: { text: () => responseText },
    });
  }

  it("returns a VisibilityCheckResult with provider 'gemini'", async () => {
    await mockResponse("Check out acme.com for great tools.");
    const result = await checkGemini(
      "best tools",
      "acme.com",
      [],
      "gemini-key",
    );
    expect(result.provider).toBe("gemini");
    expect(result.query).toBe("best tools");
  });

  it("detects brand mention", async () => {
    await mockResponse("Acme.com provides excellent AI readiness tools.");
    const result = await checkGemini("AI tools", "acme.com", [], "gemini-key");
    expect(result.brandMentioned).toBe(true);
    expect(result.urlCited).toBe(true);
  });

  it("returns false when brand not mentioned", async () => {
    await mockResponse("Use moz.com or semrush.com instead.");
    const result = await checkGemini("tools", "acme.com", [], "gemini-key");
    expect(result.brandMentioned).toBe(false);
  });

  it("handles empty response", async () => {
    await mockResponse("");
    const result = await checkGemini("query", "acme.com", [], "gemini-key");
    expect(result.responseText).toBe("");
    expect(result.brandMentioned).toBe(false);
  });

  it("detects competitor mentions", async () => {
    await mockResponse("acme.com and competitor.io are the top choices.");
    const result = await checkGemini(
      "comparison",
      "acme.com",
      ["competitor.io", "absent.org"],
      "gemini-key",
    );
    expect(result.competitorMentions).toHaveLength(2);
    expect(result.competitorMentions[0].mentioned).toBe(true);
    expect(result.competitorMentions[1].mentioned).toBe(false);
  });
});
