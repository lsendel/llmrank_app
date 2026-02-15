import { describe, it, expect } from "vitest";
import {
  letterGrade,
  averageScores,
  aggregatePageScores,
} from "../../utils/scoring";

describe("letterGrade", () => {
  it("returns A for scores >= 90", () => {
    expect(letterGrade(90)).toBe("A");
    expect(letterGrade(95)).toBe("A");
    expect(letterGrade(100)).toBe("A");
  });

  it("returns B for scores 80-89", () => {
    expect(letterGrade(80)).toBe("B");
    expect(letterGrade(89)).toBe("B");
  });

  it("returns C for scores 70-79", () => {
    expect(letterGrade(70)).toBe("C");
    expect(letterGrade(79)).toBe("C");
  });

  it("returns D for scores 60-69", () => {
    expect(letterGrade(60)).toBe("D");
    expect(letterGrade(69)).toBe("D");
  });

  it("returns F for scores below 60", () => {
    expect(letterGrade(59)).toBe("F");
    expect(letterGrade(0)).toBe("F");
    expect(letterGrade(30)).toBe("F");
  });
});

describe("averageScores", () => {
  it("averages valid numbers and rounds to nearest integer", () => {
    expect(averageScores([80, 90, 70])).toBe(80);
    expect(averageScores([85, 90])).toBe(88); // 87.5 rounds to 88
  });

  it("ignores null and undefined values", () => {
    expect(averageScores([80, null, 90, undefined])).toBe(85);
  });

  it("returns 0 for empty array", () => {
    expect(averageScores([])).toBe(0);
  });

  it("returns 0 when all values are null", () => {
    expect(averageScores([null, null, undefined])).toBe(0);
  });

  it("handles single value", () => {
    expect(averageScores([75])).toBe(75);
  });
});

describe("aggregatePageScores", () => {
  it("aggregates multiple page scores with letter grade", () => {
    const rows = [
      {
        overallScore: 80,
        technicalScore: 85,
        contentScore: 75,
        aiReadinessScore: 70,
        detail: { performanceScore: 90 },
      },
      {
        overallScore: 90,
        technicalScore: 95,
        contentScore: 85,
        aiReadinessScore: 80,
        detail: { performanceScore: 80 },
      },
    ];

    const result = aggregatePageScores(rows);
    expect(result.overallScore).toBe(85);
    expect(result.letterGrade).toBe("B");
    expect(result.scores.technical).toBe(90);
    expect(result.scores.content).toBe(80);
    expect(result.scores.aiReadiness).toBe(75);
    expect(result.scores.performance).toBe(85);
  });

  it("handles rows with null scores", () => {
    const rows = [
      {
        overallScore: null,
        technicalScore: 80,
        contentScore: null,
        aiReadinessScore: 70,
      },
      {
        overallScore: 90,
        technicalScore: null,
        contentScore: 85,
        aiReadinessScore: null,
      },
    ];

    const result = aggregatePageScores(rows);
    expect(result.overallScore).toBe(90);
    expect(result.scores.technical).toBe(80);
    expect(result.scores.content).toBe(85);
    expect(result.scores.aiReadiness).toBe(70);
  });

  it("returns zero scores for empty input", () => {
    const result = aggregatePageScores([]);
    expect(result.overallScore).toBe(0);
    expect(result.letterGrade).toBe("F");
    expect(result.scores.technical).toBe(0);
    expect(result.scores.performance).toBe(0);
  });
});
