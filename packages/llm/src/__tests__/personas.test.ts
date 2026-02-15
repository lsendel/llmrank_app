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

import { PersonaGenerator, type UserPersona } from "../personas";

describe("PersonaGenerator", () => {
  function createGenerator() {
    return new PersonaGenerator({ anthropicApiKey: "test-key" });
  }

  function getClient(gen: PersonaGenerator) {
    return (
      gen as unknown as {
        client: { messages: { create: ReturnType<typeof vi.fn> } };
      }
    ).client;
  }

  it("returns an array of UserPersona objects", async () => {
    const gen = createGenerator();
    const client = getClient(gen);

    const personas: UserPersona[] = [
      {
        name: "Marketing Maya",
        role: "Marketing Director",
        demographics: "35-45, US, High tech savviness",
        goals: ["Increase organic traffic", "Improve AI visibility"],
        painPoints: ["Low AI search presence", "Content creation overhead"],
        typicalQueries: [
          "How to optimize for ChatGPT",
          "AI SEO best practices",
        ],
        idealContentFormat: "Actionable guides with checklists",
      },
      {
        name: "Developer Dave",
        role: "Full-Stack Developer",
        demographics: "25-35, EU, Very high tech savviness",
        goals: ["Implement schema markup", "Automate SEO audits"],
        painPoints: ["Lack of structured data", "Manual auditing"],
        typicalQueries: ["JSON-LD best practices", "Automated SEO tools"],
        idealContentFormat: "Deep-dive technical guides with code samples",
      },
    ];

    client.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(personas) }],
    });

    const result = await gen.generatePersonas({
      domain: "acme.com",
      description: "AI-readiness SEO platform",
      niche: "SEO SaaS",
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Marketing Maya");
    expect(result[1].goals).toContain("Implement schema markup");
  });

  it("strips code fences from response before parsing", async () => {
    const gen = createGenerator();
    const client = getClient(gen);

    const persona: UserPersona = {
      name: "SEO Sara",
      role: "SEO Specialist",
      demographics: "28, NYC, High tech savviness",
      goals: ["Rank in AI search"],
      painPoints: ["Low visibility"],
      typicalQueries: ["AI SEO tools"],
      idealContentFormat: "Comparison tables",
    };

    client.messages.create.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "```json\n" + JSON.stringify([persona]) + "\n```",
        },
      ],
    });

    const result = await gen.generatePersonas({
      domain: "test.com",
      description: "Test",
      niche: "SaaS",
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("SEO Sara");
  });

  it("throws an error when LLM returns invalid JSON", async () => {
    const gen = createGenerator();
    const client = getClient(gen);

    client.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "Not valid JSON content" }],
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      gen.generatePersonas({
        domain: "test.com",
        description: "Test",
        niche: "SaaS",
      }),
    ).rejects.toThrow("Failed to generate personas");
    consoleSpy.mockRestore();
  });
});
