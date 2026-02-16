import { describe, it, expect } from "vitest";
import { Score } from "../../domain/score";

describe("Score", () => {
  it("stores the numeric value", () => {
    const score = new Score(85);
    expect(score.value).toBe(85);
  });

  it("rejects values below 0", () => {
    expect(() => new Score(-1)).toThrow(RangeError);
  });

  it("rejects values above 100", () => {
    expect(() => new Score(101)).toThrow(RangeError);
  });

  it("accepts boundary values 0 and 100", () => {
    expect(new Score(0).value).toBe(0);
    expect(new Score(100).value).toBe(100);
  });

  it("returns correct letter grades", () => {
    expect(new Score(95).letterGrade).toBe("A");
    expect(new Score(90).letterGrade).toBe("A");
    expect(new Score(85).letterGrade).toBe("B");
    expect(new Score(80).letterGrade).toBe("B");
    expect(new Score(75).letterGrade).toBe("C");
    expect(new Score(65).letterGrade).toBe("D");
    expect(new Score(50).letterGrade).toBe("F");
  });

  it("isPassingGrade for scores >= 60", () => {
    expect(new Score(60).isPassingGrade).toBe(true);
    expect(new Score(59).isPassingGrade).toBe(false);
  });
});
