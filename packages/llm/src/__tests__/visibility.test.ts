import { describe, it, expect } from "vitest";
import {
  analyzeResponse,
  extractCitedSources,
  engineModeFor,
  PROVIDER_ENGINE_MODE,
} from "../visibility";

describe("extractCitedSources", () => {
  it("collects distinct source hosts (www-stripped) from the answer", () => {
    const sources = extractCitedSources(
      "See https://www.nih.gov/study and [docs](https://example.com/a). " +
        "Also https://example.com/b and https://rival.org.",
    );
    expect(sources).toContain("nih.gov");
    expect(sources).toContain("example.com");
    expect(sources).toContain("rival.org");
    // deduped: example.com appears twice but once in the result
    expect(sources.filter((s) => s === "example.com")).toHaveLength(1);
  });

  it("strips trailing punctuation and skips malformed URLs", () => {
    const sources = extractCitedSources(
      "Source: https://nih.gov/page. Not a url: http:// nope.",
    );
    expect(sources).toContain("nih.gov");
    expect(sources).not.toContain("");
  });

  it("splits comma-joined URLs instead of merging them into a junk host", () => {
    const sources = extractCitedSources("https://a.com,https://b.com");
    expect(sources).toContain("a.com");
    expect(sources).toContain("b.com");
    expect(sources).not.toContain("a.com,https");
  });

  it("returns an empty array when nothing is cited", () => {
    expect(extractCitedSources("No links here at all.")).toEqual([]);
  });

  it("caps at 20 sources", () => {
    const text = Array.from(
      { length: 30 },
      (_, i) => `https://site${i}.com/x`,
    ).join(" ");
    expect(extractCitedSources(text)).toHaveLength(20);
  });
});

describe("engineModeFor", () => {
  it("marks web-grounded providers as live_retrieval", () => {
    expect(engineModeFor("perplexity")).toBe("live_retrieval");
    expect(engineModeFor("copilot")).toBe("live_retrieval");
  });

  it("marks completion-only providers as recall", () => {
    for (const p of ["chatgpt", "claude", "gemini", "gemini_ai_mode", "grok"]) {
      expect(engineModeFor(p)).toBe("recall");
    }
  });

  it("defaults unknown providers to the conservative recall", () => {
    expect(engineModeFor("some-new-provider")).toBe("recall");
  });

  it("covers every routed provider", () => {
    for (const p of Object.keys(PROVIDER_ENGINE_MODE)) {
      expect(["live_retrieval", "recall"]).toContain(engineModeFor(p));
    }
  });
});

describe("analyzeResponse", () => {
  it("detects brand mention by domain name", () => {
    const result = analyzeResponse(
      "You should check out example.com for great tools.",
      "example.com",
      [],
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.urlCited).toBe(true);
  });

  it("detects brand mention by brand name only", () => {
    const result = analyzeResponse(
      "Example is a great company with excellent tools.",
      "example.com",
      [],
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.urlCited).toBe(false);
  });

  it("returns false when brand not mentioned", () => {
    const result = analyzeResponse(
      "Here are some alternatives: toolA.io, toolB.net.",
      "example.com",
      [],
    );
    expect(result.brandMentioned).toBe(false);
    expect(result.urlCited).toBe(false);
    expect(result.citationPosition).toBe(null);
  });

  it("finds citation position", () => {
    const result = analyzeResponse(
      "Here are the top tools:\n1. toolA.io\n2. example.com\n3. toolB.net",
      "example.com",
      [],
    );
    expect(result.urlCited).toBe(true);
    expect(result.citationPosition).toBe(3); // Line 3 (after filtering)
  });

  it("detects competitor mentions", () => {
    const result = analyzeResponse(
      "Both example.com and competitor.io offer great features. Also check rival.net.",
      "example.com",
      ["competitor.io", "rival.net", "absent.org"],
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.competitorMentions).toHaveLength(3);
    expect(result.competitorMentions[0]).toEqual({
      domain: "competitor.io",
      mentioned: true,
      position: 1,
    });
    expect(result.competitorMentions[1]).toEqual({
      domain: "rival.net",
      mentioned: true,
      position: 1,
    });
    expect(result.competitorMentions[2]).toEqual({
      domain: "absent.org",
      mentioned: false,
      position: null,
    });
  });

  it("handles www prefix in domain", () => {
    const result = analyzeResponse(
      "Visit example.com for more info.",
      "www.example.com",
      [],
    );
    expect(result.brandMentioned).toBe(true);
  });

  it("handles https prefix in domain", () => {
    const result = analyzeResponse(
      "Check out example.com",
      "https://www.example.com",
      [],
    );
    expect(result.brandMentioned).toBe(true);
  });

  it("is case insensitive", () => {
    const result = analyzeResponse(
      "EXAMPLE.COM is the best tool available.",
      "example.com",
      [],
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.urlCited).toBe(true);
  });
});
