import { describe, it, expect } from "vitest";
import { computeIssueCodeDeltas } from "./issue-code-breakdown-helpers";
import type { IssueCodeCount } from "@/lib/api";

function count(
  code: string,
  n: number,
  severity = "warning",
  category = "content",
): IssueCodeCount {
  return { code, category, severity, count: n };
}

describe("computeIssueCodeDeltas", () => {
  it("diffs counts for codes present in both crawls", () => {
    const rows = computeIssueCodeDeltas(
      [count("THIN_CONTENT", 106)],
      [count("THIN_CONTENT", 46)],
    );

    expect(rows).toEqual([
      {
        code: "THIN_CONTENT",
        category: "content",
        severity: "warning",
        previous: 106,
        current: 46,
        delta: -60,
      },
    ]);
  });

  it("keeps codes that only appear in one crawl (missing side = 0)", () => {
    const rows = computeIssueCodeDeltas(
      [count("RESOLVED_CODE", 10)],
      [count("NEW_CODE", 4)],
    );

    const resolved = rows.find((r) => r.code === "RESOLVED_CODE");
    const fresh = rows.find((r) => r.code === "NEW_CODE");
    expect(resolved).toMatchObject({ previous: 10, current: 0, delta: -10 });
    expect(fresh).toMatchObject({ previous: 0, current: 4, delta: 4 });
  });

  it("sorts by |delta| desc, then current count desc", () => {
    const rows = computeIssueCodeDeltas(
      [count("SMALL_MOVE", 10), count("BIG_MOVE", 100), count("FLAT_BIG", 50)],
      [count("SMALL_MOVE", 8), count("BIG_MOVE", 20), count("FLAT_BIG", 50)],
    );

    expect(rows.map((r) => r.code)).toEqual([
      "BIG_MOVE", // |delta| 80
      "SMALL_MOVE", // |delta| 2
      "FLAT_BIG", // |delta| 0
    ]);
  });

  it("merges duplicate code rows (e.g. same code under two severities)", () => {
    const rows = computeIssueCodeDeltas(
      [count("DUP", 5, "warning"), count("DUP", 3, "critical")],
      [count("DUP", 2, "critical")],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ previous: 8, current: 2, delta: -6 });
    // Classification follows the current crawl
    expect(rows[0].severity).toBe("critical");
  });

  it("returns empty for two empty crawls", () => {
    expect(computeIssueCodeDeltas([], [])).toEqual([]);
  });
});
