import { describe, it, expect } from "vitest";
import { buildContentScoringPrompt } from "../prompts";

describe("buildContentScoringPrompt", () => {
  it("includes all 5 scoring dimensions in the prompt", () => {
    const prompt = buildContentScoringPrompt("Some sample page text.");

    expect(prompt).toContain("Clarity");
    expect(prompt).toContain("Authority");
    expect(prompt).toContain("Comprehensiveness");
    expect(prompt).toContain("Structure");
    expect(prompt).toContain("Citation Worthiness");
  });

  it("includes the scoring rubric with ranges for each dimension", () => {
    const prompt = buildContentScoringPrompt("Some sample page text.");

    // Each dimension should have rubric ranges
    expect(prompt).toContain("90-100");
    expect(prompt).toContain("70-89");
    expect(prompt).toContain("50-69");
    expect(prompt).toContain("30-49");
    expect(prompt).toContain("0-29");
  });

  it("requests JSON output format with the 5 score fields", () => {
    const prompt = buildContentScoringPrompt("Some sample page text.");

    expect(prompt).toContain("JSON");
    expect(prompt).toContain("clarity");
    expect(prompt).toContain("authority");
    expect(prompt).toContain("comprehensiveness");
    expect(prompt).toContain("structure");
    expect(prompt).toContain("citation_worthiness");
  });

  it("includes the page text in the prompt", () => {
    const pageText = "This is a unique page text for testing purposes.";
    const prompt = buildContentScoringPrompt(pageText);

    expect(prompt).toContain(pageText);
  });

  it("truncates text longer than 4000 words", () => {
    // Generate text with 5000 words
    const words = Array.from({ length: 5000 }, (_, i) => `word${i}`);
    const longText = words.join(" ");
    const prompt = buildContentScoringPrompt(longText);

    // The prompt should contain the first 4000 words but not word4000 (0-indexed)
    expect(prompt).toContain("word0");
    expect(prompt).toContain("word3999");
    expect(prompt).not.toContain("word4000");
    expect(prompt).not.toContain("word4999");
  });

  it("does not truncate text with exactly 4000 words", () => {
    const words = Array.from({ length: 4000 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const prompt = buildContentScoringPrompt(text);

    expect(prompt).toContain("word0");
    expect(prompt).toContain("word3999");
  });

  it("does not truncate text shorter than 4000 words", () => {
    const words = Array.from({ length: 100 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const prompt = buildContentScoringPrompt(text);

    expect(prompt).toContain("word0");
    expect(prompt).toContain("word99");
  });
});
