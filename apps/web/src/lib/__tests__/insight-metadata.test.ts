import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confidenceFromPageSample,
  confidenceFromRecommendation,
  confidenceFromVisibilityCoverage,
  relativeTimeLabel,
} from "../insight-metadata";

describe("relativeTimeLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns Unknown for null or invalid values", () => {
    expect(relativeTimeLabel(null)).toBe("Unknown");
    expect(relativeTimeLabel("not-a-date")).toBe("Unknown");
  });

  it("returns Just now for very recent timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T12:00:30Z"));
    expect(relativeTimeLabel("2026-02-27T12:00:00Z")).toBe("Just now");
  });

  it("returns minute, hour, and day labels", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T12:30:00Z"));
    expect(relativeTimeLabel("2026-02-27T12:20:00Z")).toBe("10m ago");

    vi.setSystemTime(new Date("2026-02-27T15:00:00Z"));
    expect(relativeTimeLabel("2026-02-27T12:00:00Z")).toBe("3h ago");

    vi.setSystemTime(new Date("2026-03-03T12:00:00Z"));
    expect(relativeTimeLabel("2026-02-27T12:00:00Z")).toBe("4d ago");
  });
});

describe("confidenceFromPageSample", () => {
  it("maps page sample counts to confidence bands", () => {
    expect(confidenceFromPageSample(80)).toEqual({
      label: "High",
      variant: "success",
    });
    expect(confidenceFromPageSample(30)).toEqual({
      label: "Medium",
      variant: "warning",
    });
    expect(confidenceFromPageSample(10)).toEqual({
      label: "Low",
      variant: "destructive",
    });
  });
});

describe("confidenceFromVisibilityCoverage", () => {
  it("maps checks/provider/query coverage to confidence bands", () => {
    expect(confidenceFromVisibilityCoverage(40, 5, 7)).toEqual({
      label: "High",
      variant: "success",
    });
    expect(confidenceFromVisibilityCoverage(16, 3, 3)).toEqual({
      label: "Medium",
      variant: "warning",
    });
    expect(confidenceFromVisibilityCoverage(5, 2, 2)).toEqual({
      label: "Low",
      variant: "destructive",
    });
  });
});

describe("confidenceFromRecommendation", () => {
  it("returns high confidence for broad, high-impact critical actions", () => {
    expect(
      confidenceFromRecommendation({
        severity: "critical",
        scoreImpact: 14,
        affectedPages: 12,
        totalPages: 20,
      }),
    ).toEqual({ label: "High", variant: "success" });
  });

  it("returns medium confidence for moderate-signal actions", () => {
    expect(
      confidenceFromRecommendation({
        severity: "warning",
        scoreImpact: 6,
        affectedPages: 3,
        totalPages: 25,
      }),
    ).toEqual({ label: "Medium", variant: "warning" });
  });

  it("returns low confidence for weak-signal actions", () => {
    expect(
      confidenceFromRecommendation({
        severity: "info",
        scoreImpact: 1,
        affectedPages: 1,
        totalPages: 120,
      }),
    ).toEqual({ label: "Low", variant: "destructive" });
  });
});
