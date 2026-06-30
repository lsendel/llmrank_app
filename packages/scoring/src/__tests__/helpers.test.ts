import { describe, it, expect } from "vitest";
import {
  deduct,
  isAuthoritativeUrl,
  type ScoreState,
} from "../factors/helpers";

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

  it("uses scoreImpact from definition when amount is omitted", () => {
    const state = freshState(100);
    deduct(state, "MISSING_TITLE");
    expect(state.score).toBe(85); // scoreImpact is -15
    expect(state.issues).toHaveLength(1);
  });

  it("accepts data as second positional arg when amount is omitted", () => {
    const state = freshState(100);
    deduct(state, "MISSING_TITLE", { titleLength: 0 });
    expect(state.score).toBe(85);
    expect(state.issues[0].data).toEqual({ titleLength: 0 });
  });

  it("attaches optional data to the issue", () => {
    const state = freshState(100);
    deduct(state, "MISSING_ALT_TEXT", -3, { imageCount: 5 });
    expect(state.issues[0].data).toEqual({ imageCount: 5 });
  });
});

describe("isAuthoritativeUrl", () => {
  it("accepts authoritative gTLDs by parsed hostname", () => {
    expect(isAuthoritativeUrl("https://www.nih.gov/study")).toBe(true);
    expect(isAuthoritativeUrl("https://harvard.edu")).toBe(true);
    expect(isAuthoritativeUrl("https://wikipedia.org/wiki/X")).toBe(true);
    expect(isAuthoritativeUrl("https://army.mil")).toBe(true);
  });

  it("accepts ccTLD government/academic second levels", () => {
    expect(isAuthoritativeUrl("https://www.nhs.gov.uk/guidance")).toBe(true);
    expect(isAuthoritativeUrl("https://ox.ac.uk")).toBe(true);
    expect(isAuthoritativeUrl("https://anu.edu.au")).toBe(true);
  });

  it("does NOT match the authoritative TLD as a substring of the path", () => {
    expect(isAuthoritativeUrl("https://shop.com/blog/best.organic-foods")).toBe(
      false,
    );
    expect(isAuthoritativeUrl("https://news.com/category/.org-charts")).toBe(
      false,
    );
    expect(isAuthoritativeUrl("https://example.com")).toBe(false);
  });

  it("does NOT accept commercial domains whose first label is gov/edu/ac", () => {
    expect(isAuthoritativeUrl("https://gov.com")).toBe(false);
    expect(isAuthoritativeUrl("https://gov.io")).toBe(false);
    expect(isAuthoritativeUrl("https://edu.io")).toBe(false);
    expect(isAuthoritativeUrl("https://myac.io")).toBe(false);
  });

  it("handles an FQDN trailing dot and rejects malformed input", () => {
    expect(isAuthoritativeUrl("https://example.org.")).toBe(true);
    expect(isAuthoritativeUrl("/relative/path")).toBe(false);
    expect(isAuthoritativeUrl("not a url")).toBe(false);
  });
});
