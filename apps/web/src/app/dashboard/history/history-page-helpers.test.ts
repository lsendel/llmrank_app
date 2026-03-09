import { describe, expect, it } from "vitest";
import {
  getHistoryScoreClassName,
  getHistoryStatusVariant,
  getHistoryWorkflowContent,
} from "./history-page-helpers";

describe("history page helpers", () => {
  it("returns the correct workflow content for free and paid plans", () => {
    expect(
      getHistoryWorkflowContent(true).actions.map((action) => action.label),
    ).toEqual(["View Plans"]);
    expect(
      getHistoryWorkflowContent(false).actions.map((action) => action.label),
    ).toEqual(["Open Projects", "New Project"]);
  });

  it("maps crawl statuses and grades to display styles", () => {
    expect(getHistoryStatusVariant("complete")).toBe("default");
    expect(getHistoryStatusVariant("failed")).toBe("destructive");
    expect(getHistoryStatusVariant("pending")).toBe("secondary");

    expect(getHistoryScoreClassName("A")).toBe("text-green-500");
    expect(getHistoryScoreClassName("B")).toBe("text-blue-500");
    expect(getHistoryScoreClassName("C")).toBe("text-yellow-500");
    expect(getHistoryScoreClassName(null)).toBe("text-red-500");
  });
});
