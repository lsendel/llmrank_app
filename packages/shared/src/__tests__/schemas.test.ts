import { describe, it, expect } from "vitest";
import {
  CreateProjectSchema,
  CrawlJobPayloadSchema,
  CrawlResultBatchSchema,
  PageScoreSchema,
} from "../index";

describe("CreateProjectSchema", () => {
  it("accepts valid project with domain auto-prefix", () => {
    const result = CreateProjectSchema.parse({
      name: "My Site",
      domain: "example.com",
    });
    expect(result.domain).toBe("https://example.com");
  });

  it("accepts domain with https", () => {
    const result = CreateProjectSchema.parse({
      name: "My Site",
      domain: "https://example.com",
    });
    expect(result.domain).toBe("https://example.com");
  });

  it("rejects empty name", () => {
    expect(() =>
      CreateProjectSchema.parse({ name: "", domain: "example.com" })
    ).toThrow();
  });
});

describe("PageScoreSchema", () => {
  it("accepts valid score", () => {
    const result = PageScoreSchema.parse({
      overall_score: 85,
      technical_score: 90,
      content_score: 80,
      ai_readiness_score: 85,
      performance_score: 75,
      letter_grade: "B",
    });
    expect(result.letter_grade).toBe("B");
  });

  it("rejects score > 100", () => {
    expect(() =>
      PageScoreSchema.parse({
        overall_score: 101,
        technical_score: 90,
        content_score: 80,
        ai_readiness_score: 85,
        performance_score: 75,
        letter_grade: "A",
      })
    ).toThrow();
  });
});
