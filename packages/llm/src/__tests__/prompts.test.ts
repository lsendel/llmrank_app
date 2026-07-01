import { describe, it, expect } from "vitest";
import { buildContentScoringPrompt } from "../prompts";

describe("buildContentScoringPrompt", () => {
  it("includes all 5 scoring dimensions in the prompt", () => {
    const prompt = buildContentScoringPrompt("Some sample page text.");

    expect(prompt.system).toContain("Clarity");
    expect(prompt.system).toContain("Authority");
    expect(prompt.system).toContain("Comprehensiveness");
    expect(prompt.system).toContain("Structure");
    expect(prompt.system).toContain("Citation Worthiness");
  });

  it("includes the scoring rubric with ranges for each dimension", () => {
    const prompt = buildContentScoringPrompt("Some sample page text.");

    // Each dimension should have rubric ranges
    expect(prompt.system).toContain("90-100");
    expect(prompt.system).toContain("70-89");
    expect(prompt.system).toContain("50-69");
    expect(prompt.system).toContain("30-49");
    expect(prompt.system).toContain("0-29");
  });

  it("requests JSON output format with the 5 score fields", () => {
    const prompt = buildContentScoringPrompt("Some sample page text.");

    expect(prompt.system).toContain("JSON");
    expect(prompt.system).toContain("clarity");
    expect(prompt.system).toContain("authority");
    expect(prompt.system).toContain("comprehensiveness");
    expect(prompt.system).toContain("structure");
    expect(prompt.system).toContain("citation_worthiness");
  });

  it("includes the page text in the prompt", () => {
    const pageText = "This is a unique page text for testing purposes.";
    const prompt = buildContentScoringPrompt(pageText);

    expect(prompt.user).toContain(pageText);
  });

  it("truncates text longer than 2500 words", () => {
    // Generate text with 3500 words
    const words = Array.from({ length: 3500 }, (_, i) => `word${i}`);
    const longText = words.join(" ");
    const prompt = buildContentScoringPrompt(longText);

    // The prompt should contain the first 2500 words but not word2500 (0-indexed)
    expect(prompt.user).toContain("word0");
    expect(prompt.user).toContain("word2499");
    expect(prompt.user).not.toContain("word2500");
    expect(prompt.user).not.toContain("word3499");
  });

  it("does not truncate text with exactly 2500 words", () => {
    const words = Array.from({ length: 2500 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const prompt = buildContentScoringPrompt(text);

    expect(prompt.user).toContain("word0");
    expect(prompt.user).toContain("word2499");
  });

  it("does not truncate text shorter than 2500 words", () => {
    const words = Array.from({ length: 100 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const prompt = buildContentScoringPrompt(text);

    expect(prompt.user).toContain("word0");
    expect(prompt.user).toContain("word99");
  });
});
