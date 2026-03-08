import type { PipelineRun } from "@/lib/api";
import { describe, expect, it } from "vitest";
import {
  PIPELINE_STEP_IDS,
  arraysEqual,
  extractFailedSteps,
  isRunSuccessful,
  normalizeKnownSkipSteps,
  normalizeUnknownSkipSteps,
  statusClasses,
} from "./automation-tab-helpers";

describe("automation-tab helpers", () => {
  it("normalizes known skip steps to unique pipeline order", () => {
    expect(
      normalizeKnownSkipSteps([
        "health_check",
        "invalid",
        "personas",
        "health_check",
      ]),
    ).toEqual(["personas", "health_check"]);
  });

  it("preserves unknown skip steps separately", () => {
    expect(
      normalizeUnknownSkipSteps(["health_check", "custom_step", 42]),
    ).toEqual(["custom_step"]);
  });

  it("compares arrays by exact ordered values", () => {
    expect(
      arraysEqual(PIPELINE_STEP_IDS.slice(0, 2), PIPELINE_STEP_IDS.slice(0, 2)),
    ).toBe(true);
    expect(
      arraysEqual(["personas", "keywords"], ["keywords", "personas"]),
    ).toBe(false);
  });

  it("maps run statuses to badge classes", () => {
    expect(statusClasses("completed")).toBe("bg-green-100 text-green-800");
    expect(statusClasses("running")).toBe("bg-blue-100 text-blue-800");
    expect(statusClasses("failed")).toBe("bg-red-100 text-red-800");
    expect(statusClasses("paused")).toBe("bg-amber-100 text-amber-800");
    expect(statusClasses("pending")).toBe("bg-muted text-muted-foreground");
  });

  it("extracts failed step details and success semantics", () => {
    const failedRun = {
      status: "completed",
      stepResults: {
        personas: { status: "completed" },
        keywords: { status: "failed", error: "Keyword generation timed out" },
        action_report: { status: "failed" },
      },
    } as PipelineRun;

    expect(extractFailedSteps(failedRun)).toEqual([
      { step: "keywords", error: "Keyword generation timed out" },
      { step: "action_report", error: "Step failed without details" },
    ]);
    expect(isRunSuccessful(failedRun)).toBe(false);

    expect(
      isRunSuccessful({ status: "completed", stepResults: {} } as PipelineRun),
    ).toBe(true);
    expect(
      extractFailedSteps({
        status: "failed",
        stepResults: null,
      } as unknown as PipelineRun),
    ).toEqual([]);
  });
});
