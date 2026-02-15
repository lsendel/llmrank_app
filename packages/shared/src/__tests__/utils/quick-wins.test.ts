import { describe, it, expect } from "vitest";
import { getQuickWins } from "../../utils/quick-wins";

// Helper to create issue instances matching known ISSUE_DEFINITIONS codes
function makeIssue(
  code: string,
  overrides?: Partial<{
    category: string;
    severity: string;
    message: string;
    recommendation: string | null;
  }>,
) {
  return {
    code,
    category: overrides?.category ?? "technical",
    severity: overrides?.severity ?? "warning",
    message: overrides?.message ?? `Issue: ${code}`,
    recommendation: overrides?.recommendation ?? null,
  };
}

describe("getQuickWins", () => {
  it("returns quick wins sorted by priority (impact * severity / effort)", () => {
    const issues = [
      makeIssue("MISSING_META_DESC"), // -10, warning(2), low(1) => priority=20
      makeIssue("MISSING_TITLE"), // -15, critical(3), low(1) => priority=45
      makeIssue("MISSING_H1"), // -8, warning(2), low(1) => priority=16
    ];

    const wins = getQuickWins(issues);
    expect(wins.length).toBeGreaterThanOrEqual(3);
    // MISSING_TITLE should come first (highest priority)
    expect(wins[0].code).toBe("MISSING_TITLE");
    expect(wins[1].code).toBe("MISSING_META_DESC");
    expect(wins[2].code).toBe("MISSING_H1");
  });

  it("respects the limit parameter", () => {
    const issues = [
      makeIssue("MISSING_TITLE"),
      makeIssue("MISSING_META_DESC"),
      makeIssue("MISSING_H1"),
      makeIssue("NOINDEX_SET"),
      makeIssue("HTTP_STATUS"),
      makeIssue("MISSING_CANONICAL"),
    ];

    const wins = getQuickWins(issues, 2);
    expect(wins).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    const wins = getQuickWins([]);
    expect(wins).toEqual([]);
  });

  it("counts affected pages correctly for duplicate issue codes", () => {
    const issues = [
      makeIssue("MISSING_TITLE"),
      makeIssue("MISSING_TITLE"),
      makeIssue("MISSING_TITLE"),
    ];

    const wins = getQuickWins(issues);
    const titleWin = wins.find((w) => w.code === "MISSING_TITLE");
    expect(titleWin).toBeDefined();
    expect(titleWin!.affectedPages).toBe(3);
  });

  it("skips issues with unknown codes", () => {
    const issues = [makeIssue("TOTALLY_FAKE_CODE"), makeIssue("MISSING_TITLE")];

    const wins = getQuickWins(issues);
    expect(wins.every((w) => w.code !== "TOTALLY_FAKE_CODE")).toBe(true);
  });
});
