import { describe, it, expect } from "vitest";
import { computeCitationReadiness } from "../citation-readiness";

describe("computeCitationReadiness", () => {
  it("computes score from all available data", () => {
    const result = computeCitationReadiness({
      llmCitationWorthiness: 80,
      schemaTypes: ["Article", "FAQPage", "BreadcrumbList"],
      structuredDataCount: 3,
      externalLinks: 12,
      facts: [
        { content: "AI reduces SEO time by 60%", citabilityScore: 92 },
        { content: "Market grew to $5B in 2025", citabilityScore: 88 },
      ],
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.components.factCitability).toBeGreaterThan(0);
    expect(result.components.llmCitationWorthiness).toBe(80);
    expect(result.components.schemaQuality).toBeGreaterThan(0);
    expect(result.topCitableFacts.length).toBe(2);
    expect(result.topCitableFacts[0].citabilityScore).toBe(92); // sorted desc
  });

  it("works with no facts and no LLM data", () => {
    const result = computeCitationReadiness({
      llmCitationWorthiness: null,
      schemaTypes: [],
      structuredDataCount: 0,
      externalLinks: 0,
      facts: [],
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.components.factCitability).toBe(0);
    expect(result.components.llmCitationWorthiness).toBe(0);
    expect(result.topCitableFacts.length).toBe(0);
  });

  it("rewards high-citability schema types", () => {
    const withSchema = computeCitationReadiness({
      llmCitationWorthiness: 70,
      schemaTypes: ["Article", "FAQPage"],
      structuredDataCount: 2,
      externalLinks: 5,
      facts: [],
    });
    const withoutSchema = computeCitationReadiness({
      llmCitationWorthiness: 70,
      schemaTypes: [],
      structuredDataCount: 0,
      externalLinks: 5,
      facts: [],
    });

    expect(withSchema.score).toBeGreaterThan(withoutSchema.score);
  });
});
