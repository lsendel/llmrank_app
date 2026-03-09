import { describe, expect, it } from "vitest";
import {
  formatPlanName,
  getClearHistoryLabel,
  showDigestDaySelect,
  validateWebhookUrl,
} from "./general-section-helpers";

describe("general section helpers", () => {
  it("formats plan names with a free fallback", () => {
    expect(formatPlanName(undefined)).toBe("Free");
    expect(formatPlanName(null)).toBe("Free");
    expect(formatPlanName("pro")).toBe("Pro");
  });

  it("validates webhook URLs", () => {
    expect(validateWebhookUrl("")).toBeNull();
    expect(validateWebhookUrl("https://hooks.example.com/123")).toBeNull();
    expect(validateWebhookUrl("http://hooks.example.com/123")).toBe(
      "URL must use HTTPS",
    );
    expect(validateWebhookUrl("not-a-url")).toBe("Invalid URL format");
  });

  it("derives digest and clear-history display state", () => {
    expect(
      showDigestDaySelect({
        digestFrequency: "weekly",
        digestDay: 1,
        lastDigestSentAt: null,
      }),
    ).toBe(true);
    expect(
      showDigestDaySelect({
        digestFrequency: "monthly",
        digestDay: 1,
        lastDigestSentAt: null,
      }),
    ).toBe(false);
    expect(getClearHistoryLabel("all", [])).toBe("all projects");
    expect(
      getClearHistoryLabel("proj-1", [
        { id: "proj-1", name: "Marketing Site" },
      ]),
    ).toBe("Marketing Site");
  });
});
