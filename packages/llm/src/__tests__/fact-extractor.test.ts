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

import { FactExtractor, type ExtractedFact } from "../fact-extractor";

describe("FactExtractor", () => {
  function createExtractor() {
    return new FactExtractor("test-key");
  }

  it("returns an array of ExtractedFact objects", async () => {
    const extractor = createExtractor();
    const client = (
      extractor as unknown as {
        client: { messages: { create: ReturnType<typeof vi.fn> } };
      }
    ).client;

    const facts: ExtractedFact[] = [
      {
        type: "metric",
        content: "$29/mo",
        sourceSentence: "Our pro plan costs $29/mo.",
        citabilityScore: 95,
      },
      {
        type: "claim",
        content: "50% faster than competitors",
        sourceSentence: "We are 50% faster than competitors.",
        citabilityScore: 80,
      },
    ];

    client.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(facts) }],
    });

    const result = await extractor.extractFacts(
      "Some content about pricing and speed.",
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("metric");
    expect(result[1].citabilityScore).toBe(80);
  });

  it("returns empty array when LLM returns invalid JSON", async () => {
    const extractor = createExtractor();
    const client = (
      extractor as unknown as {
        client: { messages: { create: ReturnType<typeof vi.fn> } };
      }
    ).client;

    client.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "This is not valid JSON at all" }],
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await extractor.extractFacts("Some content");
    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });

  it("strips markdown code fences from response", async () => {
    const extractor = createExtractor();
    const client = (
      extractor as unknown as {
        client: { messages: { create: ReturnType<typeof vi.fn> } };
      }
    ).client;

    const facts: ExtractedFact[] = [
      {
        type: "definition",
        content: "AI readiness is the ability to be cited by AI.",
        sourceSentence:
          "AI readiness measures how well content can be cited by AI.",
        citabilityScore: 70,
      },
    ];

    client.messages.create.mockResolvedValue({
      content: [
        { type: "text", text: "```json\n" + JSON.stringify(facts) + "\n```" },
      ],
    });

    const result = await extractor.extractFacts("Content about AI readiness.");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("definition");
  });
});
