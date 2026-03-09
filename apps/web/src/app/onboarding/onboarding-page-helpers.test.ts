import { describe, expect, it } from "vitest";
import {
  ONBOARDING_CRAWL_SCHEDULE_OPTIONS,
  ONBOARDING_SCORE_BREAKDOWN_LABELS,
  ONBOARDING_TEAM_SIZE_OPTIONS,
  ONBOARDING_TIPS,
  ONBOARDING_WORK_STYLE_OPTIONS,
  getOnboardingStepTitle,
} from "./onboarding-page-helpers";

describe("onboarding page helpers", () => {
  it("exposes the onboarding option sets used by the route sections", () => {
    expect(ONBOARDING_TIPS).toHaveLength(5);
    expect(ONBOARDING_WORK_STYLE_OPTIONS.map((option) => option.value)).toEqual(
      ["client_reporting", "own_site_optimization", "technical_audit"],
    );
    expect(ONBOARDING_TEAM_SIZE_OPTIONS.map((option) => option.value)).toEqual([
      "solo",
      "small_team",
      "large_team",
    ]);
    expect(
      ONBOARDING_CRAWL_SCHEDULE_OPTIONS.map((option) => option.value),
    ).toEqual(["weekly", "manual"]);
    expect(ONBOARDING_SCORE_BREAKDOWN_LABELS.map((item) => item.key)).toEqual([
      "technical",
      "content",
      "aiReadiness",
      "performance",
    ]);
  });

  it("derives the step-three title from crawl status", () => {
    expect(getOnboardingStepTitle(null)).toBe("Scanning your site...");
    expect(getOnboardingStepTitle({ status: "complete" } as never)).toBe(
      "Your AI-Readiness Score",
    );
    expect(getOnboardingStepTitle({ status: "failed" } as never)).toBe(
      "Scan Failed",
    );
    expect(getOnboardingStepTitle({ status: "crawling" } as never)).toBe(
      "Scanning your site...",
    );
  });
});
