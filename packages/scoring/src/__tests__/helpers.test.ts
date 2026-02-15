import { describe, it, expect } from "vitest";
import { deduct, type ScoreState } from "../factors/helpers";

function freshState(score = 100): ScoreState {
  return { score, issues: [] };
}

describe("deduct", () => {
  it("applies a negative penalty and records the issue", () => {
    const state = freshState(100);
    deduct(state, "MISSING_TITLE", -15);
    expect(state.score).toBe(85);
    expect(state.issues).toHaveLength(1);
    expect(state.issues[0].code).toBe("MISSING_TITLE");
    expect(state.issues[0].category).toBe("technical");
    expect(state.issues[0].severity).toBe("critical");
  });

  it("does not reduce score below 0", () => {
    const state = freshState(10);
    deduct(state, "HTTP_STATUS", -25);
    expect(state.score).toBe(0);
  });

  it("does nothing for unknown issue codes", () => {
    const state = freshState(100);
    deduct(state, "TOTALLY_UNKNOWN_CODE", -50);
    expect(state.score).toBe(100);
    expect(state.issues).toHaveLength(0);
  });

  it("attaches optional data to the issue", () => {
    const state = freshState(100);
    deduct(state, "MISSING_ALT_TEXT", -3, { imageCount: 5 });
    expect(state.issues[0].data).toEqual({ imageCount: 5 });
  });
});
