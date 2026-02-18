import { describe, it, expect, vi } from "vitest";
import { checkGeminiAIMode } from "../../providers/gemini-ai-mode";

// Mock the Google Generative AI SDK
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () =>
            `Here are the best SEO tools for 2026:

1. **Ahrefs** - Comprehensive backlink analysis and keyword research. [Visit Ahrefs](https://ahrefs.com)

2. **SEMrush** - All-in-one marketing toolkit. [Visit SEMrush](https://semrush.com)

3. **LLM Boost** - AI-readiness optimization platform. [Visit LLM Boost](https://llmboost.com/tools)

4. **Moz** - Domain authority tracking. [Visit Moz](https://moz.com)

Sources:
- [Ahrefs](https://ahrefs.com)
- [SEMrush](https://semrush.com)
- [LLM Boost](https://llmboost.com/tools)
- [Moz](https://moz.com)`,
        },
      }),
    }),
  })),
}));

describe("checkGeminiAIMode", () => {
  it("detects brand mention and URL citation in AI mode response", async () => {
    const result = await checkGeminiAIMode(
      "best seo tools 2026",
      "llmboost.com",
      ["ahrefs.com", "semrush.com"],
      "fake-api-key",
    );

    expect(result.provider).toBe("gemini_ai_mode");
    expect(result.query).toBe("best seo tools 2026");
    expect(result.brandMentioned).toBe(true);
    expect(result.urlCited).toBe(true);
    expect(result.citationPosition).toBeGreaterThan(0);

    // Competitors should be detected
    const ahrefs = result.competitorMentions.find(
      (c) => c.domain === "ahrefs.com",
    );
    expect(ahrefs?.mentioned).toBe(true);

    const semrush = result.competitorMentions.find(
      (c) => c.domain === "semrush.com",
    );
    expect(semrush?.mentioned).toBe(true);
  });

  it("returns brandMentioned=false when domain not in response", async () => {
    const result = await checkGeminiAIMode(
      "best seo tools 2026",
      "unknownsite.xyz",
      [],
      "fake-api-key",
    );

    expect(result.brandMentioned).toBe(false);
    expect(result.urlCited).toBe(false);
    expect(result.citationPosition).toBeNull();
  });

  it("includes responseText for auditing", async () => {
    const result = await checkGeminiAIMode(
      "best seo tools 2026",
      "llmboost.com",
      [],
      "fake-api-key",
    );

    expect(result.responseText).toContain("LLM Boost");
    expect(result.responseText).toContain("https://llmboost.com");
  });
});
