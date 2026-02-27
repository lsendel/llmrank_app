import { describe, it, expect } from "vitest";
import { diffBenchmarks } from "../../services/competitor-diff-service";

const baseBenchmark = {
  overallScore: 75,
  technicalScore: 80,
  contentScore: 70,
  aiReadinessScore: 65,
  performanceScore: 85,
  llmsTxtScore: 0,
  robotsTxtScore: 50,
  sitemapScore: 80,
  schemaMarkupScore: 60,
  botAccessScore: 0,
};

describe("diffBenchmarks", () => {
  it("returns empty array when no previous benchmark", () => {
    expect(diffBenchmarks("example.com", null, baseBenchmark)).toEqual([]);
  });

  it("returns empty array when scores unchanged", () => {
    expect(diffBenchmarks("example.com", baseBenchmark, baseBenchmark)).toEqual(
      [],
    );
  });

  it("detects overall score regression (> 10 points)", () => {
    const current = { ...baseBenchmark, overallScore: 60 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    const regression = events.find((e) => e.eventType === "score_regression");
    expect(regression).toBeDefined();
    expect(regression!.severity).toBe("warning");
    expect(regression!.data.delta).toBe(-15);
  });

  it("detects overall score improvement (> 10 points)", () => {
    const current = { ...baseBenchmark, overallScore: 90 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    const improvement = events.find((e) => e.eventType === "score_improvement");
    expect(improvement).toBeDefined();
    expect(improvement!.severity).toBe("info");
    expect(improvement!.data.delta).toBe(15);
  });

  it("ignores small overall score changes (< 10 points)", () => {
    const current = { ...baseBenchmark, overallScore: 78 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    expect(
      events.find((e) => e.eventType === "score_regression"),
    ).toBeUndefined();
    expect(
      events.find((e) => e.eventType === "score_improvement"),
    ).toBeUndefined();
  });

  it("detects per-category score change (>= 5 points)", () => {
    const current = { ...baseBenchmark, technicalScore: 72 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    const change = events.find((e) => e.eventType === "score_change");
    expect(change).toBeDefined();
    expect(change!.data.category).toBe("technicalScore");
  });

  it("ignores per-category change < 5 points", () => {
    const current = { ...baseBenchmark, contentScore: 72 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    expect(events.find((e) => e.eventType === "score_change")).toBeUndefined();
  });

  it("detects llms.txt added (critical)", () => {
    const current = { ...baseBenchmark, llmsTxtScore: 85 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    const added = events.find((e) => e.eventType === "llms_txt_added");
    expect(added).toBeDefined();
    expect(added!.severity).toBe("critical");
  });

  it("detects llms.txt removed (info)", () => {
    const previous = { ...baseBenchmark, llmsTxtScore: 85 };
    const current = { ...baseBenchmark, llmsTxtScore: 0 };
    const events = diffBenchmarks("example.com", previous, current);
    const removed = events.find((e) => e.eventType === "llms_txt_removed");
    expect(removed).toBeDefined();
    expect(removed!.severity).toBe("info");
  });

  it("detects AI crawlers unblocked (critical)", () => {
    const current = { ...baseBenchmark, botAccessScore: 90 };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    const unblocked = events.find(
      (e) => e.eventType === "ai_crawlers_unblocked",
    );
    expect(unblocked).toBeDefined();
    expect(unblocked!.severity).toBe("critical");
  });

  it("detects AI crawlers blocked (warning)", () => {
    const previous = { ...baseBenchmark, botAccessScore: 90 };
    const current = { ...baseBenchmark, botAccessScore: 0 };
    const events = diffBenchmarks("example.com", previous, current);
    const blocked = events.find((e) => e.eventType === "ai_crawlers_blocked");
    expect(blocked).toBeDefined();
    expect(blocked!.severity).toBe("warning");
  });

  it("detects schema markup added", () => {
    const previous = { ...baseBenchmark, schemaMarkupScore: 0 };
    const current = { ...baseBenchmark, schemaMarkupScore: 70 };
    const events = diffBenchmarks("example.com", previous, current);
    expect(events.find((e) => e.eventType === "schema_added")).toBeDefined();
  });

  it("detects sitemap changes", () => {
    const previous = { ...baseBenchmark, sitemapScore: 0 };
    const current = { ...baseBenchmark, sitemapScore: 90 };
    const events = diffBenchmarks("example.com", previous, current);
    expect(events.find((e) => e.eventType === "sitemap_added")).toBeDefined();
  });

  it("detects multiple events simultaneously", () => {
    const current = {
      ...baseBenchmark,
      overallScore: 50, // -25 regression
      llmsTxtScore: 85, // added
      botAccessScore: 90, // unblocked
    };
    const events = diffBenchmarks("example.com", baseBenchmark, current);
    expect(events.length).toBeGreaterThanOrEqual(3);
  });
});
